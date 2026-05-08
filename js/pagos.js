async function abrirPago(numFactura, cliente, valorFactura, moneda, estadoActual) {
  $('m-t').textContent = 'Pagos — Factura #' + numFactura;
  $('m-s').textContent = cliente;

  // Cargar pagos existentes
  const {data: pagos} = await db.from('pagos_facturas')
    .select('*')
    .eq('numero_factura', numFactura)
    .order('fecha_pago', {ascending: false});

  const pagosHTML = pagos && pagos.length ? `
    <div style="margin-bottom:14px">
      <div style="font-family:"DM Mono",monospace;font-size:8.5px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Pagos registrados</div>
      ${pagos.map(p=>{
        const {texto, url} = parseSoporte(p.observaciones);
        return `<div style="background:var(--sf2);border-radius:7px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="flex:1">
            <div style="font-size:11px;font-weight:600;color:#00D5B0">${fm(p.valor_pagado)} ${p.moneda||moneda}</div>
            <div style="font-size:9.5px;color:var(--t2)">${fd(p.fecha_pago)}${p.cuenta?' · '+p.cuenta:''}</div>
            ${texto?`<div style="font-size:9px;color:var(--t3);margin-top:2px">${texto}</div>`:''}
        ${url?`<a href="${url}" target="_blank" style="font-size:9px;color:var(--ac);text-decoration:none">📄 Ver soporte</a>`:
          `<label style="font-size:9px;color:var(--t3);cursor:pointer;display:inline-flex;align-items:center;gap:3px">
            📎 Adjuntar
            <input type="file" accept="image/*,.pdf" style="display:none" onchange="subirSoportePago('${p.id}','${numFactura}','${cliente}',${valorFactura},'${moneda}','${estadoActual}',this)">
          </label>`}
          <div style="display:flex;gap:5px;flex-shrink:0">
            ${USER_ROL==='admin'?`
            <button onclick="editarPago('${p.id}',${numFactura},'${cliente}',${valorFactura},'${moneda}','${estadoActual}')" style="background:rgba(0,213,176,0.1);border:1px solid #00A98D;color:#00D5B0;border-radius:5px;padding:3px 8px;font-size:9px;cursor:pointer">Editar</button>
            <button onclick="eliminarPago('${p.id}',${numFactura},'${cliente}',${valorFactura},'${moneda}','${estadoActual}')" style="background:rgba(210,38,48,0.1);border:1px solid #D22630;color:#D22630;border-radius:5px;padding:3px 8px;font-size:9px;cursor:pointer">Borrar</button>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  $('m-b').innerHTML = `
    ${pagosHTML}
    <div style="font-family:"DM Mono",monospace;font-size:8.5px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">Registrar nuevo pago</div>
    <div style="background:var(--sf2);border-radius:8px;padding:12px 14px;margin-bottom:12px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Saldo pendiente</div>
      <div style="font-size:16px;font-weight:700;color:var(--w)">${fm(valorFactura)} ${moneda}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Tipo</div>
        <select id="pago-tipo" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none" onchange="checkPagoCompleto(${valorFactura})">
          <option value="abono">Abono parcial</option>
          <option value="completo">Pago completo</option>
        </select>
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Fecha</div>
        <input id="pago-fecha" type="date" value="${new Date().toISOString().split('T')[0]}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Valor pagado</div>
        <input id="pago-valor" type="number" placeholder="0.00" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Cuenta</div>
        <input id="pago-cuenta" type="text" placeholder="BofA, Diaz Intl..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Observaciones</div>
      <input id="pago-obs" type="text" placeholder="Opcional..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">📎 Soporte / Comprobante</div>
      <label style="display:flex;align-items:center;gap:8px;background:var(--sf2);border:1px dashed var(--br);border-radius:7px;padding:9px 12px;cursor:pointer;transition:border-color .15s" 
        onmouseover="this.style.borderColor='var(--ac)'" onmouseout="this.style.borderColor='var(--br)'">
        <span style="font-size:18px">📄</span>
        <div>
          <div style="font-size:11px;color:var(--t)">Adjuntar imagen o PDF</div>
          <div style="font-size:9px;color:var(--t3)" id="pago-file-label">JPG, PNG, PDF · máx 5MB</div>
        </div>
        <input type="file" id="pago-file" accept="image/*,.pdf" style="display:none" onchange="previewFile(this,'pago-file-label')">
      </label>
    </div>
    <button onclick="guardarPago(${numFactura},'${cliente}','${moneda}',${valorFactura})" style="width:100%;background:#00A98D;color:#fff;border:none;border-radius:7px;padding:9px;font-size:13px;font-weight:700;cursor:pointer">Guardar pago</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
      <button onclick="cambiarEstadoFactura(${numFactura},'Anulada','¿Anular esta factura? El cliente no tomó el servicio.')" style="background:rgba(127,140,141,0.1);border:1px solid var(--h);color:var(--h);border-radius:7px;padding:7px;font-size:11px;cursor:pointer">🚫 Anular factura</button>
      <button onclick="cambiarEstadoFactura(${numFactura},'Castigo','¿Registrar como castigo de cartera? El saldo se dará por perdido.')" style="background:rgba(210,38,48,0.08);border:1px solid #D22630;color:#D22630;border-radius:7px;padding:7px;font-size:11px;cursor:pointer">✗ Castigo cartera</button>
    </div>
    <div id="pago-err" style="font-size:11px;color:var(--d);margin-top:6px;min-height:14px"></div>`;
  $('ov').classList.add('on');
}

async function editarPago(pagoId, numFactura, cliente, valorFactura, moneda, estadoActual) {
  const {data: pago} = await db.from('pagos_facturas').select('*').eq('id', pagoId).single();
  if (!pago) { toast('Error cargando pago','d'); return; }

  const {texto: obsTexto, url: obsUrl} = parseSoporte(pago.observaciones);
  const esAdmin = USER_ROL === 'admin';

  $('m-t').textContent = 'Editar pago';
  $('m-s').textContent = 'Factura #' + numFactura + ' · ' + cliente;
  $('m-b').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Fecha</div>
        <input id="epago-fecha" type="date" value="${pago.fecha_pago}" ${!esAdmin?'disabled':''} style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none;${!esAdmin?'opacity:0.6':''}">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Valor pagado</div>
        <input id="epago-valor" type="number" value="${pago.valor_pagado}" ${!esAdmin?'disabled':''} style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none;${!esAdmin?'opacity:0.6':''}">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Cuenta</div>
        <input id="epago-cuenta" type="text" value="${pago.cuenta||''}" ${!esAdmin?'disabled':''} style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none;${!esAdmin?'opacity:0.6':''}">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Observaciones</div>
        <input id="epago-obs" type="text" value="${obsTexto||''}" ${!esAdmin?'disabled':''} style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none;${!esAdmin?'opacity:0.6':''}">
      </div>
    </div>

    <!-- Soporte adjunto -->
    <div style="margin-bottom:12px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:6px">📎 Soporte / Comprobante</div>
      ${obsUrl ? `
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 12px;margin-bottom:6px">
          <span style="font-size:10px;color:#00A98D">✅ Soporte adjunto</span>
          <div style="display:flex;gap:6px">
            <a href="${obsUrl}" target="_blank" style="background:rgba(0,169,141,0.1);border:1px solid var(--ac);color:var(--ac);border-radius:5px;padding:3px 8px;font-size:9px;text-decoration:none">📄 Ver</a>
            ${esAdmin?`<button onclick="eliminarSoporte('${pagoId}','${obsTexto}')" style="background:rgba(210,38,48,0.08);border:1px solid #D22630;color:#D22630;border-radius:5px;padding:3px 8px;font-size:9px;cursor:pointer">✕ Quitar</button>`:''}
          </div>
        </div>` : ''}
      ${esAdmin ? `
        <label style="display:flex;align-items:center;gap:8px;background:var(--sf2);border:1px dashed var(--br);border-radius:7px;padding:9px 12px;cursor:pointer"
          onmouseover="this.style.borderColor='var(--ac)'" onmouseout="this.style.borderColor='var(--br)'">
          <span style="font-size:18px">📄</span>
          <div>
            <div style="font-size:11px;color:var(--t)">${obsUrl?'Reemplazar soporte':'Adjuntar imagen o PDF'}</div>
            <div style="font-size:9px;color:var(--t3)" id="epago-file-label">JPG, PNG, PDF · máx 5MB</div>
          </div>
          <input type="file" id="epago-file" accept="image/*,.pdf" style="display:none" onchange="previewFile(this,'epago-file-label')">
        </label>` :
        `<div style="font-size:10px;color:var(--t3);padding:8px;text-align:center">${obsUrl?'':'Sin soporte adjunto'}</div>`}
    </div>

    ${esAdmin ? `
    <div style="display:flex;gap:8px">
      <button onclick="guardarEditPago('${pagoId}',${numFactura},'${cliente}',${valorFactura},'${moneda}','${estadoActual}')" style="flex:1;background:#00A98D;color:#fff;border:none;border-radius:7px;padding:9px;font-size:13px;font-weight:700;cursor:pointer">Guardar</button>
      <button onclick="abrirPago(${numFactura},'${cliente}',${valorFactura},'${moneda}','${estadoActual}')" style="background:var(--sf2);color:var(--t2);border:1px solid var(--br);border-radius:7px;padding:9px 14px;cursor:pointer">Cancelar</button>
    </div>` : `
    <button onclick="abrirPago(${numFactura},'${cliente}',${valorFactura},'${moneda}','${estadoActual}')" style="width:100%;background:var(--sf2);color:var(--t2);border:1px solid var(--br);border-radius:7px;padding:9px;cursor:pointer">← Volver</button>
    `}
    <div id="epago-err" style="font-size:11px;color:var(--d);margin-top:6px"></div>`;
  $('ov').classList.add('on');
}

async function guardarEditPago(pagoId, numFactura, cliente, valorFactura, moneda, estadoActual) {
  if(USER_ROL !== 'admin') { toast('Solo el administrador puede editar pagos','d'); return; }
  const fecha  = $('epago-fecha').value;
  const valor  = parseFloat($('epago-valor').value);
  const cuenta = $('epago-cuenta').value || null;
  const obs    = $('epago-obs').value || null;
  const fileEl = $('epago-file');

  if (!fecha || !valor) { $('epago-err').textContent = 'Fecha y valor son obligatorios'; return; }

  // Handle file upload first
  let soporteUrl = null;
  if(fileEl && fileEl.files && fileEl.files[0]) {
    const file = fileEl.files[0];
    if(file.size > 5*1024*1024) { $('epago-err').textContent = 'Archivo muy grande. Máximo 5MB'; return; }
    const ext = file.name.split('.').pop();
    const path = `diaz/factura-${numFactura}/pago-${pagoId}.${ext}`;
    const {error: errFile} = await db.storage.from('soportes-pagos').upload(path, file, {upsert:true});
    if(!errFile) {
      const {data: urlData} = db.storage.from('soportes-pagos').getPublicUrl(path);
      soporteUrl = urlData.publicUrl;
    }
  }

  // Build final observaciones preserving existing soporte if no new file
  let finalObs = obs||'';
  if(soporteUrl) {
    finalObs = (obs||'') + (obs?' · ':'')+`[soporte:${soporteUrl}]`;
  } else {
    // Preserve existing soporte URL if present
    const {data: pagoActual} = await db.from('pagos_facturas').select('observaciones').eq('id',pagoId).single();
    const {url: existingUrl} = parseSoporte(pagoActual?.observaciones||'');
    if(existingUrl) finalObs = (obs||'') + (obs?' · ':'')+`[soporte:${existingUrl}]`;
  }

  const {error} = await db.from('pagos_facturas').update({
    fecha_pago: fecha, valor_pagado: valor, cuenta, observaciones: finalObs||null
  }).eq('id', pagoId);

  if (error) { $('epago-err').textContent = 'Error: ' + error.message; return; }

  toast('Pago actualizado ✓','ok');
  await loadDiaz();
  abrirPago(numFactura, cliente, valorFactura, moneda, estadoActual);
}

async function eliminarSoporte(pagoId, obsTexto) {
  if(!confirm('¿Quitar el soporte adjunto?')) return;
  await db.from('pagos_facturas').update({observaciones: obsTexto||null}).eq('id', pagoId);
  toast('Soporte eliminado ✓','ok');
  // Refresh modal
  const {data: p} = await db.from('pagos_facturas').select('numero_factura,cliente_nombre,moneda').eq('id',pagoId).single();
  if(p) {
    const fact = FACT_DATA.find(f=>f.numero_factura===p.numero_factura);
    editarPago(pagoId, p.numero_factura, p.cliente_nombre, fact?.saldo_pendiente||0, p.moneda, fact?.estado||'');
  }
}

async function eliminarPago(pagoId, numFactura, cliente, valorFactura, moneda, estadoActual) {
  if (!confirm('¿Eliminar este pago? Esta acción no se puede deshacer.')) return;

  const {error} = await db.from('pagos_facturas').delete().eq('id', pagoId);
  if (error) { toast('Error al eliminar','d'); return; }

  // Recalcular estado de la factura
  const {data: pagosRestantes} = await db.from('pagos_facturas')
    .select('valor_pagado')
    .eq('numero_factura', numFactura);
  
  const totalPagado = (pagosRestantes||[]).reduce((a,p)=>a+p.valor_pagado,0);
  const nuevoEstado = totalPagado <= 0 ? 'Pendiente' : totalPagado >= valorFactura ? 'Pagada' : 'Abono';
  
  await db.from('facturas_diaz').update({estado: nuevoEstado}).eq('numero_factura', numFactura);

  toast('Pago eliminado ✓','ok');
  await loadDiaz();
  abrirPago(numFactura, cliente, valorFactura, moneda, nuevoEstado);
}

function checkPagoCompleto(valorFactura) {
  if ($('pago-tipo').value === 'completo') {
    $('pago-valor').value = valorFactura;
  } else {
    $('pago-valor').value = '';
  }
}

async function guardarPago(numFactura, cliente, moneda, valorFactura) {
  const tipo   = $('pago-tipo').value;
  const fecha  = $('pago-fecha').value;
  const valor  = parseFloat($('pago-valor').value);
  const cuenta = $('pago-cuenta').value || null;
  const obs    = $('pago-obs').value || null;
  const fileEl = $('pago-file');

  if (!fecha) { $('pago-err').textContent = 'La fecha es obligatoria'; return; }
  if (!valor || valor <= 0) { $('pago-err').textContent = 'El valor es obligatorio'; return; }

  // Insertar pago
  const {data: pagoData, error: errPago} = await db.from('pagos_facturas').insert({
    numero_factura: numFactura,
    cliente_nombre: cliente,
    moneda,
    valor_pagado: valor,
    fecha_pago: fecha,
    cuenta,
    observaciones: obs
  }).select().single();

  if (errPago) { $('pago-err').textContent = 'Error: ' + errPago.message; return; }

  // Upload file if selected
  if (fileEl && fileEl.files && fileEl.files[0] && pagoData) {
    const file = fileEl.files[0];
    const ext = file.name.split('.').pop();
    const path = `diaz/factura-${numFactura}/pago-${pagoData.id}.${ext}`;
    const {error: errFile} = await supabaseStorage.storage
      .from('soportes-pagos')
      .upload(path, file, {upsert: true});
    if (!errFile) {
      const {data: urlData} = supabaseStorage.storage.from('soportes-pagos').getPublicUrl(path);
      await db.from('pagos_facturas').update({observaciones: (obs||'') + (obs?' · ':'')+`[soporte:${urlData.publicUrl}]`}).eq('id', pagoData.id);
    }
  }

  if (errPago) { $('pago-err').textContent = 'Error: ' + errPago.message; return; }

  // Calcular saldo real después del pago
  const {data: todosLosPagos} = await db.from('pagos_facturas')
    .select('valor_pagado')
    .eq('numero_factura', numFactura);
  
  const totalPagado = (todosLosPagos||[]).reduce((a,p)=>a+p.valor_pagado, 0);
  
  // Determinar estado basado en saldo real
  let nuevoEstado;
  if (tipo === 'completo' || totalPagado >= valorFactura) {
    nuevoEstado = 'Pagada';
  } else if (totalPagado > 0) {
    nuevoEstado = 'Abono';
  } else {
    nuevoEstado = 'Pendiente';
  }

  const {error: errFact} = await db.from('facturas_diaz')
    .update({estado: nuevoEstado})
    .eq('numero_factura', numFactura);

  if (errFact) { $('pago-err').textContent = 'Error actualizando factura: ' + errFact.message; return; }

  toast('Pago registrado · Factura ' + (nuevoEstado === 'Pagada' ? 'PAGADA ✓' : 'con abono ✓'), 'ok');
  closeM();
  await loadDiaz();
}

// ── PROGRAMAR FECHA DE PAGO ──────────────────────────────────
async function programarPago(numFactura, cliente, fechaActual) {
  const nuevaFecha = prompt('Fecha de pago programado (AAAA-MM-DD):', fechaActual || new Date().toISOString().split('T')[0]);
  if (!nuevaFecha) return;
  
  const {error} = await db.from('facturas_diaz')
    .update({fecha_pago_programado: nuevaFecha || null})
    .eq('numero_factura', numFactura);
  
  if (error) { toast('Error: ' + error.message, 'd'); return; }
  toast('Fecha de pago programada ✓', 'ok');
  await loadDiaz();
}

// ── ANULAR / CASTIGO FACTURAS ────────────────────────────────
async function cambiarEstadoFactura(numFactura, nuevoEstado, mensaje) {
  if (!confirm(mensaje)) return;

  const obs = nuevoEstado === 'Castigo' 
    ? prompt('Observación (opcional):', 'Castigo de cartera - cliente no pagó')
    : null;

  const {error} = await db.from('facturas_diaz')
    .update({
      estado: nuevoEstado,
      observaciones: obs || (nuevoEstado === 'Anulada' ? 'Factura anulada' : 'Castigo de cartera')
    })
    .eq('numero_factura', numFactura);

  if (error) { toast('Error: ' + error.message, 'd'); return; }

  toast(nuevoEstado === 'Anulada' ? 'Factura anulada ✓' : 'Castigo de cartera registrado ✓', 'ok');
  closeM();
  await loadDiaz();
}

// ── EDITAR / ELIMINAR MOVIMIENTOS ────────────────────────────
