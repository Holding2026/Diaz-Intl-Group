async function loadContDash(empresa) {
  const bodyId = empresa==='tycoon' ? 'cont-dash-ty-body' : 'cont-dash-dz-body';
  const anioElId = empresa==='tycoon' ? 'cont-dash-ty-año' : 'cont-dash-dz-año';
  const body = $(bodyId);
  if(!body) return;
  body.innerHTML = '<div style="text-align:center;color:var(--t3);padding:60px">Cargando...</div>';

  const anioEl = $(anioElId);
  const anio = parseInt(anioEl?.value || '0');
  const ac = empresa==='tycoon' ? '#D22630' : '#00D5B0';
  const CLR_ING='#2ecc71', CLR_EG='#f39c12', CLR_NEG='#e74c3c';

  let q = db.from('transacciones').select('*').eq('empresa_id', empresa);
  if(anio > 0) q = q.gte('fecha', anio+'-01-01').lte('fecha', anio+'-12-31');
  const {data: trans} = await q.order('fecha', {ascending:false});
  const rows = trans || [];

  if(empresa==='tycoon') CONT_DASH_TY_LOADED=true;
  else CONT_DASH_DZ_LOADED=true;

  const ing = rows.reduce((a,t)=>a+(t.ingreso||0),0);
  const eg  = rows.reduce((a,t)=>a+(t.egreso||0),0);
  const net = ing-eg, mrg = ing>0?(net/ing*100):0;

  // P&L por mes
  const byMes={};
  rows.forEach(t=>{
    if(!t.fecha) return;
    const d=new Date(t.fecha+'T12:00:00');
    const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    if(!byMes[k]) byMes[k]={k,ing:0,eg:0,label:''};
    byMes[k].ing+=t.ingreso||0; byMes[k].eg+=t.egreso||0;
  });
  const mesArr=Object.values(byMes).sort((a,b)=>a.k.localeCompare(b.k));
  const MESES=['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Top cats
  const byCat={};
  rows.filter(t=>t.egreso>0).forEach(t=>{const c=t.categoria_nombre||'Sin categoría';byCat[c]=(byCat[c]||0)+t.egreso;});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const maxCat=topCats[0]?.[1]||1;

  // By month full table
  const byYear={};
  rows.forEach(t=>{const y=t.año||anio||'?';if(!byYear[y])byYear[y]={ing:0,eg:0};byYear[y].ing+=t.ingreso||0;byYear[y].eg+=t.egreso||0;});

  // SVG chart
  const CW=560,CH=100,maxV=Math.max(...mesArr.map(m=>Math.max(m.ing,m.eg)),1);
  const bW=mesArr.length>0?Math.max(4,Math.floor((CW-30)/mesArr.length/2)-2):10;
  const gW=mesArr.length>0?Math.floor((CW-30)/mesArr.length):25;
  let bars='',xLabels='';
  mesArr.forEach((m,i)=>{
    const x=15+i*gW,hI=(m.ing/maxV)*(CH-15),hE=(m.eg/maxV)*(CH-15);
    bars+=`<rect x="${x}" y="${CH-15-hI}" width="${bW}" height="${hI}" fill="${CLR_ING}" opacity="0.85" rx="1"/>`;
    bars+=`<rect x="${x+bW+1}" y="${CH-15-hE}" width="${bW}" height="${hE}" fill="rgba(243,156,18,0.85)" rx="1"/>`;
    // Month label
    const mesNum=parseInt(m.k.split('-')[1])||0;
    if(mesNum>0) xLabels+=`<text x="${x+bW}" y="${CH-2}" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.4)" font-family="monospace">${MESES[mesNum]}</text>`;
  });

  const gPct=Math.min(Math.max(mrg,-100),100),gColor=gPct>=0?(gPct>20?CLR_ING:CLR_EG):CLR_NEG;
  const gAngle=(gPct/100)*180,gRad=(gAngle-90)*Math.PI/180;
  const gx=60+50*Math.cos(gRad),gy=60+50*Math.sin(gRad);
  const lArc=Math.abs(gAngle)>180?1:0,swp=gAngle>=0?1:0;

  body.innerHTML=`
  <!-- KPIs -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:18px 20px;border-top:3px solid ${CLR_ING}">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Ingresos ${anio||'Total'}</div>
      <div style="font-size:24px;font-weight:800;color:${CLR_ING};font-family:'Syne',sans-serif">${fm(ing)}</div>
      <div style="font-size:10px;color:var(--t3);margin-top:4px">${rows.filter(t=>t.ingreso>0).length} movimientos</div>
    </div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:18px 20px;border-top:3px solid ${CLR_EG}">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Egresos ${anio||'Total'}</div>
      <div style="font-size:24px;font-weight:800;color:${CLR_EG};font-family:'Syne',sans-serif">${fm(eg)}</div>
      <div style="font-size:10px;color:var(--t3);margin-top:4px">${rows.filter(t=>t.egreso>0).length} movimientos</div>
    </div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:18px 20px;border-top:3px solid ${net>=0?CLR_ING:CLR_NEG}">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Resultado neto</div>
      <div style="font-size:24px;font-weight:800;color:${net>=0?CLR_ING:CLR_NEG};font-family:'Syne',sans-serif">${fm(net)}</div>
      <div style="font-size:10px;color:var(--t3);margin-top:4px">${mrg.toFixed(1)}% margen</div>
    </div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:18px 20px;border-top:3px solid ${gColor}">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Margen neto</div>
      <div style="font-size:24px;font-weight:800;color:${gColor};font-family:'Syne',sans-serif">${mrg.toFixed(1)}%</div>
      <div style="font-size:10px;color:var(--t3);margin-top:4px">${mrg>=20?'✅ Saludable':mrg>=0?'⚠ Ajustado':'❌ Negativo'}</div>
    </div>
  </div>

  <!-- Chart grande + gauge -->
  <div style="display:grid;grid-template-columns:1fr 220px;gap:14px;margin-bottom:20px">
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:18px 20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:var(--t)">Ingresos vs Egresos por mes</div>
        <div style="display:flex;gap:12px;font-size:10px;color:var(--t3)">
          <span><span style="display:inline-block;width:10px;height:10px;background:${CLR_ING};border-radius:2px;margin-right:4px"></span>Ingresos</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:rgba(243,156,18,0.85);border-radius:2px;margin-right:4px"></span>Egresos</span>
        </div>
      </div>
      <svg viewBox="0 0 ${CW} ${CH}" style="width:100%;height:100px">${bars}${xLabels}</svg>
      ${mesArr.length===0?'<div style="text-align:center;color:var(--t3);font-size:11px;padding:10px">Sin datos — importa el primer extracto</div>':''}
    </div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:18px 20px;text-align:center">
      <div style="font-size:11px;font-weight:700;color:var(--t);margin-bottom:14px">Margen neto</div>
      <svg viewBox="0 0 120 75" style="width:100%;max-width:140px">
        <path d="M10,65 A50,50 0 0,1 110,65" fill="none" stroke="var(--br)" stroke-width="12" stroke-linecap="round"/>
        ${gPct!==0?`<path d="M60,65 A50,50 0 ${lArc},${swp} ${gx},${gy+5}" fill="none" stroke="${gColor}" stroke-width="12" stroke-linecap="round"/>`:''}
        <text x="60" y="60" text-anchor="middle" font-size="18" font-weight="800" fill="${gColor}" font-family="sans-serif">${mrg.toFixed(1)}%</text>
      </svg>
      <div style="font-size:11px;color:${gColor};font-weight:700;margin-top:8px">${mrg>=20?'Saludable':mrg>=0?'Ajustado':'Negativo'}</div>
      <div style="font-size:9px;color:var(--t3);margin-top:4px">${anio||'Histórico'} · Cash basis</div>
    </div>
  </div>

  <!-- Top categorías + Comparativo anual -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:18px 20px">
      <div style="font-size:11px;font-weight:700;color:var(--t);margin-bottom:14px">Top 10 categorías de egresos</div>
      ${topCats.length===0?'<div style="color:var(--t3);font-size:11px;text-align:center;padding:20px">Sin egresos — importa el primer extracto</div>':
        topCats.map(([cat,val])=>{
          const p=(val/maxCat*100).toFixed(0);
          const pctTot = eg>0?((val/eg)*100).toFixed(1):'0';
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <div style="font-size:11px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">${cat}</div>
              <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:9px;color:var(--t3)">${pctTot}%</span>
                <span style="font-size:11px;font-family:"DM Mono",monospace;color:${CLR_EG};font-weight:600">${fm(val)}</span>
              </div>
            </div>
            <div style="height:5px;background:var(--br);border-radius:3px">
              <div style="height:5px;width:${p}%;background:rgba(243,156,18,0.75);border-radius:3px"></div>
            </div>
          </div>`;
        }).join('')}
    </div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:18px 20px">
      <div style="font-size:11px;font-weight:700;color:var(--t);margin-bottom:14px">Resumen por mes</div>
      ${mesArr.length===0?'<div style="color:var(--t3);font-size:11px;text-align:center;padding:20px">Sin datos</div>':`
      <div style="overflow-y:auto;max-height:320px">
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead style="position:sticky;top:0;background:var(--sf)"><tr>
          <th style="text-align:left;color:var(--t3);font-weight:500;padding:4px 0;font-size:9px">Mes</th>
          <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Ingresos</th>
          <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Egresos</th>
          <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Neto</th>
        </tr></thead>
        <tbody>
          ${mesArr.map(m=>{
            const r=m.ing-m.eg;
            const [y,mn]=m.k.split('-');
            return `<tr style="border-top:1px solid var(--br)">
              <td style="padding:6px 0;font-weight:600">${MESES[parseInt(mn)]||mn} ${y}</td>
              <td style="padding:6px 0;text-align:right;color:${CLR_ING};font-family:"DM Mono",monospace;font-size:10px">${fm(m.ing)}</td>
              <td style="padding:6px 0;text-align:right;color:${CLR_EG};font-family:"DM Mono",monospace;font-size:10px">${fm(m.eg)}</td>
              <td style="padding:6px 0;text-align:right;color:${r>=0?CLR_ING:CLR_NEG};font-family:"DM Mono",monospace;font-weight:700;font-size:10px">${fm(r)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>

  <!-- Comparativo anual -->
  ${Object.keys(byYear).length>1?`
  <div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:18px 20px">
    <div style="font-size:11px;font-weight:700;color:var(--t);margin-bottom:14px">Comparativo anual</div>
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:4px 0;font-size:9px">Año</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Ingresos</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Egresos</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Resultado neto</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Margen</th>
      </tr></thead>
      <tbody>
        ${Object.entries(byYear).sort((a,b)=>b[0]-a[0]).map(([y,v])=>{
          const r=v.ing-v.eg, m2=v.ing>0?(r/v.ing*100):0;
          return `<tr style="border-top:1px solid var(--br)">
            <td style="padding:7px 0;font-weight:700;font-size:13px">${y}</td>
            <td style="padding:7px 0;text-align:right;color:${CLR_ING};font-family:"DM Mono",monospace">${fm(v.ing)}</td>
            <td style="padding:7px 0;text-align:right;color:${CLR_EG};font-family:"DM Mono",monospace">${fm(v.eg)}</td>
            <td style="padding:7px 0;text-align:right;color:${r>=0?CLR_ING:CLR_NEG};font-family:"DM Mono",monospace;font-weight:700">${fm(r)}</td>
            <td style="padding:7px 0;text-align:right;color:${m2>=20?CLR_ING:m2>=0?CLR_EG:CLR_NEG};font-family:"DM Mono",monospace;font-weight:600">${m2.toFixed(1)}%</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`:''}
  `;
}

// Facturación redirect — carga el mismo panel de cartera de dz
function renderFacuracion() {
  const body = $('facturacion-body');
  if(!body) return;
  body.innerHTML = '<div style="text-align:center;color:var(--t3);padding:40px;font-size:13px">Cargando facturaci\u00f3n...</div>';
  // Redirect logic: load DZ cartera into this body
  setTimeout(() => goTab('dz', document.querySelector('.ni.ni-diaz')), 300);
}

// ── COMPAT ────────────────────────────────────────────────────
let CONT_FILTER={tycoon:{cat:null,mes:null},diaz:{cat:null,mes:null}};
// contFiltrar removed — use fcFilt instead (unified filter function)

async function subirSoportePago(pagoId, numFactura, cliente, valorFactura, moneda, estadoActual, input) {
  if(!input.files || !input.files[0]) return;
  const file = input.files[0];
  if(file.size > 5*1024*1024) { toast('Archivo muy grande. Máximo 5MB','d'); return; }
  toast('Subiendo soporte...','ok');
  const ext = file.name.split('.').pop();
  const path = `diaz/factura-${numFactura}/pago-${pagoId}.${ext}`;
  const {error} = await db.storage.from('soportes-pagos').upload(path, file, {upsert:true});
  if(error) { toast('Error subiendo archivo: '+error.message,'d'); return; }
  const {data: urlData} = db.storage.from('soportes-pagos').getPublicUrl(path);
  // Get current obs
  const {data: pago} = await db.from('pagos_facturas').select('observaciones').eq('id',pagoId).single();
  const obsActual = pago?.observaciones || '';
  const {texto} = parseSoporte(obsActual);
  await db.from('pagos_facturas').update({
    observaciones: (texto||'') + (texto?' · ':'')+`[soporte:${urlData.publicUrl}]`
  }).eq('id', pagoId);
  toast('Soporte adjuntado ✓','ok');
  abrirPago(numFactura, cliente, valorFactura, moneda, estadoActual);
}

async function subirSoportePagoHistorial(pagoId, input) {
  if(!input.files || !input.files[0]) return;
  const file = input.files[0];
  if(file.size > 5*1024*1024) { toast('Archivo muy grande. Máximo 5MB','d'); return; }
  toast('Subiendo soporte...','ok');
  const ext = file.name.split('.').pop();
  const path = `diaz/pago-${pagoId}.${ext}`;
  const {error} = await db.storage.from('soportes-pagos').upload(path, file, {upsert:true});
  if(error) { toast('Error: '+error.message,'d'); return; }
  const {data: urlData} = db.storage.from('soportes-pagos').getPublicUrl(path);
  const {data: pago} = await db.from('pagos_facturas').select('observaciones,cliente_nombre').eq('id',pagoId).limit(1);
  const p = pago && pago[0];
  const {texto} = parseSoporte(p?.observaciones||'');
  await db.from('pagos_facturas').update({
    observaciones: (texto||'') + (texto?' · ':'')+`[soporte:${urlData.publicUrl}]`
  }).eq('id', pagoId);
  toast('Soporte adjuntado ✓','ok');
  if(p?.cliente_nombre) abrirHistorialCliente(p.cliente_nombre);
}

async function eliminarSoporteMov(movId, numContrato) {
  if(!confirm('¿Quitar el soporte adjunto de este movimiento?')) return;
  const {data: mov} = await db.from('movimientos').select('anotaciones').eq('id',movId).single();
  const {texto} = parseSoporte(mov?.anotaciones||'');
  await db.from('movimientos').update({anotaciones: texto||null}).eq('id', movId);
  toast('Soporte eliminado ✓','ok');
  editarMov(movId, numContrato);
}

async function subirSoporteMov(movId, numContrato, input) {
  if(!input.files || !input.files[0]) return;
  const file = input.files[0];
  if(file.size > 5*1024*1024) { toast('Archivo muy grande. Máximo 5MB','d'); return; }
  toast('Subiendo soporte...','ok');
  const ext = file.name.split('.').pop();
  const path = `tycoon/${numContrato}/mov-${movId}.${ext}`;
  const {error} = await db.storage.from('soportes-tycoon').upload(path, file, {upsert:true});
  if(error) { toast('Error: '+error.message,'d'); return; }
  const {data: urlData} = db.storage.from('soportes-tycoon').getPublicUrl(path);
  const {data: mov} = await db.from('movimientos').select('anotaciones').eq('id',movId).single();
  const {texto} = parseSoporte(mov?.anotaciones||'');
  await db.from('movimientos').update({
    anotaciones: (texto||'')+(texto?' · ':'')+`[soporte:${urlData.publicUrl}]`
  }).eq('id', movId);
  toast('Soporte adjuntado ✓','ok');
  editarMov(movId, numContrato);
}

// ── FILE HELPERS ─────────────────────────────────────────────
function previewFile(input, labelId) {
  const lbl = $(labelId);
  if(input.files && input.files[0]) {
    const f = input.files[0];
    const size = (f.size/1024/1024).toFixed(1);
    if(f.size > 5*1024*1024) {
      toast('Archivo muy grande. Máximo 5MB','d');
      input.value = '';
      lbl.textContent = 'JPG, PNG, PDF · máx 5MB';
      return;
    }
    lbl.textContent = `✅ ${f.name} (${size}MB)`;
    lbl.style.color = 'var(--ac)';
  }
}

function parseSoporte(obs) {
  if(!obs) return {texto:'', url:null, urls:[]};
  const urls = [];
  const rx = /\[soporte:(https?:\/\/[^\]]+)\]/g;
  let m; while((m=rx.exec(obs))!==null) urls.push(m[1]);
  const texto = obs.replace(/\[soporte:[^\]]+\]/g,'').trim();
  return {texto, url: urls[0]||null, urls};
}

// Adjuntar archivo acumulativo (no reemplaza los anteriores)
async function adjuntarArchivo(bucket, path, file, tablaActual, idReg, campoAnotaciones, textoActual) {
  const {error} = await db.storage.from(bucket).upload(path, file, {upsert:true});
  if(error){console.error(error);return false;}
  const {data: urlData} = db.storage.from(bucket).getPublicUrl(path);
  const nuevaUrl = '[soporte:'+urlData.publicUrl+']';
  const nuevasAnotaciones = (textoActual||'').replace(/\s*\[soporte:[^\]]+\]\s*/g,'').trim()
    + (tablaActual._soportes||[]).map(u=>'[soporte:'+u+']').join('') + nuevaUrl;
  return {nuevasAnotaciones, url: urlData.publicUrl};
}

// ── HISTORIAL CLIENTE DÍAZ ───────────────────────────────────
