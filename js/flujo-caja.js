function fcAutoCategoria(desc) {
  const d = (desc||'').toUpperCase();
  for(const r of FC_RULES) {
    for(const k of r.k) { if(d.includes(k.toUpperCase())) return r.cat; }
  }
  return '';
}

function parseBofAPDF(text) {
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const rows = [];
  let anio=2025, mes=1;
  const pm = text.match(/for\s+(\w+\s+\d+,\s+\d{4})\s+to/i);
  if(pm){ const d=new Date(pm[1]); if(!isNaN(d)){anio=d.getFullYear();mes=d.getMonth()+1;} }
  const pStr = pm ? pm[1] : '';

  let inSection=false;
  let cDate=null, cDesc=[], cAmt=null;

  function flush() {
    if(cDate&&cDesc.length&&cAmt!==null){
      const desc=cDesc.join(' ').replace(/\s+/g,' ').trim();
      const amt=parseFloat(cAmt.replace(/,/g,''));
      if(!isNaN(amt)&&Math.abs(amt)>0.001){
        rows.push({fecha:cDate,concepto:desc.substring(0,120),ingreso:amt>0?amt:0,egreso:amt<0?Math.abs(amt):0,categoria:fcAutoCategoria(desc),moneda:'USD'});
      }
    }
    cDate=null;cDesc=[];cAmt=null;
  }

  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/Daily ledger balances/i.test(line)){flush();break;}
    if(/Deposits and other credits|Withdrawals and other debits/i.test(line)){flush();inSection=true;continue;}
    if(!inSection)continue;
    const dm=line.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(.*)/);
    if(dm){
      flush();
      const [,mm,dd,yy,rest]=dm;
      cDate=`${2000+parseInt(yy)}-${mm}-${dd}`;
      const am=rest.match(/^(.*?)\s+(-?[\d,]+\.\d{2})$/);
      if(am){cDesc=[am[1].trim()];cAmt=am[2];flush();}
      else{
        cDesc=[rest];
        for(let j=i+1;j<Math.min(i+5,lines.length);j++){
          const nl=lines[j];
          if(/^\d{2}\/\d{2}\/\d{2}\s/.test(nl))break;
          const na=nl.match(/^(-?[\d,]+\.\d{2})$/);
          if(na){cAmt=na[1];for(let k=i+1;k<j;k++){if(!/^\d{2}\//.test(lines[k])&&!/^-?[\d,]+\.\d{2}$/.test(lines[k]))cDesc.push(lines[k]);}i=j;flush();break;}
          else if(!/continued on/i.test(nl)&&!/^Page \d+/i.test(nl))cDesc.push(nl);
        }
      }
    }
  }
  flush();
  return {rows, anio, mes, periodoStr:pStr};
}

async function fcLoadAux(empresa) {
  if(!FC_CUENTAS[empresa].length){
    const {data}=await db.from('cont_cuentas').select('*').eq('activa',true).eq('empresa_id',empresa).order('nombre');
    if(data) FC_CUENTAS[empresa]=data;
  }
  if(!FC_CATS[empresa] || !FC_CATS[empresa].length){
    const {data}=await db.from('fc_categorias').select('*').eq('empresa_id',empresa).eq('activa',true).order('orden');
    if(data) FC_CATS[empresa]=data;
  }
}

async function loadCont(empresa) {
  if(USER_ROL !== 'admin') { toast('El flujo de caja es solo para el administrador','d'); return; }
  await fcLoadAux(empresa);
  const isTy=empresa==='tycoon';
  const bodyId=isTy?'cont-body':'contdiaz-body';
  const anioEl=isTy?$('cont-año'):$('contdiaz-año');
  const anio=parseInt(anioEl?.value||'0');
  const ac=isTy?'#5B8DB8':'#00D5B0';
  const body=$(bodyId);
  if(!body)return;
  body.innerHTML='<div style="text-align:center;color:var(--t3);padding:60px">Cargando...</div>';

  // SINGLE QUERY: all filters in SQL, no JS filtering needed for cuenta/year
  const filt=FC_FILT[empresa];
  let q=db.from('transacciones').select('*').eq('empresa_id',empresa);
  if(anio>0) q=q.gte('fecha', anio+'-01-01').lte('fecha', anio+'-12-31');
  if(filt.cuenta) q=q.eq('cuenta_id',filt.cuenta);
  const {data:trans,error}=await q.order('fecha',{ascending:false});
  if(error) console.error('loadCont:', error);

  if(isTy) CONT_LOADED=true; else CONTDIAZ_LOADED=true;
  fcRenderDashboard(empresa, trans||[], anio, ac, body);
}

function fcRenderDashboard(empresa, trans, anio, ac, body) {
  const cuentas=FC_CUENTAS[empresa];
  const filt=FC_FILT[empresa];
  const CLR_ING='#2ecc71',CLR_EG='#f39c12',CLR_NEG='#e74c3c';
  let rows=trans.filter(t=>{
    // Month filter: derive from fecha (source of truth)
    if(filt.mes){
      const mesNum = parseInt(filt.mes)||0;
      if(mesNum > 0 && t.fecha){
        if(new Date(t.fecha+'T12:00:00').getMonth()+1 !== mesNum) return false;
      }
    }
    if(filt.tipo==='ingreso'&&!(t.ingreso>0))return false;
    if(filt.tipo==='egreso'&&!(t.egreso>0))return false;
    return true;
  });
  const ing=rows.reduce((a,t)=>a+(t.ingreso||0),0);
  const eg=rows.reduce((a,t)=>a+(t.egreso||0),0);
  const net=ing-eg, mrg=ing>0?(net/ing*100):0;
  // P&L by month: always derive from fecha
  const byMes={};
  rows.forEach(t=>{
    if(!t.fecha) return;
    const d=new Date(t.fecha+'T12:00:00');
    const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    if(!byMes[k])byMes[k]={k,ing:0,eg:0};
    byMes[k].ing+=t.ingreso||0; byMes[k].eg+=t.egreso||0;
  });
  const mesArr=Object.values(byMes).sort((a,b)=>a.k.localeCompare(b.k));
  const byCat={};
  rows.filter(t=>t.egreso>0).forEach(t=>{const c=t.categoria_nombre||'Sin categoría';byCat[c]=(byCat[c]||0)+t.egreso;});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxCat=topCats[0]?.[1]||1;
  // Comparativo anual: from ALL trans (unfiltered by month)
  const byYear={};
  trans.forEach(t=>{
    if(!t.fecha) return;
    const y=new Date(t.fecha+'T12:00:00').getFullYear();
    if(!byYear[y])byYear[y]={ing:0,eg:0};
    byYear[y].ing+=t.ingreso||0; byYear[y].eg+=t.egreso||0;
  });
  const CW=480,CH=68,maxV=Math.max(...mesArr.map(m=>Math.max(m.ing,m.eg)),1);
  const bW=mesArr.length>0?Math.max(3,Math.floor((CW-20)/mesArr.length/2)-2):8;
  const gW=mesArr.length>0?Math.floor((CW-20)/mesArr.length):20;
  let bars='';
  mesArr.forEach((m,i)=>{const x=10+i*gW,hI=(m.ing/maxV)*(CH-6),hE=(m.eg/maxV)*(CH-6);bars+=`<rect x="${x}" y="${CH-hI}" width="${bW}" height="${hI}" fill="${CLR_ING}" opacity="0.8" rx="1"/><rect x="${x+bW+1}" y="${CH-hE}" width="${bW}" height="${hE}" fill="rgba(243,156,18,0.8)" rx="1"/>`;});
  const gPct=Math.min(Math.max(mrg,-100),100),gColor=gPct>=0?(gPct>20?'#2ecc71':'#f39c12'):'#e74c3c';
  const gAngle=(gPct/100)*180,gRad=(gAngle-90)*Math.PI/180,gx=60+50*Math.cos(gRad),gy=60+50*Math.sin(gRad);
  const lArc=Math.abs(gAngle)>180?1:0,swp=gAngle>=0?1:0;
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesOpts=MESES.map((m,i)=>`<option value="${i+1}" ${parseInt(filt.mes)===(i+1)?'selected':''}>${m}</option>`).join('');

  body.innerHTML=`
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
    <span onclick="fcFilt('${empresa}','cuenta',null)" style="cursor:pointer;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:${!filt.cuenta?ac:'var(--sf2)'};color:${!filt.cuenta?'#fff':'var(--t2)'};border:1px solid ${!filt.cuenta?ac:'var(--br)'}">Todas</span>
    ${cuentas.map(c=>{const isA=filt.cuenta===c.id;const icon=c.tipo==='banco'?'🏦':c.tipo==='zelle'?'⚡':c.tipo==='paypal'?'🅿':c.tipo==='crypto'?'₿':'💵';return `<span onclick="fcFilt('${empresa}','cuenta','${c.id}')" style="cursor:pointer;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:${isA?ac:'var(--sf2)'};color:${isA?'#fff':'var(--t)'};border:1px solid ${isA?ac:'var(--br)'};">${icon} ${c.nombre}</span>`;}).join('')}
    <span onclick="abrirNuevaCuenta('${empresa}')" style="cursor:pointer;padding:6px 12px;border-radius:8px;font-size:11px;color:var(--t3);border:1px dashed var(--br)">+ Cuenta</span>
    <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
      <select onchange="fcFilt('${empresa}','mes',this.value)" style="background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:5px 8px;font-size:10px;color:var(--t);outline:none"><option value="">Todos los meses</option>${mesOpts}</select>
      <span onclick="fcFilt('${empresa}','tipo',null)" style="cursor:pointer;padding:5px 9px;border-radius:7px;font-size:10px;background:${!filt.tipo?'var(--ad)':'var(--sf2)'};color:${!filt.tipo?ac:'var(--t2)'};border:1px solid ${!filt.tipo?ac:'var(--br)'}">Todos</span>
      <span onclick="fcFilt('${empresa}','tipo','ingreso')" style="cursor:pointer;padding:5px 9px;border-radius:7px;font-size:10px;background:${filt.tipo==='ingreso'?'rgba(46,204,113,0.1)':'var(--sf2)'};color:${filt.tipo==='ingreso'?CLR_ING:'var(--t2)'};border:1px solid ${filt.tipo==='ingreso'?CLR_ING:'var(--br)'}">↑ Ing</span>
      <span onclick="fcFilt('${empresa}','tipo','egreso')" style="cursor:pointer;padding:5px 9px;border-radius:7px;font-size:10px;background:${filt.tipo==='egreso'?'rgba(243,156,18,0.1)':'var(--sf2)'};color:${filt.tipo==='egreso'?CLR_EG:'var(--t2)'};border:1px solid ${filt.tipo==='egreso'?CLR_EG:'var(--br)'}">↓ Eg</span>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px;border-top:3px solid ${CLR_ING}"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Ingresos ${anio||'Total'}</div><div style="font-size:20px;font-weight:700;color:${CLR_ING};font-family:'Syne',sans-serif">${fm(ing)}</div><div style="font-size:10px;color:var(--t3);margin-top:3px">${rows.filter(t=>t.ingreso>0).length} movimientos</div></div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px;border-top:3px solid ${CLR_EG}"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Egresos ${anio||'Total'}</div><div style="font-size:20px;font-weight:700;color:${CLR_EG};font-family:'Syne',sans-serif">${fm(eg)}</div><div style="font-size:10px;color:var(--t3);margin-top:3px">${rows.filter(t=>t.egreso>0).length} movimientos</div></div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px;border-top:3px solid ${net>=0?CLR_ING:CLR_NEG}"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Resultado neto</div><div style="font-size:20px;font-weight:700;color:${net>=0?CLR_ING:CLR_NEG};font-family:'Syne',sans-serif">${fm(net)}</div><div style="font-size:10px;color:var(--t3);margin-top:3px">${mrg.toFixed(1)}% margen</div></div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px;border-top:3px solid var(--t3)"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Movimientos</div><div style="font-size:20px;font-weight:700;color:var(--t);font-family:'Syne',sans-serif">${rows.length}</div><div style="font-size:10px;color:var(--t3);margin-top:3px">${anio||'Histórico'} · Cash basis</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 185px;gap:12px;margin-bottom:16px">
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase">P&L por mes</div>
        <div style="display:flex;gap:10px;font-size:9px;color:var(--t3)"><span><span style="display:inline-block;width:8px;height:8px;background:${CLR_ING};border-radius:1px;margin-right:3px"></span>Ing</span><span><span style="display:inline-block;width:8px;height:8px;background:rgba(243,156,18,0.8);border-radius:1px;margin-right:3px"></span>Eg</span></div>
      </div>
      <svg viewBox="0 0 ${CW} ${CH}" style="width:100%;height:68px">${bars}</svg>
      ${mesArr.length===0?'<div style="text-align:center;color:var(--t3);font-size:11px;padding:8px">Sin datos · usa 📤 Importar extracto</div>':''}
    </div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px;text-align:center">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Margen neto</div>
      <svg viewBox="0 0 120 70" style="width:100%;max-width:120px"><path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="var(--br)" stroke-width="10" stroke-linecap="round"/>${gPct!==0?`<path d="M60,60 A50,50 0 ${lArc},${swp} ${gx},${gy}" fill="none" stroke="${gColor}" stroke-width="10" stroke-linecap="round"/>`:''}
      <text x="60" y="55" text-anchor="middle" font-size="16" font-weight="700" fill="${gColor}" font-family="sans-serif">${mrg.toFixed(1)}%</text></svg>
      <div style="font-size:9px;color:var(--t3);margin-top:4px">${mrg>=20?'✅ Saludable':mrg>=0?'⚠ Ajustado':'❌ Negativo'}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Top categorías</div>
      ${topCats.length===0?'<div style="color:var(--t3);font-size:11px;text-align:center;padding:16px">Sin egresos aún</div>':topCats.map(([cat,val])=>{const p=(val/maxCat*100).toFixed(0);return `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><div style="font-size:10px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:68%">${cat}</div><div style="font-size:10px;font-family:"DM Mono",monospace;color:${CLR_EG};font-weight:600">${fm(val)}</div></div><div style="height:4px;background:var(--br);border-radius:2px"><div style="height:4px;width:${p}%;background:rgba(243,156,18,0.75);border-radius:2px"></div></div></div>`;}).join('')}
    </div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Comparativo anual</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse"><thead><tr><th style="text-align:left;color:var(--t3);font-weight:500;padding:3px 0;font-size:9px">Año</th><th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Ing</th><th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Eg</th><th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Neto</th></tr></thead><tbody>
        ${Object.entries(byYear).sort((a,b)=>b[0]-a[0]).map(([y,v])=>{const r=v.ing-v.eg;return `<tr style="border-top:1px solid var(--br)"><td style="padding:5px 0;font-weight:600">${y}</td><td style="padding:5px 0;text-align:right;color:${CLR_ING};font-family:"DM Mono",monospace;font-size:10px">${fm(v.ing)}</td><td style="padding:5px 0;text-align:right;color:${CLR_EG};font-family:"DM Mono",monospace;font-size:10px">${fm(v.eg)}</td><td style="padding:5px 0;text-align:right;color:${r>=0?CLR_ING:CLR_NEG};font-family:"DM Mono",monospace;font-weight:700;font-size:10px">${fm(r)}</td></tr>`;}).join('')}
      </tbody></table>
    </div>
  </div>
  <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase">Movimientos${filt.cuenta?' · '+(cuentas.find(c=>c.id===filt.cuenta)?.nombre||''):''}</div>
      <div style="display:flex;gap:10px;align-items:center">
        <span style="color:${CLR_ING};font-family:"DM Mono",monospace;font-weight:600;font-size:11px">${fm(ing)}</span>
        <span style="color:${CLR_EG};font-family:"DM Mono",monospace;font-weight:600;font-size:11px">${fm(eg)}</span>
        <span style="color:var(--t3);font-size:10px">${rows.length} reg</span>
        <input id="fc-srch-${empresa}" oninput="fcSearch('${empresa}')" placeholder="🔍" class="srch" style="width:110px;padding:4px 8px;font-size:10px">
      </div>
    </div>
    <div class="tw-scroll">
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px;white-space:nowrap">Fecha</th>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Concepto</th>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Cuenta</th>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Categoría</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Original</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Ingreso USD</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Egreso USD</th>
        <th style="padding:5px 4px;font-size:9px"></th>
      </tr></thead>
      <tbody id="fctb-${empresa}">
        ${fcBuildRows(rows,cuentas,empresa,CLR_ING,CLR_EG)}
      </tbody>
    </table></div>
  </div>`;
}

function fcBuildRows(rows,cuentas,empresa,CLR_ING,CLR_EG){
  if(!rows.length) return `<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:30px;font-size:12px">Sin movimientos · usa <b>📤 Importar extracto</b></td></tr>`;
  return rows.slice(0,80).map(t=>{
    const cta=cuentas.find(c=>c.id===t.cuenta_id);
    // Reconstruir el monto original a partir de USD + tasa_cambio + moneda
    const moneda = (t.moneda||'USD').toUpperCase();
    const tasa = parseFloat(t.tasa_cambio)||1;
    let original = '—';
    if(moneda !== 'USD' && tasa !== 1){
      const ing = t.ingreso||0, eg = t.egreso||0;
      let origIng=0, origEg=0;
      if(moneda==='COP'){ origIng = ing*tasa; origEg = eg*tasa; }
      else if(moneda==='EUR'){ origIng = ing/tasa; origEg = eg/tasa; }
      const monto = origIng>0?origIng:origEg;
      const cur = origIng>0?CLR_ING:CLR_EG;
      const fmtOrig = moneda==='COP'
        ? '$'+Math.round(monto).toLocaleString('es-CO')
        : '€'+monto.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      original = '<span style="color:'+cur+';font-weight:500">'+fmtOrig+'</span><div style="font-size:8px;color:var(--t3);font-family:monospace">'+moneda+' · TRM '+tasa.toLocaleString('es-CO')+'</div>';
    }
    return `<tr style="border-top:1px solid var(--br)" class="fc-tr">
      <td style="padding:5px 8px;color:var(--t3);font-family:"DM Mono",monospace;white-space:nowrap;font-size:10px">${fd(t.fecha)}</td>
      <td style="padding:5px 8px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${(t.concepto||'').replace(/"/g,'&quot;')}">${t.concepto||'—'}</td>
      <td style="padding:5px 8px;font-size:10px;color:var(--t2);white-space:nowrap">${cta?cta.nombre:'—'}</td>
      <td style="padding:5px 8px">
        <select onchange="fcCambiarCat(event,'${t.id}')" style="background:var(--ad);color:var(--ac);font-size:9px;padding:1px 4px;border-radius:4px;border:1px solid var(--br);font-family:"DM Mono",monospace;outline:none;max-width:140px">
          <option value="">— sin cat —</option>
          ${(FC_CATS[empresa]||[]).map(c=>`<option value="${c.nombre}" ${t.categoria_nombre===c.nombre?'selected':''}>${c.nombre}</option>`).join('')}
        </select>
      </td>
      <td style="padding:5px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:10px;white-space:nowrap">${original}</td>
      <td style="padding:5px 8px;text-align:right;font-family:"DM Mono",monospace;color:${CLR_ING};font-weight:${(t.ingreso||0)>0?600:400};font-size:10px">${(t.ingreso||0)>0?fm(t.ingreso):'—'}</td>
      <td style="padding:5px 8px;text-align:right;font-family:"DM Mono",monospace;color:${CLR_EG};font-weight:${(t.egreso||0)>0?600:400};font-size:10px">${(t.egreso||0)>0?fm(t.egreso):'—'}</td>
      <td style="padding:5px 4px;white-space:nowrap">
        <span onclick="fcEliminar('${t.id}','${empresa}')" style="cursor:pointer;color:var(--d);font-size:11px;padding:2px 4px;opacity:0.6" title="Eliminar">✕</span>
      </td>
    </tr>`;
  }).join('');
}

function fcFilt(empresa,tipo,valor){
  if(tipo==='cuenta') FC_FILT[empresa].cuenta=valor;
  else if(tipo==='mes') FC_FILT[empresa].mes=valor?parseInt(valor):null;
  else if(tipo==='tipo') FC_FILT[empresa].tipo=valor;
  CONT_LOADED=false;CONTDIAZ_LOADED=false;loadCont(empresa);
}
// ── CATEGORÍAS FLUJO DE CAJA (CRUD por empresa) ────────
async function fcAsignarCuenta(empresa, cuentaId) {
  if(!confirm('¿Asignar esta cuenta bancaria a todas las transacciones sin cuenta?')) return;
  const {error, count} = await db.from('transacciones')
    .update({cuenta_id: cuentaId})
    .eq('empresa_id', empresa)
    .is('cuenta_id', null);
  if(error) { toast('Error: '+error.message, 'd'); return; }
  toast('✓ Transacciones actualizadas', 'ok');
  CONT_LOADED=false; CONTDIAZ_LOADED=false; loadCont(empresa);
}

async function abrirCategorias(empresa) {
  await fcLoadAux(empresa);
  const ac = empresa==='tycoon' ? '#D22630' : '#00A98D';
  const empNom = empresa==='tycoon' ? 'Tycoon' : 'Díaz';
  // Reload from DB to get latest
  const {data} = await db.from('fc_categorias').select('*').eq('empresa_id', empresa).order('orden');
  if(data) FC_CATS[empresa] = data;
  const cats = FC_CATS[empresa] || [];

  $('m-t').textContent = 'Categorías — ' + empNom;
  $('m-s').textContent = cats.length + ' categorías activas';
  $('m-b').innerHTML = '<div style="padding:12px;max-height:65vh;overflow-y:auto" id="cats-body">'
    + '<div style="display:flex;gap:8px;margin-bottom:14px">'
    + '<input id="cat-new-nombre" type="text" placeholder="Nueva categoría..." style="flex:1;padding:8px 12px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem">'
    + '<select id="cat-new-tipo" style="padding:8px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.82rem">'
    + '<option value="gasto">Gasto</option><option value="ingreso">Ingreso</option><option value="costo">Costo</option><option value="otro">Otro</option></select>'
    + '<button class="btn-g" onclick="crearCategoria(\'' + empresa + '\')" style="white-space:nowrap">+ Agregar</button></div>'
    + '<table style="width:100%;font-size:12px;border-collapse:collapse">'
    + '<thead><tr style="background:var(--sf2)">'
    + '<th style="text-align:left;padding:8px;font-size:10px;color:var(--t3);border-bottom:1px solid var(--br)">Categoría</th>'
    + '<th style="text-align:center;padding:8px;font-size:10px;color:var(--t3);border-bottom:1px solid var(--br);width:80px">Tipo</th>'
    + '<th style="text-align:center;padding:8px;font-size:10px;color:var(--t3);border-bottom:1px solid var(--br);width:60px">Orden</th>'
    + '<th style="text-align:center;padding:8px;font-size:10px;color:var(--t3);border-bottom:1px solid var(--br);width:90px">Acciones</th>'
    + '</tr></thead><tbody>'
    + cats.map(c => {
      const tipoBg = c.tipo==='ingreso' ? 'rgba(46,204,113,.1)' : c.tipo==='gasto' ? 'rgba(243,156,18,.1)' : 'rgba(150,150,150,.1)';
      const tipoCol = c.tipo==='ingreso' ? '#2ecc71' : c.tipo==='gasto' ? '#f39c12' : 'var(--t3)';
      return '<tr style="border-bottom:1px solid var(--br)">'
        + '<td style="padding:8px"><input type="text" value="' + (c.nombre||'').replace(/"/g,'&quot;') + '" onchange="editarCategoria(\'' + c.id + '\',\'nombre\',this.value,\'' + empresa + '\')" style="background:transparent;border:none;color:var(--t1);font-size:12px;width:100%;outline:none;font-weight:500"></td>'
        + '<td style="padding:8px;text-align:center"><select onchange="editarCategoria(\'' + c.id + '\',\'tipo\',this.value,\'' + empresa + '\')" style="background:' + tipoBg + ';border:1px solid ' + tipoCol + '22;border-radius:4px;padding:2px 6px;font-size:10px;color:' + tipoCol + ';outline:none">'
        + '<option value="gasto"' + (c.tipo==='gasto' ? ' selected' : '') + '>Gasto</option>'
        + '<option value="ingreso"' + (c.tipo==='ingreso' ? ' selected' : '') + '>Ingreso</option>'
        + '<option value="costo"' + (c.tipo==='costo' ? ' selected' : '') + '>Costo</option>'
        + '<option value="otro"' + (c.tipo==='otro' ? ' selected' : '') + '>Otro</option></select></td>'
        + '<td style="padding:8px;text-align:center"><input type="number" value="' + (c.orden||0) + '" onchange="editarCategoria(\'' + c.id + '\',\'orden\',parseInt(this.value),\'' + empresa + '\')" style="width:40px;background:transparent;border:1px solid var(--br);border-radius:4px;color:var(--t1);font-size:11px;text-align:center;outline:none;padding:2px"></td>'
        + '<td style="padding:8px;text-align:center"><button onclick="eliminarCategoria(\'' + c.id + '\',\'' + empresa + '\')" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:14px" title="Eliminar">✕</button></td>'
        + '</tr>';
    }).join('')
    + '</tbody></table>'
    + (cats.length===0 ? '<div style="text-align:center;color:var(--t3);padding:20px;font-size:12px">Sin categorías — agrega la primera arriba</div>' : '')
    + '</div>';

  const ov = $('ov'); ov.classList.add('on'); ov.setAttribute('data-lock','1');
}

async function crearCategoria(empresa) {
  const nombre = $('cat-new-nombre')?.value?.trim();
  const tipo = $('cat-new-tipo')?.value || 'gasto';
  if(!nombre) { toast('Escribe un nombre para la categoría','d'); return; }
  const maxOrden = (FC_CATS[empresa]||[]).reduce((a,c) => Math.max(a, c.orden||0), 0);
  const {error} = await db.from('fc_categorias').insert({empresa_id: empresa, nombre, tipo, orden: maxOrden + 1});
  if(error) { toast('Error: ' + (error.message.includes('duplicate') ? 'Ya existe esa categoría' : error.message), 'd'); return; }
  toast('Categoría creada ✓', 'ok');
  FC_CATS[empresa] = []; // Force reload
  abrirCategorias(empresa);
}

async function editarCategoria(id, campo, valor, empresa) {
  const update = {}; update[campo] = valor;
  const {error} = await db.from('fc_categorias').update(update).eq('id', id);
  if(error) toast('Error: ' + error.message, 'd');
  FC_CATS[empresa] = []; // Force reload on next use
}

async function eliminarCategoria(id, empresa) {
  if(!confirm('¿Eliminar esta categoría?')) return;
  const {error} = await db.from('fc_categorias').delete().eq('id', id);
  if(error) { toast('Error: ' + error.message, 'd'); return; }
  toast('Categoría eliminada', 'ok');
  FC_CATS[empresa] = [];
  abrirCategorias(empresa);
}

function fcSearch(empresa){
  const q=($('fc-srch-'+empresa)?.value||'').toLowerCase();
  document.querySelectorAll(`#fctb-${empresa} tr.fc-tr`).forEach(tr=>{tr.style.display=(!q||tr.textContent.toLowerCase().includes(q))?'':'none';});
}
async function fcCambiarCat(ev,id){
  const val=ev.target.value,parts=val?val.split('|'):[null,null];
  await db.from('transacciones').update({categoria_codigo:parts[0]||null,categoria_nombre:parts[1]||null}).eq('id',id);
}
async function fcEliminar(id,empresa){
  if(!confirm('¿Eliminar este movimiento?'))return;
  await db.from('transacciones').delete().eq('id',id);
  toast('Eliminado','ok');CONT_LOADED=false;CONTDIAZ_LOADED=false;loadCont(empresa);
}

// ── NUEVO MOVIMIENTO MANUAL ───────────────────────────────────
async function abrirNuevoMovimiento(empresa){
  if(USER_ROL!=='admin'){toast('Solo el admin puede registrar movimientos','d');return;}
  await fcLoadAux(empresa);
  const cuentas=FC_CUENTAS[empresa],cats=FC_CATS[empresa]||[],ac=empresa==='tycoon'?'#5B8DB8':'#00A98D';
  const hoy=new Date().toISOString().split('T')[0];
  $('m-t').textContent='Nuevo movimiento';
  $('m-s').textContent=empresa==='tycoon'?'Tycoon Guru Connections LLC':'Díaz International LLC';
  $('m-b').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Fecha *</div>
        <input id="nm-fecha" type="date" value="${hoy}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Cuenta *</div>
        <select id="nm-cuenta" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
          <option value="">— Seleccionar —</option>
          ${cuentas.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('')}
        </select></div>
    </div>
    <div style="margin-bottom:10px"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Concepto *</div>
      <input id="nm-concepto" type="text" placeholder="Descripción..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none" oninput="nmSugCat(this.value)"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Categoría</div>
        <select id="nm-cat" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
          <option value="">— Sin categoría —</option>
          <optgroup label="INGRESOS">${cats.filter(c=>c.tipo==='ingreso').map(c=>`<option value="|${c.nombre}">${c.nombre}</option>`).join('')}</optgroup>
          <optgroup label="GASTOS">${cats.filter(c=>c.tipo==='gasto'||c.tipo==='costo').map(c=>`<option value="|${c.nombre}">${c.nombre}</option>`).join('')}</optgroup>
          <optgroup label="OTROS">${cats.filter(c=>c.tipo==='otro').map(c=>`<option value="|${c.nombre}">${c.nombre}</option>`).join('')}</optgroup>
        </select></div>
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Moneda</div>
        <select id="nm-moneda" onchange="nmToggleTasa()" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
          <option value="USD">USD</option><option value="EUR">EUR</option><option value="COP">COP</option>
        </select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Ingreso</div>
        <input id="nm-ingreso" type="number" step="0.01" min="0" placeholder="0.00" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none" oninput="if(this.value>0)document.getElementById('nm-egreso').value=''"></div>
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Egreso</div>
        <input id="nm-egreso" type="number" step="0.01" min="0" placeholder="0.00" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none" oninput="if(this.value>0)document.getElementById('nm-ingreso').value=''"></div>
      <div id="nm-tasa-wrap" style="display:none"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">TRM</div>
        <input id="nm-tasa" type="number" step="0.01" placeholder="4200" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>
    </div>
    <div style="margin-bottom:14px"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Notas</div>
      <input id="nm-notas" type="text" placeholder="Opcional..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>
    <button onclick="nmGuardar('${empresa}')" style="width:100%;background:${ac};color:#fff;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">Guardar movimiento</button>
    <div id="nm-err" style="font-size:11px;color:var(--d);min-height:14px;margin-top:6px;text-align:center"></div>`;
  $('ov').classList.add('on');
}
function nmSugCat(val){const cat=fcAutoCategoria(val);if(!cat)return;const sel=document.getElementById('nm-cat');if(!sel)return;for(const opt of sel.options){if(opt.text===cat){sel.value=opt.value;break;}}}
function nmToggleTasa(){const m=document.getElementById('nm-moneda')?.value;const w=document.getElementById('nm-tasa-wrap');if(w)w.style.display=(m==='EUR'||m==='COP')?'block':'none';}
async function nmGuardar(empresa){
  const fecha=document.getElementById('nm-fecha')?.value,cuentaId=document.getElementById('nm-cuenta')?.value,concepto=document.getElementById('nm-concepto')?.value?.trim();
  const catVal=document.getElementById('nm-cat')?.value,moneda=document.getElementById('nm-moneda')?.value||'USD';
  const ingreso=parseFloat(document.getElementById('nm-ingreso')?.value)||0,egreso=parseFloat(document.getElementById('nm-egreso')?.value)||0;
  const tasa=parseFloat(document.getElementById('nm-tasa')?.value)||1,notas=document.getElementById('nm-notas')?.value?.trim()||null;
  if(!fecha){document.getElementById('nm-err').textContent='Fecha obligatoria';return;}
  if(!cuentaId){document.getElementById('nm-err').textContent='Selecciona cuenta';return;}
  if(!concepto){document.getElementById('nm-err').textContent='Concepto obligatorio';return;}
  if(!ingreso&&!egreso){document.getElementById('nm-err').textContent='Ingresa un monto';return;}
  const parts=catVal?catVal.split('|'):[null,null];
  const fObj=new Date(fecha+'T12:00:00');
  let iUSD=ingreso,eUSD=egreso;
  if(moneda==='COP'){iUSD=ingreso/tasa;eUSD=egreso/tasa;}
  if(moneda==='EUR'){iUSD=ingreso*tasa;eUSD=egreso*tasa;}
  document.getElementById('nm-err').textContent='Guardando...';
  const {error}=await db.from('transacciones').insert({empresa_id:empresa,cuenta_id:cuentaId,fecha,concepto,categoria_codigo:parts[0]||null,categoria_nombre:parts[1]||null,moneda,tasa_cambio:moneda!=='USD'?tasa:1,ingreso:iUSD>0?Math.round(iUSD*100)/100:0,egreso:eUSD>0?Math.round(eUSD*100)/100:0,notas});
  if(error){document.getElementById('nm-err').textContent='Error: '+error.message;return;}
  toast('Movimiento guardado ✓','ok');closeM();CONT_LOADED=false;CONTDIAZ_LOADED=false;loadCont(empresa);
}

async function abrirNuevaCuenta(empresa){
  if(USER_ROL!=='admin'){toast('Solo el admin puede crear cuentas','d');return;}
  const ac=empresa==='tycoon'?'#5B8DB8':'#00A98D';
  $('m-t').textContent='Nueva cuenta'; $('m-s').textContent=empresa==='tycoon'?'Tycoon LLC':'Díaz Intl LLC';
  $('m-b').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Nombre *</div>
        <input id="nc-nombre" type="text" placeholder="Ej: BofA Checking" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Tipo</div>
        <select id="nc-tipo" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
          <option value="banco">Banco</option><option value="zelle">Zelle</option><option value="paypal">PayPal</option><option value="crypto">Crypto</option><option value="caja">Caja</option><option value="otro">Otro</option>
        </select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Moneda</div>
        <select id="nc-moneda" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"><option value="USD">USD</option><option value="EUR">EUR</option><option value="COP">COP</option></select></div>
      <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Número</div>
        <input id="nc-numero" type="text" placeholder="···8530" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>
    </div>
    <div style="margin-bottom:14px"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Saldo inicial</div>
      <input id="nc-saldo" type="number" step="0.01" placeholder="0.00" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>
    <button onclick="ncGuardar('${empresa}')" style="width:100%;background:${ac};color:#fff;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">Crear cuenta</button>
    <div id="nc-err" style="font-size:11px;color:var(--d);min-height:14px;margin-top:6px;text-align:center"></div>`;
  $('ov').classList.add('on');
}
async function ncGuardar(empresa){
  const nombre=document.getElementById('nc-nombre')?.value?.trim(),tipo=document.getElementById('nc-tipo')?.value,moneda=document.getElementById('nc-moneda')?.value||'USD';
  const numero=document.getElementById('nc-numero')?.value?.trim()||null,saldo=parseFloat(document.getElementById('nc-saldo')?.value)||0;
  if(!nombre){document.getElementById('nc-err').textContent='Nombre obligatorio';return;}
  const {error}=await db.from('cont_cuentas').insert({empresa_id:empresa,nombre,tipo,moneda,numero,saldo_inicial:saldo,saldo_actual:saldo});
  if(error){document.getElementById('nc-err').textContent='Error: '+error.message;return;}
  toast('Cuenta creada ✓','ok');FC_CUENTAS={tycoon:[],diaz:[]};closeM();CONT_LOADED=false;CONTDIAZ_LOADED=false;loadCont(empresa);
}

// ── IMPORTAR EXTRACTO BofA PDF ────────────────────────────────
let IMP_DATA = null;

async function abrirImportar(empresa){
  if(USER_ROL!=='admin'){toast('Solo el admin puede importar extractos','d');return;}
  await fcLoadAux(empresa);
  const cuentas=FC_CUENTAS[empresa],ac=empresa==='tycoon'?'#5B8DB8':'#00D5B0';
  const ovEl=document.getElementById('ov-import');
  document.getElementById('imp-title').textContent=`Importar extracto — ${empresa==='tycoon'?'Tycoon LLC':'Díaz Intl LLC'}`;
  IMP_DATA=null;
  document.getElementById('imp-body').innerHTML=`
    <div style="padding:4px 0 16px">
      <div style="background:var(--sf2);border:2px dashed var(--br);border-radius:12px;padding:28px;text-align:center;margin-bottom:16px;cursor:pointer" id="imp-drop" ondragover="event.preventDefault();this.style.borderColor='${ac}'" ondragleave="this.style.borderColor=''" ondrop="impDrop(event,'${empresa}')">
        <div style="font-size:28px;margin-bottom:8px">📄</div>
        <div style="font-size:14px;font-weight:600;color:var(--t);margin-bottom:4px">Arrastra el PDF del banco aquí</div>
        <div style="font-size:11px;color:var(--t3);margin-bottom:14px">BofA Business Advantage PDF · también acepta .txt</div>
        <label style="cursor:pointer;background:${ac};color:#fff;border:none;border-radius:7px;padding:8px 20px;font-size:12px;font-weight:700">
          Seleccionar archivo
          <input type="file" accept=".pdf,.txt" style="display:none" onchange="impSeleccionar(event,'${empresa}')">
        </label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:5px;text-transform:uppercase">Cuenta bancaria *</div>
          <select id="imp-cuenta" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t);font-size:12px;outline:none">
            <option value="">— Seleccionar cuenta —</option>
            ${cuentas.map(c=>`<option value="${c.id}" ${(empresa==='tycoon'&&c.numero&&c.numero.includes('8530'))||(empresa==='diaz'&&c.numero&&c.numero.includes('0415'))?'selected':''}>${c.nombre} (${c.moneda})</option>`).join('')}
          </select></div>
        <div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:5px;text-transform:uppercase">Período detectado</div>
          <input id="imp-periodo" type="text" readonly placeholder="Auto-detectado del PDF" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t3);font-size:12px;outline:none"></div>
      </div>
      <div id="imp-preview"></div>
      <div id="imp-actions" style="display:none;margin-top:16px">
        <button onclick="impConfirmar('${empresa}')" id="imp-btn-ok" style="background:${ac};color:#fff;border:none;border-radius:8px;padding:11px 28px;font-size:13px;font-weight:700;cursor:pointer;margin-right:10px">✓ Confirmar e importar</button>
        <button onclick="impLimpiar()" style="background:var(--sf2);border:1px solid var(--br);border-radius:8px;padding:11px 20px;font-size:12px;cursor:pointer;color:var(--t2)">✕ Cancelar</button>
        <span id="imp-count" style="font-size:11px;color:var(--t3);margin-left:12px"></span>
      </div>
    </div>`;
  ovEl.style.display='flex'; setTimeout(()=>{ovEl.style.opacity='1';ovEl.style.pointerEvents='all';},10);
}

function cerrarImportar(){
  const ovEl=document.getElementById('ov-import');
  if(!ovEl)return;
  ovEl.style.opacity='0';ovEl.style.pointerEvents='none';
  setTimeout(()=>{ovEl.style.display='none';},200);
  IMP_DATA=null;
}
document.addEventListener('click',e=>{const ovEl=document.getElementById('ov-import');if(ovEl&&e.target===ovEl)cerrarImportar();});

function impDrop(ev,empresa){ev.preventDefault();document.getElementById('imp-drop').style.borderColor='';const file=ev.dataTransfer.files[0];if(file)impProcesarArchivo(file,empresa);}
function impSeleccionar(ev,empresa){const file=ev.target.files[0];if(file)impProcesarArchivo(file,empresa);}

async function impProcesarArchivo(file,empresa){
  const ext=file.name.split('.').pop().toLowerCase();
  document.getElementById('imp-preview').innerHTML='<div style="text-align:center;padding:20px;color:var(--t3)">Procesando...</div>';
  if(ext==='pdf'){
    const reader=new FileReader();
    reader.onload=async function(e){
      try{
        if(!window.pdfjsLib){
          await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
          window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const pdf=await window.pdfjsLib.getDocument({data:e.target.result}).promise;
        let fullText='';
        for(let i=1;i<=pdf.numPages;i++){
          const page=await pdf.getPage(i);
          const tc=await page.getTextContent();
          const items=tc.items.sort((a,b)=>{const dy=b.transform[5]-a.transform[5];return Math.abs(dy)>3?dy:a.transform[4]-b.transform[4];});
          let lastY=null,lineText='';
          for(const item of items){const y=Math.round(item.transform[5]);if(lastY!==null&&Math.abs(y-lastY)>3){fullText+=lineText.trim()+'\n';lineText='';}lineText+=item.str+' ';lastY=y;}
          if(lineText.trim())fullText+=lineText.trim()+'\n';
          fullText+='\n';
        }
        impParsearTexto(fullText,empresa);
      }catch(err){document.getElementById('imp-preview').innerHTML=`<div style="color:var(--d);padding:16px;text-align:center">Error procesando PDF: ${err.message}<br><small>Guarda el PDF como .txt desde tu visor PDF e inténtalo de nuevo</small></div>`;}
    };
    reader.readAsArrayBuffer(file);
  }else if(ext==='txt'){
    const reader=new FileReader();reader.onload=e=>impParsearTexto(e.target.result,empresa);reader.readAsText(file);
  }else{document.getElementById('imp-preview').innerHTML='<div style="color:var(--d);padding:16px;text-align:center">Solo se aceptan PDF o TXT del banco</div>';}
}

function impParsearTexto(text,empresa){
  const {rows,anio,mes,periodoStr}=parseBofaPDF(text);
  const pe=document.getElementById('imp-periodo');if(pe)pe.value=periodoStr||`${mes}/${anio}`;
  if(!rows.length){document.getElementById('imp-preview').innerHTML=`<div style="background:var(--dd);border:1px solid var(--d);border-radius:8px;padding:16px;font-size:12px;color:var(--d)">No se encontraron transacciones. Verifica que sea un extracto BofA Business Advantage.</div>`;return;}
  IMP_DATA={empresa,rows,anio,mes};impMostrarPreview(rows,anio,mes,empresa);
}

// alias for the parser
function parseBofaPDF(text){return parseBofAPDF(text);}

function impMostrarPreview(rows,anio,mes,empresa){
  const ac=empresa==='tycoon'?'#5B8DB8':'#00D5B0';
  const CLR_ING='#2ecc71',CLR_EG='#f39c12';
  const tI=rows.reduce((a,r)=>a+r.ingreso,0),tE=rows.reduce((a,r)=>a+r.egreso,0),sinCat=rows.filter(r=>!r.categoria).length;
  const MESES=['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('imp-preview').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
      <div style="background:var(--sf2);border:1px solid var(--br);border-radius:8px;padding:10px 12px"><div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace;text-transform:uppercase;margin-bottom:4px">Período</div><div style="font-size:13px;font-weight:700">${MESES[mes]||mes} ${anio}</div></div>
      <div style="background:var(--sf2);border:1px solid var(--br);border-radius:8px;padding:10px 12px;border-top:2px solid ${CLR_ING}"><div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace;text-transform:uppercase;margin-bottom:4px">Ingresos</div><div style="font-size:13px;font-weight:700;color:${CLR_ING};font-family:"DM Mono",monospace">${fm(tI)}</div></div>
      <div style="background:var(--sf2);border:1px solid var(--br);border-radius:8px;padding:10px 12px;border-top:2px solid ${CLR_EG}"><div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace;text-transform:uppercase;margin-bottom:4px">Egresos</div><div style="font-size:13px;font-weight:700;color:${CLR_EG};font-family:"DM Mono",monospace">${fm(tE)}</div></div>
      <div style="background:var(--sf2);border:1px solid var(--br);border-radius:8px;padding:10px 12px;border-top:2px solid ${sinCat>0?'#f39c12':'#2ecc71'}"><div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace;text-transform:uppercase;margin-bottom:4px">Sin categoría</div><div style="font-size:13px;font-weight:700;color:${sinCat>0?'#f39c12':'#2ecc71'}">${sinCat} / ${rows.length}</div></div>
    </div>
    ${sinCat>0?`<div style="background:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.3);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:11px;color:var(--w)">⚠ ${sinCat} movimientos sin categoría. Puedes asignarlas antes o después de importar.</div>`:''}
    <div style="max-height:360px;overflow-y:auto;border:1px solid var(--br);border-radius:8px">
    <table style="width:100%;font-size:10px;border-collapse:collapse">
      <thead style="position:sticky;top:0;background:var(--sf2);z-index:1"><tr>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:6px 8px;font-size:9px;white-space:nowrap">Fecha</th>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:6px 8px;font-size:9px">Concepto</th>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:6px 8px;font-size:9px;min-width:150px">Categoría</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;padding:6px 8px;font-size:9px">Ingreso</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;padding:6px 8px;font-size:9px">Egreso</th>
      </tr></thead>
      <tbody>
        ${rows.map((r,i)=>`<tr style="border-top:1px solid var(--br);background:${!r.categoria?'rgba(243,156,18,0.04)':''}">
          <td style="padding:5px 8px;color:var(--t3);font-family:"DM Mono",monospace;white-space:nowrap">${fd(r.fecha)}</td>
          <td style="padding:5px 8px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.concepto.replace(/"/g,'&quot;')}">${r.concepto}</td>
          <td style="padding:5px 8px"><select onchange="impCambiarCat(${i},this.value)" style="width:100%;background:var(--sf2);border:1px solid ${!r.categoria?'rgba(243,156,18,0.5)':'var(--br)'};border-radius:4px;padding:2px 4px;font-size:9px;color:var(--t);outline:none">
            <option value="">— sin cat —</option>
            ${(FC_CATS[empresa]||[]).map(c=>`<option value="${c.nombre}" ${r.categoria===c.nombre?'selected':''}>${c.nombre}</option>`).join('')}
          </select></td>
          <td style="padding:5px 8px;text-align:right;font-family:"DM Mono",monospace;color:${CLR_ING};font-weight:${r.ingreso>0?600:400}">${r.ingreso>0?fm(r.ingreso):'—'}</td>
          <td style="padding:5px 8px;text-align:right;font-family:"DM Mono",monospace;color:${CLR_EG};font-weight:${r.egreso>0?600:400}">${r.egreso>0?fm(r.egreso):'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  document.getElementById('imp-actions').style.display='block';
  document.getElementById('imp-count').textContent=`${rows.length} transacciones`;
}

function impCambiarCat(idx,cat){if(IMP_DATA&&IMP_DATA.rows[idx])IMP_DATA.rows[idx].categoria=cat;}
function impLimpiar(){IMP_DATA=null;document.getElementById('imp-preview').innerHTML='';document.getElementById('imp-actions').style.display='none';document.getElementById('imp-periodo').value='';}

async function impConfirmar(empresa){
  if(!IMP_DATA||!IMP_DATA.rows.length)return;
  const cuentaId=(document.getElementById('imp-cuenta')?.value||'').trim();
  if(!cuentaId){toast('Selecciona la cuenta bancaria','d');return;}
  const btn=document.getElementById('imp-btn-ok');if(btn){btn.textContent='Importando...';btn.disabled=true;}
  const {anio,mes,rows}=IMP_DATA;

  // Determine date range from actual transaction dates
  const fechas = rows.map(r=>r.fecha).filter(Boolean).sort();
  const fechaMin = fechas[0] || (anio+'-'+String(mes).padStart(2,'0')+'-01');
  const fechaMax = fechas[fechas.length-1] || (anio+'-'+String(mes).padStart(2,'0')+'-31');

  // Clean slate: delete by empresa + cuenta + date range (not by año/mes columns)
  await db.from('transacciones').delete()
    .eq('empresa_id',empresa).eq('cuenta_id',cuentaId)
    .gte('fecha',fechaMin).lte('fecha',fechaMax);

  // Insert: año and mes are GENERATED columns (derived from fecha automatically)
  const inserts=rows.map(r=>{
    return {
      empresa_id:empresa, cuenta_id:cuentaId, fecha:r.fecha,
      concepto:r.concepto, categoria_nombre:r.categoria||null,
      ingreso:r.ingreso||0, egreso:r.egreso||0, moneda:'USD', tasa_cambio:1
    };
  });
  let errs=0;
  for(let i=0;i<inserts.length;i+=50){
    const {error}=await db.from('transacciones').insert(inserts.slice(i,i+50));
    if(error){errs++;console.error('Import batch error:',error);}
  }
  toast(errs?`Importado con ${errs} errores`:`✓ ${rows.length} movimientos importados`,'ok');
  cerrarImportar();
  // Set filters and navigate
  const anioEl=empresa==='tycoon'?$('cont-año'):$('contdiaz-año');
  if(anioEl) anioEl.value=String(anio);
  FC_FILT[empresa].mes=0;
  FC_FILT[empresa].cuenta=cuentaId;
  CONT_LOADED=false;CONTDIAZ_LOADED=false;
  goTab(empresa==='tycoon'?'cont':'contdiaz');
}

// ── DASHBOARD CONTABLE (visible admin + equipo) ───────────────
