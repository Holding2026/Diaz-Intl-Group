async function loadEmpresas() {
  const {data, error} = await db
    .from('empresas_holding')
    .select('*')
    .order('estado_code', {ascending:true})
    .order('nombre', {ascending:true});

  if(error) {
    console.error('empresas_holding:', error);
    toast('Error cargando empresas: '+error.message, 'd');
    return;
  }

  // Map DB columns to JS naming convention
  EMPRESAS_DATA = (data||[]).map(function(r){
    return {
      id: r.id,
      nombre: r.nombre,
      sigla: r.sigla||'',
      estado_registro: r.estado_registro||'',
      estado_code: r.estado_code||'fl',
      tipo_entidad: r.tipo_entidad||'LLC',
      doc_number: r.doc_number||'',
      fei: r.fei||'',
      direccion: r.direccion||'',
      ciudad: r.ciudad||'',
      estado: r.estado||'',
      zip: r.zip||'',
      registered_agent: r.registered_agent||'',
      agent_direccion: r.agent_direccion||'',
      fecha_registro: r.fecha_registro||'',
      status: r.status||'Active',
      color: r.color||'#378ADD',
      colorBg: r.color_bg||'rgba(55,138,221,.1)',
      colorText: r.color_text||'#185FA5',
      moneda: r.moneda||'',
      miembros: r.miembros||[],
      annual_reports: r.annual_reports||[],
      ownership: r.ownership||'',
      sunbiz_last: r.sunbiz_last||'',
      notas: r.notas||''
    };
  });

  renderEmpresasKPIs();
  renderEmpresasGrid();
  EMPRESAS_LOADED = true;
}

function renderEmpresasKPIs() {
  const total = EMPRESAS_DATA.length;
  const fl = EMPRESAS_DATA.filter(e=>e.estado_code==='fl').length;
  const de = EMPRESAS_DATA.filter(e=>e.estado_code==='de').length;
  const co = EMPRESAS_DATA.filter(e=>e.estado_code==='co').length;
  const curYear = new Date().getFullYear();
  const alDia = EMPRESAS_DATA.filter(e=>{
    if(!e.annual_reports || !e.annual_reports.length) return e.estado_code==='de'; // DE sin reports = exempt
    const hasPending = e.annual_reports.some(r=>r.status==='pending');
    if(hasPending) return false;
    const fy = e.annual_reports.filter(r=>r.status==='filed').map(r=>r.year);
    return fy.includes(curYear) || fy.includes(curYear-1);
  }).length;
  $('empresas-kpis').innerHTML=
    '<div class="stat"><div class="sl">Total empresas</div><div class="sv" style="color:var(--t1)">'+total+'</div></div>'
    +'<div class="stat"><div class="sl">Florida</div><div class="sv" style="color:#185FA5">'+fl+'</div></div>'
    +'<div class="stat"><div class="sl">Delaware</div><div class="sv" style="color:#7C3AED">'+de+'</div></div>'
    +'<div class="stat"><div class="sl">Colombia</div><div class="sv" style="color:#B8860B">'+co+'</div></div>'
    +'<div class="stat"><div class="sl">Al día</div><div class="sv" style="color:#059669">'+alDia+'</div></div>';
  $('empresas-subtitle').textContent=total+' entidades registradas';
}

function filtrarEmpresas(filtro,btn){
  EMPRESAS_FILTER=filtro;
  document.querySelectorAll('#empresas-filtros .fbtn').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');
  renderEmpresasGrid();
}

function renderEmpresasGrid(){
  const grid=$('empresas-grid'), detail=$('empresa-detail');
  grid.style.display='grid'; detail.style.display='none';
  let data=EMPRESAS_DATA;
  if(EMPRESAS_FILTER!=='todas') data=data.filter(e=>e.estado_code===EMPRESAS_FILTER);
  if(!data.length){grid.innerHTML='<div style="text-align:center;padding:40px;color:var(--t3)">No hay empresas con este filtro</div>';return;}
  const fl=data.filter(e=>e.estado_code==='fl'), de=data.filter(e=>e.estado_code==='de'), co=data.filter(e=>e.estado_code==='co');
  let h='';
  if(fl.length){
    h+='<div style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;text-transform:uppercase">Florida ('+fl.length+')</div>';
    h+=fl.map(empCardHTML).join('');
  }
  if(de.length){
    h+='<div style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;margin-top:8px;text-transform:uppercase">Delaware ('+de.length+')</div>';
    h+=de.map(empCardHTML).join('');
  }
  if(co.length){
    h+='<div style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;margin-top:8px;text-transform:uppercase">Colombia ('+co.length+')</div>';
    h+=co.map(empCardHTML).join('');
  }
  grid.innerHTML=h;
}

function empCardHTML(e){
  const ry=e.annual_reports.map(r=>r.year), has=e.annual_reports.length>0;
  const idLabel = e.estado_code==='co' ? 'NIT' : 'EIN';
  const renewLabel = e.estado_code==='co' ? 'Renovación Cámara Comercio' : 'Annual reports';
  const currentYear = new Date().getFullYear();
  const filedYears = e.annual_reports.filter(r=>r.status==='filed').map(r=>r.year);
  const hasPending = e.annual_reports.some(r=>r.status==='pending');
  const cardAlDia = hasPending ? false : (!e.annual_reports.length && e.estado_code==='de') || filedYears.includes(currentYear) || filedYears.includes(currentYear-1);
  return '<div class="emp-card" onclick="verEmpresaDetalle(\''+e.id+'\')">'
    +'<div class="emp-card-top"><div class="emp-dot '+(e.status==='Active'?'active':'inactive')+'"></div>'
    +'<div class="emp-name-lbl">'+e.nombre+'</div>'
    +'<div class="emp-state-pill '+e.estado_code+'">'+e.estado_registro+'</div></div>'
    +'<div class="emp-meta-row">'
    +'<div class="emp-meta-item">'+(e.estado_code==='co'?'Matrícula':'Doc#')+' <span class="val">'+e.doc_number+'</span></div>'
    +'<div class="emp-meta-item">'+idLabel+' <span class="val">'+e.fei+'</span></div>'
    +'<div class="emp-meta-item">Desde <span class="val">'+e.fecha_registro+'</span></div>'
    +(e.moneda?'<div class="emp-meta-item">Moneda <span class="val">'+e.moneda+'</span></div>':'')
    +'</div>'
    +(has
      ?'<div class="emp-annual-row"><span class="yr-lbl">'+renewLabel+':</span>'
        +e.annual_reports.map(r=>'<div class="yr-dot '+(r.status==='filed'?'ok':'miss')+'" title="'+r.year+': '+(r.status==='filed'?'Filed '+r.filed:'Pending')+'">'+String(r.year).slice(2)+'</div>').join('')
        +(cardAlDia
          ?'<span style="margin-left:auto" class="emp-status-badge al-dia">✓ Al día</span>'
          :'<span style="margin-left:auto" class="emp-status-badge pendiente">⏳ Pendiente</span>')
        +'</div>'
      :'<div style="padding:0 16px 12px;display:flex;align-items:center;justify-content:space-between">'
        +'<span style="font-size:.72rem;color:var(--t3)">'+(e.estado_code==='de'?'Entidad Delaware — exempt FL annual report':'Sin reportes registrados')+'</span>'
        +'<span class="emp-status-badge al-dia">✓ Activa</span></div>')
    +'</div>';
}

function empGetInitials(n){return n.split(' ').filter(w=>w.length>1).slice(0,2).map(w=>w[0].toUpperCase()).join('');}

function verEmpresaDetalle(id){
  const e=EMPRESAS_DATA.find(x=>x.id===id);
  if(!e) return;
  $('empresas-grid').style.display='none';
  const d=$('empresa-detail'); d.style.display='block';

  const mem=e.miembros.map(m=>
    '<div class="emp-member-row">'
    +'<div class="emp-member-initials" style="background:'+e.colorBg+';color:'+e.colorText+'">'+empGetInitials(m.nombre)+'</div>'
    +'<div><div class="emp-member-name">'+m.nombre+'</div><div class="emp-member-role">'+m.titulo+'</div></div>'
    +(m.pct?'<div class="emp-member-pct">'+m.pct+'</div>':'')
    +'</div>').join('');

  let ar='';
  if(e.annual_reports.length){
    // Determine current year and check if al-dia
    var currentYear = new Date().getFullYear();
    var filedYears = e.annual_reports.filter(r=>r.status==='filed').map(r=>r.year);
    var hasPendingAR = e.annual_reports.some(r=>r.status==='pending');
    var isAlDia = hasPendingAR ? false : (filedYears.includes(currentYear) || filedYears.includes(currentYear-1));
    // Section title based on country
    var arTitle = e.estado_code==='co' ? 'Renovaciones — Cámara de Comercio' : 'Annual reports — Sunbiz';
    var alDiaEntity = e.estado_code==='co' ? 'Cámara de Comercio' : 'Secretary of State';

    ar='<div class="emp-sect"><div class="emp-sect-title">'+arTitle+'</div>'
      +e.annual_reports.map(r=>
        '<div class="emp-ar-row"><div class="emp-ar-year">'+r.year+'</div>'
        +'<div class="emp-ar-date">'+(r.status==='filed'?'Filed '+r.filed:'Sin filing registrado')+'</div>'
        +'<div class="emp-ar-status '+r.status+'">'+(r.status==='filed'?'✓ Filed':'⏳ Pending')+'</div></div>'
      ).join('')
      +'<div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      +(isAlDia
        ?'<span class="emp-status-badge al-dia">✓ Al día con '+alDiaEntity+'</span>'
        :'<span class="emp-status-badge pendiente">⏳ Pendiente renovación '+currentYear+'</span>')
      +'<span style="font-size:.72rem;color:var(--t3)">Último filing: '+e.sunbiz_last+'</span></div></div>';
  } else if(e.estado_code==='de') {
    ar='<div class="emp-sect"><div class="emp-sect-title">Registro estatal</div>'
      +'<div style="font-size:.82rem;color:var(--t3);padding:8px 0">Entidad registrada en Delaware — no requiere annual report en Florida Sunbiz.<br>Verificar con Delaware Division of Corporations.</div>'
      +(e.notas?'<div style="font-size:.78rem;color:var(--t3);margin-top:6px;font-style:italic">'+e.notas+'</div>':'')
      +'</div>';
  } else {
    ar='<div class="emp-sect"><div class="emp-sect-title">Registro estatal</div>'
      +'<div style="font-size:.82rem;color:var(--t3);padding:8px 0">Sin reportes anuales registrados.</div>'
      +(e.notas?'<div style="font-size:.78rem;color:var(--t3);margin-top:6px;font-style:italic">'+e.notas+'</div>':'')
      +'</div>';
  }

  d.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><button class="emp-btn-back" onclick="renderEmpresasGrid()">← Volver a empresas</button><button class="btn-g" onclick="abrirFormEmpresa(\''+e.id+'\')" style="font-size:.78rem;padding:6px 14px">✎ Editar empresa</button></div>'
    +'<div class="emp-detail-card">'
    +'<div class="emp-detail-head">'
    +'<div class="emp-icon-box" style="background:'+e.colorBg+';color:'+e.colorText+'">'+e.sigla+'</div>'
    +'<div><div class="emp-detail-title">'+e.nombre+'</div>'
    +'<div class="emp-detail-sub">'+e.tipo_entidad+' · '+e.estado_registro+' · '+(e.estado_code==='co'?'Matrícula':'Doc#')+' '+e.doc_number+' · Desde '+e.fecha_registro+'</div></div></div>'

    +'<div class="emp-sect"><div class="emp-sect-title">Información legal</div>'
    +'<div class="emp-info-grid">'
    +'<div><div class="emp-f-label">'+(e.estado_code==='co'?'NIT':'EIN / FEI')+'</div><div class="emp-f-value">'+e.fei+'</div></div>'
    +'<div><div class="emp-f-label">Estado / país de registro</div><div class="emp-f-value">'+e.estado_registro+'</div></div>'
    +'<div><div class="emp-f-label">Dirección principal</div><div class="emp-f-value">'+e.direccion+'</div></div>'
    +'<div><div class="emp-f-label">Ciudad</div><div class="emp-f-value">'+e.ciudad+', '+e.estado+' '+e.zip+'</div></div>'
    +'<div><div class="emp-f-label">'+(e.estado_code==='co'?'Representante legal':'Agente registrado')+'</div><div class="emp-f-value">'+e.registered_agent+'</div></div>'
    +'<div><div class="emp-f-label">'+(e.estado_code==='co'?'Dir. notificación':'Dirección agente')+'</div><div class="emp-f-value">'+e.agent_direccion+'</div></div>'
    +'<div><div class="emp-f-label">Tipo de entidad</div><div class="emp-f-value">'+e.tipo_entidad+'</div></div>'
    +'<div><div class="emp-f-label">Status</div><div class="emp-f-value" style="color:#059669">'+e.status+'</div></div>'
    +(e.moneda?'<div><div class="emp-f-label">Moneda principal</div><div class="emp-f-value">'+e.moneda+'</div></div>':'')
    +'</div></div>'

    +'<div class="emp-sect"><div class="emp-sect-title">Miembros / socios ('+e.miembros.length+')</div>'
    +mem
    +(e.ownership?'<div style="font-size:.78rem;color:var(--t3);margin-top:8px;padding:6px 12px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid var(--br)">📋 Estructura: '+e.ownership+'</div>':'')
    +'</div>'
    +ar
    +(e.notas?'<div class="emp-sect"><div class="emp-sect-title">Notas</div><div style="font-size:.82rem;color:var(--t3)">'+e.notas+'</div></div>':'')
    +'</div>';
  window.scrollTo(0,0);
}

function abrirFormEmpresa(id){
  const isEdit = !!id;
  const e = isEdit ? EMPRESAS_DATA.find(x=>x.id===id) : {
    id:'new_'+Date.now(), nombre:'', sigla:'', estado_registro:'Florida', estado_code:'fl', tipo_entidad:'LLC',
    doc_number:'', fei:'', direccion:'', ciudad:'', estado:'FL', zip:'',
    registered_agent:'', agent_direccion:'', fecha_registro:new Date().getFullYear().toString(), status:'Active',
    color:'#378ADD', colorBg:'rgba(55,138,221,.1)', colorText:'#185FA5',
    miembros:[], annual_reports:[], sunbiz_last:'', notas:'', ownership:''
  };
  if(!e) return;

  $('m-t').textContent = isEdit ? 'Editar empresa' : 'Nueva empresa';
  $('m-s').textContent = isEdit ? e.nombre : 'Registrar nueva entidad del holding';

  const arHTML = (e.annual_reports||[]).map((r,i)=>
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px" data-ar-idx="'+i+'">'
    +'<input type="number" value="'+r.year+'" style="width:70px;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-ar-field="year">'
    +'<input type="text" value="'+r.filed+'" placeholder="MM/DD/YYYY" style="flex:1;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-ar-field="filed">'
    +'<select style="padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-ar-field="status">'
    +'<option value="filed"'+(r.status==='filed'?' selected':'')+'>Filed</option>'
    +'<option value="pending"'+(r.status==='pending'?' selected':'')+'>Pending</option></select>'
    +'<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:1.1rem;padding:2px 6px" title="Eliminar">✕</button>'
    +'</div>'
  ).join('');

  const memHTML = (e.miembros||[]).map((m,i)=>
    '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px" data-mem-idx="'+i+'">'
    +'<input type="text" value="'+m.nombre+'" placeholder="Nombre" style="flex:2;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-mem-field="nombre">'
    +'<input type="text" value="'+m.titulo+'" placeholder="Título" style="flex:1;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-mem-field="titulo">'
    +'<input type="text" value="'+(m.pct||'')+'" placeholder="%" style="width:65px;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-mem-field="pct">'
    +'<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:1.1rem;padding:2px 6px" title="Eliminar">✕</button>'
    +'</div>'
  ).join('');

  $('m-b').innerHTML = '<div style="padding:16px;max-height:70vh;overflow-y:auto" id="form-empresa">'
    +'<div style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;text-transform:uppercase;margin-bottom:8px">Información general</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      +'<div><label class="emp-f-label">Nombre legal</label><input id="fe-nombre" type="text" value="'+e.nombre+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div>'
      +'<div><label class="emp-f-label">Sigla</label><input id="fe-sigla" type="text" value="'+e.sigla+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem" maxlength="4"></div>'
      +'<div><label class="emp-f-label">Estado / país de registro</label><select id="fe-estado-reg" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem">'
        +'<option value="fl"'+(e.estado_code==='fl'?' selected':'')+'>Florida</option>'
        +'<option value="de"'+(e.estado_code==='de'?' selected':'')+'>Delaware</option>'
        +'<option value="co"'+(e.estado_code==='co'?' selected':'')+'>Colombia</option></select></div>'
      +'<div><label class="emp-f-label">Tipo entidad</label><input id="fe-tipo" type="text" value="'+e.tipo_entidad+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div>'
      +'<div><label class="emp-f-label">Doc# / Sunbiz</label><input id="fe-doc" type="text" value="'+e.doc_number+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div>'
      +'<div><label class="emp-f-label">EIN / FEI</label><input id="fe-fei" type="text" value="'+e.fei+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div>'
      +'<div><label class="emp-f-label">Año de registro</label><input id="fe-year" type="text" value="'+e.fecha_registro+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div>'
      +'<div><label class="emp-f-label">Status</label><select id="fe-status" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem">'
        +'<option value="Active"'+(e.status==='Active'?' selected':'')+'>Active</option>'
        +'<option value="Inactive"'+(e.status==='Inactive'?' selected':'')+'>Inactive</option>'
        +'<option value="Dissolved"'+(e.status==='Dissolved'?' selected':'')+'>Dissolved</option></select></div>'
    +'</div>'

    +'<div style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;text-transform:uppercase;margin:16px 0 8px">Dirección</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      +'<div style="grid-column:span 2"><label class="emp-f-label">Dirección principal</label><input id="fe-dir" type="text" value="'+e.direccion+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div>'
      +'<div><label class="emp-f-label">Ciudad</label><input id="fe-ciudad" type="text" value="'+e.ciudad+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label class="emp-f-label">Estado</label><input id="fe-est" type="text" value="'+e.estado+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem" maxlength="2"></div>'
      +'<div><label class="emp-f-label">ZIP</label><input id="fe-zip" type="text" value="'+e.zip+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div></div>'
    +'</div>'

    +'<div style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;text-transform:uppercase;margin:16px 0 8px">Agente registrado</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      +'<div><label class="emp-f-label">Nombre agente</label><input id="fe-agent" type="text" value="'+e.registered_agent+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div>'
      +'<div><label class="emp-f-label">Dirección agente</label><input id="fe-agent-dir" type="text" value="'+e.agent_direccion+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem"></div>'
    +'</div>'

    +'<div style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;text-transform:uppercase;margin:16px 0 8px">Estructura de propiedad</div>'
    +'<div><label class="emp-f-label">Ownership (ej: Tycoon 50% + Aqua Elite 50%)</label><input id="fe-ownership" type="text" value="'+(e.ownership||'')+'" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem;margin-bottom:8px"></div>'

    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
      +'<span style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;text-transform:uppercase">Miembros / socios</span>'
      +'<button onclick="addMemberRow()" class="btn-g" style="font-size:.72rem;padding:4px 10px">+ Miembro</button></div>'
    +'<div id="fe-members">' + memHTML + '</div>'

    +'<div style="display:flex;align-items:center;justify-content:space-between;margin:16px 0 6px">'
      +'<span style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;text-transform:uppercase">Annual reports</span>'
      +'<button onclick="addARRow()" class="btn-g" style="font-size:.72rem;padding:4px 10px">+ Report</button></div>'
    +'<div id="fe-annual">' + arHTML + '</div>'

    +'<div style="font-size:.72rem;font-weight:700;color:var(--t3);letter-spacing:.7px;text-transform:uppercase;margin:16px 0 8px">Notas</div>'
    +'<textarea id="fe-notas" rows="3" style="width:100%;padding:7px 10px;border:1px solid var(--br);border-radius:8px;background:var(--surface);color:var(--t1);font-size:.85rem;resize:vertical">'+((e.notas||'').replace(/"/g,'&quot;'))+'</textarea>'

    +'<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid var(--br)">'
      +'<button class="btn-g" style="background:transparent;border:1px solid var(--br);color:var(--t2)" onclick="closeM()">Cancelar</button>'
      +'<button class="btn-g" onclick="guardarEmpresa(\''+e.id+'\','+isEdit+')" style="min-width:140px">'+(isEdit?'Guardar cambios':'Crear empresa')+'</button>'
    +'</div>'
  +'</div>';

  const ov=$('ov'); ov.classList.add('on'); ov.setAttribute('data-lock','1');
}

function addMemberRow(){
  const c=$('fe-members');
  const d=document.createElement('div');
  d.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:4px';
  d.innerHTML='<input type="text" placeholder="Nombre" style="flex:2;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-mem-field="nombre">'
    +'<input type="text" placeholder="Título (MGR, Clase A...)" style="flex:1;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-mem-field="titulo">'
    +'<input type="text" placeholder="%" style="width:65px;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-mem-field="pct">'
    +'<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:1.1rem;padding:2px 6px" title="Eliminar">✕</button>';
  c.appendChild(d);
}

function addARRow(){
  const c=$('fe-annual');
  const d=document.createElement('div');
  d.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:4px';
  d.innerHTML='<input type="number" value="'+new Date().getFullYear()+'" style="width:70px;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-ar-field="year">'
    +'<input type="text" placeholder="MM/DD/YYYY" style="flex:1;padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-ar-field="filed">'
    +'<select style="padding:5px 8px;border:1px solid var(--br);border-radius:6px;background:var(--surface);color:var(--t1);font-size:.82rem" data-ar-field="status">'
    +'<option value="filed">Filed</option><option value="pending">Pending</option></select>'
    +'<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:1.1rem;padding:2px 6px" title="Eliminar">✕</button>';
  c.appendChild(d);
}

async function guardarEmpresa(id, isEdit){
  const stCode = $('fe-estado-reg').value;
  const stName = stCode==='fl'?'Florida':stCode==='de'?'Delaware':'Colombia';

  // Collect members
  const memRows = document.querySelectorAll('#fe-members > div');
  const miembros = [];
  memRows.forEach(row=>{
    const inputs = row.querySelectorAll('input');
    if(inputs.length>=2 && inputs[0].value.trim()){
      miembros.push({nombre:inputs[0].value.trim(), titulo:inputs[1].value.trim(), pct:inputs[2]?inputs[2].value.trim():''});
    }
  });

  // Collect annual reports
  const arRows = document.querySelectorAll('#fe-annual > div');
  const annual = [];
  arRows.forEach(row=>{
    const yearIn = row.querySelector('[data-ar-field="year"]');
    const filedIn = row.querySelector('[data-ar-field="filed"]');
    const statusIn = row.querySelector('[data-ar-field="status"]');
    if(yearIn && filedIn && yearIn.value){
      annual.push({year:parseInt(yearIn.value), filed:filedIn.value.trim(), status:statusIn?statusIn.value:'filed'});
    }
  });

  const nombre = $('fe-nombre').value.trim();
  if(!nombre){ toast('El nombre legal es requerido','d'); return; }

  // Colors
  let color, colorBg, colorText, moneda='';
  if(isEdit){
    const orig = EMPRESAS_DATA.find(x=>x.id===id);
    if(orig){ color=orig.color; colorBg=orig.colorBg; colorText=orig.colorText; moneda=orig.moneda||''; }
  }
  if(!color){
    const colors = [{c:'#378ADD',bg:'rgba(55,138,221,.1)',t:'#185FA5'},{c:'#D85A30',bg:'rgba(216,90,48,.1)',t:'#993C1D'},{c:'#534AB7',bg:'rgba(83,74,183,.1)',t:'#534AB7'},{c:'#1D9E75',bg:'rgba(29,158,117,.1)',t:'#0F6E56'}];
    const pick = colors[EMPRESAS_DATA.length % colors.length];
    color=pick.c; colorBg=pick.bg; colorText=pick.t;
  }

  const sortedAR = annual.sort((a,b)=>a.year-b.year);

  // Build DB row (snake_case for Supabase columns)
  const row = {
    id: isEdit ? id : ($('fe-sigla').value.trim().toLowerCase() || nombre.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20)) + '_' + Date.now(),
    nombre: nombre,
    sigla: $('fe-sigla').value.trim().toUpperCase(),
    estado_registro: stName,
    estado_code: stCode,
    tipo_entidad: $('fe-tipo').value.trim() || 'LLC',
    doc_number: $('fe-doc').value.trim(),
    fei: $('fe-fei').value.trim(),
    direccion: $('fe-dir').value.trim(),
    ciudad: $('fe-ciudad').value.trim(),
    estado: $('fe-est').value.trim().toUpperCase(),
    zip: $('fe-zip').value.trim(),
    registered_agent: $('fe-agent').value.trim(),
    agent_direccion: $('fe-agent-dir').value.trim(),
    fecha_registro: $('fe-year').value.trim(),
    status: $('fe-status').value,
    color: color,
    color_bg: colorBg,
    color_text: colorText,
    moneda: moneda || (stCode==='co'?'COP':null),
    miembros: miembros,
    annual_reports: sortedAR,
    ownership: $('fe-ownership').value.trim() || null,
    sunbiz_last: sortedAR.length ? sortedAR[sortedAR.length-1].filed : (stCode==='de' ? 'Delaware — sin annual report FL' : ''),
    notas: $('fe-notas').value.trim() || null
  };

  // Disable button while saving
  const btns = document.querySelectorAll('#form-empresa button');
  const saveBtn = btns[btns.length-1];
  if(saveBtn){ saveBtn.textContent='Guardando...'; saveBtn.disabled=true; }

  let error;
  if(isEdit){
    const {error: e} = await db.from('empresas_holding').update(row).eq('id', id);
    error = e;
  } else {
    const {error: e} = await db.from('empresas_holding').insert(row);
    error = e;
  }

  if(error){
    toast('Error guardando: '+error.message, 'd');
    console.error('empresas_holding save:', error);
    if(saveBtn){ saveBtn.textContent=isEdit?'Guardar cambios':'Crear empresa'; saveBtn.disabled=false; }
    return;
  }

  closeM();
  toast(isEdit ? 'Empresa actualizada ✓' : 'Empresa creada ✓', 'ok');
  // Reload from DB
  await loadEmpresas();
}

