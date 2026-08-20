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

// Cálculo de recuperación caso a caso. Staking recalculado en vivo (DIAS360 a hoy).
function calcularMercadoKII() {
  const hoy = new Date().toISOString().split('T')[0];
  const p = KII_MARKET.precio;
  const filas = (KII_DATA || []).map(function(i) {
    const kc = i.kii_coins || 0;
    const inv = i.valor_inversion || 0;
    const pc = kc > 0 ? inv / kc : 0; // precio de compra real
    const stk = calcularStakingSiAplica(kc, i.fecha_inversion, hoy, i.genera_staking);
    const tokTot = kc + stk;
    const valCoins = p != null ? kc * p : null;
    const valTotal = p != null ? tokTot * p : null;
    const recup = (p != null && inv > 0) ? (valTotal / inv * 100) : null;
    const varPrecio = (p != null && pc > 0) ? ((p - pc) / pc * 100) : null;
    return {
      contrato: i.contrato, nombre: i.inversionista_nombre || i.nombre || '—',
      fecha: i.fecha_inversion, inv: inv, kc: kc, pc: pc, stk: stk, tokTot: tokTot,
      valCoins: valCoins, valTotal: valTotal, recup: recup, varPrecio: varPrecio
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
  const tVal = p != null ? filas.reduce(function(a, f) { return a + f.valTotal; }, 0) : null;
  const nRec = filas.filter(function(f) { return f.recup != null && f.recup >= 100; }).length;
  const nPer = filas.filter(function(f) { return f.recup != null && f.recup < 100; }).length;
  const fuente = KII_MARKET.manual ? 'Precio manual' : 'CoinGecko · igual a CoinMarketCap';
  const ts = KII_MARKET.ts ? KII_MARKET.ts.toLocaleTimeString() : '—';

  let html = '<div class="stats" style="margin-bottom:14px">' +
    '<div class="stat" style="border-top:2px solid #FFD700"><div class="sl">Precio KII en vivo</div><div class="sv" style="color:#FFD700">' + (p != null ? '$' + p.toFixed(5) : '—') + '</div><div class="sd">' + fuente + ' · ' + ts + (KII_MARKET.cambio24h != null ? ' · 24h ' + (KII_MARKET.cambio24h >= 0 ? '+' : '') + KII_MARKET.cambio24h.toFixed(2) + '%' : '') + '</div><div class="si">◈</div></div>' +
    '<div class="stat" style="border-top:2px solid #9AD1F7"><div class="sl">Total invertido</div><div class="sv" style="font-size:14px;color:#9AD1F7">' + fm(tInv) + '</div><div class="sd">USD histórico</div><div class="si">◇</div></div>' +
    '<div class="stat" style="border-top:2px solid ' + (tVal != null && tVal >= tInv ? '#4ADE80' : '#B91C1C') + '"><div class="sl">Valor a mercado hoy</div><div class="sv" style="font-size:14px;color:' + (tVal != null && tVal >= tInv ? '#4ADE80' : '#B91C1C') + '">' + (tVal != null ? fm(tVal) : '—') + '</div><div class="sd">' + (tVal != null ? 'recuperación global ' + (tVal / tInv * 100).toFixed(1) + '%' : 'sin precio') + '</div><div class="si">⬡</div></div>' +
    '<div class="stat" style="border-top:2px solid #C7A9F8"><div class="sl">Casos</div><div class="sv" style="font-size:14px"><span style="color:#4ADE80">' + nRec + ' recuperados</span> · <span style="color:#B91C1C">' + nPer + ' en pérdida</span></div><div class="sd">de ' + filas.length + ' contratos</div><div class="si">⬢</div></div>' +
    '</div>';

  html += '<div class="tw"><div class="tw-scroll"><table><thead><tr>' +
    '<th>TK</th><th>Inversionista</th><th>Fecha</th><th style="text-align:right">Inversión</th>' +
    '<th style="text-align:right">KII Coins</th><th style="text-align:right">P. Compra</th>' +
    '<th style="text-align:right">P. Mercado</th><th style="text-align:right">Δ Precio</th>' +
    '<th style="text-align:right">Staking (hoy)</th><th style="text-align:right">Valor mercado</th>' +
    '<th style="text-align:right">Recup.</th><th>Estado</th></tr></thead><tbody>';

  filas.forEach(function(f) {
    const vpCol = f.varPrecio == null ? 'var(--t3)' : (f.varPrecio >= 0 ? '#4ADE80' : '#B91C1C');
    const rcCol = f.recup == null ? 'var(--t3)' : (f.recup >= 100 ? '#4ADE80' : '#B91C1C');
    html += '<tr>' +
      '<td style="font-family:\'DM Mono\',monospace;color:#C7A9F8">' + (f.contrato || '') + '</td>' +
      '<td>' + f.nombre + '</td>' +
      '<td style="font-family:\'DM Mono\',monospace">' + (f.fecha || '') + '</td>' +
      '<td style="text-align:right">' + fm(f.inv) + '</td>' +
      '<td style="text-align:right;font-family:\'DM Mono\',monospace">' + fmk(f.kc) + '</td>' +
      '<td style="text-align:right;font-family:\'DM Mono\',monospace">$' + f.pc.toFixed(4) + '</td>' +
      '<td style="text-align:right;font-family:\'DM Mono\',monospace;color:#FFD700">' + (p != null ? '$' + p.toFixed(5) : '—') + '</td>' +
      '<td style="text-align:right;color:' + vpCol + ';font-weight:600">' + (f.varPrecio == null ? '—' : (f.varPrecio >= 0 ? '+' : '') + f.varPrecio.toFixed(1) + '%') + '</td>' +
      '<td style="text-align:right;font-family:\'DM Mono\',monospace">' + fmk(Math.round(f.stk)) + '</td>' +
      '<td style="text-align:right;font-weight:600">' + (f.valTotal == null ? '—' : fm(f.valTotal)) + '</td>' +
      '<td style="text-align:right;color:' + rcCol + ';font-weight:700">' + (f.recup == null ? '—' : f.recup.toFixed(1) + '%') + '</td>' +
      '<td>' + badgeRecupKII(f.recup) + '</td></tr>';
  });
  html += '</tbody></table></div></div>' +
    '<div style="margin-top:10px;font-size:10px;color:var(--t3)">Valor mercado = (KII Coins + staking calculado DIAS360 a hoy) × precio en vivo. Precio de compra = inversión ÷ KII Coins leídos de la base de datos. Referencia pública: coinmarketcap.com/currencies/kiichain</div>';
  cont.innerHTML = html;
}

function imprimirMercadoKII() {
  if (KII_MARKET.precio == null) { toast('Primero obtén o ingresa el precio de mercado', 'd'); return; }
  const p = KII_MARKET.precio;
  const filas = calcularMercadoKII();
  const tInv = filas.reduce(function(a, f) { return a + f.inv; }, 0);
  const tVal = filas.reduce(function(a, f) { return a + f.valTotal; }, 0);
  let rows = '';
  filas.forEach(function(f) {
    rows += '<tr><td>' + (f.contrato || '') + '</td><td>' + f.nombre + '</td><td>' + (f.fecha || '') + '</td>' +
      '<td class="r">' + fm(f.inv) + '</td><td class="r">' + fmk(f.kc) + '</td><td class="r">$' + f.pc.toFixed(4) + '</td>' +
      '<td class="r">$' + p.toFixed(5) + '</td><td class="r">' + (f.varPrecio >= 0 ? '+' : '') + f.varPrecio.toFixed(1) + '%</td>' +
      '<td class="r">' + fmk(Math.round(f.stk)) + '</td><td class="r">' + fm(f.valTotal) + '</td>' +
      '<td class="r ' + (f.recup >= 100 ? 'ok' : 'bad') + '">' + f.recup.toFixed(1) + '%</td>' +
      '<td class="' + (f.recup >= 100 ? 'ok' : 'bad') + '">' + (f.recup >= 100 ? 'RECUPERADO' : (f.recup >= 80 ? 'PARCIAL' : 'EN PÉRDIDA')) + '</td></tr>';
  });
  const w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe Mercado KII</title><style>' +
    'body{font-family:Arial,sans-serif;font-size:10px;color:#111;margin:24px}h1{font-size:16px;margin:0}h2{font-size:11px;color:#555;font-weight:400;margin:4px 0 14px}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f0eef7;font-size:9px;text-transform:uppercase}' +
    '.r{text-align:right;font-variant-numeric:tabular-nums}.ok{color:#15803d;font-weight:700}.bad{color:#B91C1C;font-weight:700}' +
    '.tot td{background:#faf9fd;font-weight:700}</style></head><body>' +
    '<h1>KII Exchange · Informe de Recuperación por Inversionista</h1>' +
    '<h2>Precio de mercado: $' + p.toFixed(5) + ' USD (' + (KII_MARKET.manual ? 'manual' : 'CoinGecko/CoinMarketCap') + ') · Generado: ' + new Date().toLocaleString() + '</h2>' +
    '<table><thead><tr><th>TK</th><th>Inversionista</th><th>Fecha</th><th>Inversión</th><th>KII Coins</th><th>P. Compra</th><th>P. Mercado</th><th>Δ Precio</th><th>Staking hoy</th><th>Valor mercado</th><th>Recup.</th><th>Estado</th></tr></thead><tbody>' + rows +
    '<tr class="tot"><td colspan="3">TOTAL</td><td class="r">' + fm(tInv) + '</td><td colspan="5"></td><td class="r">' + fm(tVal) + '</td><td class="r">' + (tVal / tInv * 100).toFixed(1) + '%</td><td></td></tr>' +
    '</tbody></table></body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); }, 400);
}
