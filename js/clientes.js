async function abrirHistorialCliente(nombreCliente) {
  // Use main modal
  $('m-t').textContent = nombreCliente;
  $('m-s').textContent = 'Historial completo · Díaz International';
  $('m-b').innerHTML = '<div style="text-align:center;color:var(--t3);padding:30px">Cargando historial...</div>';
  $('ov').classList.add('on');

  // Load all invoices for this client
  const {data: facturas} = await db.from('vista_cartera_diaz')
    .select('*')
    .ilike('cliente_nombre', `%${nombreCliente.split(' ')[0]}%`)
    .order('fecha_factura', {ascending: false});

  const facts = (facturas||[]).filter(f =>
    f.cliente_nombre.toLowerCase().includes(nombreCliente.toLowerCase().split(' ')[0].toLowerCase())
  );

  // Load all payments for this client
  const {data: pagos} = await db.from('pagos_facturas')
    .select('*')
    .ilike('cliente_nombre', `%${nombreCliente.split(' ')[0]}%`)
    .order('fecha_pago', {ascending: false});

  const totalFacturado = facts.reduce((a,f)=>a+(f.valor_factura||f.valor||0),0);
  const totalPagado    = facts.reduce((a,f)=>a+(f.total_pagado||0),0);
  const totalPendiente = facts.reduce((a,f)=>a+(f.saldo_pendiente||0),0);
  const pagosArr = pagos||[];

  const estadoColor = e => e==='Pagada'?'var(--bl)':e==='Abono'?'var(--w)':e==='Pendiente'?'var(--d)':'var(--t3)';

  $('m-b').innerHTML = `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      <div style="background:var(--sf2);border-radius:8px;padding:10px 12px;border-top:2px solid var(--ac)">
        <div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1px;text-transform:uppercase">Total facturado</div>
        <div style="font-size:18px;font-weight:700;color:#00D5B0;font-family:'Syne',sans-serif">${fm(totalFacturado)}</div>
        <div style="font-size:9px;color:var(--t3)">${facts.length} factura${facts.length!==1?'s':''}</div>
      </div>
      <div style="background:var(--sf2);border-radius:8px;padding:10px 12px;border-top:2px solid #2ecc71">
        <div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1px;text-transform:uppercase">Total pagado</div>
        <div style="font-size:18px;font-weight:700;color:#2ecc71;font-family:'Syne',sans-serif">${fm(totalPagado)}</div>
        <div style="font-size:9px;color:var(--t3)">${pagosArr.length} pago${pagosArr.length!==1?'s':''}</div>
      </div>
      <div style="background:var(--sf2);border-radius:8px;padding:10px 12px;border-top:2px solid ${totalPendiente>0?'var(--w)':'#2ecc71'}">
        <div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace;letter-spacing:1px;text-transform:uppercase">Saldo pendiente</div>
        <div style="font-size:18px;font-weight:700;color:${totalPendiente>0?'var(--w)':'#2ecc71'};font-family:'Syne',sans-serif">${fm(totalPendiente)}</div>
        <div style="font-size:9px;color:var(--t3)">${totalPendiente>0?'por cobrar':'al día ✓'}</div>
      </div>
    </div>

    <!-- Facturas -->
    <div style="font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Facturas</div>
    ${facts.map(f=>{
      const saldo = f.saldo_pendiente||0;
      const val = f.valor_factura||f.valor||0;
      const abonado = f.total_pagado||0;
      return `<div style="background:var(--sf2);border:1px solid var(--br);border-radius:8px;padding:10px 12px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-family:"DM Mono",monospace;font-size:12px;color:#00A98D;font-weight:700">#${f.numero_factura}</span>
            <span style="font-size:9px;color:var(--t2)">${fd(f.fecha_factura)}</span>
            ${f.programa_servicio?`<span style="font-size:9px;color:var(--t3)">${f.programa_servicio}</span>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:9px;font-weight:600;color:${estadoColor(f.estado)}">${f.estado}</span>
            ${['Pendiente','Abono'].includes(f.estado)?`<button onclick="closeM();setTimeout(()=>abrirPago(${f.numero_factura},'${f.cliente_nombre}',${saldo},'${f.moneda}','${f.estado}'),100)" 
              style="background:rgba(0,169,141,0.15);border:1px solid var(--ac);color:var(--ac);border-radius:4px;padding:2px 7px;font-size:9px;cursor:pointer">+ Pago</button>`:''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <div><div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace">Valor</div><div style="font-size:11px;font-family:"DM Mono",monospace">${fm(val)} ${f.moneda}</div></div>
          <div><div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace">Pagado</div><div style="font-size:11px;font-family:"DM Mono",monospace;color:#2ecc71">${fm(abonado)}</div></div>
          <div><div style="font-size:8px;color:var(--t3);font-family:"DM Mono",monospace">Pendiente</div><div style="font-size:11px;font-family:"DM Mono",monospace;color:${saldo>0?'var(--w)':'#2ecc71'};font-weight:700">${fm(saldo)}</div></div>
        </div>
      </div>`;
    }).join('')}

    <!-- Pagos con soportes -->
    ${pagosArr.length?`
    <div style="font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin:14px 0 8px">Historial de pagos</div>
    ${pagosArr.map(p=>{
      const {texto, url} = parseSoporte(p.observaciones);
      return `<div style="background:var(--sf2);border:1px solid var(--br);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
            <span style="font-size:13px;font-weight:700;color:#2ecc71;font-family:"DM Mono",monospace">${fm(p.valor_pagado)} ${p.moneda}</span>
            <span style="font-size:9px;color:var(--t3)">${fd(p.fecha_pago)}</span>
            ${p.cuenta?`<span style="font-size:9px;color:var(--t2)">${p.cuenta}</span>`:''}
          </div>
          ${texto?`<div style="font-size:9px;color:var(--t3)">${texto}</div>`:''}
          <div style="font-size:9px;color:var(--t3)">Factura #${p.numero_factura}</div>
        </div>
        ${url?`<a href="${url}" target="_blank" style="background:rgba(0,169,141,0.1);border:1px solid var(--ac);color:var(--ac);border-radius:5px;padding:4px 8px;font-size:9px;text-decoration:none;white-space:nowrap;flex-shrink:0">📄 Ver soporte</a>`:
          `<label style="background:var(--sf2);border:1px solid var(--br);color:var(--t3);border-radius:5px;padding:4px 8px;font-size:9px;cursor:pointer;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:3px"
            onmouseover="this.style.borderColor='var(--ac)';this.style.color='var(--ac)'" onmouseout="this.style.borderColor='var(--br)';this.style.color='var(--t3)'">
            📎 Adjuntar
            <input type="file" accept="image/*,.pdf" style="display:none" onchange="subirSoportePagoHistorial('${p.id}',this)">
          </label>`}
      </div>`;
    }).join('')}`:''}`;
}

// ── AI CHAT ──────────────────────────────────────────────────
let aiOpen = false;

