
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
  let anio=new Date().getFullYear(), mes=1;

  // Detect statement period from header
  const pm = text.match(/for\s+(\w+\s+\d+,\s+\d{4})\s+to/i)
           || text.match(/(\w+\s+\d+,\s+\d{4})\s+through/i);
  if(pm){ const d=new Date(pm[1]); if(!isNaN(d)){anio=d.getFullYear();mes=d.getMonth()+1;} }
  if(!pm){ const ym=text.match(/\b(202[3-9]|2030)\b/); if(ym) anio=parseInt(ym[1]); }
  const pStr = pm ? pm[1] : `${anio}`;

  // section context: 'ing' (deposits) | 'eg' (withdrawals/service fees) | null
  // Used as FALLBACK only. Primary signal is the sign of the amount.
  let section=null;

  // Date regex: matches MM/DD/YY or MM/DD/YYYY at start of line
  const dateRe = /^(\d{2})\/(\d{2})\/(\d{2,4})\b/;
  // Amount: captures sign + number. Looks for AMOUNT AT END OF LINE.
  // Handles: 1,234.56  -1,234.56  $1,234.56  -$1,234.56  $-1,234.56
  const endAmountRe = /(-?\$?-?[\d,]+\.\d{2})\s*$/;
  // Standalone amount line (lookahead)
  const standaloneAmountRe = /^(-?\$?-?[\d,]+\.\d{2})\s*$/;

  function parseAmount(s) {
    // Normalize: strip $, commas, count minus signs
    const cleaned = s.replace(/\$/g,'').replace(/,/g,'');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  // Track sections — only used as fallback when amount has no sign
  function updateSection(line) {
    // Skip page-1 account-summary lines that contain section labels
    // (they have just a number after, no transactions follow on the same page)
    if(/Deposits and other credits/i.test(line) && !/Total deposits/i.test(line)) {
      // Real "Deposits and other credits" header appears on its own (or with Date/Description after)
      // Summary line: "Deposits and other credits   31,000.00"
      // We accept both — section change to 'ing'
      section='ing';
    }
    if(/Withdrawals and other debits|Other debits|Service fees|Checks paid/i.test(line)) {
      section='eg';
    }
  }

  let cDate=null, cDesc=[], cAmt=null, cSign=null;

  function flush() {
    if(cDate&&cDesc.length&&cAmt!==null){
      const desc=cDesc.join(' ').replace(/\s+/g,' ').trim();
      const amt=Math.abs(parseAmount(cAmt) || 0);
      if(amt > 0.001){
        // Determine ing/eg:
        // 1. If amount has explicit minus sign → egreso
        // 2. Else use section context
        // 3. Default: ingreso (deposits typically have no sign)
        let isEg;
        if(cSign === '-') isEg = true;
        else if(section === 'eg') isEg = true;
        else if(section === 'ing') isEg = false;
        else isEg = false;
        rows.push({
          fecha:cDate,
          concepto:desc.substring(0,120),
          ingreso:isEg?0:amt,
          egreso:isEg?amt:0,
          categoria:fcAutoCategoria(desc),
          moneda:'USD'
        });
      }
    }
    cDate=null;cDesc=[];cAmt=null;cSign=null;
  }

  for(let i=0;i<lines.length;i++){
    const line=lines[i];

    // End of transactions: Daily ledger balances appears at the very end
    if(/Daily ledger balances/i.test(line)){flush();break;}

    // Update section context (does not skip the line)
    updateSection(line);

    // Skip pure section header lines (no transaction data)
    if(/^(Deposits and other credits|Withdrawals and other debits|Withdrawals and other debits - continued|Other debits|Service fees|Checks paid|Date\s+Description|Card account)/i.test(line)) {
      flush();
      continue;
    }
    // Skip subtotal/total lines
    if(/^(Total deposits|Total withdrawals|Total service|Subtotal for|continued on|Note your Ending Balance|Page \d+ of)/i.test(line)) {
      flush();
      continue;
    }

    const dm=line.match(dateRe);
    if(dm){
      flush();
      const [,mm,dd,yy]=dm;
      const fullYear = yy.length===4 ? parseInt(yy) : 2000+parseInt(yy);
      cDate=`${fullYear}-${mm}-${dd}`;
      // Capture content after date
      const rest = line.substring(dm[0].length).trim();
      // Try to find amount at end of line
      const am = rest.match(endAmountRe);
      if(am){
        const amtStr = am[1];
        cSign = amtStr.includes('-') ? '-' : null;
        cAmt = amtStr;
        const descPart = rest.substring(0, rest.length - am[0].length).trim();
        cDesc = descPart ? [descPart] : [];
        flush();
      } else {
        // No amount on this line — gather description across following lines
        cDesc = rest ? [rest] : [];
        for(let j=i+1; j<Math.min(i+8, lines.length); j++){
          const nl = lines[j];
          // Stop at next date
          if(dateRe.test(nl)) break;
          // Stop at section/subtotal markers
          if(/^(Total|Subtotal for|Card account|Withdrawals|Deposits|Service fees|Date\s+Description|continued on|Page \d+)/i.test(nl)) break;
          // Standalone amount on this line?
          const sa = nl.match(standaloneAmountRe);
          if(sa){
            const amtStr = sa[1];
            cSign = amtStr.includes('-') ? '-' : null;
            cAmt = amtStr;
            // Description = everything between original line and this one
            for(let k=i+1; k<j; k++){
              if(!standaloneAmountRe.test(lines[k]) && !dateRe.test(lines[k]))
                cDesc.push(lines[k]);
            }
            i = j;
            flush();
            break;
          }
          // Amount at END of a description-continuation line?
          const ea = nl.match(endAmountRe);
          if(ea){
            const amtStr = ea[1];
            cSign = amtStr.includes('-') ? '-' : null;
            cAmt = amtStr;
            const descPart = nl.substring(0, nl.length - ea[0].length).trim();
            // Descriptions from previous lines
            for(let k=i+1; k<j; k++){
              if(!standaloneAmountRe.test(lines[k]) && !dateRe.test(lines[k]))
                cDesc.push(lines[k]);
            }
            if(descPart) cDesc.push(descPart);
            i = j;
            flush();
            break;
          }
          // Otherwise: continuation of description
          if(!/^Page \d+/i.test(nl) && !/continued on/i.test(nl)){
            cDesc.push(nl);
          }
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
  const isTy=empresa==='tycoon';
  const bodyId=isTy?'cont-body':'contdiaz-body';
  const body=$(bodyId);
  if(!body)return;
  body.innerHTML='<div style="text-align:center;color:var(--t3);padding:60px">Cargando...</div>';
  try{
    await fcLoadAux(empresa);
    const anioEl=isTy?$('cont-año'):$('contdiaz-año');
    const anio=parseInt(anioEl?.value||'0');
    const ac=isTy?'#5B8DB8':'#C4A062';

    // SINGLE QUERY: all filters in SQL including MONTH to avoid Supabase 1000-row limit
    const filt=FC_FILT[empresa];
    let q=db.from('transacciones').select('*').eq('empresa_id',empresa);
    if(anio>0){
      const mesNum=parseInt(filt.mes)||0;
      if(mesNum>0){
        // Use first-of-next-month with lt() to avoid invalid dates like Feb 31
        const mm=String(mesNum).padStart(2,'0');
        const nextY=mesNum===12?anio+1:anio;
        const nextM=mesNum===12?'01':String(mesNum+1).padStart(2,'0');
        q=q.gte('fecha',`${anio}-${mm}-01`).lt('fecha',`${nextY}-${nextM}-01`);
      } else {
        q=q.gte('fecha', anio+'-01-01').lte('fecha', anio+'-12-31');
      }
    }
    if(filt.cuenta) q=q.eq('cuenta_id',filt.cuenta);

    // Fetch transactions — paginate if >1000 rows (Supabase server max-rows)
    let trans=[];
    let from=0;
    while(true){
      const {data,error:qErr}=await q.order('fecha',{ascending:false}).range(from,from+999);
      if(qErr){console.error('loadCont:',qErr);break;}
      trans=trans.concat(data||[]);
      if(!data||data.length<1000)break;
      from+=1000;
      if(from>10000)break; // safety: max 10K rows
    }

    // Excluir cuentas extracontables del flujo bancario cuando se ve "Todas" (filtro hecho en JS, no en la query)
    if(!filt.cuenta){
      const idsExtra=new Set((FC_CUENTAS[empresa]||[]).filter(c=>c.es_bancaria===false).map(c=>c.id));
      if(idsExtra.size) trans=trans.filter(t=>!idsExtra.has(t.cuenta_id));
    }

    // Fetch annual summary + saldo acumulado using RPCs (no limit issues)
    const [{data:resumen},{data:saldos}]=await Promise.all([
      db.rpc('resumen_mensual',{p_empresa:empresa, p_anio:anio||0, p_cuenta_id:filt.cuenta||null}),
      db.rpc('saldo_acumulado',{p_empresa:empresa, p_anio:anio||new Date().getFullYear(), p_cuenta_id:filt.cuenta||null})
    ]);

    if(isTy) CONT_LOADED=true; else CONTDIAZ_LOADED=true;
    fcRenderDashboard(empresa, trans, anio, ac, body, resumen||[], saldos||[]);
  }catch(err){
    console.error('loadCont fatal:',err);
    body.innerHTML='<div style="text-align:center;color:var(--d);padding:60px;font-size:12px">⚠ Error cargando Flujo de Caja<br><span style="font-size:10px;color:var(--t3)">'+(err&&err.message?err.message:String(err))+'</span><br><br><span onclick="CONT_LOADED=false;CONTDIAZ_LOADED=false;loadCont(\''+empresa+'\')" style="cursor:pointer;text-decoration:underline;color:var(--ac)">Reintentar</span></div>';
  }
}

function fcRenderDashboard(empresa, trans, anio, ac, body, resumen, saldos) {
  const cuentas=FC_CUENTAS[empresa];
  const filt=FC_FILT[empresa];
  const cuentaSel=filt.cuenta?cuentas.find(c=>c.id===filt.cuenta):null;
  const esExtracontable=cuentaSel&&cuentaSel.es_bancaria===false;
  const msjVacio=esExtracontable
    ?'usa <b>📥 Importar pagos Inversionistas</b> o el botón <b>+ Movimiento</b> (selecciona esta cuenta)'
    :'usa <b>📤 Importar extracto</b>';
  const CLR_ING='#2ecc71',CLR_EG='#f39c12',CLR_NEG='#e74c3c',CLR_SAL='#5B8DB8';
  // Month filter is now in SQL — only filter by tipo here
  let rows=trans.filter(t=>{
    if(filt.tipo==='ingreso'&&!(t.ingreso>0))return false;
    if(filt.tipo==='egreso'&&!(t.egreso>0))return false;
    return true;
  });
  const ing=rows.reduce((a,t)=>a+(t.ingreso||0),0);
  const eg=rows.reduce((a,t)=>a+(t.egreso||0),0);
  const net=ing-eg, mrg=ing>0?(net/ing*100):0;

  // Saldo data from RPC — filter to selected month range
  const saldoIni=(saldos||[]).find(s=>s.mes===0);
  const saldoTodosMeses=(saldos||[]).filter(s=>s.mes>0).sort((a,b)=>a.mes-b.mes);
  const mesSeleccionado=parseInt(filt.mes)||0;
  // If month selected: accumulate Jan→month. If no month: full year.
  const saldoHasta=mesSeleccionado>0?saldoTodosMeses.filter(s=>s.mes<=mesSeleccionado):saldoTodosMeses;
  const saldoInicial=parseFloat(saldoIni?.saldo_acum||0);
  const totalIngAnual=saldoHasta.reduce((a,s)=>a+parseFloat(s.ing||0),0);
  const totalEgAnual=saldoHasta.reduce((a,s)=>a+parseFloat(s.eg||0),0);
  const saldoFinal=saldoHasta.length>0?parseFloat(saldoHasta[saldoHasta.length-1].saldo_acum||0):saldoInicial;
  // Labels for the strip
  const MESES_CORTOS=['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const lblPeriodo=mesSeleccionado>0?`Ene–${MESES_CORTOS[mesSeleccionado]} ${anio}`:`${anio}`;
  const lblFinal=mesSeleccionado>0?`${MESES_CORTOS[mesSeleccionado]} ${anio}`:`${anio}`;
  // Chart always uses full year data (12 months)
  const saldoMensual=saldoTodosMeses;

  // P&L by month: use RPC resumen (accurate, not limited by 1000-row cap)
  const MESES_SHORT=['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const mesArr=(resumen||[]).map(r=>({k:anio+'-'+String(r.mes).padStart(2,'0'),ing:parseFloat(r.ing)||0,eg:parseFloat(r.eg)||0}));
  const byCat={};
  rows.filter(t=>t.egreso>0).forEach(t=>{const c=t.categoria_nombre||'Sin categoría';byCat[c]=(byCat[c]||0)+t.egreso;});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxCat=topCats[0]?.[1]||1;
  // Comparativo anual: from RPC resumen (accurate, not limited by 1000-row cap)
  const byYear={};
  (resumen||[]).forEach(r=>{
    const y=anio||new Date().getFullYear();
    if(!byYear[y])byYear[y]={ing:0,eg:0};
    byYear[y].ing+=parseFloat(r.ing)||0; byYear[y].eg+=parseFloat(r.eg)||0;
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
    ${cuentas.map(c=>{const isA=filt.cuenta===c.id;const icon=c.tipo==='extracontable'?'🧾':c.tipo==='banco'?'🏦':c.tipo==='zelle'?'⚡':c.tipo==='paypal'?'🅿':c.tipo==='crypto'?'₿':'💵';return `<span onclick="fcFilt('${empresa}','cuenta','${c.id}')" style="cursor:pointer;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;background:${isA?ac:'var(--sf2)'};color:${isA?'#fff':'var(--t)'};border:1px solid ${isA?ac:'var(--br)'};">${icon} ${c.nombre}</span>`;}).join('')}
    <span onclick="abrirNuevaCuenta('${empresa}')" style="cursor:pointer;padding:6px 12px;border-radius:8px;font-size:11px;color:var(--t3);border:1px dashed var(--br)">+ Cuenta</span>
    ${empresa==='tycoon'?`<span onclick="fcImportarInvOpen()" title="Traer pagos a inversionistas hechos directo por los socios (sin pasar por el banco)" style="cursor:pointer;padding:6px 12px;border-radius:8px;font-size:11px;color:var(--t2);border:1px dashed var(--ac);background:rgba(91,141,184,0.08)">📥 Importar pagos Inversionistas</span>`:''}
    <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
      <select onchange="fcFilt('${empresa}','mes',this.value)" style="background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:5px 8px;font-size:10px;color:var(--t);outline:none"><option value="">Todos los meses</option>${mesOpts}</select>
      ${USER_ROL==='admin'?`<span onclick="fcEliminarMes('${empresa}')" title="Eliminar todas las transacciones del mes seleccionado (para re-importar)" style="cursor:pointer;padding:5px 9px;border-radius:7px;font-size:10px;background:var(--sf2);color:var(--d);border:1px solid var(--br)">🗑 Mes</span>`:''}
      <span onclick="irsAbrir('${empresa}')" title="Reporte IRS · Business Income & Expenses del año seleccionado" style="cursor:pointer;padding:5px 9px;border-radius:7px;font-size:10px;background:var(--sf2);color:var(--t2);border:1px solid var(--br)">📋 IRS</span>
      <span onclick="fcCatAbrir('${empresa}')" title="Reporte por categorías mes a mes del año seleccionado" style="cursor:pointer;padding:5px 9px;border-radius:7px;font-size:10px;background:var(--sf2);color:var(--t2);border:1px solid var(--br)">📊 Categorías</span>
      <span onclick="fcFilt('${empresa}','tipo',null)" style="cursor:pointer;padding:5px 9px;border-radius:7px;font-size:10px;background:${!filt.tipo?'var(--ad)':'var(--sf2)'};color:${!filt.tipo?ac:'var(--t2)'};border:1px solid ${!filt.tipo?ac:'var(--br)'}">Todos</span>
      <span onclick="fcFilt('${empresa}','tipo','ingreso')" style="cursor:pointer;padding:5px 9px;border-radius:7px;font-size:10px;background:${filt.tipo==='ingreso'?'rgba(46,204,113,0.1)':'var(--sf2)'};color:${filt.tipo==='ingreso'?CLR_ING:'var(--t2)'};border:1px solid ${filt.tipo==='ingreso'?CLR_ING:'var(--br)'}">↑ Ing</span>
      <span onclick="fcFilt('${empresa}','tipo','egreso')" style="cursor:pointer;padding:5px 9px;border-radius:7px;font-size:10px;background:${filt.tipo==='egreso'?'rgba(243,156,18,0.1)':'var(--sf2)'};color:${filt.tipo==='egreso'?CLR_EG:'var(--t2)'};border:1px solid ${filt.tipo==='egreso'?CLR_EG:'var(--br)'}">↓ Eg</span>
    </div>
  </div>
  <!-- ═══ SALDO STRIP ═══ -->
  <div style="background:linear-gradient(135deg,rgba(91,141,184,0.08),rgba(91,141,184,0.02));border:1px solid rgba(91,141,184,0.25);border-radius:12px;padding:14px 18px;margin-bottom:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
    <div><div style="font-size:8px;color:${CLR_SAL};font-family:'DM Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Saldo Inicial ${anio}</div><div style="font-size:18px;font-weight:700;color:${saldoInicial>=0?CLR_SAL:CLR_NEG};font-family:'Syne',sans-serif">${fm(saldoInicial)}</div></div>
    <div><div style="font-size:8px;color:${CLR_ING};font-family:'DM Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">+ Ingresos ${lblPeriodo}</div><div style="font-size:18px;font-weight:700;color:${CLR_ING};font-family:'Syne',sans-serif">${fm(totalIngAnual)}</div></div>
    <div><div style="font-size:8px;color:${CLR_EG};font-family:'DM Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">− Egresos ${lblPeriodo}</div><div style="font-size:18px;font-weight:700;color:${CLR_EG};font-family:'Syne',sans-serif">${fm(totalEgAnual)}</div></div>
    <div><div style="font-size:8px;color:${saldoFinal>=0?CLR_ING:CLR_NEG};font-family:'DM Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Saldo Final ${lblFinal}</div><div style="font-size:18px;font-weight:700;color:${saldoFinal>=0?CLR_ING:CLR_NEG};font-family:'Syne',sans-serif">${fm(saldoFinal)}</div></div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px;border-top:3px solid ${CLR_ING}"><div style="font-size:9px;color:var(--t3);font-family:'DM Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Ingresos ${filt.mes?MESES[parseInt(filt.mes)-1]||'':''} ${anio||'Total'}</div><div style="font-size:20px;font-weight:700;color:${CLR_ING};font-family:'Syne',sans-serif">${fm(ing)}</div><div style="font-size:10px;color:var(--t3);margin-top:3px">${rows.filter(t=>t.ingreso>0).length} movimientos</div></div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px;border-top:3px solid ${CLR_EG}"><div style="font-size:9px;color:var(--t3);font-family:'DM Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Egresos ${filt.mes?MESES[parseInt(filt.mes)-1]||'':''} ${anio||'Total'}</div><div style="font-size:20px;font-weight:700;color:${CLR_EG};font-family:'Syne',sans-serif">${fm(eg)}</div><div style="font-size:10px;color:var(--t3);margin-top:3px">${rows.filter(t=>t.egreso>0).length} movimientos</div></div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px;border-top:3px solid ${net>=0?CLR_ING:CLR_NEG}"><div style="font-size:9px;color:var(--t3);font-family:'DM Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Resultado neto</div><div style="font-size:20px;font-weight:700;color:${net>=0?CLR_ING:CLR_NEG};font-family:'Syne',sans-serif">${fm(net)}</div><div style="font-size:10px;color:var(--t3);margin-top:3px">${mrg.toFixed(1)}% margen</div></div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px;border-top:3px solid var(--t3)"><div style="font-size:9px;color:var(--t3);font-family:'DM Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Movimientos</div><div style="font-size:20px;font-weight:700;color:var(--t);font-family:'Syne',sans-serif">${rows.length}</div><div style="font-size:10px;color:var(--t3);margin-top:3px">${anio||'Histórico'} · Cash basis</div></div>
  </div>
  <!-- ═══ COMBINED CHART: MOVIMIENTOS + SALDO ACUMULADO ═══ -->
  <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:16px 18px;margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:9px;color:var(--t3);font-family:'DM Mono',monospace;letter-spacing:1.5px;text-transform:uppercase">Movimientos y saldo acumulado ${anio}</div>
      <div style="display:flex;gap:12px;font-size:9px;color:var(--t3)">
        <span><span style="display:inline-block;width:8px;height:8px;background:${CLR_ING};border-radius:1px;margin-right:3px"></span>Ingresos</span>
        <span><span style="display:inline-block;width:8px;height:8px;background:${CLR_EG};border-radius:1px;margin-right:3px"></span>Egresos</span>
        <span><span style="display:inline-block;width:10px;height:2px;background:${CLR_SAL};border-radius:1px;margin-right:3px;vertical-align:middle"></span>Saldo</span>
      </div>
    </div>
    ${(()=>{
      if(!saldoMensual.length) return '<div style="text-align:center;color:var(--t3);font-size:11px;padding:24px">Sin datos · '+msjVacio+'</div>';
      const W=680,H=180,PL=45,PR=50,PT=10,PB=30;
      const cW=W-PL-PR, cH=H-PT-PB;
      // Bar data (ing/eg per month)
      const maxBar=Math.max(...saldoMensual.map(s=>Math.max(parseFloat(s.ing)||0,parseFloat(s.eg)||0)),1);
      // Line data (saldo acumulado)
      const saldoVals=saldoMensual.map(s=>parseFloat(s.saldo_acum)||0);
      const minSaldo=Math.min(saldoInicial,...saldoVals);
      const maxSaldo=Math.max(saldoInicial,...saldoVals);
      const saldoRange=maxSaldo-minSaldo||1;
      const gW=cW/12;
      const bW=Math.max(4,gW/2-3);
      // Bars SVG
      let svg='';
      saldoMensual.forEach((s,i)=>{
        const ingV=parseFloat(s.ing)||0, egV=parseFloat(s.eg)||0;
        const x=PL+i*gW+gW/2-bW-1;
        const hI=(ingV/maxBar)*cH, hE=(egV/maxBar)*cH;
        svg+=`<rect x="${x}" y="${PT+cH-hI}" width="${bW}" height="${hI}" fill="${CLR_ING}" opacity="0.7" rx="2"/>`;
        svg+=`<rect x="${x+bW+2}" y="${PT+cH-hE}" width="${bW}" height="${hE}" fill="${CLR_EG}" opacity="0.7" rx="2"/>`;
        // Month label
        svg+=`<text x="${PL+i*gW+gW/2}" y="${H-6}" text-anchor="middle" font-size="8" fill="var(--t3)" font-family="sans-serif">${MESES_SHORT[s.mes]||s.mes}</text>`;
      });
      // Saldo line
      let pts=saldoMensual.map((s,i)=>{
        const x=PL+i*gW+gW/2;
        const y=PT+cH-(((parseFloat(s.saldo_acum)||0)-minSaldo)/saldoRange)*cH;
        return `${x},${y}`;
      }).join(' ');
      svg+=`<polyline points="${pts}" fill="none" stroke="${CLR_SAL}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      // Saldo dots + values
      saldoMensual.forEach((s,i)=>{
        const x=PL+i*gW+gW/2;
        const v=parseFloat(s.saldo_acum)||0;
        const y=PT+cH-((v-minSaldo)/saldoRange)*cH;
        svg+=`<circle cx="${x}" cy="${y}" r="3" fill="${CLR_SAL}" stroke="var(--bg)" stroke-width="1.5"/>`;
        // Show value label every 3 months or first/last
        if(i===0||i===saldoMensual.length-1||i%3===0){
          svg+=`<text x="${x}" y="${y-8}" text-anchor="middle" font-size="7" fill="${CLR_SAL}" font-family="monospace" font-weight="600">${Math.round(v/1000)}k</text>`;
        }
      });
      // Left Y-axis: bar scale
      svg+=`<text x="${PL-4}" y="${PT+6}" text-anchor="end" font-size="7" fill="var(--t3)" font-family="monospace">${(maxBar/1000).toFixed(0)}k</text>`;
      svg+=`<text x="${PL-4}" y="${PT+cH}" text-anchor="end" font-size="7" fill="var(--t3)" font-family="monospace">0</text>`;
      // Right Y-axis: saldo scale
      svg+=`<text x="${W-PR+4}" y="${PT+6}" text-anchor="start" font-size="7" fill="${CLR_SAL}" font-family="monospace">${(maxSaldo/1000).toFixed(0)}k</text>`;
      svg+=`<text x="${W-PR+4}" y="${PT+cH}" text-anchor="start" font-size="7" fill="${CLR_SAL}" font-family="monospace">${(minSaldo/1000).toFixed(0)}k</text>`;
      // Axes
      svg+=`<line x1="${PL}" y1="${PT+cH}" x2="${W-PR}" y2="${PT+cH}" stroke="var(--br)" stroke-width="0.5"/>`;
      return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:180px">${svg}</svg>`;
    })()}
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
        ${fcBuildRows(rows,cuentas,empresa,CLR_ING,CLR_EG,msjVacio)}
      </tbody>
    </table></div>
  </div>`;
}

function fcBuildRows(rows,cuentas,empresa,CLR_ING,CLR_EG,msjVacio){
  msjVacio=msjVacio||'usa <b>📤 Importar extracto</b>';
  if(!rows.length) return `<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:30px;font-size:12px">Sin movimientos · ${msjVacio}</td></tr>`;
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
  const nombre=ev.target.value||null;
  const {error}=await db.from('transacciones').update({categoria_nombre:nombre}).eq('id',id);
  if(error){toast('Error guardando categoría','d');console.error(error);}
  else{
    ev.target.style.background=nombre?'rgba(46,204,113,0.2)':'';
    setTimeout(()=>{ev.target.style.background='var(--ad)';},800);
    toast('✓ Categoría actualizada'+(nombre?': '+nombre:' (sin categoría)'),'ok');
  }
}
async function fcEliminar(id,empresa){
  if(!confirm('¿Eliminar este movimiento?'))return;
  await db.from('transacciones').delete().eq('id',id);
  toast('Eliminado','ok');CONT_LOADED=false;CONTDIAZ_LOADED=false;loadCont(empresa);
}

// ── ELIMINAR MES COMPLETO (para re-importar extracto) ──────────
async function fcEliminarMes(empresa){
  if(USER_ROL!=='admin'){toast('Solo el admin puede eliminar meses','d');return;}
  const anioEl=empresa==='tycoon'?$('cont-año'):$('contdiaz-año');
  const anio=parseInt(anioEl?.value||'0');
  const filt=FC_FILT[empresa];
  const mesNum=parseInt(filt.mes)||0;
  if(!anio||!mesNum){toast('Selecciona un año y un mes específico primero','d');return;}
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesNombre=MESES[mesNum-1];
  const mm=String(mesNum).padStart(2,'0');
  const nextY=mesNum===12?anio+1:anio;
  const nextM=mesNum===12?'01':String(mesNum+1).padStart(2,'0');
  const desde=`${anio}-${mm}-01`, hasta=`${nextY}-${nextM}-01`;
  let cuentaTxt='TODAS las cuentas';
  if(filt.cuenta){
    const c=(FC_CUENTAS[empresa]||[]).find(x=>x.id===filt.cuenta);
    cuentaTxt=c?c.nombre:'la cuenta filtrada';
  }
  let cq=db.from('transacciones').select('id',{count:'exact',head:true})
    .eq('empresa_id',empresa).gte('fecha',desde).lt('fecha',hasta);
  if(filt.cuenta) cq=cq.eq('cuenta_id',filt.cuenta);
  const {count,error:cErr}=await cq;
  if(cErr){toast('Error consultando: '+cErr.message,'d');return;}
  if(!count){toast(`No hay transacciones en ${mesNombre} ${anio}`,'d');return;}
  if(!confirm(`⚠️ Se eliminarán ${count} transacciones de ${mesNombre} ${anio} (${cuentaTxt}) en ${empresa==='tycoon'?'Tycoon':'Díaz'}.\n\n¿Continuar?`))return;
  if(!confirm(`Esta acción NO se puede deshacer.\n\nConfirma de nuevo para eliminar ${count} registros de ${mesNombre} ${anio}.`))return;
  let dq=db.from('transacciones').delete()
    .eq('empresa_id',empresa).gte('fecha',desde).lt('fecha',hasta);
  if(filt.cuenta) dq=dq.eq('cuenta_id',filt.cuenta);
  const {error:dErr}=await dq;
  if(dErr){toast('Error eliminando: '+dErr.message,'d');return;}
  toast(`✅ ${count} transacciones de ${mesNombre} ${anio} eliminadas`,'ok');
  CONT_LOADED=false;CONTDIAZ_LOADED=false;loadCont(empresa);
}

// ── NUEVO MOVIMIENTO MANUAL ───────────────────────────────────
async function abrirNuevoMovimiento(empresa){
  if(USER_ROL!=='admin'){toast('Solo el admin puede registrar movimientos','d');return;}
  await fcLoadAux(empresa);
  const cuentas=FC_CUENTAS[empresa],cats=FC_CATS[empresa]||[],ac=empresa==='tycoon'?'#5B8DB8':'#1e3a5f';
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
  const ac=empresa==='tycoon'?'#5B8DB8':'#1e3a5f';
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
  const cuentas=FC_CUENTAS[empresa],ac=empresa==='tycoon'?'#5B8DB8':'#C4A062';
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
  if(!rows.length){
    // Show debug panel: first 1000 chars of extracted text so user can diagnose
    const preview=text.substring(0,1200).replace(/</g,'&lt;').replace(/>/g,'&gt;');
    document.getElementById('imp-preview').innerHTML=`
      <div style="background:rgba(220,53,69,0.1);border:1px solid #dc3545;border-radius:8px;padding:14px;font-size:12px;color:#e74c3c;margin-bottom:12px">
        <b>⚠ No se encontraron transacciones.</b><br>
        Verifica que sea un extracto BofA Business Advantage (PDF o TXT exportado).<br>
        Si el formato del extracto cambió, copia el texto del PDF y pégalo en un .txt
      </div>
      <div style="background:var(--sf2);border:1px solid var(--br);border-radius:8px;padding:12px">
        <div style="font-size:9px;color:var(--t3);font-family:'DM Mono',monospace;text-transform:uppercase;margin-bottom:8px">Texto extraído del PDF (primeras 1200 chars) · para diagnóstico</div>
        <pre style="font-size:9px;color:var(--t2);white-space:pre-wrap;word-break:break-all;max-height:200px;overflow-y:auto;margin:0">${preview}</pre>
      </div>`;
    return;
  }
  IMP_DATA={empresa,rows,anio,mes};impMostrarPreview(rows,anio,mes,empresa);
}

// alias for the parser
function parseBofaPDF(text){return parseBofAPDF(text);}

function impMostrarPreview(rows,anio,mes,empresa){
  const ac=empresa==='tycoon'?'#5B8DB8':'#C4A062';
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

  // Clean slate: delete by empresa + cuenta + date range
  await db.from('transacciones').delete()
    .eq('empresa_id',empresa).eq('cuenta_id',cuentaId)
    .gte('fecha',fechaMin).lte('fecha',fechaMax);

  // Insert: año and mes are GENERATED columns (derived from fecha automatically)
  const inserts=rows.map(r=>({
    empresa_id:empresa, cuenta_id:cuentaId, fecha:r.fecha,
    concepto:r.concepto, categoria_nombre:r.categoria||null,
    ingreso:r.ingreso||0, egreso:r.egreso||0,
    moneda:'USD', tasa_cambio:1, fuente:'importado'
  }));

  let errs=0, firstErr=null;
  for(let i=0;i<inserts.length;i+=50){
    const {error}=await db.from('transacciones').insert(inserts.slice(i,i+50));
    if(error){errs++;if(!firstErr)firstErr=error;console.error('Import batch error:',error);}
  }

  if(btn){btn.textContent='✓ Confirmar e importar';btn.disabled=false;}

  if(firstErr){
    // Show the real error in the UI
    document.getElementById('imp-preview').insertAdjacentHTML('afterbegin',
      `<div style="background:rgba(220,53,69,0.12);border:1px solid #dc3545;border-radius:8px;padding:12px;margin-bottom:12px;font-size:11px;color:#e74c3c">
        <b>Error al guardar (${errs} lotes fallidos):</b><br>
        <code style="font-size:10px">${firstErr.message||JSON.stringify(firstErr)}</code>
      </div>`
    );
    if(errs===Math.ceil(inserts.length/50)){
      // ALL batches failed — don't navigate away
      toast(`Error: ${firstErr.message}`, 'd');
      return;
    }
  }

  toast(errs?`Importado con ${errs} errores (${rows.length-errs*50} ok)`:`✓ ${rows.length} movimientos importados`,'ok');
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

// ── REPORTE IRS · BUSINESS INCOME & EXPENSES ───────────────────
const IRS_EMPRESA_INFO={
  tycoon:{nombre:'TYCOON GURU CONNECTIONS LLC',fein:'47-2483992'},
  diaz:{nombre:'DIAZ INTERNATIONAL LLC',fein:'83-3709738'}
};
const IRS_LINEAS=[
  {c:'gi1',sec:'gi',n:'1',en:'Sales/ Gross Receipts/ Service Income',es:'Ventas/ Ingresos Brutos/ Ingresos por Servicios'},
  {c:'gi2',sec:'gi',n:'2',en:'Merchant Card Sales (Credit Card Income)',es:'Ventas por Tarjeta de Crédito (Punto de Venta)'},
  {c:'cogs1',sec:'cogs',n:'1',en:'Purchases/ Costs of Materials',es:'Compras/ Costos de Materiales'},
  {c:'cogs2',sec:'cogs',n:'2',en:'Merchant Card Fees',es:'Cargo Básico por Tarjeta'},
  {c:'e1',sec:'exp',n:'1',en:'Accounting',es:'Contabilidad'},
  {c:'e2',sec:'exp',n:'2',en:'Advertising',es:'Mercadeo/Propaganda'},
  {c:'e3a',sec:'exp',n:'3',en:'Automobile: Fuel/Gas',es:'Gastos del Auto: Gasolina'},
  {c:'e3b',sec:'exp',n:'',en:'Automobile: Car Insurance',es:'Seguro del Carro'},
  {c:'e3c',sec:'exp',n:'',en:'Automobile: Car Payment',es:'Cuota Mensual del Carro'},
  {c:'e4',sec:'exp',n:'4',en:'Bank Charges',es:'Cargos Bancarios'},
  {c:'e5',sec:'exp',n:'5',en:'Cleaning',es:'Limpieza'},
  {c:'e6',sec:'exp',n:'6',en:'Commissions',es:'Comisiones'},
  {c:'e7',sec:'exp',n:'7',en:'Computer Services',es:'Servicios Informáticos'},
  {c:'e8',sec:'exp',n:'8',en:'Interest',es:'Interés'},
  {c:'e9',sec:'exp',n:'9',en:'Freight',es:'Costos de Carga'},
  {c:'e10',sec:'exp',n:'10',en:'Dues and Subscriptions',es:'Cuotas y Suscripciones Mensuales/Anuales'},
  {c:'e11',sec:'exp',n:'11',en:'Equipment Rent',es:'Alquiler de Equipos'},
  {c:'e12',sec:'exp',n:'12',en:'Gifts',es:'Regalos'},
  {c:'e13',sec:'exp',n:'13',en:'Insurance',es:'Seguros'},
  {c:'e14',sec:'exp',n:'14',en:'Laundry',es:'Lavandería'},
  {c:'e15',sec:'exp',n:'15',en:'Legal and Professional',es:'Gastos Legales y Profesionales'},
  {c:'e16',sec:'exp',n:'16',en:'Meals/Entertainment',es:'Comida/Entretenimiento'},
  {c:'e17',sec:'exp',n:'17',en:'Miscellaneous',es:'Misceláneos'},
  {c:'e18',sec:'exp',n:'18',en:'Office Expense',es:'Gastos Diversos de Oficina'},
  {c:'e19',sec:'exp',n:'19',en:'Independent Contractors',es:'Contratistas Independientes'},
  {c:'e20',sec:'exp',n:'20',en:'Parking Fees and Tolls',es:'Estacionamiento/Peajes'},
  {c:'e21',sec:'exp',n:'21',en:'Permits and Fees / Taxes',es:'Permisos, Tarifas e Impuestos'},
  {c:'e22',sec:'exp',n:'22',en:'Postage',es:'Gastos de Envío'},
  {c:'e23',sec:'exp',n:'23',en:'Rents',es:'Rentas'},
  {c:'e24',sec:'exp',n:'24',en:'Repairs and Maintenance',es:'Reparaciones y Mantenimiento'},
  {c:'e25',sec:'exp',n:'25',en:'Salaries and Wages',es:'Salarios'},
  {c:'e26',sec:'exp',n:'26',en:'Security',es:'Seguridad'},
  {c:'e27',sec:'exp',n:'27',en:'Supplies',es:'Suministros'},
  {c:'e28',sec:'exp',n:'28',en:'Telephone',es:'Teléfonos'},
  {c:'e29',sec:'exp',n:'29',en:'Tools',es:'Herramientas'},
  {c:'e30',sec:'exp',n:'30',en:'Training/Continuing Education',es:'Entrenamiento/Educación'},
  {c:'e31',sec:'exp',n:'31',en:'Travel',es:'Viajes'},
  {c:'e32',sec:'exp',n:'32',en:'Uniforms',es:'Uniformes'},
  {c:'e33',sec:'exp',n:'33',en:'Utilities',es:'Servicios Públicos'},
  {c:'e34',sec:'exp',n:'34',en:'Other Deductions',es:'Otras Deducciones'}
];
let IRS_STATE=null;

function irsNorm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

function irsMapGasto(cat){
  const s=irsNorm(cat);
  if(/transferencia/.test(s))return null; // excluida
  if(/merchant.*fee/.test(s))return 'cogs2';
  if(/gasolina|combustible|fuel/.test(s))return 'e3a';
  if(/seguro.*(carro|auto|vehic)/.test(s))return 'e3b';
  if(/(cuota|pago).*(carro|auto)|car payment/.test(s))return 'e3c';
  if(/(comision|cargo|comisiones).*(bancari)|bank charge/.test(s))return 'e4';
  if(/contab|accounting/.test(s))return 'e1';
  if(/marketing|publicidad|mercadeo|propaganda|advertis/.test(s))return 'e2';
  if(/limpieza|cleaning/.test(s))return 'e5';
  if(/comision/.test(s))return 'e6';
  if(/software|tecnolog|informatic|computer|hosting|servidor/.test(s))return 'e7';
  if(/interes|interest/.test(s))return 'e8';
  if(/flete|freight|costos? de carga/.test(s))return 'e9';
  if(/suscripcion|subscripcion|dues/.test(s))return 'e10';
  if(/alquiler.*equipo|equipment rent/.test(s))return 'e11';
  if(/regalo|gift/.test(s))return 'e12';
  if(/lavander|laundry/.test(s))return 'e14';
  if(/legal|profesional|abogado/.test(s))return 'e15';
  if(/comida|meal|entreten|restauran/.test(s))return 'e16';
  if(/miscelan/.test(s))return 'e17';
  if(/oficina|office/.test(s))return 'e18';
  if(/contratista|contractor|outside service/.test(s))return 'e19';
  if(/estacionamiento|parking|peaje|toll/.test(s))return 'e20';
  if(/impuesto|\btax|taxes|\birs\b|permiso|permit|licencia/.test(s))return 'e21';
  if(/envio|postage|correo/.test(s))return 'e22';
  if(/renta|arriendo|\brent\b/.test(s))return 'e23';
  if(/reparacion|mantenimiento|repair/.test(s))return 'e24';
  if(/nomina|salario|payroll|wage/.test(s))return 'e25';
  if(/seguridad|security/.test(s))return 'e26';
  if(/seguro|insurance/.test(s))return 'e13';
  if(/suministro|supplies/.test(s))return 'e27';
  if(/telefono|phone|celular|movil/.test(s))return 'e28';
  if(/herramienta|\btool/.test(s))return 'e29';
  if(/entrenamiento|educacion|training|curso/.test(s))return 'e30';
  if(/viaje|travel/.test(s))return 'e31';
  if(/uniforme/.test(s))return 'e32';
  if(/servicios publicos|utilities|electricidad|\bluz\b|\bagua\b|internet/.test(s))return 'e33';
  if(/compra|material|purchase/.test(s))return 'cogs1';
  return 'e34';
}
function irsMapIngreso(cat){
  const s=irsNorm(cat);
  if(/transferencia/.test(s))return null;
  if(/tarjeta|merchant|card/.test(s))return 'gi2';
  return 'gi1';
}

async function irsAbrir(empresa){
  const anioEl=empresa==='tycoon'?$('cont-año'):$('contdiaz-año');
  const anio=parseInt(anioEl?.value||'0');
  if(!anio){toast('Selecciona un año específico primero','d');return;}
  const bodyId=empresa==='tycoon'?'cont-body':'contdiaz-body';
  const body=$(bodyId);
  body.innerHTML='<div style="text-align:center;color:var(--t3);padding:60px">Generando reporte IRS '+anio+'...</div>';

  // Transacciones del año (paginado)
  let trans=[],from=0;
  while(true){
    const {data,error}=await db.from('transacciones').select('categoria_nombre,ingreso,egreso')
      .eq('empresa_id',empresa).gte('fecha',anio+'-01-01').lte('fecha',anio+'-12-31')
      .range(from,from+999);
    if(error){body.innerHTML='<div style="color:var(--d);padding:40px">Error: '+error.message+'</div>';return;}
    trans=trans.concat(data||[]);
    if(!data||data.length<1000)break;
    from+=1000;if(from>20000)break;
  }
  // Saldo final del año + ajustes guardados
  const [{data:saldos},{data:ajustesRows}]=await Promise.all([
    db.rpc('saldo_acumulado',{p_empresa:empresa,p_anio:anio,p_cuenta_id:null}),
    db.from('irs_ajustes').select('linea,valor').eq('empresa_id',empresa).eq('anio',anio)
  ]);
  const m12=(saldos||[]).find(s=>s.mes===12);
  const saldoFinal=m12?parseFloat(m12.saldo_acum)||0:0;

  // Cálculo automático por línea
  const autos={},detalle={},excluidas={ing:0,eg:0};
  trans.forEach(t=>{
    const cat=t.categoria_nombre||'Sin categoría';
    if((t.ingreso||0)>0){
      const l=irsMapIngreso(cat);
      if(l===null){excluidas.ing+=t.ingreso;return;}
      autos[l]=(autos[l]||0)+t.ingreso;
      (detalle[l]=detalle[l]||{})[cat]=(detalle[l][cat]||0)+t.ingreso;
    }
    if((t.egreso||0)>0){
      const l=irsMapGasto(cat);
      if(l===null){excluidas.eg+=t.egreso;return;}
      autos[l]=(autos[l]||0)+t.egreso;
      (detalle[l]=detalle[l]||{})[cat]=(detalle[l][cat]||0)+t.egreso;
    }
  });
  const ajustes={};
  (ajustesRows||[]).forEach(a=>{if(a.valor!=null)ajustes[a.linea]=parseFloat(a.valor);});

  IRS_STATE={empresa,anio,autos,ajustes,saldoFinal,detalle,excluidas};
  irsRender();
}

function irsFilaHTML(L,esAdmin){
  const auto=IRS_STATE.autos[L.c]||0;
  const ov=IRS_STATE.ajustes[L.c];
  const val=(ov!=null?ov:auto);
  const overr=ov!=null&&Math.abs(ov-auto)>0.005;
  let extra='';
  const comp=IRS_STATE.detalle&&IRS_STATE.detalle[L.c];
  if(comp&&Object.keys(comp).length){
    extra='<div style="font-size:8px;color:var(--t3);margin-top:2px">'+
      Object.entries(comp).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+': '+fm(v)).join(' · ')+'</div>';
  }
  return `<tr style="border-top:1px solid var(--br)">
    <td style="padding:5px 8px;color:var(--t3);font-size:10px;text-align:center">${L.n}</td>
    <td style="padding:5px 8px;font-size:11px">${L.en}${extra}</td>
    <td style="padding:5px 8px;font-size:11px;color:var(--t2)">${L.es}</td>
    <td style="padding:4px 8px;text-align:right;white-space:nowrap">
      <input id="irs-v-${L.c}" data-linea="${L.c}" data-auto="${auto.toFixed(2)}" type="number" step="0.01" value="${val.toFixed(2)}"
        oninput="irsRecalc()" ${esAdmin?'':'disabled'}
        style="width:110px;background:var(--sf2);border:1px solid ${overr?'var(--ac)':'var(--br)'};border-radius:6px;padding:5px 8px;color:var(--t);font-size:11px;text-align:right;outline:none">
      <div id="irs-a-${L.c}" style="font-size:8px;color:${overr?'var(--ac)':'var(--t3)'};margin-top:1px;${overr?'':'visibility:hidden'}">
        auto: ${fm(auto)} ${esAdmin?`<span onclick="irsResetLinea('${L.c}')" style="cursor:pointer;text-decoration:underline">↺ restaurar</span>`:''}
      </div>
    </td>
  </tr>`;
}

function irsRender(){
  const {empresa,anio,saldoFinal,excluidas}=IRS_STATE;
  const info=IRS_EMPRESA_INFO[empresa]||{nombre:empresa,fein:''};
  const esAdmin=USER_ROL==='admin';
  const bodyId=empresa==='tycoon'?'cont-body':'contdiaz-body';
  const gi=IRS_LINEAS.filter(l=>l.sec==='gi'),cogs=IRS_LINEAS.filter(l=>l.sec==='cogs'),exp=IRS_LINEAS.filter(l=>l.sec==='exp');
  const sec=(titEn,titEs,lineas,totId,totEn,totEs)=>`
    <tr><td colspan="4" style="padding:10px 8px 4px;font-weight:700;font-size:11px;color:var(--ac);font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase">${titEn} · ${titEs}</td></tr>
    ${lineas.map(l=>irsFilaHTML(l,esAdmin)).join('')}
    <tr style="border-top:2px solid var(--br)"><td></td>
      <td style="padding:7px 8px;font-weight:700;font-size:11px">${totEn}</td>
      <td style="padding:7px 8px;font-weight:700;font-size:11px;color:var(--t2)">${totEs}</td>
      <td id="${totId}" style="padding:7px 8px;text-align:right;font-weight:700;font-family:'DM Mono',monospace;font-size:12px">$0.00</td></tr>`;

  $(bodyId).innerHTML=`
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
    <span onclick="CONT_LOADED=false;CONTDIAZ_LOADED=false;loadCont('${empresa}')" style="cursor:pointer;padding:6px 12px;border-radius:8px;font-size:11px;background:var(--sf2);color:var(--t2);border:1px solid var(--br)">← Volver a Flujo de Caja</span>
    <div style="margin-left:auto;display:flex;gap:8px">
      ${esAdmin?`<button onclick="irsGuardar()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer">💾 Guardar ajustes</button>`:''}
      <button onclick="irsImprimir()" style="background:var(--sf2);color:var(--t);border:1px solid var(--br);border-radius:8px;padding:7px 16px;font-size:12px;cursor:pointer">🖨 Imprimir / PDF</button>
    </div>
  </div>
  <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:18px 20px;margin-bottom:14px">
    <div style="font-size:15px;font-weight:700;font-family:'Syne',sans-serif">Business Income & Expenses / Ingresos y Gastos del Negocio</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;font-size:12px">
      <div><span style="color:var(--t3)">Business Name / Nombre del Negocio:</span> <b>${info.nombre}</b></div>
      <div><span style="color:var(--t3)">FEIN:</span> <b>${info.fein}</b></div>
      <div><span style="color:var(--t3)">Tax Year / Año Fiscal:</span> <b>${anio}</b></div>
      <div><span style="color:var(--t3)">Saldo Final del Año de la Cuenta Bancaria:</span> <b style="font-family:'DM Mono',monospace">${fm(saldoFinal)}</b></div>
    </div>
    ${(excluidas.ing||excluidas.eg)?`<div style="font-size:10px;color:var(--t3);margin-top:8px">ℹ Transferencias internas excluidas del reporte: ingresos ${fm(excluidas.ing)} · egresos ${fm(excluidas.eg)}</div>`:''}
  </div>
  <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:6px 10px 14px;overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <tr style="font-size:9px;color:var(--t3);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:1px">
        <td style="padding:6px 8px;width:30px">#</td><td style="padding:6px 8px">Concept</td><td style="padding:6px 8px">Concepto</td><td style="padding:6px 8px;text-align:right;width:150px">Valor USD</td>
      </tr>
      ${sec('Gross Income','Ingresos Brutos',gi,'irs-tot-gi','Total Gross Income','Total Ingresos Brutos')}
      ${sec('Cost of Goods Sold','Costos Directos de los Ingresos',cogs,'irs-tot-cogs','Total Cost of Goods Sold','Total Costos Directos')}
      ${sec('Deductions / Expenses','Deducciones / Gastos Administrativos',exp,'irs-tot-exp','Total Expenses','Total Gastos')}
      <tr style="border-top:3px double var(--br)"><td></td>
        <td style="padding:10px 8px;font-weight:700;font-size:13px">Total Net Profit or Loss</td>
        <td style="padding:10px 8px;font-weight:700;font-size:13px;color:var(--t2)">Total de Ganancia o Pérdida Neta</td>
        <td id="irs-tot-net" style="padding:10px 8px;text-align:right;font-weight:700;font-family:'DM Mono',monospace;font-size:15px">$0.00</td></tr>
    </table>
    <div style="font-size:10px;color:var(--t3);margin-top:12px;font-style:italic">I declare that I have examined this statement, and to the best of my knowledge and belief, it is true, correct and complete.</div>
  </div>`;
  irsRecalc();
}

function irsVal(c){const el=$('irs-v-'+c);return el?(parseFloat(el.value)||0):0;}
function irsRecalc(){
  if(!IRS_STATE)return;
  let gi=0,cogs=0,exp=0;
  IRS_LINEAS.forEach(L=>{
    const v=irsVal(L.c);
    if(L.sec==='gi')gi+=v;else if(L.sec==='cogs')cogs+=v;else exp+=v;
    // marcar override visual
    const el=$('irs-v-'+L.c),lbl=$('irs-a-'+L.c);
    if(el&&lbl){
      const auto=parseFloat(el.dataset.auto)||0;
      const overr=Math.abs((parseFloat(el.value)||0)-auto)>0.005;
      el.style.borderColor=overr?'var(--ac)':'var(--br)';
      lbl.style.visibility=overr?'visible':'hidden';
    }
  });
  const net=gi-cogs-exp;
  const set=(id,v,neg)=>{const el=$(id);if(el){el.textContent=fm(v);el.style.color=(neg&&v<0)?'#B91C1C':'var(--t)';}};
  set('irs-tot-gi',gi);set('irs-tot-cogs',cogs);set('irs-tot-exp',exp);set('irs-tot-net',net,true);
}
function irsResetLinea(c){
  const el=$('irs-v-'+c);if(!el)return;
  el.value=(parseFloat(el.dataset.auto)||0).toFixed(2);
  irsRecalc();
}

async function irsGuardar(){
  if(!IRS_STATE)return;
  if(USER_ROL!=='admin'){toast('Solo el admin puede guardar ajustes','d');return;}
  const {empresa,anio,autos}=IRS_STATE;
  const upserts=[],resets=[];
  IRS_LINEAS.forEach(L=>{
    const v=irsVal(L.c),auto=autos[L.c]||0;
    if(Math.abs(v-auto)>0.005)upserts.push({empresa_id:empresa,anio,linea:L.c,valor:v});
    else resets.push(L.c);
  });
  if(upserts.length){
    const {error}=await db.from('irs_ajustes').upsert(upserts,{onConflict:'empresa_id,anio,linea'});
    if(error){toast('Error guardando: '+error.message,'d');return;}
  }
  if(resets.length){
    await db.from('irs_ajustes').delete().eq('empresa_id',empresa).eq('anio',anio).in('linea',resets);
  }
  // refrescar estado local
  IRS_STATE.ajustes={};upserts.forEach(u=>IRS_STATE.ajustes[u.linea]=u.valor);
  toast(`✅ Reporte IRS ${anio} guardado (${upserts.length} ajustes manuales)`,'ok');
}

function irsImprimir(){
  if(!IRS_STATE)return;
  const {empresa,anio,saldoFinal}=IRS_STATE;
  const info=IRS_EMPRESA_INFO[empresa]||{nombre:empresa,fein:''};
  let gi=0,cogs=0,exp=0;
  const fila=(L)=>{const v=irsVal(L.c);if(L.sec==='gi')gi+=v;else if(L.sec==='cogs')cogs+=v;else exp+=v;
    return `<tr><td class="n">${L.n}</td><td>${L.en}</td><td class="es">${L.es}</td><td class="v">${v?('$ '+v.toLocaleString('en-US',{minimumFractionDigits:2})):'$ -'}</td></tr>`;};
  const gis=IRS_LINEAS.filter(l=>l.sec==='gi').map(fila).join('');
  const cs=IRS_LINEAS.filter(l=>l.sec==='cogs').map(fila).join('');
  const es=IRS_LINEAS.filter(l=>l.sec==='exp').map(fila).join('');
  const net=gi-cogs-exp;
  const money=v=>'$ '+v.toLocaleString('en-US',{minimumFractionDigits:2});
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>IRS Report ${info.nombre} ${anio}</title><style>
    body{font-family:Arial,sans-serif;color:#111;margin:36px;font-size:12px}
    h1{font-size:16px;margin:0 0 2px} h2{font-size:12px;margin:14px 0 4px;text-transform:uppercase;border-bottom:2px solid #111;padding-bottom:2px}
    table{width:100%;border-collapse:collapse} td{padding:3px 6px;border-bottom:1px solid #ddd;vertical-align:top}
    .n{width:24px;color:#666} .es{color:#555} .v{text-align:right;white-space:nowrap;width:110px;font-family:monospace}
    .tot td{font-weight:bold;border-top:2px solid #111;border-bottom:none}
    .net td{font-weight:bold;font-size:14px;border-top:3px double #111;border-bottom:none}
    .hdr{display:flex;justify-content:space-between;margin:8px 0 4px} .hdr div{font-size:12px}
    .decl{margin-top:24px;font-style:italic;font-size:11px}
    .firma{margin-top:36px;display:flex;gap:60px} .firma div{border-top:1px solid #111;padding-top:4px;width:220px;font-size:10px;text-align:center}
  </style></head><body>
  <h1>Business Income & Expenses / Ingresos y Gastos del Negocio</h1>
  <div class="hdr"><div><b>Business Name / Nombre del Negocio:</b> ${info.nombre}</div><div><b>FEIN:</b> ${info.fein}</div></div>
  <div class="hdr"><div><b>Tax Year / Año Fiscal:</b> ${anio}</div><div><b>Saldo Final del Año de la Cuenta Bancaria:</b> ${money(saldoFinal)}</div></div>
  <h2>Gross Income · Ingresos Brutos</h2><table>${gis}<tr class="tot"><td></td><td>Total Gross Income</td><td class="es">Total Ingresos Brutos</td><td class="v">${money(gi)}</td></tr></table>
  <h2>Cost of Goods Sold · Costos Directos</h2><table>${cs}<tr class="tot"><td></td><td>Total Cost of Goods Sold</td><td class="es">Total Costos Directos</td><td class="v">${money(cogs)}</td></tr></table>
  <h2>Deductions / Expenses · Deducciones / Gastos</h2><table>${es}<tr class="tot"><td></td><td>Total Expenses</td><td class="es">Total Gastos</td><td class="v">${money(exp)}</td></tr>
  <tr class="net"><td></td><td>Total Net Profit or Loss</td><td class="es">Total de Ganancia o Pérdida Neta</td><td class="v">${money(net)}</td></tr></table>
  <div class="decl">I declare that I have examined this statement, and to the best of my knowledge and belief, it is true, correct and complete.</div>
  <div class="firma"><div>Signature / Firma</div><div>Date / Fecha</div></div>
  <script>window.onload=function(){window.print();}<\/script></body></html>`);
  w.document.close();
}

// ── REPORTE POR CATEGORÍAS (matriz categoría × mes) ────────────
let FC_CAT_STATE=null;
async function fcCatAbrir(empresa){
  const anioEl=empresa==='tycoon'?$('cont-año'):$('contdiaz-año');
  const anio=parseInt(anioEl?.value||'0');
  if(!anio){toast('Selecciona un año específico primero','d');return;}
  const bodyId=empresa==='tycoon'?'cont-body':'contdiaz-body';
  const body=$(bodyId);
  body.innerHTML='<div style="text-align:center;color:var(--t3);padding:60px">Generando reporte por categorías '+anio+'...</div>';
  let trans=[],from=0;
  while(true){
    const {data,error}=await db.from('transacciones').select('fecha,categoria_nombre,ingreso,egreso')
      .eq('empresa_id',empresa).gte('fecha',anio+'-01-01').lte('fecha',anio+'-12-31').range(from,from+999);
    if(error){body.innerHTML='<div style="color:var(--d);padding:40px">Error: '+error.message+'</div>';return;}
    trans=trans.concat(data||[]);
    if(!data||data.length<1000)break;from+=1000;if(from>20000)break;
  }
  const ing={},eg={};
  trans.forEach(t=>{
    const m=parseInt((t.fecha||'').slice(5,7))-1;if(m<0||m>11)return;
    const cat=t.categoria_nombre||'— Sin categoría —';
    if((t.ingreso||0)>0){(ing[cat]=ing[cat]||new Array(12).fill(0))[m]+=t.ingreso;}
    if((t.egreso||0)>0){(eg[cat]=eg[cat]||new Array(12).fill(0))[m]+=t.egreso;}
  });
  FC_CAT_STATE={empresa,anio,ing,eg};
  fcCatRender();
}
function fcCatSecHTML(mapa,color,tit){
  const cats=Object.keys(mapa).sort((a,b)=>mapa[b].reduce((x,y)=>x+y,0)-mapa[a].reduce((x,y)=>x+y,0));
  const colTot=new Array(12).fill(0);let gran=0;
  const filas=cats.map(cat=>{
    const arr=mapa[cat];const tot=arr.reduce((a,b)=>a+b,0);gran+=tot;
    arr.forEach((v,i)=>colTot[i]+=v);
    return `<tr style="border-top:1px solid var(--br)">
      <td style="padding:4px 8px;font-size:10px;white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis" title="${cat.replace(/"/g,'&quot;')}">${cat}</td>
      ${arr.map(v=>`<td style="padding:4px 5px;text-align:right;font-family:'DM Mono',monospace;font-size:9px;color:${v?'var(--t)':'var(--t3)'}">${v?Math.round(v).toLocaleString('en-US'):'—'}</td>`).join('')}
      <td style="padding:4px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:10px;font-weight:700;color:${color}">${fm(tot)}</td></tr>`;
  }).join('');
  const totRow=`<tr style="border-top:2px solid var(--br)"><td style="padding:5px 8px;font-size:10px;font-weight:700">TOTAL ${tit}</td>
    ${colTot.map(v=>`<td style="padding:5px 5px;text-align:right;font-family:'DM Mono',monospace;font-size:9px;font-weight:700;color:${color}">${v?Math.round(v).toLocaleString('en-US'):'—'}</td>`).join('')}
    <td style="padding:5px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${color}">${fm(gran)}</td></tr>`;
  return {html:filas+totRow,colTot,gran};
}
function fcCatRender(){
  const {empresa,anio,ing,eg}=FC_CAT_STATE;
  const bodyId=empresa==='tycoon'?'cont-body':'contdiaz-body';
  const MS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const CLR_ING='#2ecc71',CLR_EG='#f39c12';
  const hdr=`<tr style="font-size:8px;color:var(--t3);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:0.5px">
    <td style="padding:5px 8px">Categoría</td>${MS.map(m=>`<td style="padding:5px 5px;text-align:right">${m}</td>`).join('')}<td style="padding:5px 8px;text-align:right">Total</td></tr>`;
  const sIng=fcCatSecHTML(ing,CLR_ING,'INGRESOS'),sEg=fcCatSecHTML(eg,CLR_EG,'EGRESOS');
  const netMes=sIng.colTot.map((v,i)=>v-sEg.colTot[i]);
  const netRow=`<tr style="border-top:3px double var(--br)"><td style="padding:6px 8px;font-size:11px;font-weight:700">NETO</td>
    ${netMes.map(v=>`<td style="padding:6px 5px;text-align:right;font-family:'DM Mono',monospace;font-size:9px;font-weight:700;color:${v<0?'#B91C1C':'var(--t)'}">${v?Math.round(v).toLocaleString('en-US'):'—'}</td>`).join('')}
    <td style="padding:6px 8px;text-align:right;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${(sIng.gran-sEg.gran)<0?'#B91C1C':'var(--t)'}">${fm(sIng.gran-sEg.gran)}</td></tr>`;
  $(bodyId).innerHTML=`
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
    <span onclick="CONT_LOADED=false;CONTDIAZ_LOADED=false;loadCont('${empresa}')" style="cursor:pointer;padding:6px 12px;border-radius:8px;font-size:11px;background:var(--sf2);color:var(--t2);border:1px solid var(--br)">← Volver a Flujo de Caja</span>
    <div style="font-size:13px;font-weight:700;font-family:'Syne',sans-serif;margin-left:6px">📊 Reporte por Categorías · ${anio}</div>
    <div style="margin-left:auto;display:flex;gap:8px">
      <span onclick="irsAbrir('${empresa}')" style="cursor:pointer;padding:6px 12px;border-radius:8px;font-size:11px;background:var(--sf2);color:var(--t2);border:1px solid var(--br)">📋 Ir al reporte IRS</span>
      <button onclick="fcCatCSV()" style="background:var(--sf2);color:var(--t);border:1px solid var(--br);border-radius:8px;padding:6px 14px;font-size:11px;cursor:pointer">📥 Excel/CSV</button>
      <button onclick="fcCatImprimir()" style="background:var(--sf2);color:var(--t);border:1px solid var(--br);border-radius:8px;padding:6px 14px;font-size:11px;cursor:pointer">🖨 Imprimir</button>
    </div>
  </div>
  <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:8px 10px 14px;overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;min-width:900px">
      ${hdr}
      <tr><td colspan="14" style="padding:8px 8px 3px;font-weight:700;font-size:10px;color:${CLR_ING};font-family:'DM Mono',monospace;letter-spacing:1px">▲ INGRESOS</td></tr>${sIng.html}
      <tr><td colspan="14" style="padding:12px 8px 3px;font-weight:700;font-size:10px;color:${CLR_EG};font-family:'DM Mono',monospace;letter-spacing:1px">▼ EGRESOS</td></tr>${sEg.html}
      ${netRow}
    </table>
    <div style="font-size:9px;color:var(--t3);margin-top:8px">Valores mensuales redondeados para lectura · columna Total exacta · Cash basis USD · Cambia categorías en la lista de movimientos y vuelve a abrir este reporte</div>
  </div>`;
}
function fcCatCSV(){
  if(!FC_CAT_STATE)return;
  const {empresa,anio,ing,eg}=FC_CAT_STATE;
  const MS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  let csv='Tipo;Categoria;'+MS.join(';')+';Total\n';
  const add=(mapa,tipo)=>{Object.keys(mapa).sort().forEach(cat=>{
    const arr=mapa[cat];
    csv+=tipo+';"'+cat.replace(/"/g,'""')+'";'+arr.map(v=>v.toFixed(2)).join(';')+';'+arr.reduce((a,b)=>a+b,0).toFixed(2)+'\n';});};
  add(ing,'INGRESO');add(eg,'EGRESO');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='categorias_'+empresa+'_'+anio+'.csv';a.click();
  toast('📥 CSV descargado · ábrelo en Excel','ok');
}
function fcCatImprimir(){
  if(!FC_CAT_STATE)return;
  const {empresa,anio,ing,eg}=FC_CAT_STATE;
  const info=IRS_EMPRESA_INFO[empresa]||{nombre:empresa,fein:''};
  const MS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const money=v=>v?v.toLocaleString('en-US',{minimumFractionDigits:2}):'-';
  const seccion=(mapa,tit)=>{
    const colTot=new Array(12).fill(0);let gran=0;
    let rows=Object.keys(mapa).sort((a,b)=>mapa[b].reduce((x,y)=>x+y,0)-mapa[a].reduce((x,y)=>x+y,0)).map(cat=>{
      const arr=mapa[cat];const tot=arr.reduce((a,b)=>a+b,0);gran+=tot;arr.forEach((v,i)=>colTot[i]+=v);
      return '<tr><td>'+cat+'</td>'+arr.map(v=>'<td class="v">'+(v?Math.round(v).toLocaleString('en-US'):'-')+'</td>').join('')+'<td class="v" style="font-weight:bold">'+money(tot)+'</td></tr>';}).join('');
    rows+='<tr class="tot"><td>TOTAL '+tit+'</td>'+colTot.map(v=>'<td class="v">'+(v?Math.round(v).toLocaleString('en-US'):'-')+'</td>').join('')+'<td class="v">'+money(gran)+'</td></tr>';
    return {rows,colTot,gran};
  };
  const si=seccion(ing,'INGRESOS'),se=seccion(eg,'EGRESOS');
  const net=si.colTot.map((v,i)=>v-se.colTot[i]);
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Categorías ${info.nombre} ${anio}</title><style>
  @page{size:landscape;margin:12mm}
  body{font-family:Arial,sans-serif;font-size:9px;color:#111;margin:20px}
  h1{font-size:14px;margin:0}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  td{padding:2px 4px;border-bottom:1px solid #ccc}
  .hd td{font-size:8px;text-transform:uppercase;text-align:right;border-bottom:2px solid #111;font-weight:bold}
  .hd td:first-child{text-align:left}
  .v{text-align:right;font-family:monospace;white-space:nowrap}
  .tot td{font-weight:bold;border-top:2px solid #111}
  .sec td{font-weight:bold;background:#eee;font-size:10px}
  .net td{font-weight:bold;border-top:3px double #111;font-size:10px}
  </style></head><body>
  <h1>Reporte por Categorías · ${info.nombre} · ${anio}</h1>
  <div style="font-size:9px;color:#555">FEIN ${info.fein} · Cash basis USD · Generado ${new Date().toLocaleDateString('es-CO')}</div>
  <table>
  <tr class="hd"><td>Categoría</td>${MS.map(m=>'<td>'+m+'</td>').join('')}<td>Total</td></tr>
  <tr class="sec"><td colspan="14">INGRESOS</td></tr>${si.rows}
  <tr class="sec"><td colspan="14">EGRESOS</td></tr>${se.rows}
  <tr class="net"><td>NETO</td>${net.map(v=>'<td class="v">'+(v?Math.round(v).toLocaleString('en-US'):'-')+'</td>').join('')}<td class="v">${money(si.gran-se.gran)}</td></tr>
  </table>
  <script>window.onload=function(){window.print();}<\/script></body></html>`);
  w.document.close();
}

// ── IMPORTAR PAGOS A INVERSIONISTAS (extracontable) ─────────────
async function fcImportarInvOpen(){
  if(USER_ROL!=='admin'){toast('Solo el admin puede importar','d');return;}
  $('m-t').textContent='Importar pagos a Inversionistas';
  $('m-s').textContent='Trae al Flujo de Caja (Extracontable) pagos que los socios hicieron directo, sin pasar por el banco';
  $('m-b').innerHTML='<div style="text-align:center;color:var(--t3);padding:30px">Cargando historial de movimientos...</div>';
  $('ov').classList.add('on');

  const {data:movs,error:e1}=await db.from('movimientos')
    .select('id,contrato_id,fecha,tipo,valor_pago,pago_capital_mov,anotaciones,numero_memo')
    .or('valor_pago.gt.0,pago_capital_mov.gt.0')
    .order('fecha',{ascending:false});
  const {data:contratos,error:e2}=await db.from('contratos_tycoon').select('id,numero,nombre_inversionista');
  const {data:linked,error:e3}=await db.from('movimientos_extracontable_link').select('movimiento_id');
  if(e1||e2||e3){$('m-b').innerHTML='<div style="color:var(--d);padding:20px">Error cargando datos</div>';return;}

  const contMap={};(contratos||[]).forEach(c=>contMap[c.id]=c);
  const linkedSet=new Set((linked||[]).map(l=>l.movimiento_id));
  const pendientes=(movs||[]).filter(m=>!linkedSet.has(m.id)&&((m.valor_pago||0)>0||(m.pago_capital_mov||0)>0));

  if(!pendientes.length){
    $('m-b').innerHTML='<div style="text-align:center;color:var(--t3);padding:30px">No hay pagos pendientes por importar.<br>Todos los pagos con valor ya están en el Extracontable o no tienen monto de pago.</div>';
    return;
  }

  FC_IMPORT_INV_ROWS=pendientes.map(m=>{
    const c=contMap[m.contrato_id]||{};
    const monto=(m.valor_pago||0)+(m.pago_capital_mov||0);
    return {id:m.id,fecha:m.fecha,inversionista:c.nombre_inversionista||'—',numero:c.numero||'',monto,tipo:m.tipo||'',nota:m.anotaciones||m.numero_memo||''};
  });

  $('m-b').innerHTML=`
    <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Marca los pagos que el socio hizo <b>directo al inversionista</b> (no por el banco de Tycoon). Los que ya salieron por Zelle/BofA NO los marques — ya están contados.</div>
    <div style="max-height:340px;overflow-y:auto;border:1px solid var(--br);border-radius:8px">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <tr style="position:sticky;top:0;background:var(--sf);font-size:9px;color:var(--t3);text-transform:uppercase">
          <td style="padding:6px 8px"><input type="checkbox" onchange="document.querySelectorAll('.fii-chk').forEach(c=>c.checked=this.checked)"></td>
          <td style="padding:6px 8px">Fecha</td><td style="padding:6px 8px">Inversionista</td><td style="padding:6px 8px">Contrato</td>
          <td style="padding:6px 8px;text-align:right">Monto</td><td style="padding:6px 8px">Nota</td></tr>
        ${FC_IMPORT_INV_ROWS.map((r,i)=>`<tr style="border-top:1px solid var(--br)">
          <td style="padding:5px 8px"><input type="checkbox" class="fii-chk" data-i="${i}"></td>
          <td style="padding:5px 8px;white-space:nowrap;font-family:'DM Mono',monospace;font-size:10px">${fd(r.fecha)}</td>
          <td style="padding:5px 8px">${r.inversionista}</td>
          <td style="padding:5px 8px;color:var(--t3);font-size:10px">${r.numero}</td>
          <td style="padding:5px 8px;text-align:right;font-family:'DM Mono',monospace">${fm(r.monto)}</td>
          <td style="padding:5px 8px;color:var(--t3);font-size:10px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.nota}</td></tr>`).join('')}
      </table>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
      <select id="fii-cat" style="flex:1;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;font-size:12px;color:var(--t)">
        <option value="Rendimientos/Capital pagados a Inversionistas">Rendimientos/Capital pagados a Inversionistas</option>
        ${(FC_CATS['tycoon']||[]).map(c=>`<option value="${c.nombre}">${c.nombre}</option>`).join('')}
      </select>
      <button onclick="fcImportarInvConfirmar()" style="background:var(--ac);color:#fff;border:none;border-radius:7px;padding:9px 18px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">Importar seleccionados</button>
    </div>
    <div id="fii-err" style="font-size:11px;color:var(--d);margin-top:6px"></div>`;
}

async function fcImportarInvConfirmar(){
  const checks=[...document.querySelectorAll('.fii-chk:checked')];
  if(!checks.length){$('fii-err').textContent='Selecciona al menos un pago';return;}
  const cat=$('fii-cat').value;
  const cuentaExtra=(FC_CUENTAS['tycoon']||[]).find(c=>c.es_bancaria===false);
  if(!cuentaExtra){$('fii-err').textContent='No existe la cuenta Extracontable — contacta soporte técnico';return;}
  $('fii-err').textContent='Importando...';
  const rows=checks.map(chk=>{
    const r=FC_IMPORT_INV_ROWS[parseInt(chk.dataset.i)];
    return {row:r,tx:{empresa_id:'tycoon',cuenta_id:cuentaExtra.id,fecha:r.fecha,concepto:'Pago directo a '+r.inversionista+(r.numero?' ('+r.numero+')':''),egreso:r.monto,ingreso:0,categoria_nombre:cat,fuente:'extracontable_inversionista',notas:r.nota||null}};
  });
  let ok=0,fail=0,firstErr='';
  for(const {row,tx} of rows){
    const {data,error}=await db.from('transacciones').insert(tx).select('id').single();
    if(error||!data){fail++;if(!firstErr&&error)firstErr=error.message;continue;}
    const {error:e2}=await db.from('movimientos_extracontable_link').insert({movimiento_id:row.id,transaccion_id:data.id});
    if(e2){fail++;if(!firstErr)firstErr=e2.message;continue;}
    ok++;
  }
  $('fii-err').style.color=fail?'var(--d)':'var(--ac)';
  $('fii-err').textContent=`✅ ${ok} pagos importados al Extracontable${fail?` · ${fail} fallaron (${firstErr})`:''}`;
  if(ok){CONT_LOADED=false;setTimeout(()=>{closeM();loadCont('tycoon');},1200);}
}
let FC_IMPORT_INV_ROWS=[];
