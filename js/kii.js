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

