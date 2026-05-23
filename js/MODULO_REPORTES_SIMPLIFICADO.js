// ══════════════════════════════════════════════════════════════════════════════════════
// MÓDULO: REPORTES DE VENTAS (VERSIÓN SIMPLIFICADA - Solo facturas_diaz)
// Funciona con la estructura ACTUAL de tu BD sin necesidad de tabla pagos_facturas
// ══════════════════════════════════════════════════════════════════════════════════════

let REPORTES_DATA = { facturas: [], vendedores: [], categorias: [] };

async function loadReportesVentas() {
  toast('Cargando reportes...', 'ok');
  try {
    // CARGAR SOLO DE facturas_diaz (sin LEFT JOIN)
    const { data: facturas, error } = await db.from('facturas_diaz')
      .select('*')
      .order('fecha_factura', { ascending: false });
    
    if (error) {
      console.error('Error SQL:', error);
      throw error;
    }
    
    // Extraer vendedores y categorías únicas
    const vendedores = [...new Set((facturas || []).map(f => f.vendedor).filter(v => v && v !== 'Sin asignar'))];
    const categorias = [...new Set((facturas || []).map(f => f.programa_servicio).filter(c => c))];
    
    REPORTES_DATA = { 
      facturas: facturas || [],
      vendedores, 
      categorias
    };
    
    // Llenar selects
    const selVendedor = $('reportes-vendedor');
    const selCategoria = $('reportes-categoria');
    
    if (selVendedor) {
      selVendedor.innerHTML = '<option value="">Todos</option>' + 
        vendedores.map(v => `<option value="${v}">${v}</option>`).join('');
    }
    if (selCategoria) {
      selCategoria.innerHTML = '<option value="">Todos</option>' + 
        categorias.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    
    renderReportesVentas();
    toast('Reportes cargados ✓', 'ok');
  } catch(e) {
    console.error('Error cargando reportes:', e);
    toast('Error: ' + e.message, 'd');
  }
}

function renderReportesVentas() {
  const agrupacion = $('reportes-agrupacion')?.value || 'año';
  const año = $('reportes-año')?.value || '';
  const mes = $('reportes-mes')?.value || '';
  const vendedor = $('reportes-vendedor')?.value || '';
  const programa = $('reportes-categoria')?.value || '';
  
  // Filtrar facturas
  let filtered = REPORTES_DATA.facturas.filter(f => {
    const fAño = f.fecha_factura ? f.fecha_factura.substring(0, 4) : '';
    const fMes = f.fecha_factura ? f.fecha_factura.substring(5, 7) : '';
    
    if (año && fAño !== año) return false;
    if (mes && fMes !== mes) return false;
    if (vendedor && f.vendedor !== vendedor) return false;
    if (programa && f.programa_servicio !== programa) return false;
    return true;
  });
  
  // Agrupar y calcular
  let grupos = agruparFacturas(filtered, agrupacion);
  
  // Renderizar
  renderTablaResumen(grupos, agrupacion);
  renderFacturasDetalle(filtered);
  renderTotalesGenerales(filtered);
}

function agruparFacturas(facturas, agrupacion) {
  const grupos = {};
  
  facturas.forEach(f => {
    let clave = '';
    
    switch(agrupacion) {
      case 'año':
        clave = f.fecha_factura ? f.fecha_factura.substring(0, 4) : 'Sin fecha';
        break;
      case 'mes':
        if (f.fecha_factura) {
          const año = f.fecha_factura.substring(0, 4);
          const mesNum = f.fecha_factura.substring(5, 7);
          const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          clave = meses[parseInt(mesNum)] + ' ' + año;
        }
        break;
      case 'vendedor':
        clave = f.vendedor || 'Sin asignar';
        break;
      case 'programa':
        clave = f.programa_servicio || 'Sin programa';
        break;
      case 'año-mes':
        if (f.fecha_factura) {
          const año = f.fecha_factura.substring(0, 4);
          const mes = f.fecha_factura.substring(5, 7);
          clave = año + '-' + mes;
        }
        break;
    }
    
    if (!grupos[clave]) {
      grupos[clave] = { 
        clave, 
        facturas: [], 
        facturado: 0,
        pagadas: 0,
        pendientes: 0
      };
    }
    
    grupos[clave].facturas.push(f);
    grupos[clave].facturado += parseFloat(f.valor) || 0;
    
    // Contar como "pagada" si tiene fecha_pago_programado y ya pasó
    const hoy = new Date().toISOString().split('T')[0];
    if (f.fecha_pago_programado && f.fecha_pago_programado <= hoy) {
      grupos[clave].pagadas += 1;
    } else {
      grupos[clave].pendientes += 1;
    }
  });
  
  return Object.values(grupos).sort((a, b) => {
    if (agrupacion.includes('año') || agrupacion.includes('mes')) {
      return b.clave.localeCompare(a.clave);
    }
    return a.clave.localeCompare(b.clave);
  });
}

function renderTablaResumen(grupos, agrupacion) {
  const thead = $('reportes-table')?.querySelector('thead');
  const tbody = $('reportes-body');
  
  if (!tbody) return;
  
  const labelAgrup = agrupacion === 'programa' ? 'Programa' : 
                     agrupacion === 'año-mes' ? 'Período' :
                     agrupacion.charAt(0).toUpperCase() + agrupacion.slice(1);
  
  if (thead) {
    thead.innerHTML = `<tr>
      <th>${labelAgrup}</th>
      <th style="text-align:right">Facturas</th>
      <th style="text-align:right">Valor Total</th>
      <th style="text-align:right">Pagadas</th>
      <th style="text-align:right">Pendientes</th>
    </tr>`;
  }
  
  tbody.innerHTML = grupos.map(g => {
    const total = g.facturas.length;
    const pctPagadas = total > 0 ? ((g.pagadas / total) * 100).toFixed(0) : 0;
    
    return `<tr>
      <td><strong>${g.clave}</strong></td>
      <td style="text-align:right">${total}</td>
      <td style="text-align:right;color:#047857"><strong>${(g.facturado).toLocaleString('es-CO', {style:'currency', currency:'COP', maximumFractionDigits:0})}</strong></td>
      <td style="text-align:right;color:#00D5B0">${g.pagadas} (${pctPagadas}%)</td>
      <td style="text-align:right;color:#B91C1C">${g.pendientes}</td>
    </tr>`;
  }).join('');
}

function renderFacturasDetalle(facturas) {
  const tbody = $('reportes-facturas-body');
  const bdg = $('reportes-bdg');
  
  if (!tbody) return;
  
  if (bdg) bdg.textContent = facturas.length;
  
  const hoy = new Date().toISOString().split('T')[0];
  
  tbody.innerHTML = facturas.map(f => {
    const isPagada = f.fecha_pago_programado && f.fecha_pago_programado <= hoy;
    const estadoColor = isPagada ? '#00D5B0' : '#B91C1C';
    const estadoTexto = isPagada ? 'Por Pagar' : 'Vencida';
    
    return `<tr>
      <td>${f.numero_factura || '-'}</td>
      <td>${f.cliente_nombre || '-'}</td>
      <td>${f.vendedor || '-'}</td>
      <td>${f.programa_servicio || '-'}</td>
      <td style="text-align:right;color:#047857"><strong>${(parseFloat(f.valor)||0).toLocaleString('es-CO', {style:'currency', currency:'COP', maximumFractionDigits:0})}</strong></td>
      <td>${f.fecha_factura || '-'}</td>
      <td>${f.fecha_pago_programado || '-'}</td>
      <td><span style="background:rgba(${estadoColor === '#00D5B0' ? '0,213,176' : '185,28,28'},0.1);color:${estadoColor};padding:4px 8px;border-radius:5px;font-size:10px;font-weight:600">${f.estado || 'Emitida'}</span></td>
    </tr>`;
  }).join('');
}

function renderTotalesGenerales(facturas) {
  const container = $('reportes-totales');
  if (!container) return;
  
  const hoy = new Date().toISOString().split('T')[0];
  const totalFacturado = facturas.reduce((sum, f) => sum + (parseFloat(f.valor) || 0), 0);
  const totalPagadas = facturas.filter(f => f.fecha_pago_programado && f.fecha_pago_programado <= hoy).length;
  const totalPendientes = facturas.length - totalPagadas;
  const pctPago = facturas.length > 0 ? ((totalPagadas / facturas.length) * 100).toFixed(1) : 0;
  
  container.innerHTML = `
    <div class="stat" style="background:rgba(4,120,87,0.1);border-left:3px solid #047857">
      <div class="slabel">Facturado</div>
      <div class="svalue" style="color:#047857">${totalFacturado.toLocaleString('es-CO', {style:'currency', currency:'COP', maximumFractionDigits:0})}</div>
    </div>
    <div class="stat" style="background:rgba(0,213,176,0.1);border-left:3px solid #00D5B0">
      <div class="slabel">Por Pagar (Programadas)</div>
      <div class="svalue" style="color:#00D5B0">${totalPagadas} facturas</div>
    </div>
    <div class="stat" style="background:rgba(185,28,28,0.1);border-left:3px solid #B91C1C">
      <div class="slabel">Vencidas</div>
      <div class="svalue" style="color:#B91C1C">${totalPendientes} facturas</div>
    </div>
    <div class="stat" style="background:rgba(201,169,110,0.1);border-left:3px solid #C9A96E">
      <div class="slabel">% Vencidas / Total</div>
      <div class="svalue" style="color:#C9A96E">${((totalPendientes / facturas.length) * 100).toFixed(0)}%</div>
    </div>
  `;
}
