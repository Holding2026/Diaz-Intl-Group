var TERCEROS_TY = [], TERCEROS_TY_FILTER = 'todos';
var TERCEROS_DZ = [], TERCEROS_DZ_FILTER = 'todos';

async function loadTercerosTY() {
  // Intentar tabla terceros_tycoon; si no existe, usar inversionistas como base
  const {data, error} = await db.from('terceros_tycoon').select('*').order('nombre');
  if (error) {
    // Tabla no existe aún — cargar desde inversionistas como fallback
    const {data: inv} = await db.from('inversionistas').select('id,nombre');
    TERCEROS_TY = (inv||[]).map(function(i,ix) {
      return {id:i.id, codigo:ix+1, nombre:i.nombre, tipo:'Inversionista', _fallback:true};
    });
    TY_TERCEROS_FALLBACK = true;
  } else {
    TERCEROS_TY = data || [];
    TY_TERCEROS_FALLBACK = false;
  }
  renderTercerosTY();
}

async function loadTercerosDZ() {
  const {data, error} = await db.from('terceros_diaz').select('*').order('nombre');
  if (error) {
    // Tabla no existe — cargar desde clientes_diaz
    const {data: cl} = await db.from('clientes_diaz').select('id,nombre_cliente');
    TERCEROS_DZ = (cl||[]).map(function(i,ix) {
      return {id:i.id, codigo:ix+1, nombre:i.nombre_cliente||'—', tipo:'Cliente', _fallback:true};
    });
    DZ_TERCEROS_FALLBACK = true;
  } else {
    TERCEROS_DZ = data || [];
    DZ_TERCEROS_FALLBACK = false;
  }
  renderTercerosDZ();
}

var TY_TERCEROS_FALLBACK = false, DZ_TERCEROS_FALLBACK = false;
var INV_PORT_LOADED = {tycoon:false, diaz:false};
var NOMINA_LOADED   = {tycoon:false, diaz:false};

function filterTercerosTY(tipo) {
  TERCEROS_TY_FILTER = tipo;
  ['todos','inversionista','proveedor','acreedor','empleado'].forEach(t => {
    var btn = $('tty-tab-'+t);
    if(!btn) return;
    var isOn = (tipo === 'todos' ? t === 'todos' : t === tipo.toLowerCase());
    btn.style.borderBottomColor = isOn ? '#DBE2E9' : 'transparent';
    btn.style.color = isOn ? '#DBE2E9' : 'var(--t3)';
  });
  renderTercerosTY();
}

function filterTercerosDZ(tipo) {
  TERCEROS_DZ_FILTER = tipo;
  ['todos','cliente','proveedor','acreedor','empleado'].forEach(t => {
    var btn = $('tdz-tab-'+t);
    if(!btn) return;
    var isOn = (tipo === 'todos' ? t === 'todos' : t === tipo.toLowerCase());
    btn.style.borderBottomColor = isOn ? '#00D5B0' : 'transparent';
    btn.style.color = isOn ? '#00D5B0' : 'var(--t3)';
  });
  renderTercerosDZ();
}

function renderTercerosTY() {
  var q = ($('tty-q')?.value||'').toLowerCase();
  var rows = TERCEROS_TY.filter(function(r) {
    if(TERCEROS_TY_FILTER !== 'todos' && (r.tipo||'') !== TERCEROS_TY_FILTER) return false;
    if(q && !(r.nombre||'').toLowerCase().includes(q) && !(r.email||'').toLowerCase().includes(q)) return false;
    return true;
  });
  if($('tty-bdg')) $('tty-bdg').textContent = rows.length + ' terceros';
  // Banner si está usando fallback
  var banner = $('tty-fallback-banner');
  if(TY_TERCEROS_FALLBACK && banner) {
    banner.style.display = '';
  } else if(banner) {
    banner.style.display = 'none';
  }
  var cols = {Inversionista:'#5B8DB8',Proveedor:'#d4870a',Acreedor:'#e06200',Socio:'#7C3AED','Empresa relacionada':'#185FA5',Empleado:'#00A98D'};
  if (!rows.length) {
    $('tty-body').innerHTML = '<tr><td colspan="9"><div class="mod-empty"><div class="mod-empty-icon">👥</div>Sin terceros registrados<br><span style="font-size:10px">Haz clic en <strong>+ Tercero</strong> para agregar el primero</span></div></td></tr>';
    return;
  }
  $('tty-body').innerHTML = rows.map(function(r,ix) {
    var col = cols[r.tipo] || '#5B6770';
    var id = String(r.id||'').replace(/'/g,'');
    return '<tr style="cursor:pointer" onclick="editarTercero(\''+id+'\',\'tycoon\')">'
      + '<td style="font-family:monospace;font-size:10px;color:var(--t3);padding:10px 8px">' + (r.codigo||ix+1) + '</td>'
      + '<td><div class="ic"><div class="iav" style="background:'+col+'18;color:'+col+';border:1px solid '+col+'30">'+ini(r.nombre||'?')+'</div><div class="inm">'+(r.nombre||'—')+'</div></div></td>'
      + '<td><span style="font-size:10px;padding:2px 9px;border-radius:12px;background:'+col+'18;color:'+col+'">'+(r.tipo||'—')+'</span></td>'
      + '<td style="font-size:11px;color:var(--t2)">'+(r.numero_documento||'—')+'</td>'
      + '<td style="font-size:11px;color:var(--t2)">'+(r.email||'—')+'</td>'
      + '<td style="font-size:11px;color:var(--t2)">'+(r.telefono||'—')+'</td>'
      + '<td style="font-size:11px;color:var(--t2)">'+(r.ciudad||'—')+'</td>'
      + '<td style="font-size:11px;color:var(--t3)">'+(r.vendedor||'—')+'</td>'
      + '<td><button onclick="event.stopPropagation();editarTercero(\''+id+'\',\'tycoon\')" style="font-size:10px;padding:3px 9px;border:1px solid var(--br);border-radius:5px;background:transparent;color:var(--t3);cursor:pointer">&#9998;</button></td>'
      + '</tr>';
  }).join('');
}

function renderTercerosDZ() {
  var q = ($('tdz-q')?.value||'').toLowerCase();
  var rows = TERCEROS_DZ.filter(function(r) {
    if(TERCEROS_DZ_FILTER !== 'todos' && (r.tipo||'') !== TERCEROS_DZ_FILTER) return false;
    if(q && !(r.nombre||'').toLowerCase().includes(q) && !(r.email||'').toLowerCase().includes(q)) return false;
    return true;
  });
  if($('tdz-bdg')) $('tdz-bdg').textContent = rows.length + ' terceros';
  var banner = $('tdz-fallback-banner');
  if(DZ_TERCEROS_FALLBACK && banner) {
    banner.style.display = '';
  } else if(banner) {
    banner.style.display = 'none';
  }
  var cols = {Cliente:'#00A98D',Proveedor:'#d4870a',Acreedor:'#e06200',Empleado:'#5B8DB8'};
  if (!rows.length) {
    $('tdz-body').innerHTML = '<tr><td colspan="9"><div class="mod-empty"><div class="mod-empty-icon">👥</div>Sin terceros registrados<br><span style="font-size:10px">Haz clic en <strong>+ Tercero</strong> para agregar el primero</span></div></td></tr>';
    return;
  }
  $('tdz-body').innerHTML = rows.map(function(r,ix) {
    var col = cols[r.tipo] || '#5B6770';
    var id = String(r.id||'').replace(/'/g,'');
    return '<tr style="cursor:pointer" onclick="editarTercero(\''+id+'\',\'diaz\')">'
      + '<td style="font-family:monospace;font-size:10px;color:var(--t3);padding:10px 8px">' + (r.codigo||ix+1) + '</td>'
      + '<td><div class="ic"><div class="iav" style="background:'+col+'18;color:'+col+';border:1px solid '+col+'30">'+ini(r.nombre||'?')+'</div><div class="inm">'+(r.nombre||'—')+'</div></div></td>'
      + '<td><span style="font-size:10px;padding:2px 9px;border-radius:12px;background:'+col+'18;color:'+col+'">'+(r.tipo||'—')+'</span></td>'
      + '<td style="font-size:11px;color:var(--t2)">'+(r.numero_documento||'—')+'</td>'
      + '<td style="font-size:11px;color:var(--t2)">'+(r.email||'—')+'</td>'
      + '<td style="font-size:11px;color:var(--t2)">'+(r.telefono||'—')+'</td>'
      + '<td style="font-size:11px;color:var(--t2)">'+(r.ciudad||'—')+'</td>'
      + '<td style="font-size:11px;color:var(--t3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(r.notas||'—')+'</td>'
      + '<td><button onclick="event.stopPropagation();editarTercero(\''+id+'\',\'diaz\')" style="font-size:10px;padding:3px 9px;border:1px solid var(--br);border-radius:5px;background:transparent;color:var(--t3);cursor:pointer">&#9998;</button></td>'
      + '</tr>';
  }).join('');
}

// ── NUEVO TERCERO (Tycoon o Díaz) ────────────────────────────
function openNuevoTercero(empresa) {
  var esDiaz = empresa === 'diaz';
  var tipos = esDiaz ? ['Cliente','Proveedor','Acreedor','Socio','Empresa relacionada','Empleado'] : ['Inversionista','Proveedor','Acreedor','Socio','Empresa relacionada','Empleado'];
  var col = esDiaz ? '#00A98D' : '#5B8DB8';
  var tabla = esDiaz ? 'terceros_diaz' : 'terceros_tycoon';
  var bucket = 'documentos-terceros';

  var fld = function(id, label, type) {
    type = type || 'text';
    return '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">'+label+'</div><input id="nt-'+id+'" type="'+type+'" placeholder="'+label+'..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>';
  };
  var sec = function(title) {
    return '<div style="font-size:9px;font-weight:700;color:var(--t3);letter-spacing:2px;text-transform:uppercase;padding:10px 0 6px;border-top:1px solid var(--br);margin-top:4px;font-family:monospace">'+title+'</div>';
  };

  $('m-t').textContent = 'Nuevo Tercero · ' + (esDiaz ? 'Díaz Intl' : 'Tycoon');
  $('m-s').textContent = tabla;

  var html = '<input type="hidden" id="nt-tabla" value="'+tabla+'">';

  // IDENTIDAD
  html += sec('Identidad');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('nombre','Nombre completo');
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Tipo</div><select id="nt-tipo" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'+tipos.map(function(t){return '<option>'+t+'</option>';}).join('')+'</select></div>';
  html += fld('cargo','Cargo / Rol');
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Tipo doc.</div><select id="nt-tipo_doc" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'+['Cédula','Pasaporte','NIT','SSN','Otro'].map(function(t){return '<option>'+t+'</option>';}).join('')+'</select></div>';
  html += fld('numero_documento','Número documento');
  html += '</div>';

  // CONTACTO
  html += sec('Contacto');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('email','Email','email') + fld('telefono','Teléfono','tel');
  html += fld('whatsapp','WhatsApp','tel') + fld('ciudad','Ciudad');
  html += fld('pais','País') + fld('direccion','Dirección');
  html += (esDiaz ? '' : fld('vendedor','Vendedor / Referido por'));
  html += '</div>';

  // DATOS LABORALES (solo si es empleado o puede ser)
  html += sec('Datos laborales');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('salario_base','Salario base','number');
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Periodicidad</div><select id="nt-periodicidad" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"><option value="">— Seleccionar —</option><option>Quincenal</option><option>Mensual</option><option>Por proyecto</option><option>Honorarios</option></select></div>';
  html += fld('fecha_ingreso','Fecha de ingreso','date');
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Tipo contrato</div><select id="nt-tipo_contrato" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"><option value="">— Seleccionar —</option><option>Término indefinido</option><option>Término fijo</option><option>Prestación de servicios</option><option>Obra o labor</option></select></div>';
  html += '</div>';

  // CUENTA BANCARIA
  html += sec('Cuenta bancaria / Pago');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Banco / Plataforma</div><select id="nt-banco" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"><option value="">— Seleccionar —</option><option>Bancolombia</option><option>Davivienda</option><option>BBVA</option><option>Nequi</option><option>Daviplata</option><option>Bre-B</option><option>Banco de Bogotá</option><option>Banco Popular</option><option>Colpatria</option><option>Scotiabank</option><option>Itaú</option><option>Otro</option></select></div>';
  html += '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Tipo cuenta</div><select id="nt-tipo_cuenta" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"><option value="">— Seleccionar —</option><option>Ahorros</option><option>Corriente</option><option>Billetera digital</option></select></div>';
  html += fld('numero_cuenta','Número de cuenta / Llave');
  html += fld('titular_cuenta','Titular de la cuenta');
  html += '</div>';

  // NOTAS
  html += sec('Notas');
  html += '<textarea id="nt-notas" rows="2" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t);font-size:12px;outline:none;resize:vertical;margin-bottom:4px"></textarea>';

  // DOCUMENTOS
  html += sec('Documentos');
  html += '<div style="font-size:10px;color:var(--t3);margin-bottom:8px">Adjunta contratos, identificación, certificados, etc.</div>';
  html += '<div id="nt-docs-list" style="margin-bottom:8px"></div>';
  html += '<label style="display:flex;align-items:center;gap:8px;background:var(--sf2);border:1px dashed var(--br);border-radius:7px;padding:9px 12px;cursor:pointer" id="nt-label-doc" style="cursor:pointer">';
  html += '<span style="font-size:16px">📎</span><div><div style="font-size:11px;color:var(--t)" id="nt-file-lbl">Agregar documento</div><div style="font-size:9px;color:var(--t3)">PDF, JPG, PNG — múltiples archivos permitidos</div></div>';
  html += '<input type="file" id="nt-files" multiple accept=".pdf,image/*,.doc,.docx" style="display:none" onchange="ntPreviewDocs(this)"></label>';
  html += '<div style="height:12px"></div>';

  html += '<button onclick="guardarNuevoTercero()" style="width:100%;background:'+col+';color:#fff;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:6px">Crear Tercero</button>';
  html += '<div id="nt-err" style="font-size:11px;color:var(--d);min-height:14px"></div>';

  $('m-b').innerHTML = html;
  $('ov').classList.add('on');
}

function ntPreviewDocs(input) {
  var list = $('nt-docs-list');
  var files = Array.from(input.files);
  list.innerHTML = files.map(function(f) {
    return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px;color:var(--t2)"><span>📄</span><span>'+f.name+'</span><span style="color:var(--t3);font-size:9px">('+Math.round(f.size/1024)+'KB)</span></div>';
  }).join('');
}

async function guardarNuevoTercero() {
  var tabla = $('nt-tabla').value;
  var nombre = ($('nt-nombre')?.value||'').trim();
  if(!nombre){ $('nt-err').textContent='El nombre es obligatorio'; return; }
  var btn = document.querySelector('#m-b button[onclick="guardarNuevoTercero()"]');
  if(btn){btn.textContent='Guardando...';btn.disabled=true;}

  // Generar código consecutivo
  var {data: existing} = await db.from(tabla).select('codigo').order('codigo',{ascending:false}).limit(1);
  var nextCod = existing && existing.length && existing[0].codigo ? existing[0].codigo + 1 : 1;

  // Upload documentos si los hay
  var docUrls = [];
  var filesEl = $('nt-files');
  if (filesEl && filesEl.files && filesEl.files.length) {
    for (var i=0; i<filesEl.files.length; i++) {
      var file = filesEl.files[i];
      var ext = file.name.split('.').pop();
      var path = tabla+'/'+Date.now()+'-'+i+'.'+ext;
      var {error: fileErr} = await db.storage.from('documentos-terceros').upload(path, file, {upsert:true});
      if (!fileErr) {
        var {data: urlData} = db.storage.from('documentos-terceros').getPublicUrl(path);
        docUrls.push(urlData.publicUrl);
      }
    }
  }

  // Payload base — campos que siempre existen
  var payload = {
    codigo: nextCod,
    nombre,
    tipo: $('nt-tipo')?.value||null,
    tipo_documento: $('nt-tipo_doc')?.value||null,
    numero_documento: ($('nt-numero_documento')?.value||'').trim()||null,
    email: ($('nt-email')?.value||'').trim()||null,
    telefono: ($('nt-telefono')?.value||'').trim()||null,
    whatsapp: ($('nt-whatsapp')?.value||'').trim()||null,
    ciudad: ($('nt-ciudad')?.value||'').trim()||null,
    pais: ($('nt-pais')?.value||'').trim()||null,
    direccion: ($('nt-direccion')?.value||'').trim()||null,
    notas: ($('nt-notas')?.value||'').trim()||null,
    vendedor: ($('nt-vendedor')?.value||'').trim()||null,
    created_at: new Date().toISOString()
  };

  // Campos opcionales — solo añadir si la columna existe en BD
  var cargo        = ($('nt-cargo')?.value||'').trim();
  var salario      = parseFloat($('nt-salario_base')?.value)||null;
  var periodicidad = $('nt-periodicidad')?.value||null;
  var fecha_ing    = $('nt-fecha_ingreso')?.value||null;
  var tipo_cont    = $('nt-tipo_contrato')?.value||null;
  var banco        = $('nt-banco')?.value||null;
  var tipo_cta     = $('nt-tipo_cuenta')?.value||null;
  var num_cta      = ($('nt-numero_cuenta')?.value||'').trim()||null;
  var titular      = ($('nt-titular_cuenta')?.value||'').trim()||null;

  if (cargo)        payload.cargo = cargo;
  if (salario)      payload.salario_base = salario;
  if (periodicidad) payload.periodicidad = periodicidad;
  if (fecha_ing)    payload.fecha_ingreso = fecha_ing;
  if (tipo_cont)    payload.tipo_contrato = tipo_cont;
  if (banco)        payload.banco = banco;
  if (tipo_cta)     payload.tipo_cuenta = tipo_cta;
  if (num_cta)      payload.numero_cuenta = num_cta;
  if (titular)      payload.titular_cuenta = titular;
  if (docUrls.length) payload.documentos = docUrls;

  Object.keys(payload).forEach(function(k){ if(payload[k]===null) delete payload[k]; });

  var {data: newRec, error} = await db.from(tabla).insert(payload).select('id').single();
  if(error){
    // Si falla por columna faltante, reintentar sin campos nuevos
    if(error.message && error.message.includes('column') && (error.message.includes('cargo') || error.message.includes('documentos'))) {
      delete payload.cargo;
      delete payload.documentos;
      var {error: e2} = await db.from(tabla).insert(payload);
      if(e2){$('nt-err').textContent='Error: '+e2.message;if(btn){btn.textContent='Crear Tercero';btn.disabled=false;}return;}
      toast('Tercero creado ✓ (ejecuta el SQL para habilitar cargo y documentos)','ok');
    } else {
      $('nt-err').textContent='Error: '+error.message;
      if(btn){btn.textContent='Crear Tercero';btn.disabled=false;}
      return;
    }
  } else {
    toast('Tercero "'+nombre+'" creado ✓','ok');
  }
  closeM();
  NC_TERCEROS_CACHE = {tycoon: null, diaz: null};
  if(tabla==='terceros_tycoon') await loadTercerosTY();
  else await loadTercerosDZ();
}

async function editarTercero(id, empresa) {
  var tabla = empresa === 'diaz' ? 'terceros_diaz' : 'terceros_tycoon';
  var {data: r} = await db.from(tabla).select('*').eq('id', id).single();
  if(!r){ toast('No encontrado','d'); return; }
  var col   = empresa === 'diaz' ? '#00A98D' : '#5B8DB8';
  var tipos = empresa === 'diaz' ? ['Cliente','Proveedor','Acreedor','Socio','Empresa relacionada','Empleado'] : ['Inversionista','Proveedor','Acreedor','Socio','Empresa relacionada','Empleado'];
  var bancos = ['','Bancolombia','Davivienda','BBVA','Nequi','Daviplata','Bre-B','Banco de Bogotá','Banco Popular','Colpatria','Scotiabank','Itaú','Otro'];
  var periodicidades = ['','Quincenal','Mensual','Por proyecto','Honorarios'];
  var tipo_contratos = ['','Término indefinido','Término fijo','Prestación de servicios','Obra o labor'];
  var tipo_docs = ['Cédula','Pasaporte','NIT','SSN','Otro'];

  var fld = function(id2, label, val, type) {
    type = type||'text';
    return '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">'+label+'</div>'
      +'<input id="et-'+id2+'" type="'+type+'" value="'+(val||'')+'" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>';
  };
  var sel = function(id2, label, opts, val) {
    return '<div><div style="font-size:9px;color:var(--t3);font-family:monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">'+label+'</div>'
      +'<select id="et-'+id2+'" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">'
      +opts.map(function(o){return '<option value="'+o+'" '+(val===o?'selected':'')+'>'+o+'</option>';}).join('')
      +'</select></div>';
  };
  var sec = function(title) {
    return '<div style="font-size:9px;font-weight:700;color:var(--t3);letter-spacing:2px;text-transform:uppercase;padding:10px 0 6px;border-top:1px solid var(--br);margin-top:4px;font-family:monospace">'+title+'</div>';
  };

  $('m-t').textContent = 'Editar Tercero · ' + r.nombre;
  $('m-s').textContent = (r.tipo||'') + ' · Código ' + (r.codigo||id);

  var html = '<input type="hidden" id="et-tabla" value="'+tabla+'"><input type="hidden" id="et-id" value="'+id+'">';

  // IDENTIDAD
  html += sec('Identidad');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('nombre','Nombre completo',r.nombre);
  html += sel('tipo','Tipo',tipos,r.tipo||'');
  html += fld('cargo','Cargo / Rol',r.cargo);
  html += sel('tipo_doc','Tipo documento',tipo_docs,r.tipo_documento||'Cédula');
  html += fld('numero_documento','Número documento',r.numero_documento);
  html += '</div>';

  // CONTACTO
  html += sec('Contacto');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('email','Email',r.email,'email');
  html += fld('telefono','Teléfono',r.telefono,'tel');
  html += fld('whatsapp','WhatsApp',r.whatsapp,'tel');
  html += fld('ciudad','Ciudad',r.ciudad);
  html += fld('pais','País',r.pais);
  html += fld('direccion','Dirección',r.direccion);
  if(empresa==='tycoon') html += fld('vendedor','Vendedor / Referido',r.vendedor);
  html += '</div>';

  // DATOS LABORALES
  html += sec('Datos laborales');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += fld('salario_base','Salario base',r.salario_base,'number');
  html += sel('periodicidad','Periodicidad',periodicidades,r.periodicidad||'');
  html += fld('fecha_ingreso','Fecha ingreso',r.fecha_ingreso,'date');
  html += sel('tipo_contrato','Tipo contrato',tipo_contratos,r.tipo_contrato||'');
  html += '</div>';

  // CUENTA BANCARIA
  html += sec('Cuenta bancaria / Pago');
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">';
  html += sel('banco','Banco / Plataforma',bancos,r.banco||'');
  html += sel('tipo_cuenta','Tipo cuenta',['','Ahorros','Corriente','Billetera digital'],r.tipo_cuenta||'');
  html += fld('numero_cuenta','Número de cuenta / Llave',r.numero_cuenta);
  html += fld('titular_cuenta','Titular',r.titular_cuenta);
  html += '</div>';

  // NOTAS
  html += sec('Notas');
  html += '<textarea id="et-notas" rows="2" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t);font-size:12px;outline:none;resize:vertical;margin-bottom:4px">'+(r.notas||'')+'</textarea>';

  html += '<button onclick="guardarEdicionTercero()" style="width:100%;background:'+col+';color:#fff;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:6px;margin-top:8px">Guardar cambios</button>';
  html += '<div id="et-err" style="font-size:11px;color:var(--d);min-height:14px"></div>';

  $('m-b').innerHTML = html;
  $('ov').classList.add('on');
}

async function guardarEdicionTercero() {
  var tabla = $('et-tabla').value;
  var id    = $('et-id').value;

  // Payload base siempre presente
  var payload = {
    nombre:           ($('et-nombre')?.value||'').trim(),
    tipo:             $('et-tipo')?.value||null,
    tipo_documento:   $('et-tipo_doc')?.value||null,
    numero_documento: ($('et-numero_documento')?.value||'').trim()||null,
    email:            ($('et-email')?.value||'').trim()||null,
    telefono:         ($('et-telefono')?.value||'').trim()||null,
    whatsapp:         ($('et-whatsapp')?.value||'').trim()||null,
    ciudad:           ($('et-ciudad')?.value||'').trim()||null,
    pais:             ($('et-pais')?.value||'').trim()||null,
    direccion:        ($('et-direccion')?.value||'').trim()||null,
    vendedor:         ($('et-vendedor')?.value||'').trim()||null,
    notas:            ($('et-notas')?.value||'').trim()||null,
    updated_at:       new Date().toISOString()
  };

  // Campos opcionales (columnas que pueden no existir aún)
  var extras = {
    cargo:          ($('et-cargo')?.value||'').trim()||null,
    salario_base:   parseFloat($('et-salario_base')?.value)||null,
    periodicidad:   $('et-periodicidad')?.value||null,
    fecha_ingreso:  $('et-fecha_ingreso')?.value||null,
    tipo_contrato:  $('et-tipo_contrato')?.value||null,
    banco:          $('et-banco')?.value||null,
    tipo_cuenta:    $('et-tipo_cuenta')?.value||null,
    numero_cuenta:  ($('et-numero_cuenta')?.value||'').trim()||null,
    titular_cuenta: ($('et-titular_cuenta')?.value||'').trim()||null
  };
  Object.keys(extras).forEach(function(k){ if(extras[k]) payload[k]=extras[k]; });
  Object.keys(payload).forEach(function(k){ if(payload[k]===null) delete payload[k]; });

  var {error} = await db.from(tabla).update(payload).eq('id', id);
  if(error){
    if($('et-err')) $('et-err').textContent='Error: '+error.message;
    return;
  }
  toast('Tercero actualizado ✓','ok');
  closeM();
  NC_TERCEROS_CACHE = {tycoon: null, diaz: null};
  if(tabla==='terceros_tycoon') await loadTercerosTY();
  else await loadTercerosDZ();
}

// ── NUEVA POSICIÓN KII ───────────────────────────────────────
async function openNuevaPosicionKII() {
  var {data: invList} = await db.from('inversionistas').select('id,nombre').order('nombre');
  var opts = (invList||[]).map(function(i){ return '<option value="'+i.id+'|'+i.nombre+'">'+i.nombre+'</option>'; }).join('');

  var fld = function(id, label, type) {
    type = type||'text';
    return '<div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">'+label+'</div><input id="nk-'+id+'" type="'+type+'" placeholder="'+label+'..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>';
  };

  $('m-t').textContent = 'Nueva Posición KII Exchange';
  $('m-s').textContent = 'Staking DIAS360 · 3%/mes';
  $('m-b').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
    '<div style="grid-column:span 2"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Inversionista</div>' +
    '<select id="nk-inv" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">' +
    '<option value="">— Seleccionar —</option>'+opts+'</select></div>' +
    fld('contrato','Código contrato (ej: TK50)') +
    fld('valor_inversion','Inversión USD','number') +
    fld('kii_coins','KII Coins','number') +
    fld('staking_acumulado','Staking acumulado','number') +
    fld('fecha_inversion','Fecha inversión','date') +
    fld('fecha_corte','Fecha de corte','date') +
    '</div>' +
    '<button onclick="guardarNuevaPosicionKII()" style="width:100%;background:rgba(199,169,248,0.8);color:#1a0f2e;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:6px">Crear Posición KII</button>' +
    '<div id="nk-err" style="font-size:11px;color:var(--d);min-height:14px"></div>';
  $('ov').classList.add('on');
}

async function guardarNuevaPosicionKII() {
  var invVal = $('nk-inv')?.value;
  if(!invVal){$('nk-err').textContent='Selecciona un inversionista';return;}
  var parts = invVal.split('|');
  var invId = parts[0], invNombre = parts[1];
  var contrato = ($('nk-contrato')?.value||'').trim().toUpperCase();
  if(!contrato){$('nk-err').textContent='El código de contrato es obligatorio';return;}
  var btn = document.querySelector('#m-b button[onclick="guardarNuevaPosicionKII()"]');
  if(btn){btn.textContent='Guardando...';btn.disabled=true;}
  var kii = parseFloat($('nk-kii_coins')?.value)||0;
  var staking = parseFloat($('nk-staking_acumulado')?.value)||0;
  var payload = {
    inversionista_id: invId||null,
    inversionista_nombre: invNombre,
    contrato,
    valor_inversion: parseFloat($('nk-valor_inversion')?.value)||0,
    kii_coins: kii,
    staking_acumulado: staking,
    total_tokens: kii + staking,
    fecha_inversion: $('nk-fecha_inversion')?.value||null,
    fecha_corte: $('nk-fecha_corte')?.value||null
  };
  var {error} = await db.from('posiciones_kii').insert(payload);
  if(error){$('nk-err').textContent='Error: '+error.message;if(btn){btn.textContent='Crear Posición KII';btn.disabled=false;}return;}
  toast('Posición '+contrato+' creada para '+invNombre+' ✓','ok');
  closeM();
  await loadKII();
}

// ── NUEVO CLIENTE DÍAZ ────────────────────────────────────────
function openNuevoClienteDiaz() {
  $('m-t').textContent = 'Nuevo Cliente · Díaz International';
  $('m-s').textContent = 'Se registrará en clientes_diaz';
  var fld = function(id, label, type) {
    type = type||'text';
    return '<div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">'+label+'</div><input id="nd-'+id+'" type="'+type+'" placeholder="'+label+'..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>';
  };
  $('m-b').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
    fld('nombre','Nombre / Razón social') +
    fld('tipo_doc','Tipo documento') +
    fld('num_doc','Número documento') +
    fld('email','Email','email') +
    fld('telefono','Teléfono','tel') +
    fld('ciudad','Ciudad') +
    fld('pais','País') +
    fld('programa','Programa / Servicio') +
    '</div>' +
    '<div style="margin-bottom:12px"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Notas</div>' +
    '<textarea id="nd-notas" rows="2" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t);font-size:12px;outline:none;resize:vertical"></textarea></div>' +
    '<button onclick="guardarNuevoClienteDiaz()" style="width:100%;background:#00A98D;color:#fff;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:6px">Crear Cliente</button>' +
    '<div id="nd-err" style="font-size:11px;color:var(--d);min-height:14px"></div>';
  $('ov').classList.add('on');
}

async function guardarNuevoClienteDiaz() {
  var nombre = ($('nd-nombre')?.value||'').trim();
  if(!nombre){$('nd-err').textContent='El nombre es obligatorio';return;}
  var btn = document.querySelector('#m-b button[onclick="guardarNuevoClienteDiaz()"]');
  if(btn){btn.textContent='Guardando...';btn.disabled=true;}
  var payload = {
    nombre_cliente: nombre,
    tipo_documento: ($('nd-tipo_doc')?.value||'').trim()||null,
    numero_documento: ($('nd-num_doc')?.value||'').trim()||null,
    email: ($('nd-email')?.value||'').trim()||null,
    telefono: ($('nd-telefono')?.value||'').trim()||null,
    ciudad: ($('nd-ciudad')?.value||'').trim()||null,
    pais: ($('nd-pais')?.value||'').trim()||null,
    programa_servicio: ($('nd-programa')?.value||'').trim()||null,
    notas: ($('nd-notas')?.value||'').trim()||null,
    created_at: new Date().toISOString()
  };
  Object.keys(payload).forEach(function(k){ if(payload[k]===null) delete payload[k]; });
  var {error} = await db.from('clientes_diaz').insert(payload);
  if(error){$('nd-err').textContent='Error: '+error.message;if(btn){btn.textContent='Crear Cliente';btn.disabled=false;}return;}
  toast('Cliente "'+nombre+'" creado ✓','ok');
  closeM();
}

// ── NUEVA FACTURA DÍAZ ────────────────────────────────────────
async function openNuevaFactura() {
  var {data: clientes} = await db.from('clientes_diaz').select('nombre_cliente').order('nombre_cliente');
  var optsCliente = (clientes||[]).map(function(c){ return '<option value="'+c.nombre_cliente+'">'+c.nombre_cliente+'</option>'; }).join('');

  var fld = function(id, label, type) {
    type = type||'text';
    return '<div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">'+label+'</div><input id="nf-'+id+'" type="'+type+'" placeholder="'+label+'..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none"></div>';
  };

  // Próximo número de factura
  var {data: lastFact} = await db.from('facturas_diaz').select('numero_factura').order('numero_factura',{ascending:false}).limit(1);
  var nextNum = lastFact && lastFact.length ? (parseInt(lastFact[0].numero_factura)||0)+1 : 1001;

  $('m-t').textContent = 'Nueva Factura · Díaz International';
  $('m-s').textContent = 'Número sugerido: ' + nextNum;
  $('m-b').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
    '<div style="grid-column:span 2"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Cliente</div>' +
    '<select id="nf-cliente" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">' +
    '<option value="">— Seleccionar cliente —</option>'+optsCliente+'</select></div>' +
    fld('numero','Número factura','number') +
    '<div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Moneda</div>' +
    '<select id="nf-moneda" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">' +
    '<option>USD</option><option>COP</option><option>EUR</option></select></div>' +
    fld('valor','Valor factura','number') +
    fld('fecha','Fecha factura','date') +
    fld('fecha_pago','Fecha pago programado','date') +
    fld('programa','Programa / Servicio') +
    '<div><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Estado inicial</div>' +
    '<select id="nf-estado" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">' +
    '<option>Pendiente</option><option>Abono</option><option>Pagada</option></select></div>' +
    fld('cuenta','Cuenta recaudo') +
    '</div>' +
    '<div style="margin-bottom:12px"><div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase">Observaciones</div>' +
    '<textarea id="nf-obs" rows="2" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;color:var(--t);font-size:12px;outline:none;resize:vertical"></textarea></div>' +
    '<button onclick="guardarNuevaFactura('+nextNum+')" style="width:100%;background:#00A98D;color:#fff;border:none;border-radius:7px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:6px">Crear Factura</button>' +
    '<div id="nf-err" style="font-size:11px;color:var(--d);min-height:14px"></div>';
  $('nf-numero').value = nextNum;
  $('nf-fecha').value = new Date().toISOString().split('T')[0];
  $('ov').classList.add('on');
}

async function guardarNuevaFactura(nextNumSug) {
  var cliente = $('nf-cliente')?.value;
  if(!cliente){$('nf-err').textContent='Selecciona un cliente';return;}
  var valor = parseFloat($('nf-valor')?.value)||0;
  if(!valor){$('nf-err').textContent='El valor es obligatorio';return;}
  var fecha = $('nf-fecha')?.value;
  if(!fecha){$('nf-err').textContent='La fecha es obligatoria';return;}
  var btn = document.querySelector('#m-b button[onclick^="guardarNuevaFactura"]');
  if(btn){btn.textContent='Guardando...';btn.disabled=true;}
  var payload = {
    numero_factura: parseInt($('nf-numero')?.value)||nextNumSug,
    cliente_nombre: cliente,
    valor,
    moneda: $('nf-moneda')?.value||'USD',
    estado: $('nf-estado')?.value||'Pendiente',
    fecha_factura: fecha,
    fecha_pago_programado: $('nf-fecha_pago')?.value||null,
    programa_servicio: ($('nf-programa')?.value||'').trim()||null,
    cuenta_recaudo: ($('nf-cuenta')?.value||'').trim()||null,
    observaciones: ($('nf-obs')?.value||'').trim()||null,
    año: new Date(fecha).getFullYear()
  };
  var {error} = await db.from('facturas_diaz').insert(payload);
  if(error){$('nf-err').textContent='Error: '+error.message;if(btn){btn.textContent='Crear Factura';btn.disabled=false;}return;}
  toast('Factura #'+payload.numero_factura+' creada ✓','ok');
  closeM();
  await loadDiaz();
}


// ══════════════════════════════════════════════════════════════
// MÓDULO INVERSIONES
// ══════════════════════════════════════════════════════════════
