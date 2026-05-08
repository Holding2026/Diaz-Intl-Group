function buildDZStats() {
  const d = FACT_DATA;
  const tot2026 = d.filter(f=>f.año===2026&&f.moneda==='USD').reduce((a,f)=>a+(f.valor_factura||f.valor||0),0);
  const tot2025 = d.filter(f=>f.año===2025&&f.moneda==='USD').reduce((a,f)=>a+(f.valor_factura||f.valor||0),0);
  const pendiente = d.filter(f=>['Abono','Pendiente'].includes(f.estado)).length;
  const saldoUSD = d.filter(f=>f.moneda==='USD'&&(f.saldo_pendiente||0)>0&&!['Pagada','Anulada','Castigo'].includes(f.estado)).reduce((a,f)=>a+(f.saldo_pendiente||0),0);
  const saldoEUR = d.filter(f=>f.moneda==='EUR'&&(f.saldo_pendiente||0)>0&&!['Pagada','Anulada','Castigo'].includes(f.estado)).reduce((a,f)=>a+(f.saldo_pendiente||0),0);
  $('dz-stats').innerHTML = `
    <div class="stat" style="border-top:2px solid var(--ac)"><div class="sl">Total facturas</div><div class="sv" style="color:var(--ac)">${d.length}</div><div class="sd">2022–2026</div><div class="si">◎</div></div>
    <div class="stat" style="border-top:2px solid var(--ac)"><div class="sl">Facturado 2026</div><div class="sv" style="font-size:15px;color:var(--ac)">${fm(tot2026)}</div><div class="sd">USD · ${d.filter(f=>f.año===2026).length} facturas</div><div class="si">◇</div></div>
    <div class="stat" style="border-top:2px solid var(--ac);opacity:0.85"><div class="sl">Facturado 2025</div><div class="sv" style="font-size:15px;color:var(--ac)">${fm(tot2025)}</div><div class="sd">USD · ${d.filter(f=>f.año===2025).length} facturas</div><div class="si">△</div></div>
    <div class="stat" style="border-top:2px solid var(--w);border-color:rgba(240,165,0,.25)">
      <div class="sl">Cartera pendiente</div>
      ${saldoUSD>0?`<div class="sv w" style="font-size:16px">${fm(saldoUSD)}<span style="font-size:9px;margin-left:4px">USD</span></div>`:''}
      ${saldoEUR>0?`<div class="sv w" style="font-size:16px">${fm(saldoEUR)}<span style="font-size:9px;margin-left:4px">EUR</span></div>`:''}
      ${!saldoUSD&&!saldoEUR?'<div class="sv" style="font-size:16px;color:var(--t3)">$0.00</div>':''}
      <div class="sd">${pendiente} factura(s) por cobrar</div>
      <div class="si">⬡</div>
    </div>`;
  $('dz-bdg').textContent = `${d.length} registros`;
  // Alertas de pago programado
  const hoy = new Date();
  const alertasPago = d.filter(f=>{
    if(['Pagada','Anulada','Castigo'].includes(f.estado)) return false;
    if(!f.fecha_pago_programado) return false;
    const dias = Math.floor((new Date(f.fecha_pago_programado+'T12:00:00')-hoy)/(1000*60*60*24));
    return dias <= 3;
  });
  $('dz-alerts').innerHTML = alertasPago.map(f=>{
    const dias = Math.floor((new Date(f.fecha_pago_programado+'T12:00:00')-hoy)/(1000*60*60*24));
    const vencido = dias < 0;
    return `<div class="alert ${vencido?'red':'yel'}" onclick="abrirPago(${f.numero_factura},'${f.cliente_nombre}',${f.saldo_pendiente||0},'${f.moneda}','${f.estado}')">
      <div class="adot ${vencido?'r':'y'}"></div>
      <div class="atext">
        <div class="atitle ${vencido?'r':'y'}">${f.cliente_nombre} · #${f.numero_factura} — pago ${vencido?'VENCIDO':'programado'} ${fd(f.fecha_pago_programado)}</div>
        <div class="asub" style="color:#00A98D">Saldo: ${fm(f.saldo_pendiente||0)} ${f.moneda} · ${vencido?Math.abs(dias)+' días vencido':dias===0?'HOY':dias+' días'}</div>
      </div>
      <div class="ameta ${vencido?'r':'y'}">${vencido?'-'+Math.abs(dias)+'d':dias+'d'}</div>
    </div>`;
  }).join('');
}

function renderDZ() {
  const q=$('dz-q').value.toLowerCase(), f=F.dz;
  let data = FACT_DATA.filter(r=>{
    if(f==='2026'&&r.año!==2026) return false;
    if(f==='2025'&&r.año!==2025) return false;
    if(f==='2024'&&r.año!==2024) return false;
    if(f==='pendiente'&&!['Abono','Pendiente'].includes(r.estado)) return false;
    if(q&&!r.cliente_nombre.toLowerCase().includes(q)&&!(r.programa_servicio||'').toLowerCase().includes(q)) return false;
    return true;
  });
  const sp = r => r.estado==='Pagada'?`<span class="pill pg"><span class="dot"></span>Pagada</span>`:
    r.estado==='Abono'?`<span class="pill pw"><span class="dot"></span>Abono</span>`:
    r.estado==='Pendiente'?`<span class="pill pd"><span class="dot"></span>Pendiente</span>`:
    r.estado==='Anulada'?`<span class="pill ph"><span class="dot"></span>Anulada</span>`:
    r.estado==='Castigo'?`<span class="pill pd" style="background:rgba(127,140,141,0.1);color:var(--h);border-color:var(--h)"><span class="dot"></span>Castigo</span>`:
    `<span class="pill ph"><span class="dot"></span>${r.estado}</span>`;
  if(!data.length){
    $('dz-body').innerHTML=`<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:20px">Sin resultados</td></tr>`;
    $('dz-cards').innerHTML=''; return;
  }
  $('dz-body').innerHTML = data.map(r=>{
    const saldo = r.saldo_pendiente != null ? r.saldo_pendiente : (r.valor_factura || r.valor || 0);
    const valorFactura = r.valor_factura || r.valor || 0;
    const abonado = r.total_pagado || 0;
    const fechaFact = new Date(r.fecha_factura+'T12:00:00');
    const esPendiente = !['Pagada','Anulada','Castigo'].includes(r.estado);
    const diasCartera = esPendiente ? Math.floor((new Date()-fechaFact)/(1000*60*60*24)) : null;
    const diasColor = diasCartera>90?'var(--or)':diasCartera>60?'var(--w)':'var(--t2)';
    // Fecha pago programado
    const fprog = r.fecha_pago_programado;
    const diasAlPago = fprog ? Math.floor((new Date(fprog+'T12:00:00')-new Date())/(1000*60*60*24)) : null;
    const alertaPago = diasAlPago!=null && diasAlPago<=3 && diasAlPago>=0 && esPendiente;
    const pagoPasado = diasAlPago!=null && diasAlPago<0 && esPendiente;
    return `<tr style="${alertaPago?'background:rgba(240,165,0,0.05)':pagoPasado?'background:rgba(255,122,0,0.05)':''}">
    <td><span class="mn" style="color:var(--t2)">#${r.numero_factura}</span></td>
    <td><span style="font-size:11.5px;font-weight:500;color:#00A98D;cursor:pointer;text-decoration:underline dotted" onclick="abrirHistorialCliente('${r.cliente_nombre.replace(/'/g,"\\'")}')">${r.cliente_nombre}</span></td>
    <td><span style="font-size:10px;color:var(--t2)">${r.programa_servicio||'—'}</span></td>
    <td><span class="pill pb" style="font-size:8px">${r.moneda}</span></td>
    <td><span class="mn">${fm(valorFactura)}</span></td>
    <td><span class="mn" style="color:#00D5B0">${abonado>0?fm(abonado):'—'}</span></td>
    <td><span class="mn" style="color:${saldo>0?'var(--w)':'#00D5B0'};font-weight:700">${fm(saldo)}</span></td>
    <td><span style="font-size:10px;color:${diasColor}">${diasCartera!=null?diasCartera+'d':'—'}</span></td>
    <td><span style="font-size:10px;color:var(--t2)">${fd(r.fecha_factura)}</span></td>
    <td>
      ${esPendiente ? `<div style="display:flex;align-items:center;gap:4px">
        ${fprog ? `<span style="font-size:10px;color:${alertaPago?'var(--w)':pagoPasado?'var(--or)':'var(--t2)'};font-weight:${alertaPago||pagoPasado?'700':'400'}">${alertaPago?'⚠ ':''}${pagoPasado?'[!] ':''}${fd(fprog)}</span>` : ''}
        <button onclick="programarPago(${r.numero_factura},'${r.cliente_nombre}','${fprog||''}')" style="background:var(--sf2);border:1px solid var(--br);color:var(--t3);border-radius:4px;padding:2px 6px;font-size:8.5px;cursor:pointer">${fprog?'✎':'+ fecha'}</button>
      </div>` : '<span style="font-size:9px;color:var(--t3)">—</span>'}
    </td>
    <td>${sp(r)}</td>
    <td><span style="font-size:9.5px;color:var(--t3)">${r.cuenta_recaudo||'—'}</span></td>
    <td>${esPendiente?`<button onclick="abrirPago(${r.numero_factura},'${r.cliente_nombre}',${saldo},'${r.moneda}','${r.estado}')" style="background:rgba(0,169,141,0.15);border:1px solid var(--ac);color:var(--ac);border-radius:5px;padding:3px 8px;font-size:9px;cursor:pointer;white-space:nowrap">+ Pago</button>`:'<span style="font-size:9px;color:var(--t3)">—</span>'}</td>
  </tr>`;}).join('');
  $('dz-cards').innerHTML = data.map(r=>{
    const saldo = r.saldo_pendiente != null ? r.saldo_pendiente : (r.valor_factura || r.valor || 0);
    const valorFactura = r.valor_factura || r.valor || 0;
    const diasCartera = r.estado!=='Pagada' ? Math.floor((new Date()-new Date(r.fecha_factura+'T12:00:00'))/(1000*60*60*24)) : null;
    const diasColor = diasCartera>90?'var(--or)':diasCartera>60?'var(--w)':'var(--t2)';
    return `<div class="mcard">
    <div class="mcard-hdr"><div><div class="mcard-title">${r.cliente_nombre}</div><div class="iid" style="color:#00A98D">#${r.numero_factura} · ${fd(r.fecha_factura)}</div></div>${sp(r)}</div>
    <div class="mcard-grid">
      <div class="mg-item"><div class="mgk">Valor factura</div><div class="mgv">${fm(valorFactura)}</div></div>
      <div class="mg-item"><div class="mgk">Saldo pendiente</div><div class="mgv" style="color:${saldo>0?'var(--w)':'#00D5B0'};font-weight:700">${fm(saldo)}</div></div>
      <div class="mg-item"><div class="mgk">Moneda</div><div class="mgv">${r.moneda}</div></div>
      <div class="mg-item"><div class="mgk">Dias cartera</div><div class="mgv" style="color:${diasColor}">${diasCartera!=null?diasCartera+'d':'—'}</div></div>
      <div class="mg-item" style="grid-column:span 2"><div class="mgk">Programa</div><div class="mgv" style="font-size:11px">${r.programa_servicio||'—'}</div></div>
    </div>
    ${r.estado!=='Pagada'&&r.estado!=='Anulada'&&r.estado!=='Castigo'?`<button onclick="abrirPago(${r.numero_factura},'${r.cliente_nombre}',${saldo},'${r.moneda}','${r.estado}')" style="width:100%;margin-top:10px;background:rgba(0,169,141,0.15);border:1px solid var(--ac);color:var(--ac);border-radius:7px;padding:8px;font-size:12px;cursor:pointer">+ Registrar pago</button>`:''}
    </div>`;}).join('');
}

// ── KII ───────────────────────────────────────────────────────
