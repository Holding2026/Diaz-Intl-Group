async function loadNomina(empresa) {
  var slug = empresa==='tycoon'?'ty':'dz';
  var {data,error} = await db.from('nomina_pagos').select('*').eq('empresa',empresa).order('periodo_inicio',{ascending:false});
  NOMINA_DATA[empresa] = data||[];
  renderNomina(empresa);
}

function filterNomina(empresa, tipo, btn) {
  NOMINA_FILTER[empresa] = tipo;
  var slug = empresa==='tycoon'?'ty':'dz';
  var col = empresa==='tycoon'?'#DBE2E9':'#00D5B0';
  // Reset all tabs for this empresa
  var tabs = document.querySelectorAll('#tab-nomina-'+slug+' button[onclick^="filterNomina"]');
  tabs.forEach(function(b){ b.style.borderBottomColor='transparent'; b.style.color='var(--t3)'; });
  if(btn){ btn.style.borderBottomColor=col; btn.style.color=col; }
  renderNomina(empresa);
}

function renderNomina(empresa) {
  var slug = empresa==='tycoon'?'ty':'dz';
  var col  = empresa==='tycoon'?'#5B8DB8':'#00A98D';
  var rows = NOMINA_DATA[empresa];
  var filt = NOMINA_FILTER[empresa];
  if(filt!=='todos') rows = rows.filter(function(r){return r.tipo===filt;});

  var totalBruto = rows.reduce(function(a,r){return a+(r.valor_bruto||0);},0);
  var totalNeto  = rows.reduce(function(a,r){return a+(r.valor_neto||0);},0);
  var totalDed   = rows.reduce(function(a,r){return a+(r.deducciones||0);},0);
  var pend       = rows.filter(function(r){return r.estado==='Pendiente';}).length;

  var kpis = [
    ['Pagos','total en período',rows.length,'var(--t)'],
    ['Total bruto','suma bruta',fm(totalBruto),col],
    ['Total neto','efectivamente pagado',fm(totalNeto),'#00D5B0'],
    ['Pendientes','por procesar',pend,pend>0?'var(--or)':'var(--t3)']
  ].map(function(k){
    return '<div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:14px 16px;border-top:2px solid '+k[3]+'">'
      +'<div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">'+k[0]+'</div>'
      +'<div style="font-size:18px;font-weight:700;color:'+k[3]+';font-family:monospace">'+k[2]+'</div>'
      +'<div style="font-size:9px;color:var(--t3);margin-top:2px">'+k[1]+'</div></div>';
  }).join('');
  if($('nomina-'+slug+'-kpis')) $('nomina-'+slug+'-kpis').innerHTML = kpis;

  var body = $('nomina-'+slug+'-body');
  if(!body) return;
  var estCol = {Pagado:'#00A98D',Pendiente:'#d4870a',Procesando:'#5B8DB8'};
  var tipCol = {Quincenal:'#5B8DB8',Mensual:'#8B5CF6',Comision:'#e06200',Otro:'#5B6770'};

  body.innerHTML = rows.length ? rows.map(function(r){
    var ec = estCol[r.estado]||'var(--t3)';
    var tc = tipCol[r.tipo]||'var(--t3)';
    return '<tr>'
      +'<td style="font-size:11px;font-weight:600;color:var(--t)">'+(r.empleado_nombre||'—')+'</td>'
      +'<td><span style="font-size:10px;padding:2px 8px;border-radius:10px;background:'+tc+'18;color:'+tc+'">'+(r.tipo||'—')+'</span></td>'
      +'<td style="font-size:11px;color:var(--t2)">'+(r.concepto||'—')+'</td>'
      +'<td style="font-size:10px;color:var(--t3)">'+(r.periodo_inicio?fd(r.periodo_inicio):'—')+(r.periodo_fin?' → '+fd(r.periodo_fin):'')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;color:var(--t2)">'+(r.valor_bruto?fm(r.valor_bruto):'—')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;color:var(--or)">'+(r.deducciones?fm(r.deducciones):'—')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;font-weight:600;color:#00D5B0">'+(r.valor_neto?fm(r.valor_neto):'—')+'</td>'
      +'<td><span style="font-size:10px;padding:2px 8px;border-radius:10px;background:'+ec+'18;color:'+ec+'">'+(r.estado||'—')+'</span></td>'
      +(function(){
        if(!r.fecha_pago) return '<td style="font-size:10px;color:var(--t3)">—</td>';
        var mora = '';
        if(r.dias_mora!=null) {
          if(r.dias_mora>0) mora = '<br><span style="font-size:9px;color:#c0392b;font-weight:600">+'+r.dias_mora+'d mora</span>';
          else if(r.dias_mora<0) mora = '<br><span style="font-size:9px;color:#00554B">⚡'+Math.abs(r.dias_mora)+'d antes</span>';
          else mora = '<br><span style="font-size:9px;color:#00554B">✓ puntual</span>';
        }
        return '<td style="font-size:10px;color:var(--t2)">'+fd(r.fecha_pago)+mora+'</td>';
      })()
      +'<td style="white-space:nowrap">'
      +(r.contabilizado
        ? '<button onclick="descontabilizarNomina(this.dataset.id,this.dataset.emp)" data-id="'+r.id+'" data-emp="'+empresa+'" style="font-size:9px;padding:2px 7px;border-radius:5px;background:rgba(5,150,105,0.1);color:#059669;font-weight:600;border:1px solid rgba(5,150,105,0.2);cursor:pointer" title="Clic para descontabilizar">✓ Cont.</button> '
        : '<button onclick="contabilizarNomina(this.dataset.id,this.dataset.emp)" data-id="'+r.id+'" data-emp="'+empresa+'" style="font-size:9px;padding:2px 7px;border:1px solid rgba(29,78,216,0.3);border-radius:5px;background:rgba(29,78,216,0.08);color:#1D4ED8;cursor:pointer;margin-right:3px;font-weight:600" title="Contabilizar">📒</button>')
      +'<button onclick="editarPagoNomina(this.dataset.id,this.dataset.emp)" data-id="'+r.id+'" data-emp="'+empresa+'" style="font-size:9px;padding:2px 7px;border:1px solid var(--br);border-radius:5px;background:transparent;color:var(--t3);cursor:pointer;margin-right:3px" title="Editar">&#9998;</button>'
      +'<button onclick="desprendiblePago(this.dataset.id,this.dataset.emp)" data-id="'+r.id+'" data-emp="'+empresa+'" style="font-size:9px;padding:2px 7px;border:1px solid var(--br);border-radius:5px;background:transparent;color:var(--t3);cursor:pointer" title="Generar desprendible">🖨</button>'
      +'</td>'
      +'</tr>';
  }).join('') : '<tr><td colspan="10"><div class="mod-empty"><div class="mod-empty-icon">💳</div>Sin pagos registrados<br><span style="font-size:10px">Haz clic en <strong>+ Pago</strong> para registrar el primero</span></div></td></tr>';
}

// ══════════════════════════════════════════════════════════════
// CONTABILIZAR NÓMINA — Preview + generación automática de CE
// ══════════════════════════════════════════════════════════════
async function contabilizarNomina(id, empresa) {
  var {data: pago} = await db.from('nomina_pagos').select('*').eq('id', id).single();
  if (!pago) { toast('Pago no encontrado','d'); return; }
  if (pago.contabilizado) { toast('Este pago ya fue contabilizado','w'); return; }

  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var c = contabColors(empresa);
  var empLabel = empresa === 'tycoon' ? 'Tycoon Guru' : 'Díaz International';

  // Cargar datos del empleado (tipo_contrato)
  var tabla = empresa === 'tycoon' ? 'terceros_tycoon' : 'terceros_diaz';
  var {data: empData} = await db.from(tabla).select('id,nombre,tipo_contrato,cargo')
    .eq('nombre', pago.empleado_nombre).limit(1);
  var empleado = (empData && empData[0]) || {};
  var tipoContrato = (empleado.tipo_contrato || '').toLowerCase();

  // Detectar cuenta de gasto según tipo de contrato
  var cuentaGasto, cuentaGastoNombre;
  if (tipoContrato.includes('prestación') || tipoContrato.includes('prestacion') || tipoContrato.includes('servicios') || tipoContrato.includes('honorario')) {
    cuentaGasto = '5115'; cuentaGastoNombre = 'Honorarios';
  } else if (tipoContrato.includes('comisi') || tipoContrato.includes('comision')) {
    cuentaGasto = '5110'; cuentaGastoNombre = 'Comisiones pagadas (FEE)';
  } else {
    cuentaGasto = '5105'; cuentaGastoNombre = 'Sueldos y salarios';
  }

  // Cargar préstamos activos del empleado
  var {data: prestamos} = await db.from('prestamos_empleados')
    .select('*').eq('empresa', emp).eq('empleado_nombre', pago.empleado_nombre).eq('estado', 'activo');
  prestamos = prestamos || [];
  var totalDescuento = prestamos.reduce(function(s, p) { return s + (p.valor_cuota || 0); }, 0);
  // Convertir descuento a USD si la moneda del préstamo no es USD
  var totalDescuentoUSD = prestamos.reduce(function(s, p) {
    if ((p.moneda || 'USD') === 'USD') return s + (p.valor_cuota || 0);
    return s + toUSD(p.valor_cuota);
  }, 0);
  var netoFinal = netoNomina - totalDescuentoUSD;

  // Construir líneas del asiento — SIEMPRE EN USD
  var lineas = [];
  var monedaPago = (pago.moneda || 'COP').toUpperCase();
  var trm = parseFloat(pago.trm) || 1;

  // Función para convertir a USD
  function toUSD(valor) {
    if (!valor) return 0;
    if (monedaPago === 'USD') return parseFloat(valor);
    if (trm > 1) return Math.round((parseFloat(valor) / trm) * 100) / 100;
    return parseFloat(valor);
  }

  // Usar valores USD si existen, sino convertir
  var bruto = parseFloat(pago.valor_bruto_usd) || toUSD(pago.valor_bruto);
  var deducciones = parseFloat(pago.deducciones_usd) || toUSD(pago.deducciones);
  var netoNomina = parseFloat(pago.valor_neto_usd) || toUSD(pago.valor_neto) || (bruto - deducciones);

  // Valores originales para mostrar en preview
  var brutoOrig = pago.valor_bruto || 0;
  var deduccionesOrig = pago.deducciones || 0;
  var netoOrig = pago.valor_neto || brutoOrig;

  // Línea 1: Gasto (débito)
  lineas.push({
    cuenta: cuentaGasto, nombre: cuentaGastoNombre,
    desc: (pago.concepto || 'Pago nómina') + ' — ' + pago.empleado_nombre + ' — ' + (pago.periodo_inicio ? fd(pago.periodo_inicio) : '') + (pago.periodo_fin ? ' a ' + fd(pago.periodo_fin) : ''),
    debito: bruto, credito: 0, tipo: 'gasto'
  });

  // Línea 2 (opcional): Deducciones nómina (crédito) si hay deducciones internas
  if (deducciones > 0) {
    lineas.push({
      cuenta: '2410', nombre: 'Comisiones por pagar',
      desc: 'Deducciones nómina ' + pago.empleado_nombre,
      debito: 0, credito: deducciones, tipo: 'deduccion'
    });
  }

  // Líneas de descuento préstamos (crédito cada una) — en USD
  var prestamosHTML = '';
  prestamos.forEach(function(pr) {
    var cuotaUSD = (pr.moneda || 'USD') === 'USD' ? pr.valor_cuota : toUSD(pr.valor_cuota);
    lineas.push({
      cuenta: pr.cuenta_contable || '1399', nombre: 'CxC Préstamo/Anticipo ' + pr.empleado_nombre,
      desc: (pr.tipo === 'anticipo' ? 'Anticipo' : 'Préstamo') + ' cuota ' + (pr.cuotas_pagadas + 1) + '/' + pr.num_cuotas,
      debito: 0, credito: cuotaUSD, tipo: 'prestamo', prestamo_id: pr.id
    });
    prestamosHTML += '<div style="font-size:10px;padding:6px 10px;background:rgba(139,92,246,0.06);border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between">'
      + '<span><strong>' + (pr.tipo === 'anticipo' ? '⚡ Anticipo' : '💳 Préstamo') + '</strong> · Cuota ' + (pr.cuotas_pagadas + 1) + '/' + pr.num_cuotas + ' · Saldo: ' + fm(pr.saldo_pendiente) + '</span>'
      + '<span style="font-family:DM Mono,monospace;font-weight:700;color:#8B5CF6">-' + fm(cuotaUSD) + ' USD</span></div>';
  });

  // Línea final: Banco (crédito) — en USD
  var creditoBanco = bruto - deducciones - totalDescuentoUSD;
  lineas.push({
    cuenta: '1110-01', nombre: 'Banco Bank of America USD',
    desc: 'Pago neto nómina ' + pago.empleado_nombre,
    debito: 0, credito: creditoBanco, tipo: 'banco'
  });

  // Construir preview
  var asientoHTML = lineas.map(function(l) {
    var colorDeb = l.debito > 0 ? '#059669' : 'var(--t3)';
    var colorCred = l.credito > 0 ? 'var(--danger)' : 'var(--t3)';
    return '<tr>'
      + '<td style="font-family:DM Mono,monospace;font-size:10px;color:' + c.primary + '">' + l.cuenta + '</td>'
      + '<td style="font-size:11px">' + l.nombre + '</td>'
      + '<td style="font-size:10px;color:var(--t3);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + l.desc + '</td>'
      + '<td style="text-align:right;font-family:DM Mono,monospace;color:' + colorDeb + ';font-weight:' + (l.debito > 0 ? 600 : 400) + '">' + (l.debito > 0 ? fm(l.debito) : '—') + '</td>'
      + '<td style="text-align:right;font-family:DM Mono,monospace;color:' + colorCred + ';font-weight:' + (l.credito > 0 ? 600 : 400) + '">' + (l.credito > 0 ? fm(l.credito) : '—') + '</td>'
      + '</tr>';
  }).join('');

  var totalDeb = lineas.reduce(function(s, l) { return s + l.debito; }, 0);
  var totalCred = lineas.reduce(function(s, l) { return s + l.credito; }, 0);
  var balanceOk = Math.abs(totalDeb - totalCred) < 0.01;

  var html = '<div style="padding:4px 0 14px;border-bottom:1px solid var(--br);margin-bottom:16px">'
    + '<div style="font-size:17px;font-weight:800;font-family:Syne,sans-serif;color:var(--t)">📒 Contabilizar pago de nómina</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-top:2px">' + empLabel + ' · Preview del asiento contable</div></div>'

    // Info del pago
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:14px">'
    + '<div><div class="f-label">Empleado</div><div style="font-size:12px;font-weight:600">' + sanitize(pago.empleado_nombre) + '</div></div>'
    + '<div><div class="f-label">Concepto</div><div style="font-size:12px">' + sanitize(pago.concepto || pago.tipo || '—') + '</div></div>'
    + '<div><div class="f-label">Tipo contrato</div><div style="font-size:12px">' + sanitize(empleado.tipo_contrato || 'No definido') + '</div></div>'
    + '<div><div class="f-label">Cuenta gasto</div><div style="font-size:12px;font-family:DM Mono,monospace;color:' + c.primary + '">' + cuentaGasto + ' ' + cuentaGastoNombre + '</div></div>'
    + '</div>'

    // Resumen montos — mostrar original + USD si aplica
    + (monedaPago !== 'USD' ? '<div style="background:rgba(29,78,216,0.06);border:1px solid rgba(29,78,216,0.12);border-radius:8px;padding:8px 14px;margin-bottom:12px;font-size:10px;color:#1D4ED8">'
      + '<strong>💱 Conversión:</strong> Moneda original: <strong>' + monedaPago + '</strong> · TRM: <strong>' + fm(trm).replace('$','') + '</strong> · Bruto original: ' + monedaPago + ' ' + Number(brutoOrig).toLocaleString('en-US',{minimumFractionDigits:2}) + ' → <strong>USD ' + fm(bruto) + '</strong></div>' : '')

    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">'
    + '<div style="padding:10px;background:rgba(5,150,105,0.06);border-radius:8px;text-align:center"><div style="font-size:8px;color:var(--t3);letter-spacing:1px;font-family:DM Mono,monospace">BRUTO USD</div><div style="font-size:16px;font-weight:700;color:#059669;font-family:DM Mono,monospace">' + fm(bruto) + '</div></div>'
    + '<div style="padding:10px;background:rgba(212,135,10,0.06);border-radius:8px;text-align:center"><div style="font-size:8px;color:var(--t3);letter-spacing:1px;font-family:DM Mono,monospace">DEDUCCIONES USD</div><div style="font-size:16px;font-weight:700;color:#d4870a;font-family:DM Mono,monospace">' + fm(deducciones) + '</div></div>'
    + '<div style="padding:10px;background:rgba(139,92,246,0.06);border-radius:8px;text-align:center"><div style="font-size:8px;color:var(--t3);letter-spacing:1px;font-family:DM Mono,monospace">DESC. PRÉSTAMOS</div><div style="font-size:16px;font-weight:700;color:#8B5CF6;font-family:DM Mono,monospace">' + fm(totalDescuentoUSD) + '</div></div>'
    + '<div style="padding:10px;background:rgba(0,169,141,0.08);border-radius:8px;text-align:center"><div style="font-size:8px;color:var(--t3);letter-spacing:1px;font-family:DM Mono,monospace">NETO A PAGAR USD</div><div style="font-size:16px;font-weight:700;color:#00A98D;font-family:DM Mono,monospace">' + fm(creditoBanco) + '</div></div>'
    + '</div>'

    // Préstamos activos
    + (prestamos.length ? '<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:#8B5CF6;margin-bottom:6px;font-family:DM Mono,monospace;letter-spacing:1px">DESCUENTOS AUTOMÁTICOS</div>' + prestamosHTML + '</div>' : '')

    // Checkbox: requiere préstamo de socio/tercero
    + '<div style="margin-bottom:14px;padding:12px;background:rgba(29,78,216,0.05);border:1px solid rgba(29,78,216,0.12);border-radius:8px">'
    + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:var(--t)">'
    + '<input type="checkbox" id="cnt-nom-prestamo" onchange="togglePrestamoNomina(\'' + empresa + '\')" style="width:16px;height:16px;accent-color:' + c.primary + '">'
    + '<span>La empresa no tiene recursos — se requiere préstamo de un <strong>socio o tercero</strong> para este pago</span></label>'
    + '<div id="cnt-nom-prestamo-fields" style="display:none;margin-top:10px;display:none">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div><div class="f-label">¿Quién presta?</div>'
    + '<input type="text" id="cnt-nom-prestamista" class="srch" placeholder="Escriba para buscar tercero..." autocomplete="off" oninput="cntNomBuscarPrestamista(\'' + empresa + '\',this.value)" onfocus="cntNomBuscarPrestamista(\'' + empresa + '\',this.value)">'
    + '<input type="hidden" id="cnt-nom-prestamista-id">'
    + '<div id="cnt-nom-prestamista-list" style="display:none;position:relative;z-index:999;background:var(--sf);border:1px solid var(--br);border-radius:8px;max-height:150px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.15)"></div></div>'
    + '<div><div class="f-label">Cuenta pasivo</div>'
    + '<select id="cnt-nom-cuenta-pasivo" class="srch">'
    + '<option value="2105">2105 — Préstamos de socios</option>'
    + '<option value="2215">2215 — Cuentas por pagar a terceros</option>'
    + '<option value="2115">2115 — Otras obligaciones financieras</option>'
    + '</select></div>'
    + '</div></div></div>'

    // Preview asiento
    + '<div style="font-size:11px;font-weight:700;font-family:Syne,sans-serif;color:var(--t);margin-bottom:8px">Asiento contable a generar (CE)</div>'
    + '<div class="tw"><div class="tw-scroll"><table>'
    + '<thead><tr><th>Cuenta</th><th>Nombre</th><th>Descripción</th><th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th></tr></thead>'
    + '<tbody>' + asientoHTML + '</tbody>'
    + '<tfoot><tr style="background:rgba(15,28,48,0.03);font-weight:700">'
    + '<td colspan="3" style="text-align:right;font-family:DM Mono,monospace;font-size:10px">TOTALES</td>'
    + '<td style="text-align:right;font-family:DM Mono,monospace;color:#059669">' + fm(totalDeb) + '</td>'
    + '<td style="text-align:right;font-family:DM Mono,monospace;color:var(--danger)">' + fm(totalCred) + '</td>'
    + '</tr></tfoot></table></div></div>'
    + (balanceOk ? '<div style="text-align:center;font-size:10px;color:#059669;font-family:DM Mono,monospace;margin:8px 0">✓ Asiento balanceado</div>' : '<div style="text-align:center;font-size:10px;color:var(--danger);margin:8px 0">⚠ Asiento desbalanceado — revise los montos</div>')

    + '<div id="cnt-nom-err" style="color:var(--danger);font-size:11px;min-height:16px;margin-top:4px"></div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'
    + '<button onclick="closeM()" class="btn btn-g">Cancelar</button>'
    + '<button onclick="confirmarContabilizarNomina(\'' + id + '\',\'' + empresa + '\')" class="btn btn-p" style="' + (empresa === 'tycoon' ? 'background:#D22630' : 'background:#00A98D') + '" id="cnt-nom-btn">✓ Confirmar y contabilizar</button>'
    + '</div>';

  // Guardar datos en variable global para la confirmación
  window._cntNomData = { pago, empresa, emp, lineas, prestamos, totalDescuento: totalDescuentoUSD, creditoBanco, cuentaGasto, cuentaGastoNombre, bruto, deducciones };

  var ov = $('ov');
  ov.querySelector('.mo').innerHTML = html;
  ov.setAttribute('data-lock', '1');
  ov.classList.add('on');
}

function togglePrestamoNomina(empresa) {
  var checked = $('cnt-nom-prestamo')?.checked;
  var fields = $('cnt-nom-prestamo-fields');
  if (fields) fields.style.display = checked ? 'block' : 'none';
}

async function cntNomBuscarPrestamista(empresa, query) {
  var todos = await ncCargarTerceros(empresa);
  var q = (query || '').toLowerCase().trim();
  var filtrados = q.length === 0 ? todos.slice(0, 10) : todos.filter(function(t) {
    return t.nombre.toLowerCase().includes(q);
  }).slice(0, 8);
  var list = $('cnt-nom-prestamista-list');
  if (!list || !filtrados.length) { if (list) list.style.display = 'none'; return; }
  var c = contabColors(empresa);
  list.innerHTML = filtrados.map(function(t) {
    return '<div onclick="$(\'cnt-nom-prestamista\').value=\'' + t.nombre.replace(/'/g, "\\'") + '\';$(\'cnt-nom-prestamista-id\').value=\'' + t.id + '\';$(\'cnt-nom-prestamista-list\').style.display=\'none\'" style="padding:7px 10px;cursor:pointer;font-size:11px;border-bottom:1px solid rgba(0,0,0,0.04)" onmouseover="this.style.background=\'' + c.accent + '\'" onmouseout="this.style.background=\'transparent\'">'
      + '<strong>' + sanitize(t.nombre) + '</strong> <span style="font-size:8px;color:var(--t3)">' + t.tipo + '</span></div>';
  }).join('');
  list.style.display = 'block';
}

async function confirmarContabilizarNomina(id, empresa) {
  var btn = $('cnt-nom-btn');
  var errEl = $('cnt-nom-err');
  if (btn) { btn.textContent = 'Contabilizando...'; btn.disabled = true; }
  if (errEl) errEl.textContent = '';

  var d = window._cntNomData;
  if (!d) { if (errEl) errEl.textContent = 'Error interno'; return; }

  var emp = d.emp;
  var necesitaPrestamo = $('cnt-nom-prestamo')?.checked;
  var prestamistaId = null, prestamistaNombre = '', cuentaPasivo = '2105';
  var compRcId = null;

  // Si necesita préstamo, generar RC primero
  if (necesitaPrestamo) {
    prestamistaNombre = ($('cnt-nom-prestamista')?.value || '').trim();
    prestamistaId = ($('cnt-nom-prestamista-id')?.value || '').trim() || null;
    cuentaPasivo = $('cnt-nom-cuenta-pasivo')?.value || '2105';

    if (!prestamistaNombre) {
      if (errEl) errEl.textContent = 'Seleccione quién presta el dinero.';
      if (btn) { btn.textContent = '✓ Confirmar y contabilizar'; btn.disabled = false; }
      return;
    }

    // Buscar nombre de la cuenta pasivo
    var cuentaPasivoNombre = {
      '2105': 'Préstamos de socios',
      '2215': 'Cuentas por pagar a terceros',
      '2115': 'Otras obligaciones financieras'
    }[cuentaPasivo] || 'Préstamos';

    // Generar RC
    var {data: consRC} = await db.rpc('siguiente_consecutivo', { p_empresa: emp, p_tipo_comprobante: 'RC' });
    var prefRC = emp === 'tycoon' ? 'TY-RC-' : 'DZ-RC-';
    var numRC = prefRC + String(consRC).padStart(4, '0');

    var montoRC = d.bruto; // ya está en USD
    var {data: compRC, error: errRC} = await db.from('comprobantes').insert({
      empresa: emp, tipo_comprobante: 'RC', consecutivo: consRC,
      numero_display: numRC, fecha: d.pago.fecha_pago || d.pago.periodo_inicio || new Date().toISOString().slice(0, 10),
      tercero_id: prestamistaId, tercero_nombre: prestamistaNombre,
      descripcion: 'Préstamo ' + prestamistaNombre + ' para pago nómina ' + d.pago.empleado_nombre,
      total_debito: montoRC, total_credito: montoRC,
      moneda: d.pago.moneda || 'USD', estado: 'Aprobado',
      created_by_email: (await db.auth.getUser()).data?.user?.email || null,
    }).select().single();

    if (errRC) {
      if (errEl) errEl.textContent = 'Error creando RC: ' + errRC.message;
      if (btn) { btn.textContent = '✓ Confirmar y contabilizar'; btn.disabled = false; }
      return;
    }
    compRcId = compRC.id;

    // Líneas del RC
    await db.from('comprobantes_detalle').insert([
      { comprobante_id: compRC.id, linea: 1, cuenta_codigo: '1110-01', cuenta_nombre: 'Banco Bank of America USD',
        descripcion: 'Ingreso préstamo ' + prestamistaNombre, debito: montoRC, credito: 0, moneda: 'USD', tasa_cambio: 1, debito_usd: montoRC, credito_usd: 0 },
      { comprobante_id: compRC.id, linea: 2, cuenta_codigo: cuentaPasivo, cuenta_nombre: cuentaPasivoNombre,
        descripcion: 'Préstamo para nómina ' + d.pago.empleado_nombre, debito: 0, credito: montoRC, moneda: 'USD', tasa_cambio: 1, debito_usd: 0, credito_usd: montoRC }
    ]);
  }

  // Generar CE de nómina
  var {data: consCE} = await db.rpc('siguiente_consecutivo', { p_empresa: emp, p_tipo_comprobante: 'CE' });
  var prefCE = emp === 'tycoon' ? 'TY-CE-' : 'DZ-CE-';
  var numCE = prefCE + String(consCE).padStart(4, '0');

  var totalDeb = d.lineas.reduce(function(s, l) { return s + l.debito; }, 0);
  var totalCred = d.lineas.reduce(function(s, l) { return s + l.credito; }, 0);

  var {data: compCE, error: errCE} = await db.from('comprobantes').insert({
    empresa: emp, tipo_comprobante: 'CE', consecutivo: consCE,
    numero_display: numCE, fecha: d.pago.fecha_pago || d.pago.periodo_inicio || new Date().toISOString().slice(0, 10),
    tercero_nombre: d.pago.empleado_nombre,
    descripcion: 'Pago nómina ' + d.pago.empleado_nombre + ' — ' + (d.pago.concepto || d.pago.tipo || '') + ' — ' + (d.pago.periodo_inicio ? fd(d.pago.periodo_inicio) : '') + (d.pago.periodo_fin ? ' a ' + fd(d.pago.periodo_fin) : ''),
    total_debito: totalDeb, total_credito: totalCred,
    moneda: d.pago.moneda || 'USD', estado: 'Aprobado',
    comprobante_ref_id: compRcId,
    created_by_email: (await db.auth.getUser()).data?.user?.email || null,
  }).select().single();

  if (errCE) {
    if (errEl) errEl.textContent = 'Error creando CE: ' + errCE.message;
    if (btn) { btn.textContent = '✓ Confirmar y contabilizar'; btn.disabled = false; }
    return;
  }

  // Insertar líneas del CE
  var detalles = d.lineas.map(function(l, i) {
    return {
      comprobante_id: compCE.id, linea: i + 1,
      cuenta_codigo: l.cuenta, cuenta_nombre: l.nombre,
      descripcion: l.desc, debito: l.debito, credito: l.credito,
      moneda: 'USD', tasa_cambio: 1, debito_usd: l.debito, credito_usd: l.credito
    };
  });
  await db.from('comprobantes_detalle').insert(detalles);

  // Actualizar préstamos: incrementar cuotas, reducir saldo
  for (var i = 0; i < d.prestamos.length; i++) {
    var pr = d.prestamos[i];
    var nuevasCuotas = pr.cuotas_pagadas + 1;
    var nuevoSaldo = pr.saldo_pendiente - pr.valor_cuota;
    var nuevoEstado = nuevoSaldo <= 0.01 ? 'pagado' : 'activo';

    await db.from('prestamos_empleados').update({
      cuotas_pagadas: nuevasCuotas,
      saldo_pendiente: Math.max(nuevoSaldo, 0),
      estado: nuevoEstado,
      updated_at: new Date().toISOString()
    }).eq('id', pr.id);

    // Registrar descuento
    await db.from('prestamos_descuentos').insert({
      prestamo_id: pr.id, nomina_pago_id: id, comprobante_id: compCE.id,
      numero_cuota: nuevasCuotas, valor_descontado: pr.valor_cuota,
      saldo_despues: Math.max(nuevoSaldo, 0), fecha_descuento: d.pago.fecha_pago || new Date().toISOString().slice(0, 10)
    });
  }

  // Marcar nómina como contabilizada
  await db.from('nomina_pagos').update({
    contabilizado: true,
    comprobante_id: compCE.id,
    comprobante_rc_id: compRcId,
    updated_at: new Date().toISOString()
  }).eq('id', id);

  var msg = '✓ Contabilizado: ' + numCE;
  if (compRcId) msg += ' + RC generado';
  if (d.prestamos.length) msg += ' + ' + d.prestamos.length + ' cuota(s) descontada(s)';
  toast(msg, 'ok');
  closeM();
  PLAN_CUENTAS_CACHE = null;
  await loadNomina(empresa);
}

// ══════════════════════════════════════════════════════════════
// MÓDULO PRÉSTAMOS Y ANTICIPOS A EMPLEADOS
// ══════════════════════════════════════════════════════════════

async function loadPrestamosEmp(empresa) {
  var bodyId = empresa === 'tycoon' ? 'prestamos-emp-ty-body' : 'prestamos-emp-dz-body';
  var body = $(bodyId);
  if (!body) return;
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var c = contabColors(empresa);

  var {data: prestamos} = await db.from('prestamos_empleados')
    .select('*').eq('empresa', emp).order('created_at', {ascending: false});
  prestamos = prestamos || [];

  // KPIs
  var activos = prestamos.filter(p => p.estado === 'activo');
  var pagados = prestamos.filter(p => p.estado === 'pagado');
  var totalSaldo = activos.reduce((s, p) => s + (p.saldo_pendiente || 0), 0);
  var totalDesembolsado = prestamos.reduce((s, p) => s + (p.monto_total || 0), 0);

  var kpiHTML = `
    <div class="stat"><div class="sl">Préstamos activos</div><div class="sv">${activos.length}</div><div class="si">🏦</div></div>
    <div class="stat"><div class="sl">Saldo pendiente</div><div class="sv" style="color:${totalSaldo > 0 ? 'var(--danger)' : '#059669'}">${fm(totalSaldo)}</div><div class="si">💰</div></div>
    <div class="stat"><div class="sl">Total desembolsado</div><div class="sv">${fm(totalDesembolsado)}</div><div class="si">📤</div></div>
    <div class="stat"><div class="sl">Pagados / Total</div><div class="sv">${pagados.length} / ${prestamos.length}</div><div class="si">✓</div></div>`;

  // Filtros
  var filtrosHTML = `
    <div class="ctls" style="margin-bottom:12px">
      <button class="chip on" onclick="filtrarPrestEmp('${empresa}','todos',this)">Todos</button>
      <button class="chip" onclick="filtrarPrestEmp('${empresa}','activo',this)">Activos</button>
      <button class="chip" onclick="filtrarPrestEmp('${empresa}','pagado',this)">Pagados</button>
      <button class="chip" onclick="filtrarPrestEmp('${empresa}','prestamo',this)">Préstamos</button>
      <button class="chip" onclick="filtrarPrestEmp('${empresa}','anticipo',this)">Anticipos</button>
      <input class="srch" style="max-width:200px" placeholder="Buscar empleado..." oninput="buscarPrestEmp('${empresa}',this.value)" id="prest-srch-${empresa}">
    </div>`;

  var rows = prestamos.map(p => {
    var pctPagado = p.num_cuotas > 0 ? Math.round((p.cuotas_pagadas / p.num_cuotas) * 100) : 0;
    var estadoBadge = p.estado === 'activo'
      ? '<span class="badge bdw">Activo</span>'
      : p.estado === 'pagado'
      ? '<span class="badge bdb">Pagado</span>'
      : '<span class="badge" style="background:var(--danger-soft);color:var(--danger)">Cancelado</span>';
    var tipoBadge = p.tipo === 'anticipo'
      ? '<span style="font-size:8px;padding:2px 6px;border-radius:4px;background:rgba(234,88,12,0.1);color:#EA580C;font-weight:600">⚡ Anticipo</span>'
      : '<span style="font-size:8px;padding:2px 6px;border-radius:4px;background:rgba(29,78,216,0.1);color:#1D4ED8;font-weight:600">💳 Préstamo</span>';

    return `<tr data-estado="${p.estado}" data-tipo="${p.tipo}" data-search="${p.empleado_nombre.toLowerCase()}">
      <td style="font-weight:600">${sanitize(p.empleado_nombre)}</td>
      <td>${tipoBadge}</td>
      <td style="font-family:'DM Mono',monospace;font-size:11px;color:#059669;font-weight:600">${fm(p.monto_total)}</td>
      <td style="font-family:'DM Mono',monospace;font-size:11px">${fm(p.valor_cuota)}</td>
      <td style="text-align:center;font-size:11px">${p.cuotas_pagadas} / ${p.num_cuotas}</td>
      <td>
        <div style="background:var(--br);border-radius:4px;height:6px;width:80px;overflow:hidden;display:inline-block;vertical-align:middle">
          <div style="background:${pctPagado >= 100 ? '#059669' : c.primary};height:100%;width:${pctPagado}%;border-radius:4px;transition:width .3s"></div>
        </div>
        <span style="font-size:9px;color:var(--t3);margin-left:4px">${pctPagado}%</span>
      </td>
      <td style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:${p.saldo_pendiente > 0 ? 'var(--danger)' : '#059669'}">${fm(p.saldo_pendiente)}</td>
      <td style="font-size:10px;color:var(--t3)">${fd(p.fecha_desembolso)}</td>
      <td style="font-size:10px;color:var(--t3)">${fd(p.fecha_inicio_descuento)}</td>
      <td>${estadoBadge}</td>
      <td style="text-align:right;white-space:nowrap">
        <button onclick="verPrestamo('${p.id}','${empresa}')" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid var(--br);background:var(--sf2);color:var(--t2);cursor:pointer">Ver</button>
        ${p.estado === 'activo' ? `<button onclick="editarPrestamo('${p.id}','${empresa}')" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid var(--br);background:var(--sf2);color:var(--t2);cursor:pointer;margin-left:3px">✎</button>` : ''}
        ${p.estado === 'activo' ? `<button onclick="cancelarPrestamo('${p.id}','${empresa}')" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid rgba(185,28,28,0.2);background:var(--danger-soft);color:var(--danger);cursor:pointer;margin-left:3px">✕</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  body.innerHTML = `
    <div class="stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">${kpiHTML}</div>
    ${filtrosHTML}
    <div class="tw"><div class="tw-scroll">
      <table id="prest-table-${empresa}">
        <thead><tr>
          <th>Empleado</th><th>Tipo</th><th>Monto</th><th>Cuota</th>
          <th style="text-align:center">Cuotas</th><th>Progreso</th><th>Saldo</th>
          <th>Desembolso</th><th>Inicio desc.</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody id="prest-tbody-${empresa}">${rows || '<tr><td colspan="11" style="text-align:center;color:var(--t3);padding:30px">Sin préstamos registrados</td></tr>'}</tbody>
      </table>
    </div></div>`;
}

function filtrarPrestEmp(empresa, filtro, btn) {
  btn.closest('.ctls').querySelectorAll('.chip').forEach(c2 => c2.classList.remove('on'));
  btn.classList.add('on');
  $('prest-tbody-' + empresa)?.querySelectorAll('tr').forEach(tr => {
    var show = filtro === 'todos'
      || tr.dataset.estado === filtro
      || tr.dataset.tipo === filtro;
    tr.style.display = show ? '' : 'none';
  });
}
function buscarPrestEmp(empresa, val) {
  $('prest-tbody-' + empresa)?.querySelectorAll('tr').forEach(tr => {
    tr.style.display = (!val || (tr.dataset.search || '').includes(val.toLowerCase())) ? '' : 'none';
  });
}

// ── MODAL: NUEVO PRÉSTAMO / ANTICIPO ──
async function openNuevoPrestamo(empresa, editData) {
  var c = contabColors(empresa);
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var isEdit = !!editData;
  var d = editData || {};

  // Cargar empleados
  var tabla = empresa === 'tycoon' ? 'terceros_tycoon' : 'terceros_diaz';
  var {data: empleados} = await db.from(tabla).select('id,nombre,tipo_contrato').eq('tipo', 'Empleado').order('nombre');
  empleados = empleados || [];
  var empOpts = empleados.map(e => `<option value="${e.id}" data-nombre="${e.nombre}" ${d.empleado_id === e.id ? 'selected' : ''}>${e.nombre}</option>`).join('');

  var html = `
    <div style="padding:4px 0 14px;border-bottom:1px solid var(--br);margin-bottom:16px">
      <div style="font-size:16px;font-weight:800;font-family:'Syne',sans-serif">${isEdit ? 'Editar' : 'Nuevo'} préstamo / anticipo</div>
      <div style="font-size:10px;color:var(--t3);margin-top:2px">${empresa === 'tycoon' ? 'Tycoon Guru' : 'Díaz International'} · Descuento automático de nómina</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">Empleado *</div>
        <select id="pe-empleado" class="srch" onchange="var o=this.options[this.selectedIndex];$('pe-empleado-nombre').value=o.dataset.nombre||o.text">
          <option value="">— Seleccionar —</option>${empOpts}
        </select>
        <input type="hidden" id="pe-empleado-nombre" value="${sanitize(d.empleado_nombre || '')}">
      </div>
      <div>
        <div class="f-label">Tipo *</div>
        <select id="pe-tipo" class="srch" onchange="pe_updateTipo()">
          <option value="prestamo" ${d.tipo !== 'anticipo' ? 'selected' : ''}>💳 Préstamo — cuotas fijas</option>
          <option value="anticipo" ${d.tipo === 'anticipo' ? 'selected' : ''}>⚡ Anticipo — descuento en siguiente nómina</option>
        </select>
      </div>
    </div>

    <div id="pe-hint" style="background:rgba(29,78,216,0.05);border:1px solid rgba(29,78,216,0.12);border-radius:8px;padding:8px 14px;margin-bottom:12px;font-size:10px;color:#1D4ED8">
      <strong>💳 Préstamo:</strong> Se descuenta en cuotas fijas de la nómina según la parametrización. Al desembolsar se genera un CE automático.
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">Monto total *</div>
        <input type="number" id="pe-monto" class="srch" placeholder="0.00" min="0" step="0.01" value="${d.monto_total || ''}" oninput="pe_recalcular()">
      </div>
      <div>
        <div class="f-label">Número de cuotas *</div>
        <input type="number" id="pe-cuotas" class="srch" placeholder="1" min="1" value="${d.num_cuotas || 1}" oninput="pe_recalcular()">
      </div>
      <div>
        <div class="f-label">Valor por cuota</div>
        <input type="text" id="pe-valor-cuota" class="srch" readonly style="font-family:'DM Mono',monospace;font-weight:700;color:${c.primary}">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">Moneda</div>
        <select id="pe-moneda" class="srch">
          <option value="USD" ${(d.moneda || 'USD') === 'USD' ? 'selected' : ''}>USD</option>
          <option value="COP" ${d.moneda === 'COP' ? 'selected' : ''}>COP</option>
        </select>
      </div>
      <div>
        <div class="f-label">Fecha desembolso *</div>
        <input type="date" id="pe-fecha" class="srch" value="${d.fecha_desembolso || new Date().toISOString().slice(0, 10)}">
      </div>
      <div>
        <div class="f-label">Inicio descuento *</div>
        <input type="date" id="pe-inicio" class="srch" value="${d.fecha_inicio_descuento || new Date().toISOString().slice(0, 10)}">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">Cuenta contable CxC</div>
        <input type="text" id="pe-cuenta" class="srch" value="${d.cuenta_contable || '1399'}" placeholder="1399">
      </div>
      <div>
        <div class="f-label">Notas</div>
        <input type="text" id="pe-notas" class="srch" placeholder="Motivo del préstamo/anticipo" value="${sanitize(d.notas || '')}">
      </div>
    </div>

    <div style="margin-bottom:12px;padding:12px;background:rgba(5,150,105,0.05);border:1px solid rgba(5,150,105,0.15);border-radius:8px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:var(--t)">
        <input type="checkbox" id="pe-contabilizar" checked style="width:16px;height:16px;accent-color:${c.primary}">
        <span>Generar CE de desembolso automáticamente (Db CxC Empleado / Cr Banco BofA)</span>
      </label>
    </div>

    <div id="pe-err" style="color:var(--danger);font-size:11px;min-height:16px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button onclick="closeM()" class="btn btn-g">Cancelar</button>
      <button onclick="${isEdit ? "actualizarPrestamo('" + d.id + "','" + empresa + "')" : "guardarPrestamo('" + empresa + "')"}" class="btn btn-p" style="${empresa === 'tycoon' ? 'background:#D22630' : 'background:#00A98D'}" id="pe-btn">${isEdit ? 'Actualizar' : 'Registrar préstamo'}</button>
    </div>`;

  var ov = $('ov');
  ov.querySelector('.mo').innerHTML = html;
  ov.setAttribute('data-lock', '1');
  ov.classList.add('on');
  pe_recalcular();
  pe_updateTipo();
}

function pe_updateTipo() {
  var tipo = $('pe-tipo')?.value;
  var hint = $('pe-hint');
  if (!hint) return;
  if (tipo === 'anticipo') {
    hint.innerHTML = '<strong>⚡ Anticipo:</strong> Se descuenta completo en la siguiente nómina. Equivale a un préstamo de 1 cuota.';
    if ($('pe-cuotas')) { $('pe-cuotas').value = 1; $('pe-cuotas').readOnly = true; }
  } else {
    hint.innerHTML = '<strong>💳 Préstamo:</strong> Se descuenta en cuotas fijas de la nómina según la parametrización. Al desembolsar se genera un CE automático.';
    if ($('pe-cuotas')) $('pe-cuotas').readOnly = false;
  }
  pe_recalcular();
}

function pe_recalcular() {
  var monto = parseFloat($('pe-monto')?.value || 0);
  var cuotas = parseInt($('pe-cuotas')?.value || 1);
  if (cuotas < 1) cuotas = 1;
  var valorCuota = Math.round((monto / cuotas) * 100) / 100;
  if ($('pe-valor-cuota')) $('pe-valor-cuota').value = fm(valorCuota);
}

async function guardarPrestamo(empresa) {
  var btn = $('pe-btn');
  var errEl = $('pe-err');
  if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var empleadoId = $('pe-empleado')?.value || null;
  var empleadoNombre = $('pe-empleado-nombre')?.value || $('pe-empleado')?.options[$('pe-empleado')?.selectedIndex]?.text || '';
  var tipo = $('pe-tipo')?.value || 'prestamo';
  var monto = parseFloat($('pe-monto')?.value || 0);
  var cuotas = parseInt($('pe-cuotas')?.value || 1);
  var moneda = $('pe-moneda')?.value || 'USD';
  var fecha = $('pe-fecha')?.value;
  var inicio = $('pe-inicio')?.value;
  var cuenta = ($('pe-cuenta')?.value || '1399').trim();
  var notas = ($('pe-notas')?.value || '').trim() || null;
  var contabilizar = $('pe-contabilizar')?.checked;

  if (!empleadoId || !monto || !fecha || !inicio) {
    if (errEl) errEl.textContent = 'Complete empleado, monto, fecha desembolso e inicio de descuento.';
    if (btn) { btn.textContent = 'Registrar préstamo'; btn.disabled = false; }
    return;
  }

  var valorCuota = Math.round((monto / cuotas) * 100) / 100;

  // Insertar préstamo
  var {data: prest, error: presErr} = await db.from('prestamos_empleados').insert({
    empresa: emp, empleado_id: empleadoId, empleado_nombre: empleadoNombre,
    tipo, monto_total: monto, num_cuotas: cuotas, valor_cuota: valorCuota,
    cuotas_pagadas: 0, saldo_pendiente: monto, moneda,
    fecha_desembolso: fecha, fecha_inicio_descuento: inicio,
    cuenta_contable: cuenta, estado: 'activo', notas,
    created_by: USER_DISPLAY_NAME
  }).select().single();

  if (presErr) {
    if (errEl) errEl.textContent = 'Error: ' + presErr.message;
    if (btn) { btn.textContent = 'Registrar préstamo'; btn.disabled = false; }
    return;
  }

  // Contabilizar desembolso (CE)
  if (contabilizar) {
    var {data: consData} = await db.rpc('siguiente_consecutivo', { p_empresa: emp, p_tipo_comprobante: 'CE' });
    var pref = emp === 'tycoon' ? 'TY-CE-' : 'DZ-CE-';
    var numDisplay = pref + String(consData).padStart(4, '0');

    var {data: comp} = await db.from('comprobantes').insert({
      empresa: emp, tipo_comprobante: 'CE', consecutivo: consData,
      numero_display: numDisplay, fecha,
      tercero_id: empleadoId, tercero_nombre: empleadoNombre,
      descripcion: (tipo === 'anticipo' ? 'Anticipo' : 'Préstamo') + ' a ' + empleadoNombre + ' — ' + cuotas + ' cuota(s) de ' + fm(valorCuota),
      total_debito: monto, total_credito: monto,
      moneda: 'USD', estado: 'Aprobado',
      created_by_email: (await db.auth.getUser()).data?.user?.email || null,
    }).select().single();

    if (comp) {
      await db.from('comprobantes_detalle').insert([
        { comprobante_id: comp.id, linea: 1, cuenta_codigo: cuenta, cuenta_nombre: 'CxC ' + (tipo === 'anticipo' ? 'Anticipo' : 'Préstamo') + ' ' + empleadoNombre,
          descripcion: (tipo === 'anticipo' ? 'Anticipo' : 'Préstamo') + ' desembolso', debito: monto, credito: 0, moneda: 'USD', tasa_cambio: 1, debito_usd: monto, credito_usd: 0 },
        { comprobante_id: comp.id, linea: 2, cuenta_codigo: '1110-01', cuenta_nombre: 'Banco Bank of America USD',
          descripcion: 'Desembolso ' + (tipo === 'anticipo' ? 'anticipo' : 'préstamo') + ' ' + empleadoNombre, debito: 0, credito: monto, moneda: 'USD', tasa_cambio: 1, debito_usd: 0, credito_usd: monto }
      ]);
      // Guardar referencia
      await db.from('prestamos_empleados').update({ comprobante_desembolso_id: comp.id }).eq('id', prest.id);
    }
  }

  toast((tipo === 'anticipo' ? 'Anticipo' : 'Préstamo') + ' registrado ✓' + (contabilizar ? ' + CE generado' : ''), 'ok');
  closeM();
  await loadPrestamosEmp(empresa);
}

async function editarPrestamo(id, empresa) {
  var {data: p} = await db.from('prestamos_empleados').select('*').eq('id', id).single();
  if (!p) { toast('No encontrado', 'd'); return; }
  await openNuevoPrestamo(empresa, p);
}

async function actualizarPrestamo(id, empresa) {
  var btn = $('pe-btn');
  var errEl = $('pe-err');
  if (btn) { btn.textContent = 'Actualizando...'; btn.disabled = true; }

  var cuotas = parseInt($('pe-cuotas')?.value || 1);
  var monto = parseFloat($('pe-monto')?.value || 0);
  var valorCuota = Math.round((monto / cuotas) * 100) / 100;

  var {error} = await db.from('prestamos_empleados').update({
    num_cuotas: cuotas,
    valor_cuota: valorCuota,
    monto_total: monto,
    fecha_inicio_descuento: $('pe-inicio')?.value,
    cuenta_contable: ($('pe-cuenta')?.value || '1399').trim(),
    notas: ($('pe-notas')?.value || '').trim() || null,
    moneda: $('pe-moneda')?.value || 'USD',
    updated_at: new Date().toISOString()
  }).eq('id', id);

  if (error) {
    if (errEl) errEl.textContent = 'Error: ' + error.message;
    if (btn) { btn.textContent = 'Actualizar'; btn.disabled = false; }
    return;
  }
  toast('Préstamo actualizado ✓', 'ok');
  closeM();
  await loadPrestamosEmp(empresa);
}

async function cancelarPrestamo(id, empresa) {
  if (!confirm('¿Cancelar este préstamo? El saldo pendiente se condonará.')) return;
  await db.from('prestamos_empleados').update({ estado: 'cancelado', updated_at: new Date().toISOString() }).eq('id', id);
  toast('Préstamo cancelado', 'ok');
  await loadPrestamosEmp(empresa);
}

async function verPrestamo(id, empresa) {
  var c = contabColors(empresa);
  var {data: p} = await db.from('prestamos_empleados').select('*').eq('id', id).single();
  var {data: descs} = await db.from('prestamos_descuentos').select('*').eq('prestamo_id', id).order('numero_cuota');
  if (!p) { toast('No encontrado', 'd'); return; }
  descs = descs || [];

  var pctPagado = p.num_cuotas > 0 ? Math.round((p.cuotas_pagadas / p.num_cuotas) * 100) : 0;
  var estadoBadge = p.estado === 'activo' ? '<span class="badge bdw">Activo</span>' : p.estado === 'pagado' ? '<span class="badge bdb">Pagado</span>' : '<span class="badge" style="background:var(--danger-soft);color:var(--danger)">Cancelado</span>';

  var descHTML = descs.map(d => `
    <tr>
      <td style="text-align:center;font-weight:600">${d.numero_cuota}</td>
      <td style="font-size:10px">${fd(d.fecha_descuento)}</td>
      <td style="font-family:'DM Mono',monospace;color:var(--danger)">${fm(d.valor_descontado)}</td>
      <td style="font-family:'DM Mono',monospace">${fm(d.saldo_despues)}</td>
    </tr>`).join('');

  var html = `
    <div style="padding:4px 0 14px;border-bottom:1px solid var(--br);margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:18px;font-weight:800;font-family:'Syne',sans-serif;color:var(--t)">${p.tipo === 'anticipo' ? '⚡ Anticipo' : '💳 Préstamo'}</div>
        <div style="font-size:12px;color:var(--t3);margin-top:2px">${sanitize(p.empleado_nombre)}</div>
      </div>
      ${estadoBadge}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div><div class="f-label">Monto total</div><div style="font-size:14px;font-weight:700;font-family:'DM Mono',monospace">${fm(p.monto_total)}</div></div>
      <div><div class="f-label">Valor cuota</div><div style="font-size:14px;font-weight:700;font-family:'DM Mono',monospace;color:${c.primary}">${fm(p.valor_cuota)}</div></div>
      <div><div class="f-label">Cuotas</div><div style="font-size:14px;font-weight:700">${p.cuotas_pagadas} / ${p.num_cuotas}</div></div>
      <div><div class="f-label">Saldo pendiente</div><div style="font-size:14px;font-weight:700;font-family:'DM Mono',monospace;color:${p.saldo_pendiente > 0 ? 'var(--danger)' : '#059669'}">${fm(p.saldo_pendiente)}</div></div>
    </div>
    <div style="background:var(--br);border-radius:4px;height:10px;margin-bottom:16px;overflow:hidden">
      <div style="background:${pctPagado >= 100 ? '#059669' : c.primary};height:100%;width:${pctPagado}%;border-radius:4px;transition:width .3s"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div class="f-label">Desembolso</div><div style="font-size:11px">${fd(p.fecha_desembolso)}</div></div>
      <div><div class="f-label">Inicio descuento</div><div style="font-size:11px">${fd(p.fecha_inicio_descuento)}</div></div>
      <div><div class="f-label">Cuenta CxC</div><div style="font-size:11px;font-family:'DM Mono',monospace;color:${c.primary}">${p.cuenta_contable || '1399'}</div></div>
    </div>
    ${p.notas ? '<div style="margin-bottom:16px"><div class="f-label">Notas</div><div style="font-size:11px;color:var(--t);padding:6px 10px;background:rgba(15,28,48,0.03);border-radius:6px">' + sanitize(p.notas) + '</div></div>' : ''}
    ${descs.length ? '<div style="font-size:11px;font-weight:700;font-family:\'Syne\',sans-serif;color:var(--t);margin-bottom:8px">Historial de descuentos</div><div class="tw"><div class="tw-scroll"><table><thead><tr><th style="text-align:center">Cuota</th><th>Fecha</th><th>Descontado</th><th>Saldo después</th></tr></thead><tbody>' + descHTML + '</tbody></table></div></div>' : '<div style="text-align:center;color:var(--t3);font-size:11px;padding:20px">Sin descuentos aplicados aún</div>'}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button onclick="closeM()" class="btn btn-p" style="${empresa === 'tycoon' ? 'background:#D22630' : 'background:#00A98D'}">Cerrar</button>
    </div>`;

  var ov = $('ov');
  ov.querySelector('.mo').innerHTML = html;
  ov.setAttribute('data-lock', '1');
  ov.classList.add('on');
}

async function descontabilizarNomina(id, empresa) {
  if (!confirm('¿Descontabilizar este pago? Se anularán los comprobantes generados y se revertirán los descuentos de préstamos.')) return;

  var {data: pago} = await db.from('nomina_pagos').select('*').eq('id', id).single();
  if (!pago) { toast('Pago no encontrado','d'); return; }

  // Anular CE
  if (pago.comprobante_id) {
    await db.from('comprobantes').update({
      estado: 'Anulado', anulado_en: new Date().toISOString(), anulado_por: USER_DISPLAY_NAME, motivo_anulacion: 'Descontabilización de nómina'
    }).eq('id', pago.comprobante_id);
  }

  // Anular RC si existe
  if (pago.comprobante_rc_id) {
    await db.from('comprobantes').update({
      estado: 'Anulado', anulado_en: new Date().toISOString(), anulado_por: USER_DISPLAY_NAME, motivo_anulacion: 'Descontabilización de nómina'
    }).eq('id', pago.comprobante_rc_id);
  }

  // Revertir descuentos de préstamos
  var {data: descuentos} = await db.from('prestamos_descuentos').select('*').eq('nomina_pago_id', id);
  if (descuentos && descuentos.length) {
    for (var i = 0; i < descuentos.length; i++) {
      var desc = descuentos[i];
      var {data: pr} = await db.from('prestamos_empleados').select('*').eq('id', desc.prestamo_id).single();
      if (pr) {
        await db.from('prestamos_empleados').update({
          cuotas_pagadas: Math.max((pr.cuotas_pagadas || 1) - 1, 0),
          saldo_pendiente: (pr.saldo_pendiente || 0) + desc.valor_descontado,
          estado: 'activo',
          updated_at: new Date().toISOString()
        }).eq('id', desc.prestamo_id);
      }
    }
    await db.from('prestamos_descuentos').delete().eq('nomina_pago_id', id);
  }

  // Marcar nómina como no contabilizada
  await db.from('nomina_pagos').update({
    contabilizado: false, comprobante_id: null, comprobante_rc_id: null, updated_at: new Date().toISOString()
  }).eq('id', id);

  toast('Pago descontabilizado — comprobantes anulados ✓', 'ok');
  await loadNomina(empresa);
}

async function openNuevoPago(empresa) {
  var col   = empresa==='tycoon'?'#5B8DB8':'#00A98D';
  var label = empresa==='tycoon'?'Tycoon':'Díaz Intl';

  var tabla = empresa==='tycoon'?'terceros_tycoon':'terceros_diaz';
  var {data: emps} = await db.from(tabla).select('id,nombre,cargo,salario_base,periodicidad,tipo_contrato').eq('tipo','Empleado').order('nombre');
  var empMap = {};
  (emps||[]).forEach(function(e){ empMap[e.id] = e; });
  var empOpts = '<option value="">— Seleccionar empleado —</option>'+(emps||[]).map(function(e){
    return '<option value="'+e.id+'|'+e.nombre+'">'+e.nombre+(e.cargo?' · '+e.cargo:'')+'</option>';
  }).join('');

  var fld = function(id,lbl,type,ro){
    type=type||'text';
    var sty='width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none'+(ro?';opacity:0.75':'');
    return '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">'+lbl+'</div><input id="npag-'+id+'" type="'+type+'" '+(ro?'readonly ':'')+' placeholder="'+lbl+'..." style="'+sty+'"></div>';
  };
  var sec = function(t){return '<div style="font-size:9px;font-weight:700;color:var(--t3);letter-spacing:2px;text-transform:uppercase;padding:10px 0 6px;border-top:1px solid var(--br);margin-top:6px;font-family:monospace">'+t+'</div>';};

  $('m-t').textContent = 'Nuevo Pago Nómina · '+label;
  $('m-s').textContent = 'Histórico por empleado';

  var html = '<input type="hidden" id="npag-empresa" value="'+empresa+'">';

  html += '<div style="margin-bottom:8px"><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Empleado / Contratista</div>'
    +'<select id="npag-empleado" onchange="npagOnEmp(this)" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'+empOpts+'</select></div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">';
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Tipo de pago</div>'
    +'<select id="npag-tipo" onchange="npagOnTipo(this)" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'
    +'<option>Quincenal</option><option>Mensual</option><option>Por horas</option><option>Comision</option><option>Otro</option>'
    +'</select></div>';
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Estado</div>'
    +'<select id="npag-estado" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'
    +'<option>Pendiente</option><option>Procesando</option><option>Pagado</option>'
    +'</select></div>';
  html += '</div>';

  html += '<div style="margin-bottom:8px"><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Concepto / Novedad</div>'
    +'<input id="npag-concepto" type="text" placeholder="Ej: Quincena 1-15 Enero..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">';
  html += fld('periodo_inicio','Período inicio','date') + fld('periodo_fin','Período fin','date');
  html += '</div>';

  // PANEL POR HORAS
  html += '<div id="npag-horas-panel" style="display:none;background:rgba(91,141,184,0.07);border:1px solid rgba(91,141,184,0.25);border-radius:8px;padding:12px 14px;margin-bottom:8px">';
  html += '<div style="font-size:10px;font-weight:700;color:var(--t2);margin-bottom:8px;letter-spacing:1px;font-family:monospace">CÁLCULO POR HORAS</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">';
  html += fld('valor_hora','Valor por hora (COP)','number') + fld('horas_trabajadas','Horas trabajadas','number');
  html += '</div>';
  html += '<div style="padding:8px 10px;background:var(--sf2);border-radius:6px;font-size:12px;color:var(--t2)" id="npag-horas-calc">Total = valor/hora × horas</div>';
  html += '</div>';

  html += sec('Valores');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">'
    + '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Moneda del pago</div>'
    + '<select id="npag-moneda" onchange="npagToggleTRM()" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'
    + '<option value="COP" selected>COP</option><option value="USD">USD</option><option value="EUR">EUR</option>'
    + '</select></div>'
    + '<div id="npag-trm-wrap"><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">TRM (COP por 1 USD)</div>'
    + '<input id="npag-trm" type="number" step="0.01" placeholder="4200.00" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>'
    + '</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:6px">';
  html += fld('valor_bruto','Valor bruto','number') + fld('deducciones','Deducciones','number') + fld('valor_neto','Neto a pagar','number',true);
  html += '</div>';
  // Conversión a USD en vivo (visible cuando moneda != USD)
  html += '<div id="npag-usd-info" style="display:none;background:rgba(0,169,141,0.06);border:1px solid rgba(0,169,141,0.2);border-radius:7px;padding:8px 12px;margin-bottom:10px;font-size:11px;color:var(--t2)">Equivalente USD: <span id="npag-usd-vals" style="font-family:monospace;font-weight:600;color:#00A98D">—</span></div>';

  html += fld('fecha_pago','Fecha límite de pago','date');

  html += sec('Observación / detalle del descuento');
  html += '<textarea id="npag-notas" rows="2" placeholder="Ej: Descuento $150.000 por anticipo — Grupo Fabuloso Abr 2026 (50% Tycoon / 50% Díaz)" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t);font-size:12px;outline:none;resize:vertical;margin-bottom:8px"></textarea>';

  html += '<button onclick="guardarPagoNomina()" style="width:100%;background:'+col+';color:#fff;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:6px">Registrar Pago</button>';
  html += '<div id="npag-err" style="font-size:11px;color:var(--d);min-height:14px"></div>';

  $('m-b').innerHTML = html;
  window._npagEmpMap = empMap;

  var calcNeto = function(){
    var b = parseFloat($('npag-valor_bruto')?.value)||0;
    var d = parseFloat($('npag-deducciones')?.value)||0;
    var nEl = $('npag-valor_neto');
    if(nEl) nEl.value = Math.round(b-d);
    calcUSD();
  };
  // Conversión a USD en vivo
  var calcUSD = function(){
    var moneda = $('npag-moneda')?.value || 'COP';
    var trm = parseFloat($('npag-trm')?.value)||0;
    var info = $('npag-usd-info');
    var vals = $('npag-usd-vals');
    if(!info || !vals) return;
    if(moneda === 'USD') { info.style.display='none'; return; }
    var b = parseFloat($('npag-valor_bruto')?.value)||0;
    var d = parseFloat($('npag-deducciones')?.value)||0;
    var n = b - d;
    if(!trm || trm <= 0) { info.style.display='block'; vals.textContent = '(ingresa TRM para ver conversión)'; return; }
    info.style.display='block';
    var bUSD, dUSD, nUSD;
    if(moneda === 'COP') { bUSD = b/trm; dUSD = d/trm; nUSD = n/trm; }
    else /* EUR */       { bUSD = b*trm; dUSD = d*trm; nUSD = n*trm; }
    var fmtUSD = function(x){return '$'+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
    vals.textContent = 'Bruto '+fmtUSD(bUSD)+' · Deduc '+fmtUSD(dUSD)+' · Neto '+fmtUSD(nUSD);
  };
  var calcHoras = function(){
    var vh = parseFloat($('npag-valor_hora')?.value)||0;
    var ht = parseFloat($('npag-horas_trabajadas')?.value)||0;
    var total = Math.round(vh * ht);
    var calc = $('npag-horas-calc');
    if(calc) calc.innerHTML = '<strong>$'+total.toLocaleString('es-CO')+'</strong> = $'+vh.toLocaleString('es-CO')+'/h × '+ht+'h';
    var bEl = $('npag-valor_bruto');
    if(bEl && total > 0){ bEl.value = total; calcNeto(); }
  };
  ['npag-valor_bruto','npag-deducciones'].forEach(function(id){
    var el=$(id); if(el) el.addEventListener('input', calcNeto);
  });
  ['npag-valor_hora','npag-horas_trabajadas'].forEach(function(id){
    var el=$(id); if(el) el.addEventListener('input', calcHoras);
  });
  // Recalcular USD si cambian moneda o TRM
  ['npag-moneda','npag-trm'].forEach(function(id){
    var el=$(id); if(el) el.addEventListener('input', calcUSD);
    if(el && el.tagName==='SELECT') el.addEventListener('change', calcUSD);
  });
  // Inicializar visibilidad TRM según moneda por defecto (COP)
  setTimeout(function(){ npagToggleTRM(); calcUSD(); }, 0);
  $('ov').classList.add('on');
}

// Mostrar/ocultar campo TRM según la moneda elegida
function npagToggleTRM() {
  var moneda = $('npag-moneda')?.value || 'COP';
  var wrap = $('npag-trm-wrap');
  if(!wrap) return;
  wrap.style.display = (moneda === 'USD') ? 'none' : 'block';
  // Actualizar etiqueta TRM según la moneda
  var lbl = wrap.querySelector('div');
  if(lbl) lbl.textContent = moneda === 'COP' ? 'TRM (COP por 1 USD)' : 'TRM (USD por 1 EUR)';
  // Trigger conversión
  var info = $('npag-usd-info');
  if(info) {
    var b = parseFloat($('npag-valor_bruto')?.value)||0;
    var d = parseFloat($('npag-deducciones')?.value)||0;
    var moneda2 = $('npag-moneda')?.value || 'COP';
    if(moneda2 === 'USD') info.style.display = 'none';
    else if(b || d) info.style.display = 'block';
  }
}

function npagOnTipo(sel) {
  var panel = $('npag-horas-panel');
  if(!panel) return;
  panel.style.display = sel.value === 'Por horas' ? 'block' : 'none';
  if(sel.value !== 'Por horas') {
    var empId = ($('npag-empleado')?.value||'').split('|')[0];
    var emp = window._npagEmpMap && window._npagEmpMap[empId];
    if(emp && emp.salario_base) {
      var val = sel.value === 'Quincenal' ? emp.salario_base/2 : emp.salario_base;
      var bEl = $('npag-valor_bruto');
      if(bEl) bEl.value = Math.round(val);
      var d = parseFloat($('npag-deducciones')?.value)||0;
      var nEl = $('npag-valor_neto');
      if(nEl) nEl.value = Math.round(val-d);
    }
  }
}

function npagOnEmp(sel) {
  var parts = (sel.value||'').split('|');
  var empId = parts[0];
  var emp = window._npagEmpMap && window._npagEmpMap[empId];
  if(!emp) return;
  var tipoEl = $('npag-tipo');
  var panel  = $('npag-horas-panel');

  // Si el contrato es Obra o labor → activar panel de horas y poner tarifa/hora
  var esObraLabor = (emp.tipo_contrato || '').toLowerCase().includes('obra');
  if(esObraLabor) {
    // Forzar tipo "Por horas"
    if(tipoEl) {
      for(var i=0;i<tipoEl.options.length;i++){
        if(tipoEl.options[i].value==='Por horas'){tipoEl.selectedIndex=i;break;}
      }
    }
    if(panel) panel.style.display = 'block';
    // Precargar valor/hora desde salario_base
    var vhEl = $('npag-valor_hora');
    if(vhEl && emp.salario_base) vhEl.value = emp.salario_base;
    // Limpiar bruto hasta que ingresen horas
    var bEl = $('npag-valor_bruto');
    if(bEl) bEl.value = '';
    var nEl = $('npag-valor_neto');
    if(nEl) nEl.value = '';
    var calc = $('npag-horas-calc');
    if(calc) calc.innerHTML = 'Tarifa: <strong>$'+Number(emp.salario_base||0).toLocaleString('es-CO')+'/hora</strong> — ingrese las horas trabajadas';
    return;
  }

  // Contrato normal: comportamiento original
  if(panel) panel.style.display = 'none';
  if(tipoEl && emp.periodicidad) {
    var map = {Quincenal:'Quincenal',Mensual:'Mensual',Honorarios:'Otro','Por proyecto':'Otro'};
    var t = map[emp.periodicidad]||'Quincenal';
    for(var i=0;i<tipoEl.options.length;i++){
      if(tipoEl.options[i].value===t){tipoEl.selectedIndex=i;break;}
    }
  }
  if(emp.salario_base) {
    var tipo = tipoEl?.value||'Quincenal';
    var val = tipo==='Quincenal' ? emp.salario_base/2 : emp.salario_base;
    var bEl = $('npag-valor_bruto');
    if(bEl) bEl.value = Math.round(val);
    var d = parseFloat($('npag-deducciones')?.value)||0;
    var nEl = $('npag-valor_neto');
    if(nEl) nEl.value = Math.round(val-d);
  }
}

async function guardarPagoNomina() {
  var empresa = $('npag-empresa').value;
  var empVal = $('npag-empleado')?.value||'';
  if(!empVal){$('npag-err').textContent='Selecciona un empleado';return;}
  var parts = empVal.split('|');
  var empId=parts[0], empNom=parts[1];
  var btn = document.querySelector('#m-b button[onclick="guardarPagoNomina()"]');
  if(btn){btn.textContent='Guardando...';btn.disabled=true;}
  // Helper: limpia separadores de miles antes de parsear (evita que "255.710" se vuelva 255.71)
  var parseNum = function(v){
    if(v==null||v==='') return 0;
    var s = String(v).trim();
    // Si tiene formato es-CO (puntos como miles, coma como decimal), normalizar
    if(/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/\./g,'').replace(',','.');
    } else {
      // Quitar comas como separador de miles (formato en-US)
      s = s.replace(/,/g,'');
    }
    var n = parseFloat(s);
    return isNaN(n)?0:n;
  };
  var bruto = parseNum($('npag-valor_bruto')?.value);
  var ded   = parseNum($('npag-deducciones')?.value);
  var neto  = parseNum($('npag-valor_neto')?.value) || (bruto-ded);
  // Moneda + TRM + conversión a USD
  var moneda = $('npag-moneda')?.value || 'COP';
  var trm    = parseNum($('npag-trm')?.value) || null;
  var brutoUsd, dedUsd, netoUsd;
  if(moneda === 'USD') {
    brutoUsd = bruto || null; dedUsd = ded || 0; netoUsd = neto || null;
  } else if(trm && trm > 0) {
    if(moneda === 'COP') { brutoUsd = bruto/trm; dedUsd = ded/trm; netoUsd = neto/trm; }
    else /* EUR */       { brutoUsd = bruto*trm; dedUsd = ded*trm; netoUsd = neto*trm; }
    brutoUsd = brutoUsd ? Math.round(brutoUsd*100)/100 : null;
    dedUsd   = dedUsd   ? Math.round(dedUsd*100)/100   : 0;
    netoUsd  = netoUsd  ? Math.round(netoUsd*100)/100  : null;
  }
  var payload={
    empresa, empleado_id:empId||null, empleado_nombre:empNom,
    tipo:$('npag-tipo')?.value||'Quincenal',
    concepto:($('npag-concepto')?.value||'').trim()||null,
    periodo_inicio:$('npag-periodo_inicio')?.value||null,
    periodo_fin:$('npag-periodo_fin')?.value||null,
    valor_bruto:bruto||null, deducciones:ded||0, valor_neto:neto||null,
    moneda:moneda, trm:trm,
    valor_bruto_usd:brutoUsd, deducciones_usd:dedUsd, valor_neto_usd:netoUsd,
    estado:$('npag-estado')?.value||'Pendiente',
    fecha_pago:$('npag-fecha_pago')?.value||null,
    notas:($('npag-notas')?.value||'').trim()||null,
    created_at:new Date().toISOString()
  };
  // Campos por horas (si aplica)
  var vh = parseFloat($('npag-valor_hora')?.value)||0;
  var ht = parseFloat($('npag-horas_trabajadas')?.value)||0;
  if(vh > 0) payload.valor_hora = vh;
  if(ht > 0) payload.horas_trabajadas = ht;
  Object.keys(payload).forEach(function(k){if(payload[k]===null)delete payload[k];});
  // Insert defensivo: si la BD no tiene alguna columna, la quita del payload y reintenta
  var {error} = await db.from('nomina_pagos').insert(payload);
  var maxRetries = 8;
  while(error && /column .* does not exist|could not find the .* column|schema cache/i.test(error.message||'') && maxRetries-- > 0) {
    var m = (error.message||'').match(/['"`]([a-zA-Z_]+)['"`]/);
    var colMissing = m ? m[1] : null;
    if(colMissing && payload.hasOwnProperty(colMissing)) {
      delete payload[colMissing];
      var retry = await db.from('nomina_pagos').insert(payload);
      error = retry.error;
    } else {
      break;
    }
  }
  if(error){
    var errMsg = error.message||'';
    if(errMsg.includes('row-level security') || errMsg.includes('RLS') || errMsg.includes('policy')) {
      $('npag-err').innerHTML = '⚠ Error de permisos. Ejecuta en Supabase:<br><code style="font-size:9px;background:rgba(0,0,0,0.1);padding:2px 6px;border-radius:4px">ALTER TABLE nomina_pagos DISABLE ROW LEVEL SECURITY;<br>ALTER TABLE nomina_empleados DISABLE ROW LEVEL SECURITY;</code>';
    } else {
      $('npag-err').textContent='Error: '+errMsg;
    }
    if(btn){btn.textContent='Registrar Pago';btn.disabled=false;}
    return;
  }
  toast('Pago registrado para '+empNom+' ✓','ok');
  closeM();
  await loadNomina(empresa);
}

async function editarPagoNomina(id, empresa) {
  var {data: p, error} = await db.from('nomina_pagos').select('*').eq('id', id).single();
  if (error || !p) { toast('Pago no encontrado','d'); return; }

  var col   = empresa === 'tycoon' ? '#5B8DB8' : '#00A98D';
  var label = empresa === 'tycoon' ? 'Tycoon' : 'Díaz Intl';
  var esPagado = p.estado === 'Pagado';

  // Calcular mora si hay fecha_pago_programado y fecha_pago_real
  var moraHTML = '';
  if (p.fecha_pago && p.fecha_pago_real) {
    var prog = new Date(p.fecha_pago + 'T12:00:00');
    var real = new Date(p.fecha_pago_real + 'T12:00:00');
    var diasMora = Math.round((real - prog) / 86400000);
    if (diasMora > 0) {
      moraHTML = '<div style="background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.25);border-radius:7px;padding:8px 12px;font-size:11px;color:#c0392b;margin-bottom:10px">⚠ Pagado con <strong>'+diasMora+' días de mora</strong> (programado: '+fd(p.fecha_pago)+' · pagado: '+fd(p.fecha_pago_real)+')</div>';
    } else if (diasMora < 0) {
      moraHTML = '<div style="background:rgba(0,85,75,0.08);border:1px solid rgba(0,85,75,0.2);border-radius:7px;padding:8px 12px;font-size:11px;color:#00554B;margin-bottom:10px">✓ Pago anticipado por <strong>'+Math.abs(diasMora)+' días</strong></div>';
    } else {
      moraHTML = '<div style="background:rgba(0,85,75,0.08);border:1px solid rgba(0,85,75,0.2);border-radius:7px;padding:8px 12px;font-size:11px;color:#00554B;margin-bottom:10px">✓ Pagado puntualmente</div>';
    }
  }

  var fld = function(id2, label2, val, type, disabled) {
    type = type||'text';
    return '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">'+label2+'</div>'
      +'<input id="ep-'+id2+'" type="'+type+'" value="'+(val||'')+'" '+(disabled?'disabled style="width:100%;background:var(--sf);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t3);font-size:12px;outline:none;cursor:not-allowed"':'style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"')+'></div>';
  };
  var sec = function(title) {
    return '<div style="font-size:9px;font-weight:700;color:var(--t3);letter-spacing:2px;text-transform:uppercase;padding:10px 0 6px;border-top:1px solid var(--br);margin-top:4px;font-family:monospace">'+title+'</div>';
  };

  $('m-t').textContent = 'Pago Nómina · ' + (p.empleado_nombre||'—');
  $('m-s').textContent = (p.tipo||'') + ' · ' + (p.concepto||'') + ' · ' + label;

  var html = '<input type="hidden" id="ep-id" value="'+id+'">';
  html += '<input type="hidden" id="ep-empresa" value="'+empresa+'">';
  html += moraHTML;

  // Info básica (readonly si está pagado)
  html += sec('Información del pago');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('concepto','Concepto',p.concepto,'text',esPagado);
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Estado</div>'
    +'<select id="ep-estado" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'
    +'<option '+(p.estado==='Pendiente'?'selected':'')+'>Pendiente</option>'
    +'<option '+(p.estado==='Procesando'?'selected':'')+'>Procesando</option>'
    +'<option '+(p.estado==='Pagado'?'selected':'')+'>Pagado</option>'
    +'</select></div>';
  // Moneda + TRM
  var pMoneda = (p.moneda||'COP').toUpperCase();
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Moneda</div>'
    +'<select id="ep-moneda" '+(esPagado?'disabled':'')+' style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'
    +'<option value="COP" '+(pMoneda==='COP'?'selected':'')+'>COP</option>'
    +'<option value="USD" '+(pMoneda==='USD'?'selected':'')+'>USD</option>'
    +'<option value="EUR" '+(pMoneda==='EUR'?'selected':'')+'>EUR</option>'
    +'</select></div>';
  html += fld('trm','TRM',p.trm,'number',esPagado);
  html += fld('valor_bruto','Valor bruto',p.valor_bruto,'number',esPagado);
  html += fld('deducciones','Deducciones',p.deducciones,'number',esPagado);
  html += fld('valor_neto','Valor neto',p.valor_neto,'number',esPagado);
  html += fld('fecha_pago','Fecha pago programada',p.fecha_pago,'date',esPagado);
  html += '</div>';
  // Mostrar conversión USD si aplica
  if(pMoneda !== 'USD' && p.trm) {
    var brutoU = (p.valor_bruto_usd != null) ? p.valor_bruto_usd : (pMoneda==='COP' ? (p.valor_bruto||0)/p.trm : (p.valor_bruto||0)*p.trm);
    var netoU  = (p.valor_neto_usd  != null) ? p.valor_neto_usd  : (pMoneda==='COP' ? (p.valor_neto||0)/p.trm  : (p.valor_neto||0)*p.trm);
    html += '<div style="background:rgba(0,169,141,0.06);border:1px solid rgba(0,169,141,0.2);border-radius:7px;padding:8px 12px;margin-bottom:6px;font-size:11px;color:var(--t2)">Equivalente USD: <span style="font-family:monospace;font-weight:600;color:#00A98D">Bruto $'+brutoU.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' · Neto $'+netoU.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</span></div>';
  } else if(pMoneda !== 'USD' && !p.trm) {
    html += '<div style="background:rgba(180,83,9,0.08);border:1px solid rgba(180,83,9,0.25);border-radius:7px;padding:8px 12px;margin-bottom:6px;font-size:11px;color:var(--warn)">⚠ Sin TRM registrada — agrega la TRM para calcular el equivalente USD.</div>';
  }
  html += '<div style="margin-bottom:4px"><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Notas</div>'
    +'<textarea id="ep-notas" rows="2" '+(esPagado?'disabled':'')+' style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t);font-size:12px;outline:none;resize:vertical">'+(p.notas||'')+'</textarea></div>';

  // REGISTRO DE PAGO EFECTIVO
  html += sec('Registro de pago efectivo');
  html += '<div style="background:rgba(0,169,141,0.06);border:1px solid rgba(0,169,141,0.2);border-radius:8px;padding:12px 14px;margin-bottom:8px">';
  html += '<div style="font-size:10px;color:var(--t2);margin-bottom:10px">Registra aquí la fecha real en que la empresa realizó el pago y adjunta el comprobante.</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">';
  html += fld('fecha_pago_real','Fecha real de pago',p.fecha_pago_real,'date',false);
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Cuenta / método</div>'
    +'<input id="ep-cuenta_pago" type="text" value="'+(p.cuenta_pago||'')+'" placeholder="Bancolombia, Nequi, Bre-B..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>';
  html += '</div>';
  // Soporte existente
  if (p.soporte_url) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--sf2);border-radius:6px;margin-bottom:8px">';
    html += '<span>📄</span><a href="'+p.soporte_url+'" target="_blank" style="font-size:11px;color:'+col+';text-decoration:none;flex:1">Ver soporte adjunto</a></div>';
  }
  html += '<label style="display:flex;align-items:center;gap:8px;background:var(--sf2);border:1px dashed var(--br);border-radius:7px;padding:8px 12px;cursor:pointer">'
    +'<span>📎</span><div><div style="font-size:11px;color:var(--t)">Adjuntar comprobante de pago</div><div style="font-size:9px;color:var(--t3)">PDF, JPG, PNG</div></div>'
    +'<input type="file" id="ep-soporte" accept=".pdf,image/*" style="display:none" onchange="document.getElementById(\'ep-file-lbl\').textContent=this.files[0]?.name||\'Adjuntar comprobante\'"></label>';
  html += '</div>';

  // Botones
  html += '<div style="display:flex;gap:8px;margin-top:10px">';
  html += '<button onclick="guardarEdicionNomina()" style="flex:1;background:'+col+';color:#fff;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">Guardar cambios</button>';
  if (!esPagado) {
    html += '<button onclick="eliminarPagoNomina()" style="background:rgba(192,57,43,0.1);color:#c0392b;border:1px solid rgba(192,57,43,0.3);border-radius:7px;padding:10px 16px;font-size:12px;font-weight:600;cursor:pointer">🗑 Eliminar</button>';
  }
  html += '</div>';
  html += '<div id="ep-err" style="font-size:11px;color:var(--d);min-height:14px;margin-top:6px"></div>';

  $('m-b').innerHTML = html;
  $('ov').classList.add('on');
}

async function guardarEdicionNomina() {
  var id      = $('ep-id').value;
  var empresa = $('ep-empresa').value;
  var btn     = document.querySelector('#m-b button[onclick="guardarEdicionNomina()"]');
  if(btn){btn.textContent='Guardando...';btn.disabled=true;}

  // Subir soporte si hay archivo
  var soporteUrl = null;
  var fileEl = $('ep-soporte');
  if (fileEl && fileEl.files && fileEl.files[0]) {
    var file = fileEl.files[0];
    // Sanitizar nombre del archivo: solo ASCII alfanumérico, guiones y puntos
    var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    var ext  = (safeName.split('.').pop() || 'bin').toLowerCase();
    var path = 'nomina/'+empresa+'/'+id+'-soporte-'+Date.now()+'.'+ext;
    var upRes = await db.storage.from('documentos-terceros').upload(path, file, {upsert:true, contentType: file.type || 'application/octet-stream'});
    if (upRes.error) {
      // Mostrar el error real al usuario en vez de continuar silenciosamente
      var msg = upRes.error.message || 'Error subiendo el archivo';
      // Errores típicos: "Bucket not found", "new row violates row-level security policy"
      if(/bucket.*not.*found/i.test(msg)) msg = 'El bucket "documentos-terceros" no existe en Supabase Storage. Crearlo (público) e intentar de nuevo.';
      else if(/row-level security|policy/i.test(msg)) msg = 'Permisos de Storage insuficientes. Verificar políticas del bucket "documentos-terceros".';
      if($('ep-err')) $('ep-err').textContent = '⚠ '+msg;
      if(btn){btn.textContent='Guardar cambios';btn.disabled=false;}
      return;
    }
    var ud = db.storage.from('documentos-terceros').getPublicUrl(path);
    soporteUrl = ud.data && ud.data.publicUrl;
  }

  // Helper: limpia separadores de miles antes de parsear
  var parseNum = function(v){
    if(v==null||v==='') return 0;
    var s = String(v).trim();
    if(/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/\./g,'').replace(',','.');
    } else {
      s = s.replace(/,/g,'');
    }
    var n = parseFloat(s);
    return isNaN(n)?0:n;
  };
  var bruto = parseNum($('ep-valor_bruto')?.value);
  var ded   = parseNum($('ep-deducciones')?.value);
  var neto  = parseNum($('ep-valor_neto')?.value) || (bruto-ded);
  var moneda = ($('ep-moneda')?.value||'COP').toUpperCase();
  var trm    = parseNum($('ep-trm')?.value) || null;
  // Conversión USD
  var brutoUsd = null, dedUsd = 0, netoUsd = null;
  if(moneda === 'USD') {
    brutoUsd = bruto || null; dedUsd = ded || 0; netoUsd = neto || null;
  } else if(trm && trm > 0) {
    if(moneda === 'COP') { brutoUsd = bruto/trm; dedUsd = ded/trm; netoUsd = neto/trm; }
    else                 { brutoUsd = bruto*trm; dedUsd = ded*trm; netoUsd = neto*trm; }
    brutoUsd = brutoUsd ? Math.round(brutoUsd*100)/100 : null;
    dedUsd   = dedUsd   ? Math.round(dedUsd*100)/100   : 0;
    netoUsd  = netoUsd  ? Math.round(netoUsd*100)/100  : null;
  }
  var estado = $('ep-estado')?.value||'Pendiente';
  var fechaReal = $('ep-fecha_pago_real')?.value||null;
  var fechaProg = $('ep-fecha_pago')?.value||null;

  // Calcular mora automáticamente
  var diasMora = null;
  if (fechaReal && fechaProg) {
    var prog = new Date(fechaProg+'T12:00:00');
    var real = new Date(fechaReal+'T12:00:00');
    diasMora = Math.round((real - prog) / 86400000);
  }

  // Si se registra fecha real, marcar como Pagado
  if (fechaReal && estado !== 'Pagado') estado = 'Pagado';

  var payload = {
    concepto:        ($('ep-concepto')?.value||'').trim()||null,
    estado,
    valor_bruto:     bruto||null,
    deducciones:     ded||0,
    valor_neto:      neto||null,
    moneda:          moneda,
    trm:             trm,
    valor_bruto_usd: brutoUsd,
    deducciones_usd: dedUsd,
    valor_neto_usd:  netoUsd,
    fecha_pago:      fechaProg,
    fecha_pago_real: fechaReal,
    cuenta_pago:     ($('ep-cuenta_pago')?.value||'').trim()||null,
    dias_mora:       diasMora,
    notas:           ($('ep-notas')?.value||'').trim()||null,
    updated_at:      new Date().toISOString()
  };
  if (soporteUrl) payload.soporte_url = soporteUrl;
  Object.keys(payload).forEach(function(k){if(payload[k]===null)delete payload[k];});

  var {error} = await db.from('nomina_pagos').update(payload).eq('id', id);
  // Retry inteligente: si la BD no tiene alguna columna, la extrae del mensaje y reintenta sin ella
  var maxRetries = 8;
  while(error && /column .* does not exist|could not find the .* column|schema cache/i.test(error.message||'') && maxRetries-- > 0) {
    var m = (error.message||'').match(/['"`]([a-zA-Z_]+)['"`]/);
    var colMissing = m ? m[1] : null;
    if(colMissing && payload.hasOwnProperty(colMissing)) {
      delete payload[colMissing];
      var retry = await db.from('nomina_pagos').update(payload).eq('id', id);
      error = retry.error;
    } else {
      break;
    }
  }
  if (error) {
    if($('ep-err')) $('ep-err').textContent = 'Error: '+error.message;
    if(btn){btn.textContent='Guardar cambios';btn.disabled=false;}
    return;
  }
  toast('Pago actualizado ✓','ok');
  closeM();
  await loadNomina(empresa);
}

async function eliminarPagoNomina() {
  if (!confirm('¿Eliminar este pago de nómina? Esta acción no se puede deshacer.')) return;
  var id      = $('ep-id').value;
  var empresa = $('ep-empresa').value;
  var {error} = await db.from('nomina_pagos').delete().eq('id', id);
  if (error) { toast('Error al eliminar: '+error.message,'d'); return; }
  toast('Pago eliminado','ok');
  closeM();
  await loadNomina(empresa);
}

// ══════════════════════════════════════════════════════════════
// DESPRENDIBLE DE PAGO
// ══════════════════════════════════════════════════════════════
async function desprendiblePago(id, empresa) {
  var {data: p} = await db.from('nomina_pagos').select('*').eq('id', id).single();
  if (!p) { toast('Pago no encontrado','d'); return; }

  // Buscar datos del empleado en terceros
  var tabla = empresa === 'tycoon' ? 'terceros_tycoon' : 'terceros_diaz';
  var empNom = p.empleado_nombre || 'Empleado';
  var empData = null;
  if (p.empleado_id) {
    var {data: ed} = await db.from(tabla).select('*').eq('id', p.empleado_id).single();
    empData = ed;
  }

  var empresa_label = empresa === 'tycoon' ? 'TYCOON GURU' : 'DÍAZ INTERNATIONAL';
  var empresa_color = empresa === 'tycoon' ? '#012459' : '#00554B';

  var bruto = p.valor_bruto||0;
  var ded   = p.deducciones||0;
  var neto  = p.valor_neto||(bruto-ded);
  var moneda = (p.moneda||'COP').toUpperCase();
  var trm = parseFloat(p.trm)||0;
  var netoUSD = (p.valor_neto_usd!=null) ? p.valor_neto_usd
              : (moneda==='USD') ? neto
              : (moneda==='COP' && trm>0) ? neto/trm
              : (moneda==='EUR' && trm>0) ? neto*trm
              : null;

  var fmtMoney = function(n){return '$'+(n||0).toLocaleString('es-CO');};
  var fmtUSD   = function(n){return '$'+(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var fmtDate  = function(d){return d ? new Date(d+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—';};

  var html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Desprendible · ${empNom}</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:8.5pt;color:#0d1f35;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:140mm;min-height:auto;margin:0 auto;background:#fff;padding:8mm 9mm}
  /* Cabecera compacta */
  .hdr{background:${empresa_color};color:#fff;padding:5mm 7mm;display:flex;justify-content:space-between;align-items:center;margin:-8mm -9mm 5mm}
  .hdr .brand{font-size:11pt;font-weight:800;letter-spacing:1.5px}
  .hdr .brand-sub{font-size:6pt;opacity:0.7;letter-spacing:1.5px;margin-top:0.5mm;text-transform:uppercase}
  .hdr .doc{text-align:right}
  .hdr .doc-t{font-size:9pt;font-weight:700;letter-spacing:0.8px}
  .hdr .doc-p{font-size:7pt;opacity:0.85;margin-top:0.5mm}
  /* Bloques 2 columnas */
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:4mm}
  .blk{background:#f6f8fb;border:1px solid #e3e8ee;border-radius:2px;padding:3mm 3.5mm}
  .blk-t{font-size:6pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5c6c7c;margin-bottom:2mm;padding-bottom:1.5mm;border-bottom:1px solid #e3e8ee}
  .row{display:flex;justify-content:space-between;align-items:baseline;padding:1mm 0;font-size:7.5pt}
  .row .k{color:#5c6c7c}
  .row .v{font-weight:700;color:#0d1f35;text-align:right;max-width:60%;word-break:break-word}
  /* Bloque montos destacado */
  .montos{background:#fff;border:1.5px solid ${empresa_color};border-radius:3px;padding:3mm 4mm;margin-bottom:4mm}
  .montos table{width:100%;border-collapse:collapse}
  .montos td{padding:1.5mm 0;font-size:8.5pt;border-bottom:1px dotted #e3e8ee}
  .montos tr:last-child td{border-bottom:none}
  .montos td.k{color:#5c6c7c;font-size:7.5pt}
  .montos td.v{text-align:right;font-family:'Courier New',monospace;font-weight:700}
  .montos .pos{color:#155724}
  .montos .neg{color:#8b0000}
  .montos .total td{padding-top:2.5mm;border-top:1.5px solid ${empresa_color};border-bottom:none;font-weight:800}
  .montos .total td.v{font-size:11pt;color:${empresa_color}}
  .montos .total td.k{font-size:8pt;color:${empresa_color};letter-spacing:1px;text-transform:uppercase}
  .usdrow td{font-size:7pt;color:#5c6c7c;border-bottom:none;padding-top:0.5mm}
  /* Nota descuento */
  .nota{background:#fffbe6;border-left:2px solid #f59e0b;padding:2mm 3mm;font-size:7pt;color:#8a5a00;margin-bottom:3mm;font-style:italic;line-height:1.4}
  /* Legal compacto */
  .legal{background:#f7f8fa;border-left:2px solid #adb8c5;padding:2.5mm 3.5mm;margin-bottom:4mm}
  .legal p{font-size:6.5pt;color:#5c6c7c;line-height:1.5;text-align:justify}
  /* Firmas compactas */
  .firmas{display:flex;gap:5mm;margin-top:5mm}
  .firma{flex:1;text-align:center}
  .firma-ln{border-top:1px solid #5c6c7c;width:75%;margin:6mm auto 1mm}
  .firma-lbl{font-size:6.5pt;color:#5c6c7c}
  .firma-nm{font-size:7pt;font-weight:700;margin-top:0.5mm}
  /* Pie */
  .footer{margin-top:4mm;padding-top:2mm;border-top:1px solid #e3e8ee;display:flex;justify-content:space-between;font-size:6pt;color:#8a9bb0;font-family:'Courier New',monospace;letter-spacing:0.5px}
  /* Badge */
  .bd{display:inline-block;font-size:6.5pt;font-weight:700;padding:0.5mm 2mm;border-radius:8px;letter-spacing:0.5px;text-transform:uppercase}
  .bd-ok{background:#d4edda;color:#155724}.bd-pend{background:#fff3cd;color:#856404}.bd-pr{background:#cce5ff;color:#004085}
  /* Botones pantalla */
  .btn-bar{position:fixed;top:6mm;right:6mm;display:flex;gap:6px;z-index:99}
  .btn-bar button{border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:9pt;font-weight:700;font-family:Arial,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.12)}
  .btn-print{background:${empresa_color};color:#fff}
  .btn-close{background:#e8ecf0;color:#333}
  /* IMPRESIÓN: media carta, una sola página */
  @page{size:140mm 216mm;margin:0}
  @media print{
    html,body{width:140mm}
    .page{width:140mm;margin:0;padding:7mm 9mm}
    .hdr{margin:-7mm -9mm 4mm}
    .btn-bar{display:none!important}
    .page,.hdr,.blk,.montos,.legal,.nota,.footer{page-break-inside:avoid}
  }
</style></head><body>
<div class="btn-bar">
  <button class="btn-close" onclick="window.close()">Cerrar</button>
  <button class="btn-print" onclick="window.print()">🖨 Imprimir / PDF</button>
</div>
<div class="page">

  <div class="hdr">
    <div>
      <div class="brand">${empresa_label}</div>
      <div class="brand-sub">Nómina · Desprendible</div>
    </div>
    <div class="doc">
      <div class="doc-t">DESPRENDIBLE DE PAGO</div>
      <div class="doc-p">${fmtDate(p.periodo_inicio)} → ${fmtDate(p.periodo_fin)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="blk">
      <div class="blk-t">Empleado</div>
      <div class="row"><span class="k">Nombre</span><span class="v">${empNom}</span></div>
      <div class="row"><span class="k">Cargo</span><span class="v">${empData?.cargo||'—'}</span></div>
      <div class="row"><span class="k">Documento</span><span class="v">${empData?.numero_documento||'—'}</span></div>
      <div class="row"><span class="k">Banco</span><span class="v">${empData?.banco||'—'}</span></div>
      <div class="row"><span class="k">Cuenta</span><span class="v">${empData?.numero_cuenta||'—'}</span></div>
    </div>
    <div class="blk">
      <div class="blk-t">Pago</div>
      <div class="row"><span class="k">Tipo</span><span class="v">${p.tipo||'—'}</span></div>
      <div class="row"><span class="k">Concepto</span><span class="v">${p.concepto||'—'}</span></div>
      <div class="row"><span class="k">Fecha programada</span><span class="v">${fmtDate(p.fecha_pago)}</span></div>
      <div class="row"><span class="k">Fecha efectiva</span><span class="v">${fmtDate(p.fecha_pago_real)}</span></div>
      <div class="row"><span class="k">Estado</span><span class="v"><span class="bd bd-${(p.estado||'pendiente').toLowerCase()==='pagado'?'ok':(p.estado||'').toLowerCase()==='procesando'?'pr':'pend'}">${p.estado||'Pendiente'}</span></span></div>
    </div>
  </div>

  <div class="montos">
    <table>
      <tr><td class="k">${p.concepto||'Pago de nómina'}</td><td class="v pos">${fmtMoney(bruto)}</td></tr>
      ${ded>0?`<tr><td class="k">Deducciones / descuentos</td><td class="v neg">-${fmtMoney(ded)}</td></tr>`:''}
      <tr class="total"><td class="k">Neto a pagar</td><td class="v">${fmtMoney(Math.round(neto))} ${moneda}</td></tr>
      ${(moneda!=='USD' && netoUSD!=null)?`<tr class="usdrow"><td class="k">Equivalente USD (TRM ${trm.toLocaleString('es-CO')})</td><td class="v" style="color:#5c6c7c">${fmtUSD(netoUSD)}</td></tr>`:''}
    </table>
  </div>

  ${p.notas?`<div class="nota"><strong>📝 Observación:</strong> ${p.notas}</div>`:''}
  ${(p.valor_hora && p.horas_trabajadas)?`<div class="nota"><strong>⏱ Horas:</strong> ${p.horas_trabajadas}h × $${Number(p.valor_hora).toLocaleString('es-CO')}/h = $${Math.round(p.valor_hora*p.horas_trabajadas).toLocaleString('es-CO')}</div>`:''}

  <div class="legal">
    <p>Pago por contrato de prestación de servicios con entidad extranjera. En Colombia, contrato civil sin relación laboral (CST art. 23, Ley 80/1993 art. 32). El contratista asume sus obligaciones fiscales y de seguridad social. La entidad pagadora no tiene calidad de empleador.</p>
  </div>

  <div class="firmas">
    <div class="firma">
      <div class="firma-ln"></div>
      <div class="firma-lbl">Firma contratista</div>
      <div class="firma-nm">${empNom}</div>
    </div>
    <div class="firma">
      <div class="firma-ln"></div>
      <div class="firma-lbl">Firma autorizada</div>
      <div class="firma-nm">${empresa_label}</div>
    </div>
  </div>

  <div class="footer">
    <span>Generado ${new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</span>
    <span>Confidencial · Uso interno</span>
  </div>

</div>
</body></html>`;

  var win = window.open('', '_blank', 'width=750,height=900,scrollbars=yes');
  if (!win) { toast('Permite ventanas emergentes para generar el desprendible','w'); return; }
  win.document.write(html);
  win.document.close();
}

// ── REPORTE NÓMINA globals ───────────────────────────────────
var _rnom_rows = {tycoon:[], diaz:[]};
var _rnom_empMap = {tycoon:{}, diaz:{}};


// ══════════════════════════════════════════════════════════════
// REPORTE DE NÓMINA POR PERÍODO
// ══════════════════════════════════════════════════════════════
async function loadReporteNomina(empresa) {
  var slug = empresa==='tycoon'?'ty':'dz';
  var col  = empresa==='tycoon'?'#012459':'#00554B';

  var desde = $('rnom-'+slug+'-desde')?.value||null;
  var hasta = $('rnom-'+slug+'-hasta')?.value||null;
  var tipo  = $('rnom-'+slug+'-tipo')?.value||null;

  // Construir query
  var q = db.from('nomina_pagos').select('*').eq('empresa', empresa).order('empleado_nombre');
  if(desde) q = q.gte('periodo_inicio', desde);
  if(hasta) q = q.lte('periodo_fin', hasta);
  if(tipo)  q = q.eq('tipo', tipo);

  var {data: rows, error} = await q;
  if(error){ toast('Error cargando reporte: '+error.message,'d'); return; }
  rows = rows || [];
  _rnom_rows[empresa] = rows;

  // Cargar datos de empleados para banco y cuenta
  var tabla = empresa==='tycoon'?'terceros_tycoon':'terceros_diaz';
  var {data: emps} = await db.from(tabla).select('id,nombre,banco,tipo_cuenta,numero_cuenta,tipo_contrato').order('nombre');
  var empMap = {};
  (emps||[]).forEach(function(e){ empMap[e.id] = e; });
  _rnom_empMap[empresa] = empMap;

  // KPIs
  var totalBruto = rows.reduce(function(a,r){return a+(r.valor_bruto||0);},0);
  var totalDed   = rows.reduce(function(a,r){return a+(r.deducciones||0);},0);
  var totalNeto  = rows.reduce(function(a,r){return a+(r.valor_neto||0);},0);
  var uniq = [...new Set(rows.map(function(r){return r.empleado_nombre;}))].length;

  var colAcc = empresa==='tycoon'?'#5B8DB8':'#00A98D';
  var kpis = [
    ['Empleados',uniq,'en este período','var(--t)'],
    ['Total bruto',fm(totalBruto),'suma devengados',colAcc],
    ['Descuentos',fm(totalDed),'deducciones',totalDed>0?'#D22630':'var(--t3)'],
    ['Neto a pagar',fm(totalNeto),'transferencias','#00554B']
  ].map(function(k){
    return '<div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:14px 16px;border-top:3px solid '+k[3]+'">'
      +'<div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">'+k[0]+'</div>'
      +'<div style="font-size:20px;font-weight:700;color:'+k[3]+';font-family:monospace">'+k[2+0]+'</div>'
      +'<div style="font-size:9px;color:var(--t3);margin-top:3px">'+k[2]+'</div></div>';
  }).join('');

  // Helper: calcula equivalente USD para un pago (usa valor_neto_usd si existe; si no, calcula con TRM)
  var toUSD = function(r, valor){
    if(valor == null || valor === 0) return 0;
    var moneda = (r.moneda || 'COP').toUpperCase();
    if(moneda === 'USD') return valor;
    var trm = parseFloat(r.trm)||0;
    if(!trm || trm <= 0) return null; // sin TRM no podemos convertir
    if(moneda === 'COP') return valor / trm;
    if(moneda === 'EUR') return valor * trm;
    return null;
  };
  // Totales en USD del período (suma sólo lo que se puede convertir)
  var totalBrutoUSD = 0, totalNetoUSD = 0, totalDedUSD = 0, faltaTRM = 0;
  rows.forEach(function(r){
    var bU = (r.valor_bruto_usd != null) ? r.valor_bruto_usd : toUSD(r, r.valor_bruto||0);
    var nU = (r.valor_neto_usd  != null) ? r.valor_neto_usd  : toUSD(r, r.valor_neto||0);
    var dU = (r.deducciones_usd != null) ? r.deducciones_usd : toUSD(r, r.deducciones||0);
    if(bU != null) totalBrutoUSD += bU; else if((r.valor_bruto||0) > 0 && (r.moneda||'COP') !== 'USD') faltaTRM++;
    if(nU != null) totalNetoUSD  += nU;
    if(dU != null) totalDedUSD   += dU;
  });

  // KPIs (la versión "fix" con valores correctos)
  kpis = [
    ['Empleados',uniq,'en este período','var(--t)'],
    ['Total bruto',fm(totalBruto),'COP — '+fm(totalBrutoUSD)+' USD',colAcc],
    ['Descuentos',fm(totalDed),'COP — '+fm(totalDedUSD)+' USD',totalDed>0?'#D22630':'var(--t3)'],
    ['Neto a pagar',fm(totalNeto),'COP — '+fm(totalNetoUSD)+' USD','#00554B']
  ].map(function(k){
    return '<div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:14px 16px;border-top:3px solid '+k[3]+'">'
      +'<div style="font-size:9px;color:var(--text-soft);font-family:monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;font-weight:600">'+k[0]+'</div>'
      +'<div style="font-size:20px;font-weight:700;color:'+k[3]+';font-family:monospace">'+k[1]+'</div>'
      +'<div style="font-size:9px;color:var(--t3);margin-top:3px">'+k[2]+'</div></div>';
  }).join('');

  if($('rnom-'+slug+'-kpis')) $('rnom-'+slug+'-kpis').innerHTML = kpis;

  // Aviso si hay filas sin TRM
  var avisoTRM = faltaTRM > 0
    ? '<div style="background:rgba(180,83,9,0.08);border:1px solid rgba(180,83,9,0.25);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:var(--warn)">⚠ '+faltaTRM+' pago(s) sin TRM registrada — sus equivalentes USD no se incluyen en los totales. Edita esos pagos para agregar la TRM.</div>'
    : '';

  // Tabla
  var estCol = {Pagado:'#00554B',Pendiente:'#d4870a',Procesando:'#5B8DB8'};
  var tipCol = {Quincenal:'#5B8DB8',Mensual:'#8B5CF6','Por horas':'#0F6E56',Comision:'#e06200',Otro:'#5B6770'};

  var rows_html = rows.length ? rows.map(function(r) {
    var emp = empMap[r.empleado_id]||{};
    var ec  = estCol[r.estado]||'#5B6770';
    var tc  = tipCol[r.tipo]||'#5B6770';

    var banco = emp.banco||'—';
    var cuenta = emp.numero_cuenta||'—';
    var cuentaLbl = (emp.banco==='Nequi'||emp.banco==='Bre-B'||emp.banco==='Daviplata') ? 'Llave: '+cuenta : cuenta;

    var mora = '';
    if(r.dias_mora!=null) {
      if(r.dias_mora>0)       mora = '<br><span style="font-size:9px;color:#c0392b;font-weight:600">+'+r.dias_mora+'d mora</span>';
      else if(r.dias_mora<0)  mora = '<br><span style="font-size:9px;color:#00554B">⚡'+Math.abs(r.dias_mora)+'d antes</span>';
      else                    mora = '<br><span style="font-size:9px;color:#00554B">✓ puntual</span>';
    }

    // Horas info
    var horasInfo = '';
    if(r.tipo==='Por horas' && r.valor_hora && r.horas_trabajadas) {
      horasInfo = '<span style="font-size:9px;color:var(--t3);display:block;margin-top:2px">$'+r.valor_hora.toLocaleString('es-CO')+'/h × '+r.horas_trabajadas+'h</span>';
    }

    // Conversión USD para esta fila
    var moneda = (r.moneda || 'COP').toUpperCase();
    var bUSD = (r.valor_bruto_usd != null) ? r.valor_bruto_usd : toUSD(r, r.valor_bruto||0);
    var nUSD = (r.valor_neto_usd  != null) ? r.valor_neto_usd  : toUSD(r, r.valor_neto||0);
    var fmtUSD = function(x){ return x==null ? '—' : '$'+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); };
    // Etiqueta de moneda + TRM
    var trmInfo = (moneda !== 'USD' && r.trm) ? '<div style="font-size:8px;color:var(--t3);margin-top:2px">TRM: '+Number(r.trm).toLocaleString('es-CO')+'</div>' : '';
    var monedaPill = '<span style="font-size:8px;padding:1px 5px;border-radius:8px;background:rgba(75,85,99,0.10);color:var(--t3);font-family:monospace;letter-spacing:0.5px">'+moneda+'</span>';

    return '<tr>'
      +'<td><div style="font-weight:700;font-size:12px;color:#0d1f35">'+sanitize(r.empleado_nombre||'—')+'</div></td>'
      +'<td><div style="font-size:11px;font-family:monospace;color:var(--t)">'+sanitize(cuentaLbl)+'</div>'
      +'<div style="font-size:10px;color:var(--t3);margin-top:2px">'+sanitize(banco)+'</div></td>'
      +'<td style="font-size:10px;color:var(--t2)">'+(r.periodo_inicio?fd(r.periodo_inicio):'—')+(r.periodo_fin?'<br>→ '+fd(r.periodo_fin):'')+'</td>'
      +'<td style="text-align:right"><span style="font-size:10px;padding:2px 8px;border-radius:10px;background:'+tc+'18;color:'+tc+'">'+sanitize(r.tipo||'—')+'</span></td>'
      +'<td style="text-align:right;font-family:monospace;font-size:11px;color:var(--t2)">'+fm(r.valor_bruto||0)+' '+monedaPill+horasInfo+trmInfo+'</td>'
      +'<td style="text-align:right;font-family:monospace;font-size:11px;color:#D22630">'+fm(r.deducciones||0)+'</td>'
      +'<td style="text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:var(--t)">'+fm(r.valor_neto||0)+'</td>'
      +'<td style="text-align:right;font-family:monospace;font-size:11px;color:var(--t2)">'+fmtUSD(bUSD)+'</td>'
      +'<td style="text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:#00554B">'+fmtUSD(nUSD)+'</td>'
      +'<td style="font-size:10px;max-width:160px"><div style="color:var(--t3);font-style:italic;line-height:1.4;background:var(--sf2);border-radius:5px;padding:4px 7px;font-size:10px">'+sanitize(r.notas||'—')+'</div></td>'
      +'<td style="font-size:10px;white-space:nowrap">'+(r.fecha_pago?fd(r.fecha_pago):'—')+mora+'</td>'
      +'<td><span style="font-size:10px;padding:2px 8px;border-radius:10px;background:'+ec+'18;color:'+ec+'">'+sanitize(r.estado||'—')+'</span></td>'
      +'</tr>';
  }).join('') : '<tr><td colspan="12" class="mod-empty">Sin pagos en este período</td></tr>';

  var fmtUSDtot = function(x){ return '$'+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var totales = '<tfoot><tr style="border-top:2px solid var(--br)">'
    +'<td colspan="4" style="font-size:11px;color:var(--t3);padding:10px 8px;font-weight:600">Totales del período</td>'
    +'<td style="text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:var(--t2)">'+fm(totalBruto)+'</td>'
    +'<td style="text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:#D22630">'+fm(totalDed)+'</td>'
    +'<td style="text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:var(--t)">'+fm(totalNeto)+'</td>'
    +'<td style="text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:var(--t2)">'+fmtUSDtot(totalBrutoUSD)+'</td>'
    +'<td style="text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:#00554B">'+fmtUSDtot(totalNetoUSD)+'</td>'
    +'<td colspan="3"></td></tr></tfoot>';

  var tabla_html = avisoTRM + '<div class="tw"><div class="tw-scroll"><table>'
    +'<thead><tr>'
    +'<th>Empleado</th><th>Cuenta / Llave / Banco</th><th>Período</th><th>Tipo</th>'
    +'<th style="text-align:right">Bruto</th><th style="text-align:right">Descuento</th><th style="text-align:right">Neto</th>'
    +'<th style="text-align:right">Bruto USD</th><th style="text-align:right">Neto USD</th>'
    +'<th>Observación descuento</th><th>Límite pago</th><th>Estado</th>'
    +'</tr></thead><tbody>'+rows_html+'</tbody>'+totales+'</table></div></div>';

  if($('rnom-'+slug+'-table')) $('rnom-'+slug+'-table').innerHTML = tabla_html;
}

async function imprimirReporte(empresa) {
  var slug = empresa==='tycoon'?'ty':'dz';
  var desde = $('rnom-'+slug+'-desde')?.value||'';
  var hasta = $('rnom-'+slug+'-hasta')?.value||'';
  var label = empresa==='tycoon'?'TYCOON GURU':'DÍAZ INTERNATIONAL';
  var col   = empresa==='tycoon'?'#012459':'#00554B';

  // Capturar tabla actual
  var tablaEl = $('rnom-'+slug+'-table');
  if(!tablaEl||!tablaEl.innerHTML){ toast('Carga el reporte primero','w'); return; }

  var periodo = desde||hasta ? (desde?fd(desde):'') + (desde&&hasta?' – ':'') + (hasta?fd(hasta):'') : 'Todos los períodos';

  var html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Nómina · ${label}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hdr{background:${col};color:#fff;padding:10mm 8mm;display:flex;justify-content:space-between;align-items:center}
  .hdr-logo{font-size:16pt;font-weight:900;letter-spacing:3px}
  .hdr-sub{font-size:7pt;opacity:0.65;letter-spacing:1px;margin-top:2px}
  .hdr-right{text-align:right;font-size:10pt;font-weight:700}
  .hdr-period{font-size:7.5pt;opacity:0.75;margin-top:3px}
  .body{padding:6mm 8mm}
  .kpi-row{display:flex;gap:4mm;margin-bottom:5mm}
  .kpi{flex:1;background:#f5f7fa;border-radius:4px;padding:3.5mm 4mm;border-top:2px solid ${col}}
  .kpi-label{font-size:6pt;text-transform:uppercase;letter-spacing:1.5px;color:#6b7c8f;margin-bottom:2mm}
  .kpi-val{font-size:13pt;font-weight:700;color:#111;font-family:'Courier New',monospace}
  table{width:100%;border-collapse:collapse;font-size:8pt}
  th{background:#f0f3f7;padding:3mm;text-align:left;font-size:6.5pt;text-transform:uppercase;letter-spacing:0.5px;color:#5c6c7c;border-bottom:1.5px solid ${col}}
  th.r{text-align:right}
  td{padding:2.5mm 3mm;border-bottom:0.5px solid #edf0f4;vertical-align:top}
  td.r{text-align:right;font-family:'Courier New',monospace;font-weight:700}
  .pos{color:#00554B}.neg{color:#8b0000}
  .badge{display:inline-block;font-size:6pt;padding:1px 5px;border-radius:8px;font-weight:700;text-transform:uppercase}
  .badge-p{background:#fff3cd;color:#856404}
  .badge-ok{background:#d4edda;color:#155724}
  .badge-pr{background:#cce5ff;color:#004085}
  .nota{font-size:7pt;color:#5c6c7c;font-style:italic;background:#f8f9fa;padding:2px 4px;border-radius:2px;border-left:1.5px solid #adb8c5}
  .total-row td{background:#f0f3f7;font-weight:700;border-top:1.5px solid ${col};padding:3mm}
  .footer{margin-top:4mm;padding:2mm 0;border-top:0.5px solid #dde2ea;display:flex;justify-content:space-between;font-size:6pt;color:#8a9bb0}
  .no-print{display:flex;justify-content:flex-end;gap:4mm;padding:4mm 8mm;border-top:0.5px solid #dde2ea}
  .btn{padding:2mm 5mm;border-radius:3px;border:none;cursor:pointer;font-size:9pt;font-family:Arial,sans-serif;font-weight:700}
  .btn-p{background:${col};color:#fff}
  .btn-c{background:#e8ecf0;color:#333}
  @page{size:landscape;margin:0}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="hdr">
  <div><div class="hdr-logo">${empresa==='tycoon'?'TYCOON':'DÍAZ'}</div><div class="hdr-sub">${label}</div></div>
  <div class="hdr-right">REPORTE DE NÓMINA<div class="hdr-period">Período: ${periodo}</div></div>
</div>
<div class="body">
  <div id="kpi-print" class="kpi-row"></div>
  <table>
    <thead><tr>
      <th>Empleado / Banco</th><th>Cuenta / Llave</th><th>Período</th><th>Tipo</th>
      <th class="r">Bruto</th><th class="r">Descuento</th><th class="r">Neto</th>
      <th>Observación descuento</th><th>Límite pago</th><th>Estado</th>
    </tr></thead>
    <tbody id="print-tbody"></tbody>
  </table>
  <div class="footer">
    <span>Generado: ${new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})} · ${label}</span>
    <span>Documento de aprobación de pagos · Confidencial</span>
  </div>
</div>
<div class="no-print">
  <button class="btn btn-c" onclick="window.close()">Cerrar</button>
  <button class="btn btn-p" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
</div>
<script>
  var rows = ${JSON.stringify(_rnom_rows[empresa]||[])};
  var empMap = ${JSON.stringify(_rnom_empMap[empresa]||{})};
  var empByNom={};Object.values(empMap).forEach(function(e){if(e.nombre)empByNom[e.nombre.trim().toUpperCase()]=e;});
  var totalB=0,totalD=0,totalN=0,totalEmp=new Set();
  var tipCol={Quincenal:'#1565c0',Mensual:'#6a1b9a','Por horas':'#1b5e20',Comision:'#e65100',Otro:'#37474f'};
  var estCls={Pagado:'badge-ok',Pendiente:'badge-p',Procesando:'badge-pr'};
  var tbody = document.getElementById('print-tbody');
  rows.forEach(function(r){
    totalB+=(r.valor_bruto||0); totalD+=(r.deducciones||0); totalN+=(r.valor_neto||0);
    totalEmp.add(r.empleado_nombre);
    var emp=empMap[r.empleado_id]||empByNom[(r.empleado_nombre||'').trim().toUpperCase()]||{};
    var banco=emp.banco||r.banco||'—';
    var cta=emp.numero_cuenta||r.numero_cuenta||'—';
    var ctaLbl=(banco==='Nequi'||banco==='Bre-B'||banco==='Daviplata')?'Llave: '+cta:cta;
    var tc=tipCol[r.tipo]||'#37474f';
    var horasInfo=(r.tipo==='Por horas'&&r.valor_hora&&r.horas_trabajadas)?'<br><small>$'+r.valor_hora.toLocaleString('es-CO')+'/h × '+r.horas_trabajadas+'h</small>':'';
    var mora='';
    if(r.dias_mora!=null){if(r.dias_mora>0)mora='<br><span style="color:#8b0000;font-size:7pt">+'+r.dias_mora+'d mora</span>';else if(r.dias_mora<0)mora='<br><span style="color:#155724;font-size:7pt">-'+Math.abs(r.dias_mora)+'d</span>';}
    var fecha_prog=r.fecha_pago?new Date(r.fecha_pago+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}):'—';
    var per=(r.periodo_inicio?new Date(r.periodo_inicio+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'}):'—')+(r.periodo_fin?'<br>'+new Date(r.periodo_fin+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}):'');
    var fmtCO=function(n){return '$'+(n||0).toLocaleString('es-CO');};
    var tr=document.createElement('tr');
    tr.innerHTML='<td><strong>'+(r.empleado_nombre||'—')+'</strong><br><span style="font-size:7pt;color:#5c6c7c">'+banco+'</span></td>'
      +'<td style="font-size:8pt;font-family:Courier New,monospace">'+ctaLbl+'</td>'
      +'<td style="font-size:8pt">'+per+'</td>'
      +'<td><span class="badge" style="background:'+tc+'18;color:'+tc+'">'+(r.tipo||'—')+'</span></td>'
      +'<td class="r pos">'+fmtCO(r.valor_bruto)+horasInfo+'</td>'
      +'<td class="r neg">'+fmtCO(r.deducciones)+'</td>'
      +'<td class="r">'+fmtCO(r.valor_neto)+'</td>'
      +'<td><div class="nota">'+(r.notas||'—')+'</div></td>'
      +'<td style="font-size:8pt">'+fecha_prog+mora+'</td>'
      +'<td><span class="badge '+(estCls[r.estado]||'badge-p')+'">'+(r.estado||'—')+'</span></td>';
    tbody.appendChild(tr);
  });
  // Fila totales
  var totRow=document.createElement('tr');
  totRow.className='total-row';
  var fmt=function(n){return '$'+n.toLocaleString('es-CO');};
  totRow.innerHTML='<td colspan="4">Totales ('+totalEmp.size+' empleados)</td>'
    +'<td class="r pos">'+fmt(totalB)+'</td><td class="r neg">'+fmt(totalD)+'</td><td class="r">'+fmt(totalN)+'</td>'
    +'<td colspan="3"></td>';
  tbody.appendChild(totRow);
  // KPIs
  var kpiData=[['Empleados',totalEmp.size,'en este período'],['Total bruto',fmt(totalB),'devengado'],['Descuentos',fmt(totalD),'deducciones'],['Neto a pagar',fmt(totalN),'a transferir']];
  document.getElementById('kpi-print').innerHTML=kpiData.map(function(k){
    return '<div class="kpi"><div class="kpi-label">'+k[0]+'</div><div class="kpi-val">'+k[1]+'</div><div style="font-size:6.5pt;color:#6b7c8f;margin-top:1mm">'+k[2]+'</div></div>';
  }).join('');
<\/script>
</body></html>`;

  var win = window.open('','_blank','width=1100,height=800,scrollbars=yes');
  if(!win){ toast('Permite ventanas emergentes para generar el reporte','w'); return; }
  win.document.write(html);
  win.document.close();
}

// ══════════════════════════════════════════════════════════════
// REPORTE LIGERO PARA CONSIGNACIONES (cajero/contabilidad)
// ══════════════════════════════════════════════════════════════
async function imprimirConsignaciones(empresa) {
  var slug  = empresa==='tycoon'?'ty':'dz';
  var label = empresa==='tycoon'?'TYCOON GURU':'DÍAZ INTERNATIONAL';
  var col   = empresa==='tycoon'?'#012459':'#00554B';
  var colAcc= empresa==='tycoon'?'#5B8DB8':'#00A98D';

  var rows = _rnom_rows[empresa]||[];
  if(!rows.length){ toast('Carga el reporte primero','w'); return; }
  var empMap = _rnom_empMap[empresa]||{};

  var desde = $('rnom-'+slug+'-desde')?.value||'';
  var hasta = $('rnom-'+slug+'-hasta')?.value||'';
  var periodoLabel = (desde && hasta)
    ? new Date(desde+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})
      +' al '+new Date(hasta+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})
    : 'Período no especificado';

  var html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Consignaciones · ${label}</title>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#0d1f35;font-size:8pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .doc{width:190mm;margin:0 auto;background:#fff;padding:8mm 10mm}
  .head{background:${col};color:#fff;padding:5mm 8mm;display:flex;justify-content:space-between;align-items:center;margin:-8mm -10mm 5mm}
  .head .brand{font-size:11pt;font-weight:800;letter-spacing:1.5px}
  .head .brand-sub{font-size:6pt;opacity:0.7;letter-spacing:1.5px;margin-top:0.5mm;text-transform:uppercase}
  .head .doc-info{text-align:right}
  .head .doc-t{font-size:9pt;font-weight:700;letter-spacing:0.8px}
  .head .doc-p{font-size:7pt;opacity:0.85;margin-top:0.5mm}
  .kpis{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2.5mm;margin-bottom:4mm}
  .kpi{background:#f6f8fb;border-left:2.5px solid ${colAcc};padding:2.5mm 3.5mm;border-radius:2px}
  .kpi .lbl{font-size:5.5pt;color:#374151;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:0.5mm;font-weight:700;font-family:'Courier New',monospace}
  .kpi .val{font-size:11pt;font-weight:700;color:${col};line-height:1.1}
  .kpi .sub{font-size:5.5pt;color:#6b7280;margin-top:0.5mm}
  table{width:100%;border-collapse:collapse;margin-bottom:3mm}
  thead th{background:${col};color:#fff;padding:1.8mm 2.5mm;text-align:left;font-size:6.5pt;font-weight:700;letter-spacing:0.8px;text-transform:uppercase}
  thead th.r{text-align:right}
  tbody td{padding:1.8mm 2.5mm;border-bottom:1px solid #e5e7eb;font-size:7.5pt;vertical-align:middle}
  tbody td.r{text-align:right;font-family:'Courier New',monospace;font-weight:600}
  tbody tr:nth-child(even){background:#fafbfc}
  .empl{font-weight:700;color:#0d1f35;font-size:8pt}
  .cta{font-family:'Courier New',monospace;color:#1f2937;font-size:7.5pt}
  .banco{font-size:6.5pt;color:#6b7280;margin-top:0.3mm}
  .neto{color:${col};font-size:8.5pt}
  .neto-mon{font-size:6pt;color:#6b7280;display:block;margin-top:0.3mm}
  .total-row td{background:#f3f4f6;font-weight:800;color:${col};border-top:1.5px solid ${col};border-bottom:none;padding:2.5mm}
  .total-row td.r{font-size:9pt}
  .novedades{margin-top:3mm;padding:2.5mm 3.5mm;background:#fffbeb;border-left:2px solid #f59e0b;border-radius:2px}
  .novedades h2{font-size:7pt;color:#92400e;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:2mm;font-family:'Courier New',monospace}
  .novedades ul{list-style:none}
  .novedades li{padding:1.2mm 0;border-bottom:1px dashed #fde68a;font-size:7pt;color:#451a03;line-height:1.35}
  .novedades li:last-child{border-bottom:none}
  .novedades li strong{color:#0d1f35;font-size:7pt;font-weight:700}
  .novedades li .obs{color:#6b7280;font-style:italic;margin-top:0.3mm;display:block}
  .footer{margin-top:4mm;padding-top:2mm;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:5.5pt;color:#8a9bb0;font-family:'Courier New',monospace;letter-spacing:0.5px}
  .btn-bar{position:fixed;top:6mm;right:6mm;display:flex;gap:6px;z-index:99}
  .btn-bar button{border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:9pt;font-weight:700;font-family:Arial,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.12)}
  .btn-print{background:${col};color:#fff}
  .btn-close{background:#e8ecf0;color:#333}
  @page{size:190mm 270mm;margin:0}
  @media print{
    html,body{width:190mm}
    .doc{width:190mm;margin:0;padding:7mm 10mm}
    .head{margin:-7mm -10mm 4mm}
    .btn-bar{display:none!important}
    .doc,.head,.kpis,.novedades,.footer,table,tr{page-break-inside:avoid}
  }
</style></head><body>
<div class="btn-bar">
  <button class="btn-close" onclick="window.close()">Cerrar</button>
  <button class="btn-print" onclick="window.print()">🖨 Imprimir / PDF</button>
</div>
<div class="doc">

  <div class="head">
    <div>
      <div class="brand">${label}</div>
      <div class="brand-sub">Nómina · Consignaciones</div>
    </div>
    <div class="doc-info">
      <div class="doc-t">REPORTE DE CONSIGNACIONES</div>
      <div class="doc-p">${periodoLabel}</div>
    </div>
  </div>

  <div class="kpis" id="kpi-cons"></div>

  <table>
    <thead><tr>
      <th style="width:4%">#</th>
      <th style="width:30%">Empleado</th>
      <th style="width:36%">Banco / Cuenta / Llave</th>
      <th class="r" style="width:16%">Neto</th>
      <th class="r" style="width:14%">USD</th>
    </tr></thead>
    <tbody id="cons-tbody"></tbody>
  </table>

  <div class="novedades" id="novedades-box" style="display:none">
    <h2>Novedades de nómina</h2>
    <ul id="novedades-list"></ul>
  </div>

  <div class="footer">
    <span>${label} · ${new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</span>
    <span>Confidencial · Uso interno</span>
  </div>

</div>
<script>
  var rows = ${JSON.stringify(rows)};
  var empMap = ${JSON.stringify(empMap)};
  var totalNeto=0, totalNetoUSD=0, empSet=new Set();
  var tbody = document.getElementById('cons-tbody');
  var novList = document.getElementById('novedades-list');
  var novedades = [];
  // Construir también índice por nombre para fallback
  var empByNombre = {};
  Object.values(empMap).forEach(function(e){ if(e.nombre) empByNombre[e.nombre.trim().toUpperCase()] = e; });

  rows.forEach(function(r,i){
    var emp = empMap[r.empleado_id] || empByNombre[(r.empleado_nombre||'').trim().toUpperCase()] || {};
    var banco = emp.banco || r.banco || '—';
    var cta   = emp.numero_cuenta || r.numero_cuenta || '—';
    var esLlave = (banco==='Nequi'||banco==='Bre-B'||banco==='Daviplata');
    var ctaLbl = esLlave ? 'Llave: '+cta : cta;
    var moneda = (r.moneda||'COP').toUpperCase();
    var trm = parseFloat(r.trm)||0;
    var neto = r.valor_neto||0;
    var netoFmt = (moneda==='USD')
      ? '$'+neto.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
      : '$'+neto.toLocaleString('es-CO');
    var monLabel = '<span class="neto-mon">'+moneda+'</span>';
    var netoUSD = (r.valor_neto_usd!=null) ? r.valor_neto_usd
                : (moneda==='USD') ? neto
                : (moneda==='COP' && trm>0) ? neto/trm
                : (moneda==='EUR' && trm>0) ? neto*trm
                : null;
    var netoUSDFmt = netoUSD!=null ? '$'+netoUSD.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

    totalNeto += neto;
    if(netoUSD!=null) totalNetoUSD += netoUSD;
    empSet.add(r.empleado_nombre);

    if(r.notas && r.notas.trim() && r.notas.trim() !== '—') {
      novedades.push({nombre:r.empleado_nombre, nota:r.notas, dedu:r.deducciones||0});
    } else if((r.deducciones||0) > 0) {
      novedades.push({nombre:r.empleado_nombre, nota:'Descuento aplicado', dedu:r.deducciones});
    }

    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="font-family:Courier New,monospace;color:#6b7280;font-size:6.5pt">'+(i+1).toString().padStart(2,'0')+'</td>'
      +'<td><div class="empl" style="white-space:nowrap">'+(r.empleado_nombre||'—')+'</div></td>'
      +'<td><div class="banco" style="font-size:6.5pt;color:#6b7280;margin-bottom:0.3mm">'+banco+'</div><div class="cta">'+ctaLbl+'</div></td>'
      +'<td class="r neto">'+netoFmt+monLabel+'</td>'
      +'<td class="r" style="color:#374151">'+netoUSDFmt+'</td>';
    tbody.appendChild(tr);
  });

  var totRow = document.createElement('tr');
  totRow.className = 'total-row';
  totRow.innerHTML = '<td colspan="3">TOTAL · '+empSet.size+' empleado(s)</td>'
    +'<td class="r">$'+totalNeto.toLocaleString('es-CO')+'</td>'
    +'<td class="r">$'+totalNetoUSD.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>';
  tbody.appendChild(totRow);

  var kpis = [
    ['Empleados', empSet.size, 'a transferir'],
    ['Neto total', '$'+totalNeto.toLocaleString('es-CO'), 'moneda original'],
    ['Equivalente', '$'+totalNetoUSD.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}), 'USD']
  ];
  document.getElementById('kpi-cons').innerHTML = kpis.map(function(k){
    return '<div class="kpi"><div class="lbl">'+k[0]+'</div><div class="val">'+k[1]+'</div><div class="sub">'+k[2]+'</div></div>';
  }).join('');

  if(novedades.length) {
    document.getElementById('novedades-box').style.display = 'block';
    novedades.forEach(function(n){
      var li = document.createElement('li');
      var dedTxt = n.dedu>0 ? ' <span style="color:#dc2626;font-weight:700">— Desc. $'+n.dedu.toLocaleString('es-CO')+'</span>' : '';
      li.innerHTML = '<strong>'+n.nombre+'</strong>'+dedTxt+'<span class="obs">'+n.nota+'</span>';
      novList.appendChild(li);
    });
  }
<\/script>
</body></html>`;

  var win = window.open('','_blank','width=1100,height=800,scrollbars=yes');
  if(!win){ toast('Permite ventanas emergentes para generar el reporte','w'); return; }
  win.document.write(html);
  win.document.close();
}


// ══════════════════════════════════════════════════════════════════
//  MÓDULO CONTABILIDAD NIIF — Tycoon & Díaz International
//  Funciones: loadContabNiif, openNuevoComprobante, guardarComprobante
//             renderSubtabComprobantes, renderSubtabDiario,
//             renderSubtabMayor, renderSubtabBalance,
//             renderSubtabFee, abrirVerComprobante
// ══════════════════════════════════════════════════════════════════

// Estado del módulo
var CONTAB_LOADED = {tycoon: false, diaz: false};
var CONTAB_SUBTAB = {tycoon: 'comprobantes', diaz: 'comprobantes'};
var CONTAB_CUENTAS = []; // caché del plan de cuentas
var PLAN_CUENTAS_CACHE = null;

// ── Colores por empresa ──

