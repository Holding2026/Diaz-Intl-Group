async function editarMov(movId, numContrato) {
  // Buscar el movimiento
  const {data: mov, error} = await db.from('movimientos').select('*').eq('id', movId).single();
  if (error || !mov) { toast('Error al cargar movimiento','d'); return; }

  $('m-t').textContent = 'Editar movimiento';
  $('m-s').textContent = `Memo ${mov.numero_memo||'N.C'} · ${mov.fecha}`;
  $('m-b').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Tipo</div>
        <select id="edit-tipo" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
          <option value="corte_rendimiento" ${mov.tipo==='corte_rendimiento'?'selected':''}>Corte rendimiento</option>
          <option value="retiro_capital" ${mov.tipo==='retiro_capital'?'selected':''}>Retiro capital</option>
          <option value="capital_nuevo" ${mov.tipo==='capital_nuevo'?'selected':''}>Capital nuevo</option>
          <option value="ajuste" ${mov.tipo==='ajuste'?'selected':''}>Ajuste</option>
        </select>
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Fecha</div>
        <input id="edit-fecha" type="date" value="${mov.fecha}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Memo #</div>
        <input id="edit-memo" type="text" value="${mov.numero_memo||''}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Capital base</div>
        <input id="edit-capital" type="number" value="${mov.capital_base||''}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">% Período</div>
        <input id="edit-pct" type="number" step="0.0001" value="${mov.porcentaje||''}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">$ Rendimiento</div>
        <input id="edit-rend" type="number" value="${mov.valor_rendimiento||''}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">$ Reinversión</div>
        <input id="edit-reinv" type="number" value="${mov.valor_reinversion||''}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
      <div>
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Saldo resultado</div>
        <input id="edit-saldo" type="number" value="${mov.saldo_resultado||''}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Anotaciones</div>
      <input id="edit-nota" type="text" value="${parseSoporte(mov.anotaciones||'').texto||mov.anotaciones||''}" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
    </div>
    <!-- Soporte adjunto -->
    <div style="margin-bottom:12px">
      <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:6px">📎 Soporte / Memo</div>
      ${parseSoporte(mov.anotaciones||'').url ? `
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:8px 12px;margin-bottom:6px">
          <span style="font-size:10px;color:#00A98D">✅ Soporte adjunto</span>
          <div style="display:flex;gap:6px">
            <a href="${parseSoporte(mov.anotaciones||'').url}" target="_blank" style="background:rgba(0,169,141,0.1);border:1px solid var(--ac);color:var(--ac);border-radius:5px;padding:3px 8px;font-size:9px;text-decoration:none">📄 Ver</a>
            <button onclick="eliminarSoporteMov('${movId}','${numContrato}')" style="background:rgba(210,38,48,0.08);border:1px solid #D22630;color:#D22630;border-radius:5px;padding:3px 8px;font-size:9px;cursor:pointer">✕ Quitar</button>
          </div>
        </div>` : ''}
      <label style="display:flex;align-items:center;gap:8px;background:var(--sf2);border:1px dashed var(--br);border-radius:7px;padding:9px 12px;cursor:pointer"
        onmouseover="this.style.borderColor='var(--ac)'" onmouseout="this.style.borderColor='var(--br)'">
        <span style="font-size:18px">📄</span>
        <div>
          <div style="font-size:11px;color:var(--t)">${parseSoporte(mov.anotaciones||'').url?'Reemplazar soporte':'Adjuntar memo o comprobante'}</div>
          <div style="font-size:9px;color:var(--t3)" id="edit-file-label">JPG, PNG, PDF · máx 5MB</div>
        </div>
        <input type="file" id="edit-file" accept="image/*,.pdf" style="display:none" onchange="previewFile(this,'edit-file-label')">
      </label>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="guardarEdicion('${movId}','${numContrato}')" style="flex:1;background:#00A98D;color:#fff;border:none;border-radius:7px;padding:9px;font-size:13px;font-weight:700;cursor:pointer">Guardar cambios</button>
      <button onclick="openPerfil('${numContrato}')" style="background:var(--sf2);color:var(--t2);border:1px solid var(--br);border-radius:7px;padding:9px 14px;font-size:13px;cursor:pointer">Cancelar</button>
    </div>
    <div id="edit-err" style="font-size:11px;color:var(--d);margin-top:6px;min-height:14px"></div>`;
  $('ov').classList.add('on');
}

async function guardarEdicion(movId, numContrato) {
  const tipo  = $('edit-tipo').value;
  const fecha = $('edit-fecha').value;
  const memo  = $('edit-memo').value || null;
  const cap   = parseFloat($('edit-capital').value) || null;
  const pct   = parseFloat($('edit-pct').value) || null;
  const rend  = parseFloat($('edit-rend').value) || null;
  const reinv = parseFloat($('edit-reinv').value) || null;
  const saldo = parseFloat($('edit-saldo').value) || null;
  const nota  = $('edit-nota').value || null;
  const fileEl = $('edit-file');

  if (!fecha) { $('edit-err').textContent = 'La fecha es obligatoria'; return; }
  if (!saldo) { $('edit-err').textContent = 'El saldo resultado es obligatorio'; return; }

  // Handle file upload
  let soporteUrl = null;
  if(fileEl && fileEl.files && fileEl.files[0]) {
    const file = fileEl.files[0];
    if(file.size > 5*1024*1024) { $('edit-err').textContent = 'Archivo muy grande. Máximo 5MB'; return; }
    const ext = file.name.split('.').pop();
    const path = `tycoon/${numContrato}/mov-${movId}.${ext}`;
    const {error: errFile} = await db.storage.from('soportes-tycoon').upload(path, file, {upsert:true});
    if(!errFile) {
      const {data: urlData} = db.storage.from('soportes-tycoon').getPublicUrl(path);
      soporteUrl = urlData.publicUrl;
    }
  }

  // Build final anotaciones preserving existing soporte URL if no new file
  let finalNota = nota||'';
  if(soporteUrl) {
    finalNota = (nota||'') + (nota?' · ':'')+`[soporte:${soporteUrl}]`;
  } else {
    // Get existing soporte URL
    const {data: movActual} = await db.from('movimientos').select('anotaciones').eq('id',movId).single();
    const {url: existingUrl} = parseSoporte(movActual?.anotaciones||'');
    if(existingUrl) finalNota = (nota||'') + (nota?' · ':'')+`[soporte:${existingUrl}]`;
  }

  const {error} = await db.from('movimientos').update({
    tipo, fecha,
    numero_memo: memo,
    capital_base: cap,
    porcentaje: pct,
    valor_rendimiento: rend,
    valor_reinversion: reinv,
    saldo_resultado: saldo,
    anotaciones: finalNota||null
  }).eq('id', movId);

  if (error) { $('edit-err').textContent = 'Error: ' + error.message; return; }

  // Actualizar saldo del contrato
  if (saldo) {
    await db.from('contratos_tycoon').update({saldo_actual: saldo}).eq('numero', numContrato);
  }

  toast('Movimiento actualizado ✓','ok');
  closeM();
  await loadTycoon();
  setTimeout(() => openPerfil(numContrato), 500);
}

async function eliminarMov(movId, numContrato) {
  if (!confirm('¿Seguro que desea eliminar este movimiento? Esta acción no se puede deshacer.')) return;

  const {error} = await db.from('movimientos').delete().eq('id', movId);
  if (error) { toast('Error al eliminar: ' + error.message, 'd'); return; }

  toast('Movimiento eliminado ✓','ok');
  closeM();
  await loadTycoon();
  setTimeout(() => openPerfil(numContrato), 500);
}

// ── FICHA INVERSIONISTA ─────────────────────────────────────
let INV_EDIT_MODE = false;
let INV_CURRENT = null; // {id, nombre, contratos_ty, contratos_kii}
let INV_TAB = 'resumen';

