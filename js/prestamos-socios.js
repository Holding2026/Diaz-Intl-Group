async function loadPrestamos() {
  const body = $('prestamos-body');
  if(!body) return;
  body.innerHTML = '<div style="text-align:center;color:var(--t3);padding:40px">Cargando...</div>';

  const {data: rows, error} = await db.from('cont_prestamos_socios').select('*').order('año,mes');
  if(error || !rows) { body.innerHTML = '<div style="text-align:center;color:var(--d);padding:40px">Error cargando datos</div>'; return; }

  PRESTAMOS_LOADED = true;

  // Totals
  const socios = ['juan','diego_sergio'];
  const nomSocio = {juan:'Juan García', diego_sergio:'Diego Díaz + Sergio'};
  const colSocio = {juan:'#C7A9F8', diego_sergio:'#9AD1F7'};
  const totales = {};
  socios.forEach(s => {
    const r = rows.filter(x=>x.socio===s);
    const prest = r.filter(x=>!x.es_abono).reduce((a,x)=>a+(x.total_usd||0),0);
    const abono = r.filter(x=>x.es_abono).reduce((a,x)=>a+(x.total_usd||0),0);
    totales[s] = {prest, abono, saldo: prest-abono, count: r.length};
  });
  const totalGlobal = Object.values(totales).reduce((a,t)=>a+t.saldo,0);

  // By year
  const byYear = {};
  rows.forEach(r => {
    const y = r.año||'?';
    if(!byYear[y]) byYear[y] = {juan:0, diego_sergio:0};
    const val = (r.total_usd||0) * (r.es_abono?-1:1);
    if(byYear[y][r.socio] !== undefined) byYear[y][r.socio] += val;
  });

  // By category
  const byCat = {};
  rows.filter(r=>!r.es_abono).forEach(r => {
    const c = r.categoria||'Sin categoría';
    byCat[c] = (byCat[c]||0) + (r.total_usd||0);
  });
  const topCats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxCat = topCats[0]?.[1]||1;

  body.innerHTML = `
  <!-- KPIs socios -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
    ${socios.map(s=>`
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:16px;border-top:3px solid ${colSocio[s]}">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">${nomSocio[s]}</div>
      <div style="font-size:20px;font-weight:700;color:${colSocio[s]};font-family:'Syne',sans-serif">${fm(totales[s].saldo)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
        <div style="font-size:10px;color:var(--t3)">Prestado<br><span style="color:#e74c3c;font-family:"DM Mono",monospace;font-size:11px">${fm(totales[s].prest)}</span></div>
        <div style="font-size:10px;color:var(--t3)">Abonado<br><span style="color:#2ecc71;font-family:"DM Mono",monospace;font-size:11px">${fm(totales[s].abono)}</span></div>
      </div>
      <div style="font-size:9px;color:var(--t3);margin-top:6px">${totales[s].count} registros</div>
    </div>`).join('')}
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:16px;border-top:3px solid #e74c3c">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Pasivo total a Tycoon</div>
      <div style="font-size:22px;font-weight:700;color:#e74c3c;font-family:'Syne',sans-serif">${fm(totalGlobal)}</div>
      <div style="font-size:10px;color:var(--t3);margin-top:8px">Deuda neta acumulada<br>2023 – 2026</div>
      <div style="font-size:9px;color:var(--t3);margin-top:6px">${rows.length} registros totales</div>
    </div>
  </div>

  <!-- Por año + top cats -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Préstamos por año</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;color:var(--t3);font-weight:500;padding:3px 0;font-size:9px">Año</th>
          <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Juan</th>
          <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Diego+Sergio</th>
          <th style="text-align:right;color:var(--t3);font-weight:500;font-size:9px">Total</th>
        </tr></thead>
        <tbody>
          ${Object.entries(byYear).sort((a,b)=>a[0]-b[0]).map(([y,v])=>{
            const tot=v.juan+v.diego_sergio;
            return `<tr style="border-top:1px solid var(--br)">
              <td style="padding:5px 0;font-weight:600">${y}</td>
              <td style="padding:5px 0;text-align:right;font-family:"DM Mono",monospace;font-size:10px;color:#C7A9F8">${fm(v.juan)}</td>
              <td style="padding:5px 0;text-align:right;font-family:"DM Mono",monospace;font-size:10px;color:#9AD1F7">${fm(v.diego_sergio)}</td>
              <td style="padding:5px 0;text-align:right;font-family:"DM Mono",monospace;font-size:10px;font-weight:700;color:${tot<0?'#2ecc71':'#e74c3c'}">${fm(tot)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Top destino de préstamos</div>
      ${topCats.map(([cat,val])=>{const p=(val/maxCat*100).toFixed(0); return `<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><div style="font-size:10px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">${cat}</div><div style="font-size:10px;font-family:"DM Mono",monospace;color:#e74c3c;font-weight:600">${fm(val)}</div></div><div style="height:4px;background:var(--br);border-radius:2px"><div style="height:4px;width:${p}%;background:#e74c3c;opacity:0.6;border-radius:2px"></div></div></div>`;}).join('')}
    </div>
  </div>

  <!-- Tabla detalle -->
  <div style="background:var(--sf);border:1px solid var(--br);border-radius:10px;padding:14px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1.5px;text-transform:uppercase">Detalle de movimientos</div>
      <div style="display:flex;gap:8px;align-items:center">
        <span onclick="filtrarPrestamos('todos')" id="ps-f-todos" style="cursor:pointer;padding:4px 10px;border-radius:6px;font-size:10px;background:rgba(199,169,248,0.15);color:#C7A9F8;border:1px solid rgba(199,169,248,0.3)">Todos</span>
        <span onclick="filtrarPrestamos('juan')" id="ps-f-juan" style="cursor:pointer;padding:4px 10px;border-radius:6px;font-size:10px;background:var(--sf2);color:var(--t2);border:1px solid var(--br)">Juan</span>
        <span onclick="filtrarPrestamos('diego_sergio')" id="ps-f-diego" style="cursor:pointer;padding:4px 10px;border-radius:6px;font-size:10px;background:var(--sf2);color:var(--t2);border:1px solid var(--br)">Diego+Sergio</span>
        <input id="ps-search" oninput="buscarPrestamos()" placeholder="🔍 Buscar..." class="srch" style="width:130px;padding:4px 8px;font-size:10px">
      </div>
    </div>
    <div class="tw-scroll" style="max-height:400px;overflow-y:auto">
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px;white-space:nowrap">Año/Mes</th>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Socio</th>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Categoría</th>
        <th style="text-align:left;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Concepto</th>
        <th style="text-align:right;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Monto USD</th>
        <th style="text-align:center;color:var(--t3);font-weight:500;padding:5px 8px;font-size:9px">Tipo</th>
      </tr></thead>
      <tbody id="ps-tbody">
        ${rows.slice().reverse().map(r=>`<tr class="ps-tr" data-socio="${r.socio}" style="border-top:1px solid var(--br)">
          <td style="padding:5px 8px;color:var(--t3);font-family:"DM Mono",monospace;white-space:nowrap;font-size:10px">${r.año||''}${r.mes?' / '+['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][r.mes]:''}</td>
          <td style="padding:5px 8px;font-size:10px"><span style="color:${r.socio==='juan'?'#C7A9F8':'#9AD1F7'};font-weight:600">${r.socio==='juan'?'Juan':'Diego+Sergio'}</span></td>
          <td style="padding:5px 8px;font-size:10px;color:var(--t2)">${r.categoria||'—'}</td>
          <td style="padding:5px 8px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(r.concepto||'').replace(/"/g,'&quot;')}">${r.concepto||'—'}</td>
          <td style="padding:5px 8px;text-align:right;font-family:"DM Mono",monospace;font-weight:600;color:${r.es_abono?'#2ecc71':'#e74c3c'};font-size:10px">${fm(r.total_usd||0)}</td>
          <td style="padding:5px 8px;text-align:center"><span style="font-size:9px;padding:2px 6px;border-radius:4px;background:${r.es_abono?'rgba(46,204,113,0.1)':'rgba(231,76,60,0.1)'};color:${r.es_abono?'#2ecc71':'#e74c3c'}">${r.es_abono?'Abono':'Préstamo'}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
  </div>`;
}

let PS_FILT_SOCIO = 'todos';
function filtrarPrestamos(socio) {
  PS_FILT_SOCIO = socio;
  ['todos','juan','diego'].forEach(s => {
    const id = s==='todos'?'ps-f-todos':s==='juan'?'ps-f-juan':'ps-f-diego';
    const el = document.getElementById(id);
    const active = (s===socio)||(s==='todos'&&socio==='todos');
    if(el) { el.style.background = active?'rgba(199,169,248,0.15)':'var(--sf2)'; el.style.color = active?'#C7A9F8':'var(--t2)'; el.style.border = active?'1px solid rgba(199,169,248,0.3)':'1px solid var(--br)'; }
  });
  buscarPrestamos();
}
function buscarPrestamos() {
  const q = (document.getElementById('ps-search')?.value||'').toLowerCase();
  document.querySelectorAll('#ps-tbody tr.ps-tr').forEach(tr => {
    const sMatch = PS_FILT_SOCIO==='todos' || tr.dataset.socio===PS_FILT_SOCIO || (PS_FILT_SOCIO==='diego'&&tr.dataset.socio==='diego_sergio');
    const tMatch = !q || tr.textContent.toLowerCase().includes(q);
    tr.style.display = (sMatch&&tMatch)?'':'none';
  });
}

// ── CONTABILIDAD · FLUJO DE CAJA (solo admin) ─────────────────
let CONT_LOADED = false;
let CONTDIAZ_LOADED = false;
let FC_CUENTAS = {tycoon:[], diaz:[]};
let FC_CATS = {tycoon:[], diaz:[]}; // Categorías POR EMPRESA
let FC_FILT = {tycoon:{cuenta:null,mes:null,tipo:null}, diaz:{cuenta:null,mes:null,tipo:null}};

const FC_RULES = [
  {k:['Rappi','Uber Eats','UBER EATS','UberEats','Cheesecake','Rusty Pelica','Lola Bar','GreenG Juice','Kelly','Gelato','TST*','G3ASTRO','OXXO','ALTAMAR','MIRADOR','ANDRES CARTAGENA','FRISBY','DMARCHA','SEKUSHI','REEF '], cat:'Comida/Entretenimiento'},
  {k:['UBER *TRIP','UBER * TRIP'], cat:'Rentas'},
  {k:['T-Mobile','TMOBILE','AGI*TMO','TMO SERVICE'], cat:'Teléfonos'},
  {k:['GOOGLE','Microsoft','MICROSOFT','Adobe','DigitalOcean','DIGITALOCEAN','Coin Stats','COIN STATS','Paramount','PARAMOUNT','Amazon Digi','AMAZON DIG','Shaklee','MV AGENCY','BY AFRO','READ - MEETING','myvocal','MYVOCAL'], cat:'Cuotas y Subscripciones Mensuales/Anuales'},
  {k:['Monthly Fee','Bank Adv Relationship'], cat:'Cargos Bancarios'},
  {k:['INTERNATIONAL TRANSACTION FEE'], cat:'Cargos Bancarios'},
  {k:['IRS','USATAXPYMT'], cat:'IRS - Taxes'},
  {k:['Hotel','HOTEL','Holiday Inn','HOTELES RILUX','HOTEL LAS AMERICA'], cat:'Viajes'},
  {k:['Avianca','AEROVIAS','HOT NH MEX CITY'], cat:'Viajes'},
  {k:['AMAZON MKTPL','Amazon Mktpl','Walgreens','WALGREENS','IFIX AND REPAIR','WYNWOOD'], cat:'Miscelaneous'},
  {k:['WU *','Western Union'], cat:'Pagos Inversionistas'},
  {k:['Zelle payment from','WIRE TYPE:WIRE IN','GoFundMe','Counter Credit','PAYPAL IAT'], cat:'Depositos Otros'},
  {k:['Zelle payment to SANTIAGO','Zelle payment to YAZMIN','Zelle payment to KAREN','Zelle payment to EVA','Zelle payment to CAROLINA'], cat:'Pagos Inversionistas'},
  {k:['PARKING','ECONOMY PARK'], cat:'Tarifas de Estacionamiento/Peajes'},
];

