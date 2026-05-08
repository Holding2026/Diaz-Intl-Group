var INV_PORT_DATA = {tycoon:[], diaz:[]};

async function loadInvPort(empresa) {
  var slug = empresa === 'tycoon' ? 'ty' : 'dz';
  if($('inv-port-'+slug+'-kpis')) $('inv-port-'+slug+'-kpis').innerHTML = '<div style="grid-column:span 4;text-align:center;color:var(--t3);padding:16px">⏳ Cargando...</div>';

  var {data, error} = await db.from('inversiones').select('*').eq('empresa', empresa).order('created_at',{ascending:false});

  if (error) {
    if($('inv-port-'+slug+'-body')) $('inv-port-'+slug+'-body').innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--d);padding:20px">Error: '+error.message+'</td></tr>';
    return;
  }

  INV_PORT_DATA[empresa] = data || [];
  renderInvPort(empresa);
}

function renderInvPort(empresa) {
  var slug = empresa === 'tycoon' ? 'ty' : 'dz';
  var rows = INV_PORT_DATA[empresa];
  var col  = empresa === 'tycoon' ? '#5B8DB8' : '#00A98D';

  var totalInv = rows.reduce(function(a,r){return a+(r.valor_inversion||0);},0);
  var totalPag = rows.reduce(function(a,r){return a+(r.pago_parcial||0);},0);
  var totalPor = rows.reduce(function(a,r){return a+(r.por_pagar||0);},0);
  var activos  = rows.filter(function(r){return r.estado==='Activo';}).length;

  var kpiHtml = [
    ['Inversiones','total registradas',rows.length,'var(--t)'],
    ['Total invertido','valor portafolio',fm(totalInv),col],
    ['Capital pagado','efectivamente pagado',fm(totalPag),'#00D5B0'],
    ['Por pagar','saldo pendiente',fm(totalPor),totalPor>0?'var(--or)':'#00D5B0']
  ].map(function(k){
    return '<div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:14px 16px;border-top:2px solid '+k[3]+'">'
      +'<div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">'+k[0]+'</div>'
      +'<div style="font-size:18px;font-weight:700;color:'+k[3]+';font-family:monospace">'+k[2]+'</div>'
      +'<div style="font-size:9px;color:var(--t3);margin-top:2px">'+k[1]+'</div></div>';
  }).join('');
  if($('inv-port-'+slug+'-kpis')) $('inv-port-'+slug+'-kpis').innerHTML = kpiHtml;

  var body = $('inv-port-'+slug+'-body');
  if (!body) return;

  var estCol = {Activo:'#00A98D',Inactivo:'#5B6770','Proceso Legal':'#e06200',Otro:'#d4870a'};

  body.innerHTML = rows.length ? rows.map(function(r) {
    var ec = estCol[r.estado]||'var(--t3)';
    var docs = r.documentos && r.documentos.length
      ? r.documentos.map(function(u,i){return '<a href="'+u+'" target="_blank" style="font-size:9px;color:'+col+';text-decoration:none">📄'+(i+1)+'</a>';}).join(' ')
      : '<span style="color:var(--t3);font-size:10px">—</span>';
    return '<tr>'
      +'<td style="font-size:11px;font-weight:600;color:var(--t)">'+(r.plataforma||'—')+'</td>'
      +'<td style="font-size:11px;color:var(--t2)">'+(r.proyecto||'—')+'</td>'
      +'<td style="font-size:10px;color:var(--t3);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(r.descripcion||'')+'">'+(r.descripcion||'—')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;font-weight:600;color:'+col+'">'+(r.valor_inversion?fm(r.valor_inversion):'—')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;color:#00D5B0">'+(r.pago_parcial?fm(r.pago_parcial):'—')+'</td>'
      +'<td style="font-family:monospace;font-size:11px;color:'+(r.por_pagar>0?'var(--or)':'var(--t3)')+'">'+(r.por_pagar?fm(r.por_pagar):'—')+'</td>'
      +'<td style="font-size:10px;color:var(--t2)">'+(r.moneda||'USD')+'</td>'
      +'<td style="font-size:10px;color:var(--t2)">'+(r.beneficiario||'—')+'</td>'
      +'<td style="font-size:10px;color:var(--t2)">'+(r.fecha_inicial?fd(r.fecha_inicial):'—')+'</td>'
      +'<td style="font-size:10px;color:var(--t2)">'+(r.fecha_final&&r.fecha_final!=='Indefinido'?fd(r.fecha_final):'Indefinido')+'</td>'
      +'<td><span style="font-size:10px;padding:2px 8px;border-radius:10px;background:'+ec+'18;color:'+ec+'">'+(r.estado||'—')+'</span></td>'
      +'<td>'+docs+'</td>'
      +'<td><button onclick="editarInversion(this.dataset.id)" data-id="'+r.id+'" style="font-size:9px;padding:2px 8px;border:1px solid var(--br);border-radius:5px;background:transparent;color:var(--t3);cursor:pointer">&#9998;</button></td>'
      +'</tr>';
  }).join('') : '<tr><td colspan="13"><div class="mod-empty"><div class="mod-empty-icon">💼</div>Sin inversiones registradas<br><span style="font-size:10px">Haz clic en <strong>+ Inversión</strong> para agregar la primera</span></div></td></tr>';
}

async function openNuevaInversion(empresa) {
  var col   = empresa === 'tycoon' ? '#5B8DB8' : '#00A98D';
  var label = empresa === 'tycoon' ? 'Tycoon Guru' : 'Díaz International';

  var fld = function(id, lbl, type) {
    type = type||'text';
    return '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">'+lbl+'</div><input id="ninv-'+id+'" type="'+type+'" placeholder="'+lbl+'..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>';
  };
  var sec = function(title) {
    return '<div style="font-size:9px;font-weight:700;color:var(--t3);letter-spacing:2px;text-transform:uppercase;padding:10px 0 6px;border-top:1px solid var(--br);margin-top:4px;font-family:monospace">'+title+'</div>';
  };
  var sel = function(id, lbl, opts) {
    return '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">'+lbl+'</div><select id="ninv-'+id+'" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'+opts.map(function(o){return '<option>'+o+'</option>';}).join('')+'</select></div>';
  };

  $('m-t').textContent = 'Nueva Inversión · '+label;
  $('m-s').textContent = 'Tabla: inversiones';

  var html = '<input type="hidden" id="ninv-empresa" value="'+empresa+'">';
  html += sec('Proyecto');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('plataforma','Plataforma de inversión');
  html += fld('proyecto','Nombre del proyecto');
  html += '</div>';
  html += '<div style="margin-bottom:8px"><div style="font-size:9px;color:var(--t3);font-family:monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Descripción</div><textarea id="ninv-descripcion" rows="2" placeholder="Descripción del proyecto..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t);font-size:12px;outline:none;resize:vertical"></textarea></div>';

  html += sec('Valor');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('valor_inversion','Total inversión','number');
  html += fld('pago_parcial','Valor pagado','number');
  html += fld('por_pagar','Por pagar','number');
  html += sel('moneda','Moneda',['USD','EUR','COP','CRYPTO','Otro']);
  html += fld('beneficiario','Propietario / Beneficiario');
  html += fld('ubicacion','Ubicación geográfica');
  html += '</div>';

  html += sec('Fechas y estado');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('fecha_inicial','Fecha inicial','date');
  html += fld('fecha_final','Fecha final (o Indefinido)');
  html += sel('estado','Estado',['Activo','Inactivo','Proceso Legal','Otro']);
  html += fld('tipo','Tipo documento');
  html += '</div>';

  html += sec('Notas');
  html += '<textarea id="ninv-notas" rows="2" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t);font-size:12px;outline:none;resize:vertical;margin-bottom:4px"></textarea>';

  html += sec('Documentos de soporte');
  html += '<div id="ninv-docs-list" style="margin-bottom:8px"></div>';
  html += '<label style="display:flex;align-items:center;gap:8px;background:var(--sf2);border:1px dashed var(--br);border-radius:7px;padding:9px 12px;cursor:pointer" id="nt-label-doc" style="cursor:pointer">';
  html += '<span style="font-size:16px">📎</span><div><div style="font-size:11px;color:var(--t)">Agregar documentos</div><div style="font-size:9px;color:var(--t3)">Contratos, certificados, PDF, imágenes</div></div>';
  html += '<input type="file" id="ninv-files" multiple accept=".pdf,image/*,.doc,.docx" style="display:none" onchange="ninvPreviewDocs(this)"></label>';
  html += '<div style="height:12px"></div>';

  html += '<button onclick="guardarNuevaInversion()" style="width:100%;background:'+col+';color:#fff;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:6px">Crear Inversión</button>';
  html += '<div id="ninv-err" style="font-size:11px;color:var(--d);min-height:14px"></div>';
  $('m-b').innerHTML = html;
  $('ov').classList.add('on');
}

function ninvPreviewDocs(input) {
  var list = $('ninv-docs-list');
  if(!list) return;
  list.innerHTML = Array.from(input.files).map(function(f){
    return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;color:var(--t2)"><span>📄</span><span>'+f.name+'</span><span style="color:var(--t3);font-size:9px">('+Math.round(f.size/1024)+'KB)</span></div>';
  }).join('');
}

async function guardarNuevaInversion() {
  var empresa = $('ninv-empresa').value;
  var proyecto = ($('ninv-proyecto')?.value||'').trim();
  if(!proyecto) { $('ninv-err').textContent='El nombre del proyecto es obligatorio'; return; }
  var btn = document.querySelector('#m-b button[onclick="guardarNuevaInversion()"]');
  if(btn){btn.textContent='Guardando...';btn.disabled=true;}

  // Upload docs
  var docUrls = [];
  var filesEl = $('ninv-files');
  if(filesEl && filesEl.files && filesEl.files.length) {
    for(var i=0;i<filesEl.files.length;i++) {
      var file = filesEl.files[i];
      var ext = file.name.split('.').pop();
      var path = 'inversiones/'+empresa+'/'+Date.now()+'-'+i+'.'+ext;
      var {error: fe} = await db.storage.from('documentos-terceros').upload(path, file, {upsert:true});
      if(!fe) {
        var {data: ud} = db.storage.from('documentos-terceros').getPublicUrl(path);
        docUrls.push(ud.publicUrl);
      }
    }
  }

  var pago = parseFloat($('ninv-pago_parcial')?.value)||0;
  var total = parseFloat($('ninv-valor_inversion')?.value)||0;
  var porPagar = parseFloat($('ninv-por_pagar')?.value)||(total-pago)||0;

  var payload = {
    empresa,
    plataforma: ($('ninv-plataforma')?.value||'').trim()||null,
    proyecto,
    descripcion: ($('ninv-descripcion')?.value||'').trim()||null,
    valor_inversion: total||null,
    pago_parcial: pago||null,
    por_pagar: porPagar||null,
    moneda: $('ninv-moneda')?.value||'USD',
    beneficiario: ($('ninv-beneficiario')?.value||'').trim()||null,
    ubicacion: ($('ninv-ubicacion')?.value||'').trim()||null,
    fecha_inicial: $('ninv-fecha_inicial')?.value||null,
    fecha_final: ($('ninv-fecha_final')?.value||'Indefinido').trim()||'Indefinido',
    estado: $('ninv-estado')?.value||'Activo',
    tipo: ($('ninv-tipo')?.value||'').trim()||null,
    notas: ($('ninv-notas')?.value||'').trim()||null,
    documentos: docUrls.length ? docUrls : null,
    created_at: new Date().toISOString()
  };
  Object.keys(payload).forEach(function(k){if(payload[k]===null)delete payload[k];});

  var {error} = await db.from('inversiones').insert(payload);
  if(error){$('ninv-err').textContent='Error: '+error.message;if(btn){btn.textContent='Crear Inversión';btn.disabled=false;}return;}
  toast('Inversión "'+proyecto+'" creada ✓','ok');
  closeM();
  await loadInvPort(empresa);
}

async function editarInversion(id) {
  toast('Editando inversión...','ok');
  // TODO: abrir modal de edición
}

// ══════════════════════════════════════════════════════════════
// MÓDULO NÓMINA
// ══════════════════════════════════════════════════════════════
var NOMINA_DATA = {tycoon:[], diaz:[]};
var NOMINA_FILTER = {tycoon:'todos', diaz:'todos'};

