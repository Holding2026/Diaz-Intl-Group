function buildKIIStats() {
  const d = KII_DATA;
  const ti = d.reduce((a,i)=>a+i.valor_inversion,0);
  const tt = d.reduce((a,i)=>a+(i.total_tokens||0),0);
  const tu = d.reduce((a,i)=>a+(i.total_tokens||0)*0.02,0);
  $('kii-stats').innerHTML = `
    <div class="stat" style="border-top:2px solid var(--ac)"><div class="sl">Inversionistas KII</div><div class="sv" style="color:var(--ac)">${d.length}</div><div class="sd">posiciones permanentes</div><div class="si">⬡</div></div>
    <div class="stat" style="border-top:2px solid #9AD1F7"><div class="sl">Total invertido</div><div class="sv" style="font-size:14px;color:#9AD1F7">${fm(ti)}</div><div class="sd">USD histórico</div><div class="si">◇</div></div>
    <div class="stat" style="border-top:2px solid var(--ac)"><div class="sl">Total tokens KII</div><div class="sv" style="color:var(--ac)">${fmk(tt)}</div><div class="sd">coins + staking acum.</div><div class="si">○</div></div>
    <div class="stat" style="border-top:2px solid #9AD1F7"><div class="sl">Valor @$0.02</div><div class="sv" style="font-size:14px;color:#9AD1F7">${fm(tu)}</div><div class="sd">precio referencia</div><div class="si">△</div></div>`;
  $('kii-bdg').textContent = `${d.length} posiciones · ${fmk(tt)} tokens`;
}

function renderKII() {
  const q=$('kii-q').value.toLowerCase(), s=$('kii-so').value, f=F.kii;
  let data = KII_DATA.filter(i=>{
    if(f==='2022'&&i.fecha_inversion&&!i.fecha_inversion.startsWith('2022')) return false;
    if(f==='2023'&&i.fecha_inversion&&!i.fecha_inversion.startsWith('2023')) return false;
    if(f==='2024p'&&i.fecha_inversion&&(i.fecha_inversion.startsWith('2022')||i.fecha_inversion.startsWith('2023'))) return false;
    if(q&&!i.inversionista_nombre.toLowerCase().includes(q)&&!i.contrato.toLowerCase().includes(q)) return false;
    return true;
  });
  if(s==='inv') data.sort((a,b)=>b.valor_inversion-a.valor_inversion);
  else if(s==='tok') data.sort((a,b)=>(b.total_tokens||0)-(a.total_tokens||0));
  else data.sort((a,b)=>a.inversionista_nombre.localeCompare(b.inversionista_nombre));
  if(!data.length){
    $('kii-body').innerHTML=`<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:20px">Sin resultados</td></tr>`;
    $('kii-cards').innerHTML=''; return;
  }
  $('kii-body').innerHTML = data.map((i,ix)=>{
    const col=PAL[ix%PAL.length];
    const tt=i.total_tokens||0, st=i.staking_acumulado||0, kc=i.kii_coins||0;
    const sr=kc>0?Math.round((st/kc)*100):0;
    return `<tr>
      <td><div class="ic"><div class="iav" style="background:${col}18;color:${col};border:1px solid ${col}30">${ini(i.inversionista_nombre)}</div>
        <div><div class="inm">${i.inversionista_nombre}</div><div class="iid">${fd(i.fecha_inversion)}</div></div></div></td>
      <td><span class="mn" style="color:${col};font-size:10px">${i.contrato}</span></td>
      <td><span class="mn g">${i.valor_inversion>0?fm(i.valor_inversion):'—'}</span></td>
      <td><span class="mn" style="font-size:10px">${fmk(kc)}</span></td>
      <td><div><span class="mn" style="font-size:10px;color:var(--bl)">${fmk(st)}</span>
        <div class="vb"><div class="vbf" style="width:${sr}%;background:var(--bl)"></div></div></div></td>
      <td><span class="mn" style="font-weight:600">${fmk(tt)}</span></td>
      <td><span class="mn g">${fm(tt*0.02)}</span></td>
      <td><span style="font-size:9.5px;color:var(--t2)">${fd(i.fecha_corte)}</span></td>
    </tr>`;
  }).join('');
  $('kii-cards').innerHTML = data.map((i,ix)=>{
    const col=PAL[ix%PAL.length];
    const tt=i.total_tokens||0;
    return `<div class="mcard">
      <div class="mcard-hdr"><div class="ic"><div class="iav" style="background:${col}18;color:${col};border:1px solid ${col}30">${ini(i.inversionista_nombre)}</div>
        <div><div class="mcard-title">${i.inversionista_nombre}</div><div class="iid" style="color:${col}">${i.contrato} · ${fd(i.fecha_inversion)}</div></div></div>
        <span class="pill pg" style="font-size:8.5px">${fd(i.fecha_corte)}</span></div>
      <div class="mcard-grid">
        <div class="mg-item"><div class="mgk">Inversión</div><div class="mgv g">${i.valor_inversion>0?fm(i.valor_inversion):'—'}</div></div>
        <div class="mg-item"><div class="mgk">KII Coins</div><div class="mgv">${fmk(i.kii_coins)}</div></div>
        <div class="mg-item"><div class="mgk">Staking acum.</div><div class="mgv" style="color:var(--bl)">${fmk(i.staking_acumulado)}</div></div>
        <div class="mg-item"><div class="mgk">Total tokens</div><div class="mgv" style="font-weight:700">${fmk(tt)}</div></div>
        <div class="mg-item" style="grid-column:span 2"><div class="mgk">Valor @$0.02</div><div class="mgv g" style="font-size:14px">${fm(tt*0.02)}</div></div>
      </div></div>`;
  }).join('');
}

// ── REGISTRAR PAGO DÍAZ ──────────────────────────────────────

// ── KII: MERCADO EN VIVO (CoinGecko / CoinMarketCap) ───────────
// Precio en tiempo real de KII (KiiChain). Fuente: API pública CoinGecko
// (id: kiichain), mismo precio que https://coinmarketcap.com/currencies/kiichain/
// CoinMarketCap no permite lectura directa desde el navegador (CORS),
// por eso se usa CoinGecko que sí expone API pública sin key.
var KII_MARKET = { precio: null, cambio24h: null, ts: null, manual: false, error: null };
var KII_MARKET_TIMER = null;

async function fetchKiiPrecio(silencioso) {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=kiichain&vs_currencies=usd&include_24hr_change=true', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const p = j && j.kiichain ? j.kiichain.usd : null;
    if (!p) throw new Error('sin datos');
    KII_MARKET.precio = p;
    KII_MARKET.cambio24h = j.kiichain.usd_24h_change != null ? j.kiichain.usd_24h_change : null;
    KII_MARKET.ts = new Date();
    KII_MARKET.manual = false;
    KII_MARKET.error = null;
  } catch (e) {
    KII_MARKET.error = e.message || 'error';
    if (!silencioso) toast('No se pudo obtener el precio en vivo. Puedes ingresarlo manualmente.', 'd');
  }
  pintarPrecioLiveKII();
  const panel = $('kii-panel-mercado');
  if (panel && panel.style.display !== 'none') renderKiiMercado();
}

function startKiiPrecioAuto() {
  if (KII_MARKET_TIMER) return;
  fetchKiiPrecio(true);
  KII_MARKET_TIMER = setInterval(function(){ fetchKiiPrecio(true); }, 60000); // cada 60s
}

function setPrecioManualKII(v) {
  const p = parseFloat(v);
  if (!p || p <= 0) return;
  KII_MARKET.precio = p;
  KII_MARKET.cambio24h = null;
  KII_MARKET.ts = new Date();
  KII_MARKET.manual = true;
  KII_MARKET.error = null;
  pintarPrecioLiveKII();
  renderKiiMercado();
}

function pintarPrecioLiveKII() {
  const el = $('kii-precio-live');
  if (!el) return;
  if (KII_MARKET.precio == null) {
    el.innerHTML = '<span style="color:var(--t3)">KII: sin precio</span>';
    return;
  }
  const ch = KII_MARKET.cambio24h;
  const chHtml = ch == null ? '' :
    '<span style="color:' + (ch >= 0 ? '#4ADE80' : '#B91C1C') + ';font-weight:700"> ' + (ch >= 0 ? '▲' : '▼') + Math.abs(ch).toFixed(2) + '%</span>';
  el.innerHTML = '<span style="color:#9AD1F7">KII</span> <span style="color:#FFD700;font-weight:700">$' + KII_MARKET.precio.toFixed(5) + '</span>' + chHtml +
    (KII_MARKET.manual ? ' <span style="color:var(--t3);font-size:8px">(manual)</span>' : '');
}

// Cálculo de recuperación caso a caso — DOS ESCENARIOS:
//  A) Capital principal: kii_coins (como está) + staking
//  B) Equivalencia @$0.02: inversión/0.02 (lo que le corresponde) + staking
// Staking se calcula siempre sobre los KII Coins originales (DIAS360 a hoy).
function calcularMercadoKII() {
  const hoy = new Date().toISOString().split('T')[0];
  const p = KII_MARKET.precio;
  const filas = (KII_DATA || []).map(function(i) {
    const kc = i.kii_coins || 0;
    const inv = i.valor_inversion || 0;
    const pc = kc > 0 ? inv / kc : 0; // precio de compra real
    const stk = calcularStakingSiAplica(kc, i.fecha_inversion, hoy, i.genera_staking);
    const equiv = inv / 0.02;              // tokens por equivalencia @$0.02
    const tokA = kc + stk;                 // escenario A: principal + staking
    const tokB = equiv + stk;              // escenario B: equivalencia + staking
    const valA = p != null ? tokA * p : null;
    const valB = p != null ? tokB * p : null;
    const recupA = (p != null && inv > 0) ? (valA / inv * 100) : null;
    const recupB = (p != null && inv > 0) ? (valB / inv * 100) : null;
    const varPrecio = (p != null && pc > 0) ? ((p - pc) / pc * 100) : null;
    return {
      contrato: i.contrato, nombre: i.inversionista_nombre || i.nombre || '—',
      fecha: i.fecha_inversion, inv: inv, kc: kc, pc: pc, stk: stk, equiv: equiv,
      tokA: tokA, tokB: tokB, valA: valA, valB: valB, recupA: recupA, recupB: recupB, varPrecio: varPrecio
    };
  });
  filas.sort(function(a, b) { return (a.nombre || '').localeCompare(b.nombre || '') || (a.contrato || '').localeCompare(b.contrato || '', undefined, { numeric: true }); });
  return filas;
}

function badgeRecupKII(recup) {
  if (recup == null) return '<span class="badge" style="background:rgba(148,163,184,.15);color:var(--t3)">SIN PRECIO</span>';
  if (recup >= 100) return '<span class="badge" style="background:rgba(74,222,128,.15);color:#4ADE80;border:1px solid rgba(74,222,128,.3)">RECUPERADO</span>';
  if (recup >= 80) return '<span class="badge" style="background:rgba(240,192,96,.15);color:#F0C060;border:1px solid rgba(240,192,96,.3)">PARCIAL</span>';
  return '<span class="badge" style="background:rgba(185,28,28,.15);color:#B91C1C;border:1px solid rgba(185,28,28,.3)">EN PÉRDIDA</span>';
}

function renderKiiMercado() {
  const cont = $('kii-mercado-body');
  if (!cont) return;
  if (!KII_DATA || !KII_DATA.length) {
    cont.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3)">Cargando posiciones...</div>';
    loadKII().then(renderKiiMercado);
    return;
  }
  const p = KII_MARKET.precio;
  const filas = calcularMercadoKII();
  const tInv = filas.reduce(function(a, f) { return a + f.inv; }, 0);
  const tValA = p != null ? filas.reduce(function(a, f) { return a + f.valA; }, 0) : null;
  const tValB = p != null ? filas.reduce(function(a, f) { return a + f.valB; }, 0) : null;
  const nRecA = filas.filter(function(f) { return f.recupA != null && f.recupA >= 100; }).length;
  const nRecB = filas.filter(function(f) { return f.recupB != null && f.recupB >= 100; }).length;
  const fuente = KII_MARKET.manual ? 'Precio manual' : 'CoinGecko · igual a CoinMarketCap';
  const ts = KII_MARKET.ts ? KII_MARKET.ts.toLocaleTimeString() : '—';

  let html = '<div class="stats" style="margin-bottom:14px">' +
    '<div class="stat" style="border-top:2px solid #FFD700"><div class="sl">Precio KII en vivo</div><div class="sv" style="color:#FFD700">' + (p != null ? '$' + p.toFixed(5) : '—') + '</div><div class="sd">' + fuente + ' · ' + ts + (KII_MARKET.cambio24h != null ? ' · 24h ' + (KII_MARKET.cambio24h >= 0 ? '+' : '') + KII_MARKET.cambio24h.toFixed(2) + '%' : '') + '</div><div class="si">◈</div></div>' +
    '<div class="stat" style="border-top:2px solid #9AD1F7"><div class="sl">Total invertido</div><div class="sv" style="font-size:14px;color:#9AD1F7">' + fm(tInv) + '</div><div class="sd">USD histórico</div><div class="si">◇</div></div>' +
    '<div class="stat" style="border-top:2px solid ' + (tValA != null && tValA >= tInv ? '#4ADE80' : '#B91C1C') + '"><div class="sl">Esc. A · Capital principal</div><div class="sv" style="font-size:14px;color:' + (tValA != null && tValA >= tInv ? '#4ADE80' : '#B91C1C') + '">' + (tValA != null ? fm(tValA) : '—') + '</div><div class="sd">' + (tValA != null ? 'recup. ' + (tValA / tInv * 100).toFixed(1) + '% · ' + nRecA + ' casos recuperados' : 'sin precio') + '</div><div class="si">⬡</div></div>' +
    '<div class="stat" style="border-top:2px solid ' + (tValB != null && tValB >= tInv ? '#4ADE80' : '#C7A9F8') + '"><div class="sl">Esc. B · Equivalencia @$0.02</div><div class="sv" style="font-size:14px;color:' + (tValB != null && tValB >= tInv ? '#4ADE80' : '#C7A9F8') + '">' + (tValB != null ? fm(tValB) : '—') + '</div><div class="sd">' + (tValB != null ? 'recup. ' + (tValB / tInv * 100).toFixed(1) + '% · ' + nRecB + ' casos recuperados' : 'sin precio') + '</div><div class="si">⬢</div></div>' +
    '</div>';

  html += '<div class="tw"><div class="tw-scroll"><table><thead><tr>' +
    '<th>TK</th><th>Inversionista</th><th style="text-align:right">Inversión</th>' +
    '<th style="text-align:right">P. Compra</th><th style="text-align:right">Staking hoy</th>' +
    '<th style="text-align:right;border-left:1px solid var(--br)">KII Principal</th>' +
    '<th style="text-align:right">Valor A</th><th style="text-align:right">Recup. A</th>' +
    '<th style="text-align:right;border-left:1px solid var(--br)">Equiv @0.02</th>' +
    '<th style="text-align:right">Valor B</th><th style="text-align:right">Recup. B</th>' +
    '<th>Estado (B)</th></tr></thead><tbody>';

  filas.forEach(function(f) {
    const cA = f.recupA == null ? 'var(--t3)' : (f.recupA >= 100 ? '#4ADE80' : '#B91C1C');
    const cB = f.recupB == null ? 'var(--t3)' : (f.recupB >= 100 ? '#4ADE80' : '#B91C1C');
    html += '<tr>' +
      '<td style="font-family:\'DM Mono\',monospace;color:#C7A9F8">' + (f.contrato || '') + '</td>' +
      '<td>' + f.nombre + '<div style="font-size:9px;color:var(--t3);font-family:\'DM Mono\',monospace">' + (f.fecha || '') + '</div></td>' +
      '<td style="text-align:right">' + fm(f.inv) + '</td>' +
      '<td style="text-align:right;font-family:\'DM Mono\',monospace">$' + f.pc.toFixed(4) + '</td>' +
      '<td style="text-align:right;font-family:\'DM Mono\',monospace">' + fmk(Math.round(f.stk)) + '</td>' +
      '<td style="text-align:right;font-family:\'DM Mono\',monospace;border-left:1px solid var(--br)">' + fmk(f.kc) + '</td>' +
      '<td style="text-align:right;font-weight:600">' + (f.valA == null ? '—' : fm(f.valA)) + '</td>' +
      '<td style="text-align:right;color:' + cA + ';font-weight:700">' + (f.recupA == null ? '—' : f.recupA.toFixed(1) + '%') + '</td>' +
      '<td style="text-align:right;font-family:\'DM Mono\',monospace;color:#C7A9F8;border-left:1px solid var(--br)">' + fmk(Math.round(f.equiv)) + '</td>' +
      '<td style="text-align:right;font-weight:600">' + (f.valB == null ? '—' : fm(f.valB)) + '</td>' +
      '<td style="text-align:right;color:' + cB + ';font-weight:700">' + (f.recupB == null ? '—' : f.recupB.toFixed(1) + '%') + '</td>' +
      '<td>' + badgeRecupKII(f.recupB) + '</td></tr>';
  });
  html += '</tbody></table></div></div>' +
    '<div style="margin-top:10px;font-size:10px;color:var(--t3);line-height:1.6">' +
    '<b>Escenario A</b> = (KII Coins de capital principal + staking DIAS360 a hoy) × precio en vivo — cómo está con lo que compró.<br>' +
    '<b>Escenario B</b> = (Inversión ÷ $0.02 + staking DIAS360 a hoy) × precio en vivo — lo que le corresponde por equivalencia @$0.02.<br>' +
    'Precio de compra = inversión ÷ KII Coins leídos de la base de datos · Referencia pública: coinmarketcap.com/currencies/kiichain</div>';
  cont.innerHTML = html;
}

function imprimirMercadoKII() {
  if (KII_MARKET.precio == null) { toast('Primero obtén o ingresa el precio de mercado', 'd'); return; }
  const p = KII_MARKET.precio;
  const filas = calcularMercadoKII();
  const tInv = filas.reduce(function(a, f) { return a + f.inv; }, 0);
  const tValA = filas.reduce(function(a, f) { return a + f.valA; }, 0);
  const tValB = filas.reduce(function(a, f) { return a + f.valB; }, 0);
  let rows = '';
  filas.forEach(function(f) {
    rows += '<tr><td>' + (f.contrato || '') + '</td><td>' + f.nombre + '</td><td>' + (f.fecha || '') + '</td>' +
      '<td class="r">' + fm(f.inv) + '</td><td class="r">$' + f.pc.toFixed(4) + '</td><td class="r">' + fmk(Math.round(f.stk)) + '</td>' +
      '<td class="r">' + fmk(f.kc) + '</td><td class="r">' + fm(f.valA) + '</td><td class="r ' + (f.recupA >= 100 ? 'ok' : 'bad') + '">' + f.recupA.toFixed(1) + '%</td>' +
      '<td class="r">' + fmk(Math.round(f.equiv)) + '</td><td class="r">' + fm(f.valB) + '</td><td class="r ' + (f.recupB >= 100 ? 'ok' : 'bad') + '">' + f.recupB.toFixed(1) + '%</td>' +
      '<td class="' + (f.recupB >= 100 ? 'ok' : 'bad') + '">' + (f.recupB >= 100 ? 'RECUPERADO' : (f.recupB >= 80 ? 'PARCIAL' : 'EN PÉRDIDA')) + '</td></tr>';
  });
  const w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe Mercado KII</title><style>' +
    'body{font-family:Arial,sans-serif;font-size:9px;color:#111;margin:20px}h1{font-size:15px;margin:0}h2{font-size:10px;color:#555;font-weight:400;margin:4px 0 4px}' +
    '.leg{font-size:8.5px;color:#555;margin:0 0 12px;line-height:1.5}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:3px 5px;text-align:left}th{background:#f0eef7;font-size:8px;text-transform:uppercase}' +
    '.r{text-align:right;font-variant-numeric:tabular-nums}.ok{color:#15803d;font-weight:700}.bad{color:#B91C1C;font-weight:700}' +
    '.tot td{background:#faf9fd;font-weight:700}@page{size:landscape}</style></head><body>' +
    '<h1>KII Exchange · Informe de Recuperación por Inversionista — Dos Escenarios</h1>' +
    '<h2>Precio de mercado: $' + p.toFixed(5) + ' USD (' + (KII_MARKET.manual ? 'manual' : 'CoinGecko/CoinMarketCap') + ') · Generado: ' + new Date().toLocaleString() + '</h2>' +
    '<p class="leg"><b>Escenario A</b> = (KII Coins de capital principal + staking DIAS360 a hoy) × precio de mercado. <b>Escenario B</b> = (Inversión ÷ $0.02 por equivalencia + staking) × precio de mercado.</p>' +
    '<table><thead><tr><th>TK</th><th>Inversionista</th><th>Fecha</th><th>Inversión</th><th>P. Compra</th><th>Staking hoy</th><th>KII Principal</th><th>Valor A</th><th>Recup. A</th><th>Equiv @0.02</th><th>Valor B</th><th>Recup. B</th><th>Estado (B)</th></tr></thead><tbody>' + rows +
    '<tr class="tot"><td colspan="3">TOTAL</td><td class="r">' + fm(tInv) + '</td><td colspan="3"></td><td class="r">' + fm(tValA) + '</td><td class="r">' + (tValA / tInv * 100).toFixed(1) + '%</td><td></td><td class="r">' + fm(tValB) + '</td><td class="r">' + (tValB / tInv * 100).toFixed(1) + '%</td><td></td></tr>' +
    '</tbody></table></body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); }, 400);
}
