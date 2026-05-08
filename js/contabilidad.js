function contabColors(empresa) {
  return empresa === 'tycoon'
    ? {primary:'#D22630', bg:'linear-gradient(135deg,#012459,#01347a)', text:'#DBE2E9', accent:'rgba(210,38,48,0.15)', border:'rgba(210,38,48,0.3)'}
    : {primary:'#00D5B0', bg:'linear-gradient(135deg,#00554B,#00A98D)', text:'#ffffff', accent:'rgba(0,213,176,0.15)', border:'rgba(0,213,176,0.3)'};
}

// ── Loader principal del módulo ──
async function loadContabNiif(empresa) {
  var bodyId = empresa === 'tycoon' ? 'contab-ty-body' : 'contab-dz-body';
  var body = $(bodyId);
  if (!body) return;

  var c = contabColors(empresa);
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var subtab = CONTAB_SUBTAB[empresa] || 'comprobantes';

  // Cargar plan de cuentas al inicio si no está cacheado
  if (!PLAN_CUENTAS_CACHE) {
    var {data: pc} = await db.from('plan_cuentas').select('*').order('codigo');
    PLAN_CUENTAS_CACHE = pc || [];
  }

  // Sub-tabs
  var tabs = [
    {id:'comprobantes', icon:'📄', label:'Comprobantes'},
    {id:'diario',       icon:'📋', label:'Libro Diario'},
    {id:'mayor',        icon:'📚', label:'Libro Mayor'},
    {id:'balance',      icon:'⚖️',  label:'Balance / P&L'},
    {id:'fee',          icon:'💰', label:'FEE Inversionistas'},
    {id:'pdc',          icon:'📂', label:'Plan de Cuentas'},
  ];

  var tabsHTML = tabs.map(tb => `
    <button onclick="contabSubTab('${empresa}','${tb.id}',this)"
      id="cntb-${empresa}-${tb.id}"
      style="padding:7px 14px;font-size:11px;font-weight:600;border:none;
             border-bottom:2px solid ${subtab===tb.id ? c.primary : 'transparent'};
             background:transparent;color:${subtab===tb.id ? c.primary : 'var(--t3)'};
             cursor:pointer;margin-bottom:-1px;font-family:'Syne',sans-serif;transition:all .15s">
      ${tb.icon} ${tb.label}
    </button>`).join('');

  body.innerHTML = `
    <div style="display:flex;gap:2px;margin-bottom:18px;border-bottom:1px solid var(--br)">
      ${tabsHTML}
    </div>
    <div id="cntb-${empresa}-panel">
      <div style="text-align:center;color:var(--t3);padding:40px">Cargando...</div>
    </div>`;

  await contabSubTab(empresa, subtab, $('cntb-'+empresa+'-'+subtab));
}

async function contabSubTab(empresa, subtab, btn) {
  CONTAB_SUBTAB[empresa] = subtab;
  var c = contabColors(empresa);

  // Resaltar tab activo
  var tabs = ['comprobantes','diario','mayor','balance','fee'];
  tabs.forEach(tb => {
    var el = $('cntb-'+empresa+'-'+tb);
    if (!el) return;
    el.style.borderBottomColor = tb === subtab ? c.primary : 'transparent';
    el.style.color = tb === subtab ? c.primary : 'var(--t3)';
  });

  var panel = $('cntb-'+empresa+'-panel');
  if (!panel) return;
  panel.innerHTML = '<div style="text-align:center;color:var(--t3);padding:40px">Cargando...</div>';

  if (subtab === 'comprobantes') await renderSubtabComprobantes(empresa, panel, c);
  if (subtab === 'diario')       await renderSubtabDiario(empresa, panel, c);
  if (subtab === 'mayor')        await renderSubtabMayor(empresa, panel, c);
  if (subtab === 'balance')      await renderSubtabBalance(empresa, panel, c);
  if (subtab === 'fee')          await renderSubtabFee(empresa, panel, c);
  if (subtab === 'pdc')          await renderSubtabPDC(empresa, panel, c);
}

// ── SUB-TAB: COMPROBANTES ──
async function renderSubtabComprobantes(empresa, panel, c) {
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';

  // KPIs de consecutivos
  var {data: consec} = await db.from('consecutivos_contables').select('*').eq('empresa', emp);
  var {data: comps, error} = await db.from('comprobantes')
    .select('*').eq('empresa', emp)
    .order('fecha', {ascending: false}).limit(100);
  comps = comps || [];

  var kpiHTML = (consec || []).map(cs => `
    <div class="stat">
      <div class="sl">${cs.tipo_comprobante === 'RC' ? 'Recibos de Caja' : cs.tipo_comprobante === 'CE' ? 'Comp. Egreso' : cs.tipo_comprobante === 'NC' ? 'Notas Contables' : 'Asientos'}</div>
      <div class="sv">${cs.ultimo_numero}</div>
      <div class="sd">${cs.prefijo || ''}${String(cs.ultimo_numero).padStart(4,'0')}</div>
      <div class="si">${cs.tipo_comprobante === 'RC' ? '📥' : cs.tipo_comprobante === 'CE' ? '📤' : cs.tipo_comprobante === 'NC' ? '📝' : '⚖️'}</div>
    </div>`).join('');

  var tiposHTML = `
    <div class="ctls" style="margin-bottom:14px">
      <button class="chip on" onclick="filtrarComps('${empresa}','todos',this)">Todos</button>
      <button class="chip" onclick="filtrarComps('${empresa}','RC',this)">📥 RC</button>
      <button class="chip" onclick="filtrarComps('${empresa}','CE',this)">📤 CE</button>
      <button class="chip" onclick="filtrarComps('${empresa}','NC',this)">📝 NC</button>
      <button class="chip" onclick="filtrarComps('${empresa}','AC',this)">⚖️ AC</button>
      <input class="srch" style="max-width:200px" placeholder="Buscar tercero, descripción..." oninput="filtrarCompsTexto('${empresa}',this.value)" id="comp-srch-${empresa}">
    </div>`;

  var rows = comps.map(c2 => {
    var badge = c2.estado === 'Aprobado'
      ? `<span class="badge bdb">Aprobado</span>`
      : c2.estado === 'Anulado'
      ? `<span class="badge" style="background:var(--danger-soft);color:var(--danger)">Anulado</span>`
      : `<span class="badge bdw">Borrador</span>`;
    var tipo = c2.tipo_comprobante;
    var tipoIcon = tipo==='RC'?'📥':tipo==='CE'?'📤':tipo==='NC'?'📝':'⚖️';
    return `<tr data-tipo="${tipo}" data-search="${(c2.tercero_nombre+c2.descripcion).toLowerCase()}">
      <td><span style="font-family:'DM Mono',monospace;font-size:10px;color:${c.primary}">${c2.numero_display || tipo+'-'+String(c2.consecutivo).padStart(4,'0')}</span></td>
      <td><span style="font-size:13px">${tipoIcon}</span> <span style="font-size:10px;font-weight:600">${tipo}</span></td>
      <td>${fd(c2.fecha)}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sanitize(c2.tercero_nombre)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--t2);font-size:11px">${sanitize(c2.descripcion)}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:#059669">${fm(c2.total_debito)}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--danger)">${fm(c2.total_credito)}</td>
      <td>${badge}</td>
      <td style="text-align:right">
        <button onclick="abrirVerComprobante('${c2.id}','${empresa}')" style="padding:3px 8px;font-size:10px;border-radius:6px;border:1px solid var(--br);background:var(--sf2);color:var(--t2);cursor:pointer">Ver</button>
        ${c2.estado!=='Anulado'?`<button onclick="imprimirComprobante('${c2.id}','${empresa}')" style="padding:3px 8px;font-size:10px;border-radius:6px;border:1px solid var(--br);background:var(--sf2);color:var(--t2);cursor:pointer;margin-left:4px">🖨</button>`:''}
      </td>
    </tr>`;
  }).join('');

  panel.innerHTML = `
    <div class="stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">${kpiHTML}</div>
    ${tiposHTML}
    <div class="tw"><div class="tw-scroll">
      <table id="comp-table-${empresa}">
        <thead><tr>
          <th>N° Documento</th><th>Tipo</th><th>Fecha</th><th>Tercero</th>
          <th>Descripción</th><th style="text-align:right">Débito</th>
          <th style="text-align:right">Crédito</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody id="comp-tbody-${empresa}">${rows || '<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:30px">Sin comprobantes registrados</td></tr>'}</tbody>
      </table>
    </div></div>`;
}

function filtrarComps(empresa, tipo, btn) {
  btn.closest('.ctls').querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));
  btn.classList.add('on');
  var tbody = $('comp-tbody-'+empresa);
  if (!tbody) return;
  var searchVal = ($('comp-srch-'+empresa)?.value||'').toLowerCase();
  tbody.querySelectorAll('tr').forEach(tr => {
    var tipoMatch = tipo === 'todos' || tr.dataset.tipo === tipo;
    var searchMatch = !searchVal || (tr.dataset.search||'').includes(searchVal);
    tr.style.display = (tipoMatch && searchMatch) ? '' : 'none';
  });
}
function filtrarCompsTexto(empresa, val) {
  var tbody = $('comp-tbody-'+empresa);
  if (!tbody) return;
  var chip = document.querySelector(`#cntb-${empresa}-comprobantes`)?.closest('[class]');
  var tipoActivo = document.querySelector(`.ctls .chip.on`)?.textContent?.trim() || 'Todos';
  tbody.querySelectorAll('tr').forEach(tr => {
    var searchMatch = !val || (tr.dataset.search||'').includes(val.toLowerCase());
    tr.style.display = searchMatch ? '' : 'none';
  });
}

// ── SUB-TAB: LIBRO DIARIO ──
async function renderSubtabDiario(empresa, panel, c) {
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var {data: rows} = await db.from('vista_libro_diario')
    .select('*').eq('empresa', emp)
    .order('fecha', {ascending: false}).limit(200);
  rows = rows || [];

  if (!rows.length) {
    panel.innerHTML = '<div class="mod-empty"><div class="mod-empty-icon">📋</div><div>Sin movimientos contables registrados</div></div>';
    return;
  }

  var filas = rows.map(r => `
    <tr>
      <td style="font-family:'DM Mono',monospace;font-size:10px;white-space:nowrap">${fd(r.fecha)}</td>
      <td style="font-family:'DM Mono',monospace;font-size:10px;color:${c.primary}">${r.numero_display||'—'}</td>
      <td><span style="font-size:10px;background:var(--primary-soft);color:var(--primary);padding:2px 6px;border-radius:4px;font-family:'DM Mono',monospace">${r.tipo_comprobante}</span></td>
      <td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sanitize(r.tercero_nombre||'—')}</td>
      <td style="font-family:'DM Mono',monospace;font-size:10px;color:var(--t2)">${r.cuenta_codigo}</td>
      <td style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sanitize(r.cuenta_nombre||'—')}</td>
      <td style="font-size:10px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--t3)">${sanitize(r.descripcion_linea||r.descripcion_comprobante||'—')}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:#059669;font-weight:${r.debito>0?600:400}">${r.debito>0?fm(r.debito):'—'}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--danger);font-weight:${r.credito>0?600:400}">${r.credito>0?fm(r.credito):'—'}</td>
    </tr>`).join('');

  panel.innerHTML = `
    <div style="font-size:10px;color:var(--t3);margin-bottom:10px;font-family:'DM Mono',monospace">${rows.length} líneas · últimas 200</div>
    <div class="tw"><div class="tw-scroll">
      <table>
        <thead><tr>
          <th>Fecha</th><th>Documento</th><th>Tipo</th><th>Tercero</th>
          <th>Cuenta</th><th>Nombre cuenta</th><th>Descripción</th>
          <th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div></div>`;
}

// ── SUB-TAB: LIBRO MAYOR ──
async function renderSubtabMayor(empresa, panel, c) {
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var {data: rows} = await db.from('vista_libro_mayor')
    .select('*').eq('empresa', emp).order('cuenta_codigo').limit(500);
  rows = rows || [];

  if (!rows.length) {
    panel.innerHTML = '<div class="mod-empty"><div class="mod-empty-icon">📚</div><div>Sin movimientos en el mayor</div></div>';
    return;
  }

  // Agrupar por cuenta
  var cuentas = {};
  rows.forEach(r => {
    if (!cuentas[r.cuenta_codigo]) cuentas[r.cuenta_codigo] = {nombre: r.cuenta_nombre, filas: []};
    cuentas[r.cuenta_codigo].filas.push(r);
  });

  var html = Object.entries(cuentas).map(([cod, data]) => {
    var totalDeb = data.filas.reduce((s,r)=>s+(r.debito||0),0);
    var totalCred = data.filas.reduce((s,r)=>s+(r.credito||0),0);
    var saldo = data.filas[data.filas.length-1]?.saldo_acumulado || 0;
    var filas = data.filas.map(r => `
      <tr>
        <td style="font-family:'DM Mono',monospace;font-size:10px">${fd(r.fecha)}</td>
        <td style="font-family:'DM Mono',monospace;font-size:10px;color:${c.primary}">${r.numero_display||'—'}</td>
        <td style="font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sanitize(r.tercero_nombre||'—')}</td>
        <td style="font-size:10px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--t3)">${sanitize(r.descripcion||'—')}</td>
        <td style="text-align:right;font-family:'DM Mono',monospace;color:#059669">${r.debito>0?fm(r.debito):'—'}</td>
        <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--danger)">${r.credito>0?fm(r.credito):'—'}</td>
        <td style="text-align:right;font-family:'DM Mono',monospace;font-weight:600;color:${saldo>=0?'#059669':'var(--danger)'}">${fm(r.saldo_acumulado)}</td>
      </tr>`).join('');
    return `
      <div style="margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:10px 14px;background:${c.accent};border-radius:8px;border-left:3px solid ${c.primary}">
          <div>
            <span style="font-family:'DM Mono',monospace;font-size:10px;color:${c.primary};font-weight:700">${cod}</span>
            <span style="font-size:12px;font-weight:600;color:var(--t);margin-left:10px">${data.nombre}</span>
          </div>
          <div style="display:flex;gap:20px;font-family:'DM Mono',monospace;font-size:11px">
            <span style="color:#059669">Déb: ${fm(totalDeb)}</span>
            <span style="color:var(--danger)">Créd: ${fm(totalCred)}</span>
            <span style="font-weight:700;color:${saldo>=0?'#059669':'var(--danger)'}">Saldo: ${fm(saldo)}</span>
          </div>
        </div>
        <div class="tw-scroll">
          <table style="margin-bottom:0">
            <thead><tr>
              <th>Fecha</th><th>Documento</th><th>Tercero</th><th>Descripción</th>
              <th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th>
              <th style="text-align:right">Saldo</th>
            </tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `<div style="font-size:10px;color:var(--t3);margin-bottom:14px;font-family:'DM Mono',monospace">${Object.keys(cuentas).length} cuentas con movimiento</div>${html}`;
}

// ── SUB-TAB: BALANCE / P&L ──
async function renderSubtabBalance(empresa, panel, c) {
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var {data: rows} = await db.from('vista_balance_general')
    .select('*').eq('empresa', emp);
  rows = rows || [];

  if (!rows.length) {
    panel.innerHTML = '<div class="mod-empty"><div class="mod-empty-icon">⚖️</div><div>Sin datos contables para generar balance</div><div style="font-size:11px;color:var(--t3);margin-top:8px">Registra comprobantes para ver los estados financieros</div></div>';
    return;
  }

  // Agrupar por tipo NIIF
  var grupos = {Activo:[], Pasivo:[], Patrimonio:[], Ingreso:[], Costo:[], Gasto:[]};
  rows.forEach(r => { if(grupos[r.tipo]) grupos[r.tipo].push(r); });

  var totales = {};
  Object.keys(grupos).forEach(tipo => {
    totales[tipo] = grupos[tipo].reduce((s,r)=>s+(parseFloat(r.saldo)||0),0);
  });

  var utilidad = (totales.Ingreso||0) - (totales.Costo||0) - (totales.Gasto||0);
  var totalActivo = totales.Activo||0;
  var totalPasivo = (totales.Pasivo||0) + (totales.Patrimonio||0);

  function renderSeccion(tipo, titulo, color) {
    var items = grupos[tipo] || [];
    if (!items.length) return '';
    return `
      <div style="margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:${color};margin-bottom:8px;font-family:'Syne',sans-serif;text-transform:uppercase">${titulo}</div>
        ${items.map(r=>`
          <div style="display:flex;justify-content:space-between;padding:6px 10px;border-radius:6px;margin-bottom:3px;background:rgba(15,28,48,0.02)">
            <div>
              <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--t3);margin-right:8px">${r.cuenta_codigo}</span>
              <span style="font-size:11px;color:var(--t)">${r.cuenta_nombre}</span>
            </div>
            <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:${parseFloat(r.saldo)>=0?color:'var(--danger)'}">${fm(r.saldo)}</span>
          </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:8px 10px;margin-top:4px;border-top:1px solid var(--br);font-weight:700">
          <span style="font-size:11px;font-family:'Syne',sans-serif">TOTAL ${titulo}</span>
          <span style="font-family:'DM Mono',monospace;font-size:13px;color:${(totales[tipo]||0)>=0?color:'var(--danger)'}">${fm(totales[tipo]||0)}</span>
        </div>
      </div>`;
  }

  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
      <!-- KPIs ejecutivos -->
      <div class="stat" style="grid-column:span 2">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
          <div><div class="sl">Total Activo</div><div class="sv" style="color:${totalActivo>=0?'#059669':'var(--danger)'}">${fm(totalActivo)}</div></div>
          <div><div class="sl">Total Pasivo+Patrim.</div><div class="sv" style="color:${totalPasivo>=0?'#1D4ED8':'var(--danger)'}">${fm(totalPasivo)}</div></div>
          <div><div class="sl">Ingresos</div><div class="sv" style="color:${(totales.Ingreso||0)>=0?'#059669':'var(--danger)'}">${fm(totales.Ingreso||0)}</div></div>
          <div><div class="sl">Utilidad neta</div><div class="sv" style="color:${utilidad>=0?'#059669':'var(--danger)'}">${fm(utilidad)}</div></div>
        </div>
      </div>

      <!-- BALANCE GENERAL -->
      <div style="background:var(--sf);border-radius:14px;padding:20px;box-shadow:var(--shadow-soft)">
        <div style="font-size:13px;font-weight:700;color:var(--t);margin-bottom:16px;font-family:'Syne',sans-serif;border-bottom:2px solid ${c.primary};padding-bottom:8px">
          ⚖️ BALANCE GENERAL
        </div>
        ${renderSeccion('Activo','Activos','#059669')}
        ${renderSeccion('Pasivo','Pasivos','var(--danger)')}
        ${renderSeccion('Patrimonio','Patrimonio','#1D4ED8')}
      </div>

      <!-- ESTADO DE RESULTADOS -->
      <div style="background:var(--sf);border-radius:14px;padding:20px;box-shadow:var(--shadow-soft)">
        <div style="font-size:13px;font-weight:700;color:var(--t);margin-bottom:16px;font-family:'Syne',sans-serif;border-bottom:2px solid ${c.primary};padding-bottom:8px">
          📊 ESTADO DE RESULTADOS
        </div>
        ${renderSeccion('Ingreso','Ingresos','#059669')}
        ${renderSeccion('Costo','Costos','var(--warn)')}
        ${renderSeccion('Gasto','Gastos','var(--danger)')}
        <div style="margin-top:12px;padding:14px;background:${utilidad>=0?'var(--ok-soft)':'var(--danger-soft)'};border-radius:10px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;font-family:'Syne',sans-serif;font-size:13px">${utilidad>=0?'UTILIDAD DEL PERÍODO':'PÉRDIDA DEL PERÍODO'}</span>
          <span style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:${utilidad>=0?'#059669':'var(--danger)'}">${fm(Math.abs(utilidad))}</span>
        </div>
      </div>
    </div>`;
}

// ── SUB-TAB: FEE INVERSIONISTAS ──
async function renderSubtabFee(empresa, panel, c) {
  var emp = empresa === 'tycoon' ? 'tycoon' : empresa === 'diaz' ? 'diaz' : 'kii';
  var {data: fees} = await db.from('fee_inversionistas')
    .select('*').eq('empresa', emp).order('inversionista_nombre');
  fees = fees || [];

  var btnColor = empresa === 'tycoon' ? 'background:#D22630;color:#fff' : 'background:#00A98D;color:#fff';

  var rows = fees.map(f => `
    <tr>
      <td style="font-weight:600">${sanitize(f.inversionista_nombre)}</td>
      <td><span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${c.primary}">${f.porcentaje_fee}%</span></td>
      <td style="font-size:10px;color:var(--t3)">${fd(f.fecha_desde)}</td>
      <td style="font-size:10px;color:var(--t3)">${f.fecha_hasta ? fd(f.fecha_hasta) : 'Vigente'}</td>
      <td style="font-size:10px;color:var(--t3)">${sanitize(f.contrato_ref||'—')}</td>
      <td>${f.activo ? '<span class="badge bdb">Activo</span>' : '<span class="badge" style="background:var(--neutral-soft);color:var(--neutral)">Inactivo</span>'}</td>
      <td style="font-size:10px;max-width:160px;color:var(--t3)">${sanitize(f.notas||'—')}</td>
      <td>
        <button onclick="editarFee('${f.id}','${empresa}')" style="padding:3px 8px;font-size:10px;border-radius:6px;border:1px solid var(--br);background:var(--sf2);color:var(--t2);cursor:pointer">Editar</button>
        <button onclick="eliminarFee('${f.id}','${empresa}')" style="padding:3px 8px;font-size:10px;border-radius:6px;border:1px solid rgba(185,28,28,0.2);background:var(--danger-soft);color:var(--danger);cursor:pointer;margin-left:4px">✕</button>
      </td>
    </tr>`).join('');

  // Mini info NIIF
  panel.innerHTML = `
    <div style="background:rgba(29,78,216,0.06);border:1px solid rgba(29,78,216,0.15);border-radius:10px;padding:14px 18px;margin-bottom:18px;font-size:11px;color:#1D4ED8">
      <strong>📐 Fórmula NIIF:</strong> Rendimiento Neto = Rendimiento Bruto − (Rendimiento Bruto × FEE% ÷ 100)
      <span style="margin-left:16px;color:var(--t3)">Ejemplo: Bruto $1,000 · FEE 5% → Neto $950 · Comisión $50</span>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button onclick="openNuevoFee('${empresa}')" style="padding:7px 16px;font-size:11px;border-radius:8px;border:none;cursor:pointer;font-weight:600;${btnColor}">+ Nuevo FEE</button>
    </div>
    <div class="tw"><div class="tw-scroll">
      <table>
        <thead><tr>
          <th>Inversionista</th><th>FEE %</th><th>Desde</th><th>Hasta</th>
          <th>Contrato</th><th>Estado</th><th>Notas</th><th></th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:30px">Sin comisiones registradas</td></tr>'}</tbody>
      </table>
    </div></div>`;
}

// ── SUB-TAB: PLAN DE CUENTAS ──
async function renderSubtabPDC(empresa, panel, c) {
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';

  // Recargar siempre para tener datos frescos
  var {data: cuentas} = await db.from('plan_cuentas')
    .select('*')
    .or('empresa.eq.' + emp + ',empresa.eq.ambas')
    .order('codigo');
  cuentas = cuentas || [];

  // KPIs
  var total = cuentas.length;
  var movibles = cuentas.filter(c2 => c2.acepta_movimiento).length;
  var tipos = {};
  cuentas.forEach(c2 => { tipos[c2.tipo] = (tipos[c2.tipo]||0) + 1; });

  var kpiHTML = `
    <div class="stat"><div class="sl">Total cuentas</div><div class="sv">${total}</div><div class="si">📂</div></div>
    <div class="stat"><div class="sl">Acepta movimiento</div><div class="sv">${movibles}</div><div class="si">✎</div></div>
    <div class="stat"><div class="sl">Solo agrupación</div><div class="sv">${total - movibles}</div><div class="si">📁</div></div>
    <div class="stat"><div class="sl">Tipos</div><div class="sv">${Object.keys(tipos).length}</div><div class="si">📊</div></div>`;

  // Filtros por tipo
  var tiposArr = ['Todos','Activo','Pasivo','Patrimonio','Ingreso','Costo','Gasto'];
  var filtrosHTML = tiposArr.map(t => `
    <button class="chip ${t==='Todos'?'on':''}" onclick="filtrarPDC('${empresa}','${t}',this)">${t}</button>`).join('');

  // Construir árbol jerárquico
  var filas = cuentas.map(c2 => {
    var indent = (c2.nivel - 1) * 20;
    var isGroup = !c2.acepta_movimiento;
    var tipoCol = {Activo:'#059669',Pasivo:'var(--danger)',Patrimonio:'#1D4ED8',Ingreso:'#059669',Costo:'#d4870a',Gasto:'var(--danger)'}[c2.tipo] || 'var(--t3)';
    var natBadge = c2.naturaleza === 'Debito'
      ? '<span style="font-size:8px;padding:1px 5px;border-radius:3px;background:rgba(5,150,105,0.1);color:#059669;font-weight:600">Db</span>'
      : '<span style="font-size:8px;padding:1px 5px;border-radius:3px;background:rgba(220,38,38,0.1);color:var(--danger);font-weight:600">Cr</span>';
    var empBadge = c2.empresa === 'ambas'
      ? '<span style="font-size:7px;padding:1px 4px;border-radius:3px;background:rgba(124,58,237,0.1);color:#7C3AED;font-weight:600">AMBAS</span>'
      : c2.empresa === 'tycoon'
      ? '<span style="font-size:7px;padding:1px 4px;border-radius:3px;background:rgba(24,95,165,0.1);color:#185FA5;font-weight:600">TY</span>'
      : '<span style="font-size:7px;padding:1px 4px;border-radius:3px;background:rgba(15,110,86,0.1);color:#0F6E56;font-weight:600">DZ</span>';

    return `<tr data-tipo="${c2.tipo}" data-codigo="${c2.codigo}" data-search="${(c2.codigo+c2.nombre).toLowerCase()}">
      <td style="padding-left:${indent + 8}px;font-family:'DM Mono',monospace;font-size:10px;color:${c.primary};white-space:nowrap;font-weight:${isGroup?700:400}">${isGroup?'▸ ':''}<span style="font-weight:700">${c2.codigo}</span></td>
      <td style="font-size:11px;font-weight:${isGroup?700:400};color:${isGroup?'var(--t)':'var(--t2)'}">${sanitize(c2.nombre)}</td>
      <td><span style="font-size:9px;color:${tipoCol};font-weight:600">${c2.tipo}</span></td>
      <td>${natBadge}</td>
      <td style="text-align:center;font-size:9px;color:var(--t3)">${c2.nivel}</td>
      <td style="text-align:center">${c2.acepta_movimiento ? '<span style="color:#059669;font-size:12px">✓</span>' : '<span style="color:var(--t3);font-size:10px">—</span>'}</td>
      <td>${empBadge}</td>
      <td style="font-size:9px;color:var(--t3)">${c2.cuenta_padre||'—'}</td>
      <td style="text-align:right">
        <button onclick="editarCuenta('${c2.id}','${empresa}')" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid var(--br);background:var(--sf2);color:var(--t2);cursor:pointer">✎</button>
        ${c2.empresa !== 'ambas' ? `<button onclick="eliminarCuenta('${c2.id}','${empresa}')" style="padding:2px 6px;font-size:9px;border-radius:4px;border:1px solid rgba(185,28,28,0.2);background:var(--danger-soft);color:var(--danger);cursor:pointer;margin-left:3px">✕</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  panel.innerHTML = `
    <div class="stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">${kpiHTML}</div>
    <div class="ctls" style="margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      ${filtrosHTML}
      <input class="srch" style="max-width:200px;margin-left:auto" placeholder="Buscar código o nombre..." oninput="buscarPDC('${empresa}',this.value)" id="pdc-srch-${empresa}">
      <button onclick="openNuevaCuenta('${empresa}')" class="btn btn-p" style="${empresa==='tycoon'?'background:#D22630':'background:#00A98D'};padding:6px 14px;font-size:11px">+ Cuenta</button>
    </div>
    <div style="background:rgba(29,78,216,0.05);border:1px solid rgba(29,78,216,0.12);border-radius:8px;padding:8px 14px;margin-bottom:12px;font-size:10px;color:#1D4ED8">
      <strong>📐 Estructura NIIF:</strong> Nivel 1 = Clase · Nivel 2 = Grupo · Nivel 3 = Cuenta · Nivel 4 = Subcuenta.
      Las cuentas con <strong>empresa = AMBAS</strong> aplican a Tycoon y Díaz. Solo se pueden eliminar las cuentas específicas de empresa.
    </div>
    <div class="tw"><div class="tw-scroll">
      <table id="pdc-table-${empresa}">
        <thead><tr>
          <th>Código</th><th>Nombre</th><th>Tipo</th><th>Nat.</th>
          <th style="text-align:center">Niv.</th><th style="text-align:center">Mov.</th>
          <th>Emp.</th><th>Padre</th><th></th>
        </tr></thead>
        <tbody id="pdc-tbody-${empresa}">${filas}</tbody>
      </table>
    </div></div>`;
}

function filtrarPDC(empresa, tipo, btn) {
  btn.closest('.ctls').querySelectorAll('.chip').forEach(c2=>c2.classList.remove('on'));
  btn.classList.add('on');
  var searchVal = ($('pdc-srch-'+empresa)?.value||'').toLowerCase();
  $('pdc-tbody-'+empresa)?.querySelectorAll('tr').forEach(tr => {
    var tipoMatch = tipo === 'Todos' || tr.dataset.tipo === tipo;
    var searchMatch = !searchVal || (tr.dataset.search||'').includes(searchVal);
    tr.style.display = (tipoMatch && searchMatch) ? '' : 'none';
  });
}

function buscarPDC(empresa, val) {
  $('pdc-tbody-'+empresa)?.querySelectorAll('tr').forEach(tr => {
    tr.style.display = (!val || (tr.dataset.search||'').includes(val.toLowerCase())) ? '' : 'none';
  });
}

// ── MODAL: NUEVA CUENTA ──
function openNuevaCuenta(empresa, editData) {
  var c = contabColors(empresa);
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var isEdit = !!editData;
  var d = editData || {};

  // Opciones de cuentas padre
  var padreOpts = (PLAN_CUENTAS_CACHE || [])
    .filter(pc => !pc.acepta_movimiento && (pc.empresa === emp || pc.empresa === 'ambas'))
    .map(pc => `<option value="${pc.codigo}" ${d.cuenta_padre===pc.codigo?'selected':''}>${pc.codigo} — ${pc.nombre}</option>`)
    .join('');

  var html = `
    <div style="padding:4px 0 14px;border-bottom:1px solid var(--br);margin-bottom:16px">
      <div style="font-size:16px;font-weight:800;font-family:'Syne',sans-serif">${isEdit?'Editar':'Nueva'} cuenta contable</div>
      <div style="font-size:10px;color:var(--t3);margin-top:2px">${empresa==='tycoon'?'Tycoon Guru':'Díaz International'} · Plan de Cuentas NIIF</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">Código *</div>
        <input type="text" id="pdc-codigo" class="srch" placeholder="Ej: 1110-06" value="${d.codigo||''}" ${isEdit?'readonly style="opacity:0.6;font-family:DM Mono,monospace;font-size:11px"':''}>
      </div>
      <div>
        <div class="f-label">Nombre *</div>
        <input type="text" id="pdc-nombre" class="srch" placeholder="Ej: Cuenta Zelle USD" value="${sanitize(d.nombre||'')}">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">Tipo NIIF *</div>
        <select id="pdc-tipo" class="srch">
          <option value="Activo"     ${d.tipo==='Activo'?'selected':''}>Activo</option>
          <option value="Pasivo"     ${d.tipo==='Pasivo'?'selected':''}>Pasivo</option>
          <option value="Patrimonio" ${d.tipo==='Patrimonio'?'selected':''}>Patrimonio</option>
          <option value="Ingreso"    ${d.tipo==='Ingreso'?'selected':''}>Ingreso</option>
          <option value="Costo"      ${d.tipo==='Costo'?'selected':''}>Costo</option>
          <option value="Gasto"      ${d.tipo==='Gasto'?'selected':''}>Gasto</option>
        </select>
      </div>
      <div>
        <div class="f-label">Naturaleza *</div>
        <select id="pdc-nat" class="srch">
          <option value="Debito"  ${d.naturaleza==='Debito'?'selected':''}>Débito (se incrementa con Db)</option>
          <option value="Credito" ${d.naturaleza==='Credito'?'selected':''}>Crédito (se incrementa con Cr)</option>
        </select>
      </div>
      <div>
        <div class="f-label">Nivel *</div>
        <select id="pdc-nivel" class="srch">
          <option value="1" ${d.nivel==1?'selected':''}>1 — Clase</option>
          <option value="2" ${d.nivel==2?'selected':''}>2 — Grupo</option>
          <option value="3" ${d.nivel==3?'selected':''}>3 — Cuenta</option>
          <option value="4" ${d.nivel==4?'selected':''}>4 — Subcuenta</option>
        </select>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">Cuenta padre</div>
        <select id="pdc-padre" class="srch">
          <option value="">— Ninguna (raíz) —</option>
          ${padreOpts}
        </select>
      </div>
      <div>
        <div class="f-label">Aplica a</div>
        <select id="pdc-empresa" class="srch">
          <option value="${emp}" ${(d.empresa||emp)===emp?'selected':''}>${empresa==='tycoon'?'Solo Tycoon':'Solo Díaz'}</option>
          <option value="ambas" ${d.empresa==='ambas'?'selected':''}>Ambas empresas</option>
        </select>
      </div>
      <div>
        <div class="f-label">¿Acepta movimiento?</div>
        <select id="pdc-mov" class="srch">
          <option value="true"  ${d.acepta_movimiento!==false?'selected':''}>Sí — permite asientos</option>
          <option value="false" ${d.acepta_movimiento===false?'selected':''}>No — solo agrupa hijos</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom:12px">
      <div class="f-label">Notas (opcional)</div>
      <input type="text" id="pdc-notas" class="srch" placeholder="Descripción adicional" value="${sanitize(d.notas||'')}">
    </div>

    <div id="pdc-err" style="color:var(--danger);font-size:11px;min-height:16px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button onclick="closeM()" class="btn btn-g">Cancelar</button>
      <button onclick="${isEdit?'actualizarCuenta':'guardarCuenta'}('${empresa}'${isEdit?',\''+d.id+'\'':''})" class="btn btn-p" style="${empresa==='tycoon'?'background:#D22630':'background:#00A98D'}" id="pdc-btn">${isEdit?'Actualizar':'Crear cuenta'}</button>
    </div>`;

  var ov = $('ov');
  ov.querySelector('.mo').innerHTML = html;
  ov.setAttribute('data-lock','1');
  ov.classList.add('on');
}

async function guardarCuenta(empresa) {
  var btn = $('pdc-btn');
  var errEl = $('pdc-err');
  if(btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

  var codigo = ($('pdc-codigo')?.value||'').trim();
  var nombre = ($('pdc-nombre')?.value||'').trim();
  var tipo = $('pdc-tipo')?.value;
  var nat = $('pdc-nat')?.value;
  var nivel = parseInt($('pdc-nivel')?.value||3);
  var padre = $('pdc-padre')?.value || null;
  var empVal = $('pdc-empresa')?.value || empresa;
  var mov = $('pdc-mov')?.value === 'true';
  var notas = ($('pdc-notas')?.value||'').trim() || null;

  if (!codigo || !nombre || !tipo || !nat) {
    if(errEl) errEl.textContent = 'Completa código, nombre, tipo y naturaleza.';
    if(btn) { btn.textContent = 'Crear cuenta'; btn.disabled = false; }
    return;
  }

  var {error} = await db.from('plan_cuentas').insert({
    empresa: empVal, codigo, nombre, tipo,
    naturaleza: nat, nivel,
    cuenta_padre: padre,
    acepta_movimiento: mov,
    notas, activa: true
  });

  if (error) {
    if(errEl) errEl.textContent = error.message.includes('duplicate') ? 'Ya existe una cuenta con ese código para esta empresa.' : 'Error: ' + error.message;
    if(btn) { btn.textContent = 'Crear cuenta'; btn.disabled = false; }
    return;
  }

  toast('Cuenta ' + codigo + ' creada ✓', 'ok');
  closeM();
  PLAN_CUENTAS_CACHE = null;
  await loadContabNiif(empresa);
  contabSubTab(empresa, 'pdc', $('cntb-'+empresa+'-pdc'));
}

async function editarCuenta(id, empresa) {
  if (!PLAN_CUENTAS_CACHE) {
    var {data: pc} = await db.from('plan_cuentas').select('*').order('codigo');
    PLAN_CUENTAS_CACHE = pc || [];
  }
  var cuenta = PLAN_CUENTAS_CACHE.find(c2 => c2.id === id);
  if (!cuenta) {
    var {data: c2} = await db.from('plan_cuentas').select('*').eq('id', id).single();
    cuenta = c2;
  }
  if (!cuenta) { toast('Cuenta no encontrada', 'd'); return; }
  openNuevaCuenta(empresa, cuenta);
}

async function actualizarCuenta(empresa, id) {
  var btn = $('pdc-btn');
  var errEl = $('pdc-err');
  if(btn) { btn.textContent = 'Actualizando...'; btn.disabled = true; }

  var nombre = ($('pdc-nombre')?.value||'').trim();
  var tipo = $('pdc-tipo')?.value;
  var nat = $('pdc-nat')?.value;
  var nivel = parseInt($('pdc-nivel')?.value||3);
  var padre = $('pdc-padre')?.value || null;
  var empVal = $('pdc-empresa')?.value;
  var mov = $('pdc-mov')?.value === 'true';
  var notas = ($('pdc-notas')?.value||'').trim() || null;

  if (!nombre || !tipo || !nat) {
    if(errEl) errEl.textContent = 'Completa nombre, tipo y naturaleza.';
    if(btn) { btn.textContent = 'Actualizar'; btn.disabled = false; }
    return;
  }

  var {error} = await db.from('plan_cuentas').update({
    nombre, tipo, naturaleza: nat, nivel,
    cuenta_padre: padre, empresa: empVal,
    acepta_movimiento: mov, notas,
    updated_at: new Date().toISOString()
  }).eq('id', id);

  if (error) {
    if(errEl) errEl.textContent = 'Error: ' + error.message;
    if(btn) { btn.textContent = 'Actualizar'; btn.disabled = false; }
    return;
  }

  toast('Cuenta actualizada ✓', 'ok');
  closeM();
  PLAN_CUENTAS_CACHE = null;
  await loadContabNiif(empresa);
  contabSubTab(empresa, 'pdc', $('cntb-'+empresa+'-pdc'));
}

async function eliminarCuenta(id, empresa) {
  if (!confirm('¿Eliminar esta cuenta? Solo se eliminan cuentas sin movimientos registrados.')) return;

  // Verificar que no tenga movimientos
  var {data: movs} = await db.from('comprobantes_detalle').select('id').eq('cuenta_codigo',
    (PLAN_CUENTAS_CACHE||[]).find(c2=>c2.id===id)?.codigo || '').limit(1);
  if (movs && movs.length > 0) {
    toast('No se puede eliminar: esta cuenta tiene movimientos registrados', 'd');
    return;
  }

  var {error} = await db.from('plan_cuentas').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'd'); return; }

  toast('Cuenta eliminada ✓', 'ok');
  PLAN_CUENTAS_CACHE = null;
  await loadContabNiif(empresa);
  contabSubTab(empresa, 'pdc', $('cntb-'+empresa+'-pdc'));
}

// ── MODAL: NUEVO COMPROBANTE ──
async function openNuevoComprobante(empresa) {
  if (!PLAN_CUENTAS_CACHE) {
    var {data: pc} = await db.from('plan_cuentas').select('*').order('codigo');
    PLAN_CUENTAS_CACHE = pc || [];
  }
  var c = contabColors(empresa);
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var tipoIcon = {RC:'📥',CE:'📤',NC:'📝',AC:'⚖️'};

  // Opciones de cuentas que aceptan movimiento — filtradas por empresa
  var cuentasOpts = PLAN_CUENTAS_CACHE
    .filter(pc => pc.acepta_movimiento && (pc.empresa === emp || pc.empresa === 'ambas'))
    .map(pc => `<option value="${pc.codigo}" data-nombre="${pc.nombre}" data-naturaleza="${pc.naturaleza}">${pc.codigo} — ${pc.nombre}</option>`)
    .join('');

  var html = `
    <div style="padding:4px 0 16px;border-bottom:1px solid var(--br);margin-bottom:16px">
      <div style="font-size:17px;font-weight:800;font-family:'Syne',sans-serif;color:var(--t)">Nuevo Comprobante</div>
      <div style="font-size:11px;color:var(--t3);margin-top:2px">${empresa === 'tycoon' ? 'Tycoon Guru' : 'Díaz International'} · Sistema Contable NIIF</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
      <div>
        <div class="f-label">Tipo de Comprobante *</div>
        <select id="nc-tipo" class="srch" onchange="nc_updateTipo('${empresa}')">
          <option value="RC">📥 RC — Recibo de Caja</option>
          <option value="CE">📤 CE — Comprobante de Egreso</option>
          <option value="NC">📝 NC — Nota Contable</option>
          <option value="AC">⚖️ AC — Asiento / Causación</option>
        </select>
      </div>
      <div>
        <div class="f-label">Fecha *</div>
        <input type="date" id="nc-fecha" class="srch" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div>
        <div class="f-label">N° Alterno (opcional)</div>
        <input type="text" id="nc-alterno" class="srch" placeholder="Ej: FAC-001, EXT-2024...">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
      <div style="position:relative">
        <div class="f-label">Tercero / Beneficiario *</div>
        <input type="text" id="nc-tercero" class="srch" placeholder="Escriba para buscar tercero..." autocomplete="off"
          oninput="ncBuscarTercero('${empresa}',this.value)"
          onfocus="ncBuscarTercero('${empresa}',this.value)">
        <input type="hidden" id="nc-tercero-id">
        <div id="nc-tercero-list" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:999;background:var(--sf);border:1px solid var(--br);border-radius:8px;max-height:200px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.15);margin-top:2px"></div>
      </div>
      <div>
        <div class="f-label">Moneda</div>
        <select id="nc-moneda" class="srch">
          <option value="USD">USD — Dólar</option>
          <option value="COP">COP — Peso colombiano</option>
          <option value="EUR">EUR — Euro</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <div class="f-label">Descripción del comprobante *</div>
      <input type="text" id="nc-desc" class="srch" placeholder="Ej: Préstamo socio John Díaz — ingreso caja USD 200">
    </div>

    <!-- Plantillas rápidas -->
    <div id="nc-hint" style="background:rgba(29,78,216,0.05);border:1px solid rgba(29,78,216,0.12);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:10.5px;color:#1D4ED8">
      <strong>📥 RC — Recibo de Caja:</strong> El dinero ENTRA. Débita la cuenta de caja/banco · Acredita la fuente (ingreso, pasivo, etc.)
    </div>

    <!-- Líneas del asiento -->
    <div style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;font-family:'Syne',sans-serif;color:var(--t)">Asiento contable</div>
        <button onclick="nc_addLinea('${empresa}')" style="padding:4px 12px;font-size:10px;border-radius:6px;border:1px solid ${c.primary};color:${c.primary};background:transparent;cursor:pointer;font-weight:600">+ Línea</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr 24px;gap:6px;padding:5px 8px;background:rgba(15,28,48,0.03);border-radius:6px;font-size:9px;font-weight:700;color:var(--t3);letter-spacing:1px;font-family:'DM Mono',monospace;margin-bottom:4px">
        <div>CUENTA</div><div>DESCRIPCIÓN</div><div style="text-align:right">DÉBITO</div><div style="text-align:right">CRÉDITO</div><div></div>
      </div>
      <div id="nc-lineas-${empresa}"></div>

      <!-- Totalizador -->
      <div id="nc-totales-${empresa}" style="display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr 24px;gap:6px;padding:8px;margin-top:6px;background:rgba(15,28,48,0.03);border-radius:6px;font-size:11px;font-weight:700;font-family:'DM Mono',monospace">
        <div style="color:var(--t3)">TOTALES</div>
        <div></div>
        <div id="nc-tot-deb-${empresa}" style="text-align:right;color:#059669">$0.00</div>
        <div id="nc-tot-cred-${empresa}" style="text-align:right;color:var(--danger)">$0.00</div>
        <div></div>
      </div>
      <div id="nc-balance-${empresa}" style="text-align:center;font-size:10px;color:var(--t3);margin-top:6px;font-family:'DM Mono',monospace">Agrega líneas al asiento</div>
    </div>

    <div id="nc-err-${empresa}" style="color:var(--danger);font-size:11px;min-height:16px;margin-top:4px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button onclick="closeM()" class="btn btn-g">Cancelar</button>
      <button onclick="guardarComprobante('${empresa}')" class="btn btn-p" style="${empresa==='tycoon'?'background:#D22630':'background:#00A98D'}" id="nc-btn-${empresa}">Guardar comprobante</button>
    </div>`;

  var ov = $('ov');
  ov.querySelector('.mo').innerHTML = html;
  ov.setAttribute('data-lock','1');
  ov.classList.add('on');
  nc_addLinea(empresa, cuentasOpts);
  nc_addLinea(empresa, cuentasOpts);
}

// ── AUTOCOMPLETE TERCEROS EN COMPROBANTES ──
var NC_TERCEROS_CACHE = {tycoon: null, diaz: null};
var NC_TERCERO_TIMER = null;

async function ncCargarTerceros(empresa) {
  if (NC_TERCEROS_CACHE[empresa]) return NC_TERCEROS_CACHE[empresa];
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var tabla = emp === 'tycoon' ? 'terceros_tycoon' : 'terceros_diaz';

  // Cargar terceros de la empresa
  var {data: terceros} = await db.from(tabla).select('id,nombre,tipo,numero_documento').order('nombre');
  terceros = (terceros || []).map(t => ({id: t.id, nombre: t.nombre, tipo: t.tipo || 'General', doc: t.numero_documento || '', fuente: 'tercero'}));

  // Cargar inversionistas también
  var {data: invs} = await db.from('inversionistas').select('id,nombre,documento').order('nombre');
  invs = (invs || []).map(i => ({id: i.id, nombre: i.nombre, tipo: 'Inversionista', doc: i.documento || '', fuente: 'inversionista'}));

  // Merge sin duplicados por nombre
  var nombres = new Set(terceros.map(t => t.nombre.toLowerCase()));
  invs.forEach(i => {
    if (!nombres.has(i.nombre.toLowerCase())) {
      terceros.push(i);
      nombres.add(i.nombre.toLowerCase());
    }
  });

  terceros.sort((a, b) => a.nombre.localeCompare(b.nombre));
  NC_TERCEROS_CACHE[empresa] = terceros;
  return terceros;
}

async function ncBuscarTercero(empresa, query) {
  clearTimeout(NC_TERCERO_TIMER);
  NC_TERCERO_TIMER = setTimeout(async function() {
    var list = $('nc-tercero-list');
    if (!list) return;

    var todos = await ncCargarTerceros(empresa);
    var q = (query || '').toLowerCase().trim();
    var filtrados = q.length === 0 ? todos.slice(0, 15) : todos.filter(t =>
      t.nombre.toLowerCase().includes(q) || (t.doc && t.doc.includes(q))
    ).slice(0, 10);

    if (!filtrados.length) {
      list.style.display = 'none';
      return;
    }

    var c = contabColors(empresa);
    var tipoColors = {
      Inversionista: '#1D4ED8',
      Socio: '#7C3AED',
      Proveedor: '#EA580C',
      Cliente: '#059669',
      Empleado: '#0891B2',
      Acreedor: '#DC2626',
      General: 'var(--t3)'
    };

    list.innerHTML = filtrados.map(t => {
      var tc = tipoColors[t.tipo] || 'var(--t3)';
      return `<div onclick="ncSeleccionarTercero('${t.id}','${t.nombre.replace(/'/g,"\\'")}','${t.fuente}')"
        style="padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.04);transition:background .1s;display:flex;align-items:center;justify-content:space-between;gap:8px"
        onmouseover="this.style.background='${c.accent}'" onmouseout="this.style.background='transparent'">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--t)">${sanitize(t.nombre)}</div>
          <div style="font-size:9px;color:var(--t3);margin-top:1px">${t.doc ? 'Doc: ' + t.doc : ''}</div>
        </div>
        <span style="font-size:8px;font-weight:700;letter-spacing:0.5px;padding:2px 6px;border-radius:4px;background:${tc}15;color:${tc};white-space:nowrap">${t.tipo}</span>
      </div>`;
    }).join('');
    list.style.display = 'block';
  }, 150);
}

function ncSeleccionarTercero(id, nombre, fuente) {
  var input = $('nc-tercero');
  var hidden = $('nc-tercero-id');
  var list = $('nc-tercero-list');
  if (input) input.value = nombre;
  if (hidden) hidden.value = id || '';
  if (list) list.style.display = 'none';
}

// Cerrar dropdown al hacer click fuera
document.addEventListener('click', function(e) {
  var list = $('nc-tercero-list');
  if (list && !e.target.closest('#nc-tercero') && !e.target.closest('#nc-tercero-list')) {
    list.style.display = 'none';
  }
});

var NC_LINEA_IDX = {tycoon:0, diaz:0};
function nc_addLinea(empresa, cuentasOptsArg) {
  var idx = NC_LINEA_IDX[empresa] = (NC_LINEA_IDX[empresa]||0) + 1;
  var container = $('nc-lineas-'+empresa);
  if (!container) return;

  // Usar el caché — filtrado por empresa
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var cuentasOpts = cuentasOptsArg || (PLAN_CUENTAS_CACHE || [])
    .filter(pc => pc.acepta_movimiento && (pc.empresa === emp || pc.empresa === 'ambas'))
    .map(pc => `<option value="${pc.codigo}" data-nombre="${pc.nombre}">${pc.codigo} — ${pc.nombre}</option>`)
    .join('');

  var div = document.createElement('div');
  div.id = 'nc-lin-'+empresa+'-'+idx;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr 24px;gap:6px;margin-bottom:4px;align-items:center';
  div.innerHTML = `
    <select class="srch" style="font-size:10px;padding:5px 6px" onchange="nc_recalcular('${empresa}')">
      <option value="">— Seleccionar cuenta —</option>
      ${cuentasOpts}
    </select>
    <input type="text" class="srch" style="font-size:10px;padding:5px 6px" placeholder="Descripción línea">
    <input type="number" class="srch nc-deb" style="font-size:10px;padding:5px 6px;text-align:right" placeholder="0.00" min="0" step="0.01" oninput="nc_recalcular('${empresa}')">
    <input type="number" class="srch nc-cred" style="font-size:10px;padding:5px 6px;text-align:right" placeholder="0.00" min="0" step="0.01" oninput="nc_recalcular('${empresa}')">
    <button onclick="this.parentElement.remove();nc_recalcular('${empresa}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:0">✕</button>`;
  container.appendChild(div);
}

function nc_recalcular(empresa) {
  var container = $('nc-lineas-'+empresa);
  if (!container) return;
  var totalDeb = 0, totalCred = 0;
  container.querySelectorAll('.nc-deb').forEach(el => totalDeb += parseFloat(el.value||0));
  container.querySelectorAll('.nc-cred').forEach(el => totalCred += parseFloat(el.value||0));

  var tdEl = $('nc-tot-deb-'+empresa);
  var tcEl = $('nc-tot-cred-'+empresa);
  var balEl = $('nc-balance-'+empresa);
  if(tdEl) tdEl.textContent = fm(totalDeb);
  if(tcEl) tcEl.textContent = fm(totalCred);

  var diff = Math.abs(totalDeb - totalCred);
  if (balEl) {
    if (totalDeb === 0 && totalCred === 0) {
      balEl.textContent = 'Agrega líneas al asiento';
      balEl.style.color = 'var(--t3)';
    } else if (diff < 0.01) {
      balEl.textContent = '✓ Asiento balanceado · Débitos = Créditos';
      balEl.style.color = '#059669';
    } else {
      balEl.textContent = `⚠ Diferencia: ${fm(diff)} · Débitos ${fm(totalDeb)} · Créditos ${fm(totalCred)}`;
      balEl.style.color = 'var(--danger)';
    }
  }
}

function nc_updateTipo(empresa) {
  var tipo = $('nc-tipo')?.value;
  var hint = $('nc-hint');
  if (!hint) return;
  var hints = {
    RC: '<strong>📥 RC — Recibo de Caja:</strong> El dinero ENTRA. Débita la cuenta de caja/banco · Acredita la fuente (ingreso, pasivo, etc.)',
    CE: '<strong>📤 CE — Comprobante de Egreso:</strong> El dinero SALE. Débita la obligación o gasto · Acredita la cuenta de caja/banco',
    NC: '<strong>📝 NC — Nota Contable:</strong> Ajuste, corrección o reconocimiento. Sin movimiento de efectivo.',
    AC: '<strong>⚖️ AC — Asiento / Causación:</strong> Reconocimiento de un derecho u obligación. Débito y crédito libre.',
  };
  hint.innerHTML = hints[tipo] || '';
}

async function guardarComprobante(empresa) {
  var btn = $('nc-btn-'+empresa);
  var errEl = $('nc-err-'+empresa);
  if(btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }
  if(errEl) errEl.textContent = '';

  var tipo = $('nc-tipo')?.value;
  var fecha = $('nc-fecha')?.value;
  var tercero = ($('nc-tercero')?.value||'').trim();
  var terceroId = ($('nc-tercero-id')?.value||'').trim() || null;
  var desc = ($('nc-desc')?.value||'').trim();
  var moneda = $('nc-moneda')?.value || 'USD';
  var alterno = ($('nc-alterno')?.value||'').trim() || null;

  if (!tipo || !fecha || !tercero || !desc) {
    if(errEl) errEl.textContent = 'Completa los campos obligatorios: tipo, fecha, tercero y descripción.';
    if(btn) { btn.textContent = 'Guardar comprobante'; btn.disabled = false; }
    return;
  }

  // Recoger líneas
  var container = $('nc-lineas-'+empresa);
  var lineas = [];
  var totalDeb = 0, totalCred = 0;
  container.querySelectorAll('div[id^="nc-lin"]').forEach((div, i) => {
    var sel = div.querySelector('select');
    var desc2 = div.querySelectorAll('input')[0];
    var debEl = div.querySelector('.nc-deb');
    var credEl = div.querySelector('.nc-cred');
    var cuenta = sel?.value;
    var deb = parseFloat(debEl?.value||0);
    var cred = parseFloat(credEl?.value||0);
    if (cuenta && (deb > 0 || cred > 0)) {
      var opt = sel.options[sel.selectedIndex];
      lineas.push({
        linea: i+1,
        cuenta_codigo: cuenta,
        cuenta_nombre: opt?.dataset?.nombre || opt?.text?.split('—')[1]?.trim() || cuenta,
        descripcion: desc2?.value?.trim() || null,
        debito: deb, credito: cred,
        moneda: moneda, tasa_cambio: 1,
        debito_usd: deb, credito_usd: cred,
      });
      totalDeb += deb; totalCred += cred;
    }
  });

  if (lineas.length < 2) {
    if(errEl) errEl.textContent = 'El asiento debe tener al menos 2 líneas.';
    if(btn) { btn.textContent = 'Guardar comprobante'; btn.disabled = false; }
    return;
  }
  if (Math.abs(totalDeb - totalCred) >= 0.01) {
    if(errEl) errEl.textContent = `El asiento no está balanceado. Débitos: ${fm(totalDeb)} · Créditos: ${fm(totalCred)}`;
    if(btn) { btn.textContent = 'Guardar comprobante'; btn.disabled = false; }
    return;
  }

  // Obtener consecutivo vía función PG
  var {data: consData, error: consErr} = await db.rpc('siguiente_consecutivo', {
    p_empresa: empresa === 'tycoon' ? 'tycoon' : 'diaz',
    p_tipo_comprobante: tipo
  });
  if (consErr) {
    if(errEl) errEl.textContent = 'Error al obtener consecutivo: ' + consErr.message;
    if(btn) { btn.textContent = 'Guardar comprobante'; btn.disabled = false; }
    return;
  }
  var consecutivo = consData;
  var emp = empresa === 'tycoon' ? 'tycoon' : 'diaz';
  var prefijos = {tycoon:{RC:'TY-RC-',CE:'TY-CE-',NC:'TY-NC-',AC:'TY-AC-'}, diaz:{RC:'DZ-RC-',CE:'DZ-CE-',NC:'DZ-NC-',AC:'DZ-AC-'}};
  var num_display = (prefijos[emp]?.[tipo]||tipo+'-') + String(consecutivo).padStart(4,'0');

  // Insertar comprobante
  var {data: comp, error: compErr} = await db.from('comprobantes').insert({
    empresa: emp, tipo_comprobante: tipo,
    consecutivo, numero_alterno: alterno, numero_display: num_display,
    fecha, tercero_id: terceroId, tercero_nombre: tercero, descripcion: desc,
    total_debito: totalDeb, total_credito: totalCred,
    moneda, tasa_cambio: 1,
    estado: 'Aprobado',
    created_by: (await db.auth.getUser()).data?.user?.id || null,
    created_by_email: (await db.auth.getUser()).data?.user?.email || null,
  }).select().single();

  if (compErr) {
    if(errEl) errEl.textContent = 'Error al guardar: ' + compErr.message;
    if(btn) { btn.textContent = 'Guardar comprobante'; btn.disabled = false; }
    return;
  }

  // Insertar líneas del asiento
  var detalles = lineas.map(l => ({ ...l, comprobante_id: comp.id }));
  var {error: detErr} = await db.from('comprobantes_detalle').insert(detalles);
  if (detErr) {
    if(errEl) errEl.textContent = 'Comprobante creado pero error en detalle: ' + detErr.message;
    if(btn) { btn.textContent = 'Guardar comprobante'; btn.disabled = false; }
    return;
  }

  toast(`✓ ${num_display} creado correctamente`, 'ok');
  closeM();
  NC_LINEA_IDX[empresa] = 0;
  await loadContabNiif(empresa);
}

// ── VER COMPROBANTE (modal detalle) ──
async function abrirVerComprobante(id, empresa) {
  var c = contabColors(empresa);
  var {data: comp} = await db.from('comprobantes').select('*').eq('id', id).single();
  var {data: lineas} = await db.from('comprobantes_detalle').select('*').eq('comprobante_id', id).order('linea');
  if (!comp) { toast('Comprobante no encontrado', 'd'); return; }
  lineas = lineas || [];

  var tipoNames = {RC:'Recibo de Caja',CE:'Comprobante de Egreso',NC:'Nota Contable',AC:'Asiento Contable'};
  var estadoBadge = comp.estado === 'Aprobado'
    ? '<span class="badge bdb">Aprobado</span>'
    : comp.estado === 'Anulado'
    ? '<span class="badge" style="background:var(--danger-soft);color:var(--danger)">Anulado</span>'
    : '<span class="badge bdw">Borrador</span>';

  var lineasHTML = lineas.map(l => `
    <tr>
      <td style="font-family:'DM Mono',monospace;font-size:10px;color:${c.primary}">${l.cuenta_codigo}</td>
      <td style="font-size:11px">${sanitize(l.cuenta_nombre||'—')}</td>
      <td style="font-size:10px;color:var(--t3)">${sanitize(l.descripcion||'—')}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:#059669;font-weight:${l.debito>0?600:400}">${l.debito>0?fm(l.debito):'—'}</td>
      <td style="text-align:right;font-family:'DM Mono',monospace;color:var(--danger);font-weight:${l.credito>0?600:400}">${l.credito>0?fm(l.credito):'—'}</td>
    </tr>`).join('');

  var html = `
    <div style="padding:4px 0 14px;border-bottom:1px solid var(--br);margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:20px;font-weight:800;font-family:'Syne',sans-serif;color:${c.primary}">${comp.numero_display}</div>
        <div style="font-size:12px;color:var(--t3);margin-top:2px">${tipoNames[comp.tipo_comprobante]||comp.tipo_comprobante} · ${empresa==='tycoon'?'Tycoon Guru':'Díaz International'}</div>
      </div>
      ${estadoBadge}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div class="f-label">Fecha</div><div style="font-size:12px;font-weight:600">${fd(comp.fecha)}</div></div>
      <div><div class="f-label">Tercero</div><div style="font-size:12px;font-weight:600">${sanitize(comp.tercero_nombre)}</div></div>
      <div><div class="f-label">Moneda</div><div style="font-size:12px;font-weight:600">${comp.moneda}</div></div>
    </div>
    <div style="margin-bottom:16px">
      <div class="f-label">Descripción</div>
      <div style="font-size:12px;color:var(--t);padding:8px 12px;background:rgba(15,28,48,0.03);border-radius:7px">${sanitize(comp.descripcion)}</div>
    </div>
    <div class="tw" style="margin-bottom:14px"><div class="tw-scroll">
      <table>
        <thead><tr>
          <th>Cuenta</th><th>Nombre</th><th>Descripción</th>
          <th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th>
        </tr></thead>
        <tbody>${lineasHTML}</tbody>
        <tfoot>
          <tr style="background:rgba(15,28,48,0.03);font-weight:700">
            <td colspan="3" style="padding:8px;text-align:right;font-family:'DM Mono',monospace;font-size:10px">TOTALES</td>
            <td style="padding:8px;text-align:right;font-family:'DM Mono',monospace;color:#059669">${fm(comp.total_debito)}</td>
            <td style="padding:8px;text-align:right;font-family:'DM Mono',monospace;color:var(--danger)">${fm(comp.total_credito)}</td>
          </tr>
        </tfoot>
      </table>
    </div></div>
    ${Math.abs(comp.total_debito - comp.total_credito) < 0.01
      ? '<div style="text-align:center;font-size:10px;color:#059669;font-family:\'DM Mono\',monospace;margin-bottom:12px">✓ Asiento balanceado</div>'
      : '<div style="text-align:center;font-size:10px;color:var(--danger);font-family:\'DM Mono\',monospace;margin-bottom:12px">⚠ Asiento desbalanceado</div>'}
    <div style="display:flex;gap:8px;justify-content:flex-end">
      ${comp.estado !== 'Anulado' ? `<button onclick="editarComprobante('${id}','${empresa}')" style="padding:6px 14px;font-size:11px;border-radius:7px;border:1px solid ${c.primary};background:transparent;color:${c.primary};cursor:pointer;font-weight:600">✎ Editar</button>` : ''}
      ${comp.estado !== 'Anulado' ? `<button onclick="anularComprobante('${id}','${empresa}')" style="padding:6px 14px;font-size:11px;border-radius:7px;border:1px solid rgba(185,28,28,0.3);background:var(--danger-soft);color:var(--danger);cursor:pointer">Anular</button>` : ''}
      <button onclick="imprimirComprobante('${id}','${empresa}')" style="padding:6px 14px;font-size:11px;border-radius:7px;border:1px solid var(--br);background:var(--sf2);color:var(--t2);cursor:pointer">🖨 Imprimir</button>
      <button onclick="closeM()" class="btn btn-p" style="${empresa==='tycoon'?'background:#D22630':'background:#00A98D'}">Cerrar</button>
    </div>`;

  var ov = $('ov');
  ov.querySelector('.mo').innerHTML = html;
  ov.setAttribute('data-lock','1');
  ov.classList.add('on');
}

// ── ANULAR COMPROBANTE ──
async function anularComprobante(id, empresa) {
  if (!confirm('¿Anular este comprobante? Esta acción no se puede deshacer.')) return;
  var {error} = await db.from('comprobantes').update({
    estado: 'Anulado',
    anulado_en: new Date().toISOString(),
    anulado_por: USER_DISPLAY_NAME,
  }).eq('id', id);
  if (error) { toast('Error al anular: ' + error.message, 'd'); return; }
  toast('Comprobante anulado', 'ok');
  closeM();
  await loadContabNiif(empresa);
}

// ── EDITAR COMPROBANTE ──
async function editarComprobante(id, empresa) {
  var {data: comp} = await db.from('comprobantes').select('*').eq('id', id).single();
  var {data: lineas} = await db.from('comprobantes_detalle').select('*').eq('comprobante_id', id).order('linea');
  if (!comp) { toast('Comprobante no encontrado', 'd'); return; }
  lineas = lineas || [];

  // Abrir el formulario como si fuera nuevo
  await openNuevoComprobante(empresa);

  // Esperar a que el DOM se renderice
  await new Promise(r => setTimeout(r, 150));

  // Pre-llenar cabecera
  if ($('nc-tipo')) $('nc-tipo').value = comp.tipo_comprobante;
  nc_updateTipo(empresa);
  if ($('nc-fecha')) $('nc-fecha').value = comp.fecha;
  if ($('nc-alterno')) $('nc-alterno').value = comp.numero_alterno || '';
  if ($('nc-tercero')) $('nc-tercero').value = comp.tercero_nombre;
  if ($('nc-tercero-id')) $('nc-tercero-id').value = comp.tercero_id || '';
  if ($('nc-moneda')) $('nc-moneda').value = comp.moneda || 'USD';
  if ($('nc-desc')) $('nc-desc').value = comp.descripcion;

  // Limpiar líneas por defecto (las 2 que se agregan al abrir)
  var container = $('nc-lineas-' + empresa);
  if (container) container.innerHTML = '';
  NC_LINEA_IDX[empresa] = 0;

  // Agregar líneas del comprobante existente
  for (var i = 0; i < lineas.length; i++) {
    nc_addLinea(empresa);
    await new Promise(r => setTimeout(r, 30));
    var lineDiv = $('nc-lin-' + empresa + '-' + (i + 1));
    if (!lineDiv) continue;
    var sel = lineDiv.querySelector('select');
    var descInput = lineDiv.querySelectorAll('input')[0];
    var debInput = lineDiv.querySelector('.nc-deb');
    var credInput = lineDiv.querySelector('.nc-cred');
    if (sel) sel.value = lineas[i].cuenta_codigo;
    if (descInput) descInput.value = lineas[i].descripcion || '';
    if (debInput && lineas[i].debito > 0) debInput.value = lineas[i].debito;
    if (credInput && lineas[i].credito > 0) credInput.value = lineas[i].credito;
  }
  nc_recalcular(empresa);

  // Cambiar botón de "Guardar" a "Actualizar" con lógica de update
  var btn = $('nc-btn-' + empresa);
  if (btn) {
    btn.textContent = 'Actualizar comprobante';
    btn.onclick = async function () {
      await actualizarComprobante(id, empresa);
    };
  }
}

async function actualizarComprobante(id, empresa) {
  var btn = $('nc-btn-' + empresa);
  var errEl = $('nc-err-' + empresa);
  if (btn) { btn.textContent = 'Actualizando...'; btn.disabled = true; }
  if (errEl) errEl.textContent = '';

  var tipo = $('nc-tipo')?.value;
  var fecha = $('nc-fecha')?.value;
  var tercero = ($('nc-tercero')?.value || '').trim();
  var terceroId = ($('nc-tercero-id')?.value || '').trim() || null;
  var desc = ($('nc-desc')?.value || '').trim();
  var moneda = $('nc-moneda')?.value || 'USD';
  var alterno = ($('nc-alterno')?.value || '').trim() || null;

  if (!tipo || !fecha || !tercero || !desc) {
    if (errEl) errEl.textContent = 'Completa los campos obligatorios.';
    if (btn) { btn.textContent = 'Actualizar comprobante'; btn.disabled = false; }
    return;
  }

  // Recoger líneas
  var container = $('nc-lineas-' + empresa);
  var nuevasLineas = [];
  var totalDeb = 0, totalCred = 0;
  container.querySelectorAll('div[id^="nc-lin"]').forEach(function (div, i) {
    var sel = div.querySelector('select');
    var desc2 = div.querySelectorAll('input')[0];
    var debEl = div.querySelector('.nc-deb');
    var credEl = div.querySelector('.nc-cred');
    var cuenta = sel?.value;
    var deb = parseFloat(debEl?.value || 0);
    var cred = parseFloat(credEl?.value || 0);
    if (cuenta && (deb > 0 || cred > 0)) {
      var opt = sel.options[sel.selectedIndex];
      nuevasLineas.push({
        comprobante_id: id,
        linea: i + 1,
        cuenta_codigo: cuenta,
        cuenta_nombre: opt?.dataset?.nombre || opt?.text?.split('—')[1]?.trim() || cuenta,
        descripcion: desc2?.value?.trim() || null,
        debito: deb, credito: cred,
        moneda: moneda, tasa_cambio: 1,
        debito_usd: deb, credito_usd: cred,
      });
      totalDeb += deb;
      totalCred += cred;
    }
  });

  if (nuevasLineas.length < 2) {
    if (errEl) errEl.textContent = 'El asiento debe tener al menos 2 líneas.';
    if (btn) { btn.textContent = 'Actualizar comprobante'; btn.disabled = false; }
    return;
  }
  if (Math.abs(totalDeb - totalCred) >= 0.01) {
    if (errEl) errEl.textContent = 'El asiento no está balanceado. Débitos: ' + fm(totalDeb) + ' · Créditos: ' + fm(totalCred);
    if (btn) { btn.textContent = 'Actualizar comprobante'; btn.disabled = false; }
    return;
  }

  // Actualizar cabecera
  var { error: compErr } = await db.from('comprobantes').update({
    tipo_comprobante: tipo,
    numero_alterno: alterno,
    fecha: fecha,
    tercero_id: terceroId,
    tercero_nombre: tercero,
    descripcion: desc,
    total_debito: totalDeb,
    total_credito: totalCred,
    moneda: moneda,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (compErr) {
    if (errEl) errEl.textContent = 'Error al actualizar: ' + compErr.message;
    if (btn) { btn.textContent = 'Actualizar comprobante'; btn.disabled = false; }
    return;
  }

  // Eliminar líneas anteriores y reinsertar
  await db.from('comprobantes_detalle').delete().eq('comprobante_id', id);
  var { error: detErr } = await db.from('comprobantes_detalle').insert(nuevasLineas);
  if (detErr) {
    if (errEl) errEl.textContent = 'Cabecera actualizada pero error en detalle: ' + detErr.message;
    if (btn) { btn.textContent = 'Actualizar comprobante'; btn.disabled = false; }
    return;
  }

  toast('Comprobante actualizado correctamente ✓', 'ok');
  closeM();
  NC_LINEA_IDX[empresa] = 0;
  await loadContabNiif(empresa);
}

// ── IMPRIMIR COMPROBANTE ──
async function imprimirComprobante(id, empresa) {
  var {data: comp} = await db.from('comprobantes').select('*').eq('id', id).single();
  var {data: lineas} = await db.from('comprobantes_detalle').select('*').eq('comprobante_id', id).order('linea');
  if (!comp) { toast('Comprobante no encontrado', 'd'); return; }
  lineas = lineas || [];

  var c = contabColors(empresa);
  var empName = empresa === 'tycoon' ? 'Tycoon Guru — Fondo de Inversiones' : 'Díaz International Group';
  var tipoNames = {RC:'RECIBO DE CAJA',CE:'COMPROBANTE DE EGRESO',NC:'NOTA CONTABLE',AC:'ASIENTO CONTABLE'};

  var lineasHTML = lineas.map((l,i) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:5px 8px;font-family:monospace;font-size:10pt">${i+1}</td>
      <td style="padding:5px 8px;font-family:monospace;font-size:9pt;color:#4b5563">${l.cuenta_codigo}</td>
      <td style="padding:5px 8px;font-size:10pt">${l.cuenta_nombre||'—'}</td>
      <td style="padding:5px 8px;font-size:9pt;color:#6b7280">${l.descripcion||'—'}</td>
      <td style="padding:5px 8px;text-align:right;font-family:monospace;font-size:10pt;color:#059669">${l.debito>0?fm(l.debito):'—'}</td>
      <td style="padding:5px 8px;text-align:right;font-family:monospace;font-size:10pt;color:#b91c1c">${l.credito>0?fm(l.credito):'—'}</td>
    </tr>`).join('');

  var html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${comp.numero_display}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:20mm 18mm;font-size:11pt;color:#111;background:#fff}
    .header{background:${c.bg};padding:16px 20px;border-radius:8px;margin-bottom:20px;color:#fff}
    .header-top{display:flex;justify-content:space-between;align-items:flex-start}
    .doc-num{font-size:22pt;font-weight:800;letter-spacing:-0.5px}
    .doc-tipo{font-size:10pt;opacity:0.7;margin-top:2px;letter-spacing:1px;text-transform:uppercase}
    .emp-name{font-size:13pt;font-weight:700;text-align:right}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:18px;padding:12px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb}
    .meta-item .label{font-size:8pt;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;font-weight:600;margin-bottom:3px}
    .meta-item .value{font-size:11pt;font-weight:600}
    .desc-box{padding:10px 14px;background:#f3f4f6;border-radius:6px;margin-bottom:16px;font-size:10.5pt;border-left:3px solid ${c.primary}}
    table{width:100%;border-collapse:collapse;margin-bottom:14px}
    thead{background:${c.accent};border-bottom:2px solid ${c.primary}}
    th{padding:7px 8px;text-align:left;font-size:9pt;letter-spacing:0.8px;text-transform:uppercase;color:${c.primary}}
    th:last-child,th:nth-last-child(2){text-align:right}
    .totales-row td{padding:8px;font-weight:700;background:#f9fafb;border-top:2px solid #e5e7eb}
    .balance{text-align:center;font-size:9pt;margin-bottom:20px;color:#059669;font-weight:600}
    .firmas{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:30px}
    .firma-box{text-align:center;border-top:1px solid #111;padding-top:8px;font-size:9pt;color:#6b7280}
    @media print{body{padding:10mm 12mm}}
  </style></head>
  <body>
    <div class="header">
      <div class="header-top">
        <div>
          <div class="doc-num">${comp.numero_display}</div>
          <div class="doc-tipo">${tipoNames[comp.tipo_comprobante]||comp.tipo_comprobante}</div>
        </div>
        <div class="emp-name">${empName}</div>
      </div>
    </div>
    <div class="meta">
      <div class="meta-item"><div class="label">Fecha</div><div class="value">${fd(comp.fecha)}</div></div>
      <div class="meta-item"><div class="label">Tercero</div><div class="value">${comp.tercero_nombre}</div></div>
      <div class="meta-item"><div class="label">Moneda</div><div class="value">${comp.moneda}</div></div>
    </div>
    <div class="desc-box">${comp.descripcion}</div>
    <table>
      <thead><tr>
        <th>#</th><th>Cuenta</th><th>Nombre</th><th>Descripción</th>
        <th style="text-align:right">Débito</th><th style="text-align:right">Crédito</th>
      </tr></thead>
      <tbody>${lineasHTML}</tbody>
      <tr class="totales-row">
        <td colspan="4" style="text-align:right;font-size:10pt;letter-spacing:1px">TOTALES</td>
        <td style="text-align:right;font-family:monospace;color:#059669">${fm(comp.total_debito)}</td>
        <td style="text-align:right;font-family:monospace;color:#b91c1c">${fm(comp.total_credito)}</td>
      </tr>
    </table>
    <div class="balance">✓ Débitos = Créditos — Asiento balanceado</div>
    ${comp.notas ? `<div class="desc-box" style="font-size:9.5pt;color:#6b7280">Notas: ${comp.notas}</div>` : ''}
    <div class="firmas">
      <div class="firma-box">Elaborado por<br><br><strong>${comp.created_by_email||USER_DISPLAY_NAME}</strong></div>
      <div class="firma-box">Revisado por<br><br>&nbsp;</div>
      <div class="firma-box">Autorizado por<br><br>&nbsp;</div>
    </div>
  </body></html>`;

  var win = window.open('','_blank','width=900,height=700,scrollbars=yes');
  if (!win) { toast('Permite ventanas emergentes para imprimir','w'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(()=>win.print(), 600);
}

// ── MODAL NUEVO FEE ──
async function openNuevoFee(empresa) {
  var c = contabColors(empresa);
  var emp = empresa === 'tycoon' ? 'tycoon' : empresa === 'diaz' ? 'diaz' : 'kii';

  // Cargar inversionistas según empresa
  var {data: invs} = empresa === 'tycoon'
    ? await db.from('inversionistas').select('id,nombre').order('nombre')
    : await db.from('clientes_diaz').select('id,nombre').order('nombre');
  invs = invs || [];

  var invOpts = invs.map(i => `<option value="${i.id}" data-nombre="${i.nombre}">${i.nombre}</option>`).join('');

  var html = `
    <div style="padding:4px 0 14px;border-bottom:1px solid var(--br);margin-bottom:16px">
      <div style="font-size:16px;font-weight:800;font-family:'Syne',sans-serif">Nuevo FEE de Inversionista</div>
      <div style="font-size:10px;color:var(--t3);margin-top:2px">Comisión de gestión por inversionista — NIIF</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">Inversionista *</div>
        <select id="fee-inv" class="srch" onchange="var o=this.options[this.selectedIndex];$('fee-nombre').value=o.dataset.nombre||o.text">
          <option value="">— Seleccionar —</option>${invOpts}
        </select>
      </div>
      <div>
        <div class="f-label">Nombre (editable) *</div>
        <input type="text" id="fee-nombre" class="srch" placeholder="Nombre del inversionista">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">FEE % *</div>
        <input type="number" id="fee-pct" class="srch" placeholder="Ej: 5" min="0" max="100" step="0.01" oninput="$('fee-preview').textContent='Ejemplo: $1,000 bruto → $'+(1000-(1000*parseFloat(this.value||0)/100)).toFixed(2)+' neto'">
      </div>
      <div>
        <div class="f-label">Vigente desde *</div>
        <input type="date" id="fee-desde" class="srch" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div>
        <div class="f-label">Vigente hasta</div>
        <input type="date" id="fee-hasta" class="srch">
      </div>
    </div>
    <div id="fee-preview" style="font-size:10px;color:var(--t3);font-family:'DM Mono',monospace;margin-bottom:12px">Ingresa el porcentaje para ver el ejemplo</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div class="f-label">Contrato referencia</div>
        <input type="text" id="fee-contrato" class="srch" placeholder="Ej: TY-001">
      </div>
      <div>
        <div class="f-label">Notas</div>
        <input type="text" id="fee-notas" class="srch" placeholder="Observaciones">
      </div>
    </div>
    <div id="fee-err" style="color:var(--danger);font-size:11px;min-height:16px;margin-top:4px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button onclick="closeM()" class="btn btn-g">Cancelar</button>
      <button onclick="guardarFee('${empresa}')" class="btn btn-p" style="${empresa==='tycoon'?'background:#D22630':'background:#00A98D'}" id="fee-btn">Guardar FEE</button>
    </div>`;

  var ov = $('ov');
  ov.querySelector('.mo').innerHTML = html;
  ov.setAttribute('data-lock','1');
  ov.classList.add('on');
}

async function guardarFee(empresa) {
  var btn = $('fee-btn');
  var errEl = $('fee-err');
  if(btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

  var nombre = ($('fee-nombre')?.value||'').trim();
  var pct = parseFloat($('fee-pct')?.value||0);
  var desde = $('fee-desde')?.value;
  var hasta = $('fee-hasta')?.value || null;
  var contrato = ($('fee-contrato')?.value||'').trim() || null;
  var notas = ($('fee-notas')?.value||'').trim() || null;
  var invId = $('fee-inv')?.value || null;

  if (!nombre || isNaN(pct) || !desde) {
    if(errEl) errEl.textContent = 'Completa: nombre, porcentaje y fecha desde.';
    if(btn) { btn.textContent = 'Guardar FEE'; btn.disabled = false; }
    return;
  }

  var emp = empresa === 'tycoon' ? 'tycoon' : empresa === 'diaz' ? 'diaz' : 'kii';
  var {error} = await db.from('fee_inversionistas').insert({
    empresa: emp,
    inversionista_id: invId || null,
    inversionista_nombre: nombre,
    porcentaje_fee: pct,
    fecha_desde: desde,
    fecha_hasta: hasta,
    contrato_ref: contrato,
    notas, activo: true,
  });

  if (error) {
    if(errEl) errEl.textContent = 'Error: ' + error.message;
    if(btn) { btn.textContent = 'Guardar FEE'; btn.disabled = false; }
    return;
  }

  toast('FEE registrado correctamente ✓', 'ok');
  closeM();
  await loadContabNiif(empresa);
}

async function eliminarFee(id, empresa) {
  if (!confirm('¿Eliminar este FEE?')) return;
  var {error} = await db.from('fee_inversionistas').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'd'); return; }
  toast('FEE eliminado', 'ok');
  await loadContabNiif(empresa);
}

async function editarFee(id, empresa) {
  var {data: f} = await db.from('fee_inversionistas').select('*').eq('id', id).single();
  if (!f) { toast('No encontrado', 'd'); return; }
  await openNuevoFee(empresa);
  // Pre-llenar campos
  setTimeout(() => {
    if($('fee-nombre')) $('fee-nombre').value = f.inversionista_nombre;
    if($('fee-pct'))    $('fee-pct').value    = f.porcentaje_fee;
    if($('fee-desde'))  $('fee-desde').value  = f.fecha_desde;
    if($('fee-hasta') && f.fecha_hasta) $('fee-hasta').value = f.fecha_hasta;
    if($('fee-contrato') && f.contrato_ref) $('fee-contrato').value = f.contrato_ref;
    if($('fee-notas') && f.notas) $('fee-notas').value = f.notas;
    var btn = $('fee-btn');
    if(btn) {
      btn.textContent = 'Actualizar FEE';
      btn.onclick = async function() {
        btn.textContent = 'Guardando...'; btn.disabled = true;
        var {error} = await db.from('fee_inversionistas').update({
          inversionista_nombre: $('fee-nombre').value.trim(),
          porcentaje_fee: parseFloat($('fee-pct').value||0),
          fecha_desde: $('fee-desde').value,
          fecha_hasta: $('fee-hasta').value || null,
          contrato_ref: $('fee-contrato').value.trim() || null,
          notas: $('fee-notas').value.trim() || null,
          updated_at: new Date().toISOString(),
        }).eq('id', id);
        if(error) { $('fee-err').textContent = 'Error: '+error.message; btn.textContent='Actualizar FEE';btn.disabled=false; return; }
        toast('FEE actualizado ✓','ok'); closeM(); await loadContabNiif(empresa);
      };
    }
  }, 100);
}

// Guard en goTab para contab tabs (solo admin y equipo)
// Nota: los guards se aplican al inicio de goTab

// ══════════════════════════════════════════════════════════════
// MÓDULO EMPRESAS — Registro legal del holding
// ══════════════════════════════════════════════════════════════
let EMPRESAS_LOADED = false;
let EMPRESAS_DATA = [];
let EMPRESAS_FILTER = 'todas';

// ── LOAD FROM SUPABASE ────────────────────────────────────────

