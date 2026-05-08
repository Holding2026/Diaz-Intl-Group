async function openInvFicha(nombreBusqueda) {
  $('inv-ov').classList.add('on');
  $('inv-modal-body').innerHTML = '<div style="text-align:center;color:var(--t3);padding:40px">Cargando...</div>';

  // Buscar directamente en INV_DATA (ya correctamente agrupado, sin ambigüedad)
  let invEntry = null;
  if(INV_DATA && INV_DATA.length) {
    // Match exacto primero
    invEntry = INV_DATA.find(i => i.nombre.trim().toLowerCase() === nombreBusqueda.trim().toLowerCase());
    // Si no hay match exacto, buscar por todas las palabras
    if(!invEntry) {
      const palabras = nombreBusqueda.toLowerCase().trim().split(/\s+/).filter(w=>w.length>1);
      const candidatos = INV_DATA.filter(i => {
        const n = i.nombre.toLowerCase();
        return palabras.every(w => n.includes(w));
      });
      // Si hay un único candidato, usarlo. Si hay varios, preferir el más corto (más específico)
      if(candidatos.length === 1) invEntry = candidatos[0];
      else if(candidatos.length > 1) invEntry = candidatos.sort((a,b)=>a.nombre.length-b.nombre.length)[0];
    }
  }

  // Si aún no lo encontramos, cargar datos frescos
  if(!invEntry) {
    if(!TYC_DATA.length) await loadTycoon();
    if(!KII_DATA.length) await loadKII();
  }

  const tyContratos = invEntry ? invEntry.tycoon : [];
  const kiiContratos = invEntry ? invEntry.kii : [];

  // Buscar ficha en tabla inversionistas por nombre exacto
  let inv = null;
  try {
    const {data} = await db.from('inversionistas').select('*').ilike('nombre', nombreBusqueda.trim());
    if(data && data.length) inv = data[0];
    // Si no, buscar con ilike parcial pero exigir que el nombre del resultado sea igual al buscado
    if(!inv) {
      const palabras = nombreBusqueda.toLowerCase().trim().split(/\s+/).filter(w=>w.length>2);
      const apellido = palabras[palabras.length-1] || palabras[0];
      const {data: d2} = await db.from('inversionistas').select('*').ilike('nombre', `%${apellido}%`);
      if(d2) {
        const exact = d2.find(i => i.nombre.trim().toLowerCase() === nombreBusqueda.trim().toLowerCase());
        inv = exact || null;
      }
    }
  } catch(e) { console.error('Error buscando inversionista:', e); }

  INV_CURRENT = {
    id: inv?.id || null,
    nombre: inv?.nombre || nombreBusqueda,
    inv: inv || null,
    tycoon: tyContratos,
    kii: kiiContratos
  };

  INV_EDIT_MODE = false;
  INV_TAB = 'resumen';

  // Set header
  const col = PAL[Math.abs(nombreBusqueda.charCodeAt(0) + nombreBusqueda.length) % PAL.length];
  const avatarEl = $('inv-av-lg');
  avatarEl.style.background = col+'22';
  avatarEl.style.color = col;
  avatarEl.style.border = `1px solid ${col}44`;
  avatarEl.textContent = ini(INV_CURRENT.nombre);
  $('inv-head-name').textContent = INV_CURRENT.nombre;

  const tyNums = tyContratos.map(c=>c.numero).join(' · ');
  const kiiNums = kiiContratos.map(k=>k.contrato).join(' · ');
  $('inv-head-sub').textContent = [tyNums, kiiNums].filter(Boolean).join(' | ') || 'Sin contratos registrados';

  // Reset tabs UI
  document.querySelectorAll('.inv-tab').forEach(t=>t.classList.remove('on'));
  document.querySelector('.inv-tab').classList.add('on');
  $('inv-foot').style.display = 'none';
  $('inv-edit-btn').textContent = '✎ Editar';

  await renderInvTab('resumen');
}

function closeInvModal() {
  $('inv-ov').classList.remove('on');
  INV_EDIT_MODE = false;
  INV_CURRENT = null;
}

function toggleInvEdit() {
  INV_EDIT_MODE = !INV_EDIT_MODE;
  $('inv-edit-btn').textContent = INV_EDIT_MODE ? '✕ Cancelar' : '✎ Editar';
  $('inv-foot').style.display = INV_EDIT_MODE ? 'flex' : 'none';
  renderInvTab(INV_TAB);
}

async function switchInvTab(tab, el) {
  document.querySelectorAll('.inv-tab').forEach(t=>t.classList.remove('on'));
  if(el) el.classList.add('on');
  INV_TAB = tab;
  await renderInvTab(tab);
}

let INV_RENDERING = false;
async function renderInvTab(tab) {
  if(INV_RENDERING) return;
  INV_RENDERING = true;
  INV_TAB = tab;
  const body = document.getElementById('inv-modal-body');
  if(!body) { INV_RENDERING = false; return; }
  body.innerHTML = '<div style="text-align:center;color:var(--t3);padding:30px">Cargando...</div>';
  try {
    if(tab === 'resumen') await renderInvResumen(body);
    else if(tab === 'perfil') await renderInvPerfil(body);
    else if(tab === 'banking') await renderInvBanking(body);
    else if(tab === 'beneficiarios') await renderInvBeneficiarios(body);
  } catch(e) {
    console.error('Error en tab '+tab+':', e);
    body.innerHTML = `<div style="text-align:center;padding:30px">
      <div style="color:var(--d);font-size:13px;margin-bottom:8px">Error cargando ${tab}</div>
      <div style="color:var(--t3);font-size:11px">${e.message}</div>
      <button class="btn btn-g" style="margin-top:12px" onclick="renderInvTab('${tab}')">↻ Reintentar</button>
    </div>`;
  } finally {
    INV_RENDERING = false;
  }
}

async function renderInvResumen(body) {
  if(!INV_CURRENT) { body.innerHTML='<div style="text-align:center;color:var(--t3);padding:40px">Sin inversionista seleccionado</div>'; return; }

  let ty = [], kii = [];

  // Usar los contratos ya agrupados en INV_CURRENT (vienen de INV_DATA, sin ambigüedad)
  ty  = INV_CURRENT.tycoon || [];
  kii = INV_CURRENT.kii    || [];

  // Si hay ID pero no contratos cargados, intentar query directa por ID
  if(!ty.length && !kii.length && INV_CURRENT.id) {
    try {
      const tyRes = await db.from('contratos_tycoon')
        .select('numero,nombre_inversionista,valor_inicial,saldo_actual,tipo_liquidacion,estado,fecha_inicio,fecha_vencimiento')
        .eq('inversionista_id', INV_CURRENT.id);
      ty = tyRes.data || [];
    } catch(e) { console.error('[INV] tycoon error:', e); }
    try {
      const kiiRes = await db.from('posiciones_kii').select('*').eq('inversionista_id', INV_CURRENT.id);
      kii = kiiRes.data || [];
    } catch(e) { console.error('[INV] kii error:', e); }
  }

  // Update header
  const tyNums = ty.map(c=>c.numero).join(' · ');
  const kiiNums = kii.map(k=>k.contrato).join(' · ');
  if($('inv-head-sub')) $('inv-head-sub').textContent = [tyNums, kiiNums].filter(Boolean).join(' | ') || 'Sin contratos registrados';

  const tySaldo  = ty.reduce((a,c)=>a+(Number(c.saldo_actual)||0),0);
  const tyCapital = ty.reduce((a,c)=>a+(Number(c.valor_inicial)||0),0);
  const kiiTokens = kii.reduce((a,k)=>a+(Number(k.total_tokens)||0),0);
  const kiiValor  = kiiTokens * 0.02;
  const kiiInv    = kii.reduce((a,k)=>a+(Number(k.valor_inversion)||0),0);

  let html = '';

  // Stats cards
  html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
    <div class="stat" style="border-top:2px solid var(--ac)">
      <div class="sl">Saldo Tycoon</div>
      <div class="sv" style="font-size:16px;color:#00D5B0">${fm(tySaldo)}</div>
      <div class="sd">${ty.length} contrato${ty.length!==1?'s':''}</div>
    </div>
    <div class="stat" style="border-top:2px solid #9AD1F7">
      <div class="sl">Valor KII</div>
      <div class="sv" style="font-size:16px;color:#9AD1F7">${fm(kiiValor)}</div>
      <div class="sd">${kii.length} posición${kii.length!==1?'es':''}</div>
    </div>
    <div class="stat" style="border-top:2px solid var(--w)">
      <div class="sl">Total Holding</div>
      <div class="sv" style="font-size:16px;color:var(--w)">${fm(tySaldo + kiiValor)}</div>
      <div class="sd">Tycoon + KII</div>
    </div>
  </div>`;

  // Tycoon contracts
  if(ty.length) {
    html += `<div class="inv-sec"><div class="inv-sec-title">Contratos Tycoon</div>`;
    ty.forEach(c => {
      const vd = c.fecha_vencimiento;
      const d = vd ? Math.floor((new Date(vd+'T12:00:00') - new Date())/(1000*60*60*24)) : 999;
      const dColor = d<30?'var(--or)':d<180?'var(--w)':'var(--t3)';
      const estadoPill = c.estado==='On Hold'
        ? `<span class="pill ph"><span class="dot"></span>On Hold</span>`
        : c.estado==='Terminado'
        ? `<span class="pill pd"><span class="dot"></span>Terminado</span>`
        : c.estado==='Liquidado'
        ? `<span class="pill pw"><span class="dot"></span>Liquidado</span>`
        : `<span class="pill pg"><span class="dot"></span>Activo</span>`;
      html += `<div style="background:var(--sf2);border:1px solid var(--br);border-radius:9px;padding:12px 14px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="closeInvModal();setTimeout(()=>openPerfil('${c.numero}'),100)">
            <span class="mn" style="color:var(--bl);font-size:13px">${c.numero}</span>
            <span style="font-size:10px;color:var(--t2)">${c.tipo_liquidacion}</span>
            ${estadoPill}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:9px;color:${dColor};font-family:"DM Mono",monospace">${fd(vd)}</span>
            <button onclick="event.stopPropagation();closeInvModal();setTimeout(()=>editarContrato('${c.numero}'),100)" style="background:rgba(91,141,184,0.13);border:1px solid rgba(91,141,184,0.35);border-radius:6px;padding:4px 11px;color:#5B8DB8;font-size:10px;font-weight:600;cursor:pointer">&#9998; Editar</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <div><div class="inv-label">Capital inicial</div><div style="font-family:"DM Mono",monospace;font-size:11px">${fm(c.valor_inicial)}</div></div>
          <div><div class="inv-label">Saldo actual</div><div style="font-family:"DM Mono",monospace;font-size:11px;color:#00D5B0;font-weight:700">${fm(c.saldo_actual)}</div></div>
          <div><div class="inv-label">Crecimiento</div><div style="font-family:"DM Mono",monospace;font-size:11px;color:${
            (() => {
              const diff = (c.saldo_actual||0) - (c.valor_inicial||0);
              if(diff >= 0) return 'var(--bl)'; // green: grew
              if(c.estado === 'Activo') return 'var(--d)'; // red only if active and losing
              return 'var(--t3)'; // grey: on hold/terminated = likely withdrawal
            })()
          };font-weight:500">${c.valor_inicial?((((c.saldo_actual||0)-c.valor_inicial)/c.valor_inicial)*100).toFixed(1)+'%':'—'}</div></div>
        </div>
        <div style="font-size:9px;color:var(--t3);margin-top:6px">Clic para ver historial completo →</div>
      </div>`;
    });
    html += '</div>';
  }

  // KII positions
  if(kii.length) {
    html += `<div class="inv-sec"><div class="inv-sec-title">Posiciones KII Exchange</div>`;
    kii.forEach(k => {
      const stPct = k.kii_coins>0 ? ((k.staking_acumulado/k.kii_coins)*100).toFixed(1) : 0;
      html += `<div style="background:var(--sf2);border:1px solid var(--br);border-radius:9px;padding:12px 14px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span class="mn" style="color:#9AD1F7;font-size:13px">${k.contrato}</span>
          <span style="font-size:9px;color:var(--t3)">${fd(k.fecha_inversion)}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          <div><div class="inv-label">Inversión</div><div style="font-family:"DM Mono",monospace;font-size:11px">${fm(k.valor_inversion)}</div></div>
          <div><div class="inv-label">KII Coins</div><div style="font-family:"DM Mono",monospace;font-size:11px">${fmk(k.kii_coins)}</div></div>
          <div><div class="inv-label">Staking (${stPct}%)</div><div style="font-family:"DM Mono",monospace;font-size:11px;color:#9AD1F7">${fmk(k.staking_acumulado)}</div></div>
          <div><div class="inv-label">Valor @$0.02</div><div style="font-family:"DM Mono",monospace;font-size:11px;color:#9AD1F7;font-weight:700">${fm((k.total_tokens||0)*0.02)}</div></div>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  if(!ty.length && !kii.length) {
    html += `<div style="text-align:center;color:var(--t3);padding:40px">Sin contratos registrados en Tycoon o KII</div>`;
  }

  console.log('[INV] setting body.innerHTML, html length:', html.length);
  body.innerHTML = html;
  console.log('[INV] done');
}

async function renderInvPerfil(body) {
  let perfil = null;
  if(INV_CURRENT.id) {
    const {data} = await db.from('inversionistas_perfil')
      .select('*')
      .eq('inversionista_id', INV_CURRENT.id)
      .limit(1);
    perfil = data && data.length ? data[0] : null;
  }

  // Show warning if no ID but still render form
  const noIdWarning = !INV_CURRENT.id ? `
    <div style="background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.3);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:11px;color:var(--w)">
      ⚠ Este inversionista no tiene ID en la tabla principal. Los datos no se pueden guardar hasta que sea registrado correctamente.
    </div>` : '';

  const p = perfil || {};
  const edit = INV_EDIT_MODE;
  const f = (key, label, type='text', options=null) => {
    const val = p[key] || '';
    if(edit) {
      if(options) {
        return `<div class="inv-field"><label class="inv-label">${label}</label>
          <select class="inv-select" id="pf_${key}">
            <option value="">— Seleccionar —</option>
            ${options.map(o=>`<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}
          </select></div>`;
      }
      return `<div class="inv-field"><label class="inv-label">${label}</label>
        <input class="inv-input" id="pf_${key}" type="${type}" value="${val}" placeholder="${label}..."></div>`;
    }
    return `<div class="inv-field"><div class="inv-label">${label}</div>
      <div class="inv-val ${!val?'empty':''}">${val||'Sin registrar'}</div></div>`;
  };

  body.innerHTML = noIdWarning + `
    <div class="inv-sec">
      <div class="inv-sec-title">Identidad</div>
      <div class="inv-grid three">
        ${f('nombre_legal','Nombre legal completo')}
        ${f('nombre_contrato','Nombre en contrato')}
        ${f('nacionalidad','Nacionalidad')}
        ${f('fecha_nacimiento','Fecha de nacimiento','date')}
        ${f('tipo_documento','Tipo documento','',[' ','Cédula','Pasaporte','NIT','SSN','Otro'])}
        ${f('numero_documento','Número documento')}
        ${f('vendedor','Vendedor (referido por)')}
      </div>
    </div>
    <div class="inv-sec">
      <div class="inv-sec-title">Contacto</div>
      <div class="inv-grid">
        ${f('email','Email principal','email')}
        ${f('email_secundario','Email secundario','email')}
        ${f('telefono','Teléfono','tel')}
        ${f('whatsapp','WhatsApp','tel')}
      </div>
    </div>
    <div class="inv-sec">
      <div class="inv-sec-title">Residencia</div>
      <div class="inv-grid three">
        ${f('pais_residencia','País')}
        ${f('ciudad','Ciudad')}
        ${f('direccion','Dirección')}
        ${f('codigo_postal','Código postal')}
      </div>
    </div>
    <div class="inv-sec">
      <div class="inv-sec-title">Notas</div>
      ${edit
        ? `<textarea class="inv-input" id="pf_notas_admin" rows="3" style="resize:vertical" placeholder="Notas internas...">${p.notas_admin||''}</textarea>`
        : `<div class="inv-val ${!p.notas_admin?'empty':''}">${p.notas_admin||'Sin notas'}</div>`}
    </div>`;
}

async function renderInvBanking(body) {
  let cuentas = [];
  if(INV_CURRENT.id) {
    const {data} = await db.from('inversionistas_banking')
      .select('*')
      .eq('inversionista_id', INV_CURRENT.id)
      .order('created_at', {ascending:true});
    cuentas = data || [];
  }

  let html = '';

  if(cuentas.length === 0) {
    html += `<div style="text-align:center;color:var(--t3);padding:30px 0">Sin cuentas bancarias registradas</div>`;
  } else {
    cuentas.forEach((c,i) => {
      html += `<div class="inv-banking-card">
        <div class="inv-banking-label">${c.label || 'Cuenta '+(i+1)} · <span style="color:var(--t3)">${c.tipo||''} ${c.moneda||''}</span></div>
        <div class="inv-grid">
          <div class="inv-field"><div class="inv-label">Banco</div><div class="inv-val ${!c.banco_nombre?'empty':''}">${c.banco_nombre||'—'}</div></div>
          <div class="inv-field"><div class="inv-label">Titular</div><div class="inv-val ${!c.cuenta_nombre?'empty':''}">${c.cuenta_nombre||'—'}</div></div>
          <div class="inv-field"><div class="inv-label">Tipo cuenta</div><div class="inv-val ${!c.cuenta_tipo?'empty':''}">${c.cuenta_tipo||'—'}</div></div>
          <div class="inv-field"><div class="inv-label">Número cuenta</div><div class="inv-val ${!c.cuenta_numero?'empty':''}">${c.cuenta_numero||'—'}</div></div>
          ${c.routing_aba?`<div class="inv-field"><div class="inv-label">Routing ABA</div><div class="inv-val">${c.routing_aba}</div></div>`:''}
          ${c.swift_bic?`<div class="inv-field"><div class="inv-label">SWIFT/BIC</div><div class="inv-val">${c.swift_bic}</div></div>`:''}
          ${c.iban?`<div class="inv-field"><div class="inv-label">IBAN</div><div class="inv-val">${c.iban}</div></div>`:''}
          ${c.wallet_address?`<div class="inv-field"><div class="inv-label">Wallet</div><div class="inv-val" style="font-size:10px;word-break:break-all">${c.wallet_address}</div></div>`:''}
          ${c.notas?`<div class="inv-field" style="grid-column:span 2"><div class="inv-label">Notas</div><div class="inv-val">${c.notas}</div></div>`:''}
        </div>
        ${INV_EDIT_MODE?`<button class="btn-add" style="margin-top:10px;color:var(--d);border-color:var(--d)" onclick="deleteBanking('${c.id}')">🗑 Eliminar</button>`:''}
      </div>`;
    });
  }

  if(INV_EDIT_MODE) {
    html += `<button class="btn-add" onclick="addBankingForm()" style="width:100%;margin-top:4px">+ Agregar cuenta bancaria</button>
    <div id="banking-form-area"></div>`;
  }

  body.innerHTML = html;
}

async function renderInvBeneficiarios(body) {
  let benefs = [];
  if(INV_CURRENT.id) {
    const {data} = await db.from('inversionistas_beneficiarios')
      .select('*')
      .eq('inversionista_id', INV_CURRENT.id)
      .order('porcentaje', {ascending:false});
    benefs = data || [];
  }

  let html = '';
  const totalPct = benefs.reduce((a,b)=>a+(b.porcentaje||0),0);

  if(benefs.length) {
    html += `<div style="background:var(--ad);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:11px;color:var(--t2)">${benefs.length} beneficiario${benefs.length!==1?'s':''} registrado${benefs.length!==1?'s':''}</span>
      <span style="font-family:"DM Mono",monospace;font-size:11px;color:${totalPct===100?'var(--bl)':'var(--w)'};font-weight:700">${totalPct.toFixed(0)}% asignado</span>
    </div>`;
    benefs.forEach(b => {
      html += `<div class="inv-benef-card">
        <div class="inv-benef-pct">${(b.porcentaje||0).toFixed(0)}%</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;margin-bottom:4px">${b.nombre}</div>
          <div style="font-size:10px;color:var(--t2);margin-bottom:6px">${b.parentesco||'—'}</div>
          <div class="inv-grid">
            ${b.email?`<div class="inv-field"><div class="inv-label">Email</div><div class="inv-val" style="font-size:11px">${b.email}</div></div>`:''}
            ${b.telefono?`<div class="inv-field"><div class="inv-label">Teléfono</div><div class="inv-val" style="font-size:11px">${b.telefono}</div></div>`:''}
            ${b.documento?`<div class="inv-field"><div class="inv-label">Documento</div><div class="inv-val" style="font-size:11px">${b.documento}</div></div>`:''}
            ${b.banco_nombre?`<div class="inv-field"><div class="inv-label">Banco</div><div class="inv-val" style="font-size:11px">${b.banco_nombre} ${b.cuenta_numero||''}</div></div>`:''}
          </div>
          ${INV_EDIT_MODE?`<button class="btn-add" style="margin-top:8px;color:var(--d);border-color:var(--d);font-size:10px" onclick="deleteBenef('${b.id}')">🗑 Eliminar</button>`:''}
        </div>
      </div>`;
    });
  } else {
    html += `<div style="text-align:center;color:var(--t3);padding:30px 0">Sin beneficiarios registrados</div>`;
  }

  if(INV_EDIT_MODE) {
    html += `<button class="btn-add" onclick="addBenefForm()" style="width:100%;margin-top:8px">+ Agregar beneficiario</button>
    <div id="benef-form-area"></div>`;
  }

  body.innerHTML = html;
}

function addBankingForm() {
  $('banking-form-area').innerHTML = `
    <div style="background:var(--sf2);border:1px solid var(--ac);border-radius:9px;padding:14px;margin-top:10px">
      <div class="inv-sec-title" style="color:#5B8DB8">Nueva cuenta bancaria</div>
      <div class="inv-grid three" style="margin-bottom:10px">
        <div class="inv-field"><label class="inv-label">Label</label><input class="inv-input" id="nb_label" placeholder="Ej: Cuenta principal"></div>
        <div class="inv-field"><label class="inv-label">Tipo</label>
          <select class="inv-select" id="nb_tipo">
            <option value="cuenta_bancaria">Cuenta bancaria</option>
            <option value="wire">Wire internacional</option>
            <option value="cripto">Cripto/Wallet</option>
            <option value="nequi">Nequi/Daviplata</option>
          </select></div>
        <div class="inv-field"><label class="inv-label">Moneda</label>
          <select class="inv-select" id="nb_moneda">
            <option value="USD">USD</option>
            <option value="COP">COP</option>
            <option value="EUR">EUR</option>
          </select></div>
        <div class="inv-field"><label class="inv-label">Banco</label><input class="inv-input" id="nb_banco_nombre" placeholder="Nombre del banco"></div>
        <div class="inv-field"><label class="inv-label">Titular</label><input class="inv-input" id="nb_cuenta_nombre" placeholder="Nombre del titular"></div>
        <div class="inv-field"><label class="inv-label">Tipo cuenta</label>
          <select class="inv-select" id="nb_cuenta_tipo">
            <option value="">—</option>
            <option value="Checking">Checking</option>
            <option value="Savings">Savings</option>
            <option value="Corriente">Corriente</option>
            <option value="Ahorros">Ahorros</option>
          </select></div>
        <div class="inv-field"><label class="inv-label">Número cuenta</label><input class="inv-input" id="nb_cuenta_numero" placeholder="####"></div>
        <div class="inv-field"><label class="inv-label">Routing ABA</label><input class="inv-input" id="nb_routing_aba" placeholder="9 dígitos"></div>
        <div class="inv-field"><label class="inv-label">SWIFT/BIC</label><input class="inv-input" id="nb_swift_bic" placeholder="BOFAUS3N"></div>
        <div class="inv-field"><label class="inv-label">IBAN</label><input class="inv-input" id="nb_iban" placeholder="ES00 0000..."></div>
        <div class="inv-field"><label class="inv-label">Wallet cripto</label><input class="inv-input" id="nb_wallet_address" placeholder="0x..."></div>
        <div class="inv-field"><label class="inv-label">Red blockchain</label><input class="inv-input" id="nb_red_blockchain" placeholder="Ethereum, TRC20..."></div>
      </div>
      <div class="inv-field" style="margin-bottom:10px"><label class="inv-label">Notas</label><input class="inv-input" id="nb_notas" placeholder="Observaciones..."></div>
      <div style="display:flex;gap:8px">
        <button class="btn-save" onclick="saveBanking()">Guardar cuenta</button>
        <button class="btn-add" onclick="$('banking-form-area').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

async function saveBanking() {
  if(!INV_CURRENT.id) { toast('Inversionista sin ID en tabla inversionistas','d'); return; }
  const {error} = await db.from('inversionistas_banking').insert({
    inversionista_id: INV_CURRENT.id,
    label: $('nb_label').value||null,
    tipo: $('nb_tipo').value||null,
    moneda: $('nb_moneda').value||'USD',
    banco_nombre: $('nb_banco_nombre').value||null,
    cuenta_nombre: $('nb_cuenta_nombre').value||null,
    cuenta_tipo: $('nb_cuenta_tipo').value||null,
    cuenta_numero: $('nb_cuenta_numero').value||null,
    routing_aba: $('nb_routing_aba').value||null,
    swift_bic: $('nb_swift_bic').value||null,
    iban: $('nb_iban').value||null,
    wallet_address: $('nb_wallet_address').value||null,
    red_blockchain: $('nb_red_blockchain').value||null,
    notas: $('nb_notas').value||null
  });
  if(error) { toast('Error: '+error.message,'d'); return; }
  toast('Cuenta guardada ✓','ok');
  await renderInvTab('banking');
}

async function deleteBanking(id) {
  if(!confirm('¿Eliminar esta cuenta bancaria?')) return;
  await db.from('inversionistas_banking').delete().eq('id', id);
  toast('Cuenta eliminada ✓','ok');
  await renderInvTab('banking');
}

function addBenefForm() {
  $('benef-form-area').innerHTML = `
    <div style="background:var(--sf2);border:1px solid var(--ac);border-radius:9px;padding:14px;margin-top:10px">
      <div class="inv-sec-title" style="color:#5B8DB8">Nuevo beneficiario</div>
      <div class="inv-grid" style="margin-bottom:10px">
        <div class="inv-field"><label class="inv-label">Nombre completo</label><input class="inv-input" id="bnf_nombre" placeholder="Nombre del beneficiario"></div>
        <div class="inv-field"><label class="inv-label">Parentesco</label>
          <select class="inv-select" id="bnf_parentesco">
            <option value="">—</option>
            <option value="Cónyuge">Cónyuge</option>
            <option value="Hijo/a">Hijo/a</option>
            <option value="Padre">Padre</option>
            <option value="Madre">Madre</option>
            <option value="Hermano/a">Hermano/a</option>
            <option value="Otro">Otro</option>
          </select></div>
        <div class="inv-field"><label class="inv-label">% Participación</label><input class="inv-input" id="bnf_pct" type="number" min="0" max="100" placeholder="50"></div>
        <div class="inv-field"><label class="inv-label">Documento</label><input class="inv-input" id="bnf_doc" placeholder="Cédula / Pasaporte"></div>
        <div class="inv-field"><label class="inv-label">Email</label><input class="inv-input" id="bnf_email" type="email" placeholder="email@..."></div>
        <div class="inv-field"><label class="inv-label">Teléfono</label><input class="inv-input" id="bnf_tel" placeholder="+57..."></div>
        <div class="inv-field"><label class="inv-label">Banco</label><input class="inv-input" id="bnf_banco" placeholder="Banco del beneficiario"></div>
        <div class="inv-field"><label class="inv-label">Cuenta banco</label><input class="inv-input" id="bnf_cuenta" placeholder="####"></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-save" onclick="saveBenef()">Guardar beneficiario</button>
        <button class="btn-add" onclick="$('benef-form-area').innerHTML=''">Cancelar</button>
      </div>
    </div>`;
}

async function saveBenef() {
  if(!INV_CURRENT.id) { toast('Inversionista sin ID','d'); return; }
  const nombre = $('bnf_nombre').value;
  if(!nombre) { toast('El nombre es obligatorio','d'); return; }
  const {error} = await db.from('inversionistas_beneficiarios').insert({
    inversionista_id: INV_CURRENT.id,
    nombre,
    parentesco: $('bnf_parentesco').value||null,
    porcentaje: parseFloat($('bnf_pct').value)||null,
    documento: $('bnf_doc').value||null,
    email: $('bnf_email').value||null,
    telefono: $('bnf_tel').value||null,
    banco_nombre: $('bnf_banco').value||null,
    cuenta_numero: $('bnf_cuenta').value||null
  });
  if(error) { toast('Error: '+error.message,'d'); return; }
  toast('Beneficiario guardado ✓','ok');
  await renderInvTab('beneficiarios');
}

async function deleteBenef(id) {
  if(!confirm('¿Eliminar este beneficiario?')) return;
  await db.from('inversionistas_beneficiarios').delete().eq('id', id);
  toast('Beneficiario eliminado ✓','ok');
  await renderInvTab('beneficiarios');
}

async function saveInvData() {
  if(INV_TAB !== 'perfil') { toast('Solo se guarda desde la pestaña Perfil','w'); return; }
  if(!INV_CURRENT.id) { toast('Inversionista no tiene ID registrado','d'); return; }

  const getData = id => $(id) ? $(id).value || null : null;

  // Check if perfil exists
  const {data: existingArr} = await db.from('inversionistas_perfil')
    .select('id').eq('inversionista_id', INV_CURRENT.id).limit(1);
  const existing = existingArr && existingArr.length ? existingArr[0] : null;

  const payload = {
    inversionista_id: INV_CURRENT.id,
    nombre_legal: getData('pf_nombre_legal'),
    nombre_contrato: getData('pf_nombre_contrato'),
    nacionalidad: getData('pf_nacionalidad'),
    fecha_nacimiento: getData('pf_fecha_nacimiento'),
    tipo_documento: getData('pf_tipo_documento'),
    numero_documento: getData('pf_numero_documento'),
    email: getData('pf_email'),
    email_secundario: getData('pf_email_secundario'),
    telefono: getData('pf_telefono'),
    whatsapp: getData('pf_whatsapp'),
    pais_residencia: getData('pf_pais_residencia'),
    ciudad: getData('pf_ciudad'),
    direccion: getData('pf_direccion'),
    codigo_postal: getData('pf_codigo_postal'),
    vendedor: getData('pf_vendedor'),
    notas_admin: getData('pf_notas_admin'),
    updated_at: new Date().toISOString()
  };

  let error;
  if(existing) {
    ({error} = await db.from('inversionistas_perfil').update(payload).eq('id', existing.id));
  } else {
    ({error} = await db.from('inversionistas_perfil').insert(payload));
  }

  if(error) { toast('Error: '+error.message,'d'); return; }
  toast('Perfil guardado ✓','ok');
  INV_EDIT_MODE = false;
  $('inv-edit-btn').textContent = '✎ Editar';
  $('inv-foot').style.display = 'none';
  await renderInvTab('perfil');
}

// ── PRÉSTAMOS SOCIOS (dashboard read-only para todos) ─────────
