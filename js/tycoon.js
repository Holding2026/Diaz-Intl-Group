async function loadAll() {
  toast('Actualizando datos...','ok');
  await Promise.all([loadTycoon(), loadDiaz(), loadKII()]);
  toast('Datos actualizados ✓','ok');
}

async function loadTycoon() {
  const {data, error} = await db
    .from('vista_contratos_vencimiento')
    .select('*')
    .order('dias_al_vencimiento', {ascending:true});
  if(error) { console.error(error); return; }

  // Último corte de rendimiento por contrato → calcular próximo reporte
  const {data: ultimosCortes} = await db
    .from('movimientos')
    .select('contrato_id, fecha, tipo_liquidacion')
    .eq('tipo', 'corte_rendimiento')
    .order('fecha', {ascending: false});

  const ucMap = {};
  if (ultimosCortes) {
    ultimosCortes.forEach(function(m) {
      if (!ucMap[m.contrato_id]) ucMap[m.contrato_id] = m;
    });
  }

  // Saldo REAL: último movimiento por contrato (saldo_resultado es el saldo calculado)
  const {data: ultimosMov} = await db
    .from('movimientos')
    .select('contrato_id, saldo_resultado')
    .order('fecha', {ascending: false})
    .order('created_at', {ascending: false});

  const saldoRealMap = {};
  if (ultimosMov) {
    ultimosMov.forEach(function(m) {
      if (!saldoRealMap[m.contrato_id] && m.saldo_resultado != null) {
        saldoRealMap[m.contrato_id] = m.saldo_resultado;
      }
    });
  }

  TYC_DATA = (data || []).map(function(ct) {
    // contrato_id puede venir como ct.contrato_id o ct.id según la vista
    var cid = ct.contrato_id || ct.id;
    const uc = ucMap[cid];
    if (uc && uc.fecha) {
      const tipo = (uc.tipo_liquidacion || ct.tipo_liquidacion || 'Trimestral').toLowerCase();
      const meses = tipo.includes('semest') ? 6 : tipo.includes('anual') ? 12 : 3;
      const next = new Date(uc.fecha + 'T12:00:00');
      next.setMonth(next.getMonth() + meses);
      ct.fecha_proximo_corte = next.toISOString().split('T')[0];
    }
    // Sobrescribir saldo_actual con el saldo real del último movimiento
    var realSaldo = saldoRealMap[cid];
    if (realSaldo != null) {
      ct.saldo_actual = realSaldo;
    }
    // Guardar cid para uso posterior
    if (!ct.contrato_id) ct.contrato_id = cid;
    return ct;
  });

  buildTYStats();
  renderTY();
}

async function loadDiaz() {
  const {data, error} = await db
    .from('vista_cartera_diaz')
    .select('*')
    .order('fecha_factura', {ascending:false});
  if(error) { console.error(error); return; }
  FACT_DATA = data || [];
  buildDZStats();
  renderDZ();
}

async function loadKII() {
  const {data, error} = await db
    .from('posiciones_kii')
    .select('*')
    .order('valor_inversion', {ascending:false});
  if(error) { console.error(error); return; }
  KII_DATA = data || [];
  buildKIIStats();
  renderKII();
}

// ── TYCOON ───────────────────────────────────────────────────
// ── TYCOON SUB-TABS ─────────────────────────────────────────
var TY_CAL_DATE = new Date();

function tySubTab(name) {
  ['dash','cal','list'].forEach(function(p) {
    var panel = $(  'ty-panel-'+p);
    var btn   = $('ty-subtab-'+p);
    if (!panel||!btn) return;
    var on = p===name;
    panel.style.display = on ? '' : 'none';
    btn.style.borderBottomColor = on ? '#DBE2E9' : 'transparent';
    btn.style.color = on ? '#DBE2E9' : 'var(--t3)';
  });
  if (name==='cal') renderTYCalendar();
}

// ── TYCOON STATS ─────────────────────────────────────────────
function buildTYStats() {
  var d = TYC_DATA;
  var totalSaldo   = d.reduce(function(a,c){return a+(c.saldo_actual||0);},0);
  var totalInicial = d.reduce(function(a,c){return a+(c.valor_inicial||0);},0);
  var crecimiento  = totalInicial>0 ? ((totalSaldo-totalInicial)/totalInicial*100) : 0;
  var activos = d.filter(function(c){return !c.estado||c.estado==='Activo';}).length;
  var onHold  = d.filter(function(c){return c.estado==='On Hold';}).length;
  var prox180 = d.filter(function(c){return c.dias_al_vencimiento>=0&&c.dias_al_vencimiento<180;}).length;

  $('ty-date').textContent = todayStr() + ' · Datos en tiempo real';
  $('ty-bdg').textContent = d.length + ' contratos';

  // KPIs
  $('ty-kpi-row').innerHTML =
    kpiCard('AUM Total','Assets Under Management',fm(totalSaldo),'#00A98D','◈',true) +
    kpiCard('Capital Invertido','Suma capital inicial',fm(totalInicial),'#5B8DB8','◇',false) +
    kpiCard('Crecimiento','Saldo vs capital inicial',(crecimiento>=0?'+':'')+crecimiento.toFixed(1)+'%',crecimiento>=0?'#00D5B0':'var(--or)','△',false) +
    kpiCard('Contratos activos','En base de datos',activos+(onHold?' <span style="font-size:10px;color:var(--t3)">+'+onHold+' hold</span>':''),'#DBE2E9','◎',false) +
    kpiCard('Atención requerida','Vencen en &lt;6 meses',prox180,prox180>0?'var(--or)':'#00A98D','⚠',false);

  // Distribución por estado
  var estados = {Activo:0,'On Hold':0,Terminado:0,Liquidado:0};
  d.forEach(function(ct){ var e=ct.estado||'Activo'; if(estados[e]!==undefined) estados[e]++; else estados.Activo++; });
  var total = d.length||1;
  var dCol = {Activo:'#00A98D','On Hold':'#d4870a',Terminado:'#5B8DB8',Liquidado:'#5B6770'};
  var donutSegs=''; var offset=0; var r=30; var circ=2*Math.PI*r;
  Object.keys(estados).filter(function(e){return estados[e]>0;}).forEach(function(e){
    var pct=estados[e]/total;
    var dash=circ*pct; var gap=circ*(1-pct);
    donutSegs+='<circle cx="40" cy="40" r="'+r+'" fill="none" stroke="'+dCol[e]+'" stroke-width="10" stroke-dasharray="'+dash+' '+gap+'" stroke-dashoffset="-'+offset+'" style="transform-origin:center;transform:rotate(-90deg)"/>';
    offset+=circ*pct;
  });
  var distHTML = Object.keys(estados).filter(function(e){return estados[e]>0;}).map(function(e){
    var pct=Math.round(estados[e]/total*100);
    return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:var(--t2)">'+e+'</span><span style="font-family:\'DM Mono\',monospace;font-size:11px;color:'+dCol[e]+'">'+estados[e]+' <span style="color:var(--t3);font-size:9px">('+pct+'%)</span></span></div><div style="height:3px;background:var(--br);border-radius:2px;margin-top:4px"><div style="height:3px;border-radius:2px;width:'+pct+'%;background:'+dCol[e]+'"></div></div></div>';
  }).join('');
  $('ty-dist-body').innerHTML='<div style="display:flex;gap:14px;align-items:flex-start"><svg width="80" height="80" style="flex-shrink:0">'+donutSegs+'<text x="40" y="44" text-anchor="middle" font-size="12" font-weight="700" fill="var(--t)" font-family="DM Mono,monospace">'+d.length+'</text></svg><div style="flex:1">'+distHTML+'</div></div>';

  // Top 5
  var top5 = d.slice().sort(function(a,b){return (b.saldo_actual||0)-(a.saldo_actual||0);}).slice(0,5);
  var maxS = top5[0]?(top5[0].saldo_actual||1):1;
  $('ty-top-body').innerHTML = top5.map(function(ct,ix){
    var col=PAL[ix%PAL.length];
    var pct=Math.max(4,Math.round((ct.saldo_actual||0)/maxS*100));
    return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px"><div style="display:flex;align-items:center;gap:6px"><div style="width:20px;height:20px;border-radius:50%;background:'+col+'18;color:'+col+';border:1px solid '+col+'30;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:\'Syne\',sans-serif">'+ini(ct.inversionista)+'</div><span style="font-size:11px;color:var(--t2)">'+ct.inversionista.split(' ')[0]+'<span style="color:var(--t3);font-size:9px;margin-left:4px">'+ct.numero+'</span></span></div><span style="font-family:\'DM Mono\',monospace;font-size:11px;color:#00D5B0;font-weight:600">'+fm(ct.saldo_actual)+'</span></div><div style="height:3px;background:var(--br);border-radius:2px"><div style="height:3px;border-radius:2px;width:'+pct+'%;background:'+col+'"></div></div></div>';
  }).join('');

  // Alertas ≤90d
  var urgRows = d.filter(function(ct){return ct.dias_al_vencimiento>=0&&ct.dias_al_vencimiento<90;});
  $('ty-al-hdr').textContent = urgRows.length ? 'ALERTAS DE VENCIMIENTO ('+urgRows.length+')' : '';
  $('ty-al').innerHTML = urgRows.map(function(ct){
    var r=ct.dias_al_vencimiento<30;
    var vd=ct.fecha_vencimiento||ct.proximo_vencimiento;
    return '<div class="alert '+(r?'red':'yel')+'" style="display:flex;align-items:center">'+
      '<div class="adot '+(r?'r':'y')+'" style="flex-shrink:0"></div>'+
      '<div class="atext" style="flex:1;cursor:pointer" onclick="openPerfil(\''+ct.numero+'\')"><div class="atitle '+(r?'r':'y')+'">'+ct.inversionista+' · '+ct.numero+' — vence '+fd(vd)+'</div><div class="asub">Saldo: '+fm(ct.saldo_actual)+' · '+ct.dias_al_vencimiento+'d restantes</div></div>'+
      '<button onclick="event.stopPropagation();editarContrato(\''+ct.numero+'\')" style="flex-shrink:0;margin-left:8px;background:rgba(91,141,184,0.12);border:1px solid rgba(91,141,184,0.3);border-radius:6px;padding:4px 10px;color:#5B8DB8;font-size:10px;cursor:pointer">&#9998; Editar</button>'+
      '<div class="ameta '+(r?'r':'y')+'" style="margin-left:8px;flex-shrink:0">'+ct.dias_al_vencimiento+'d</div>'+
    '</div>';
  }).join('');
}

function kpiCard(label, sub, value, color, icon, large) {
  return '<div style="background:var(--sf);border:1px solid var(--br);border-radius:12px;padding:16px 18px;border-top:2px solid '+color+';position:relative;overflow:hidden">'+
    '<div style="font-size:9px;font-weight:700;color:var(--t3);letter-spacing:1.5px;margin-bottom:8px;font-family:\'Syne\',sans-serif;text-transform:uppercase">'+label+'</div>'+
    '<div style="font-size:'+(large?'20':'17')+'px;font-weight:700;color:'+color+';font-family:\'DM Mono\',monospace;line-height:1.1;margin-bottom:4px">'+value+'</div>'+
    '<div style="font-size:9px;color:var(--t3)">'+sub+'</div>'+
    '<div style="position:absolute;right:14px;top:14px;font-size:18px;opacity:0.15;color:'+color+'">'+icon+'</div>'+
  '</div>';
}

// ── CALENDARIO ───────────────────────────────────────────────
function tyCalPrev() { TY_CAL_DATE.setMonth(TY_CAL_DATE.getMonth()-1); renderTYCalendar(); }
function tyCalNext() { TY_CAL_DATE.setMonth(TY_CAL_DATE.getMonth()+1); renderTYCalendar(); }

function renderTYCalendar() {
  var meses   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var diasSem = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var y = TY_CAL_DATE.getFullYear();
  var m = TY_CAL_DATE.getMonth();
  $('ty-cal-title').textContent = meses[m] + ' ' + y;

  var eventos = {};
  var today = new Date(); today.setHours(0,0,0,0);

  function addEv(dia, ev) { if(!eventos[dia]) eventos[dia]=[]; eventos[dia].push(ev); }

  TYC_DATA.forEach(function(ct) {
    var nombre = ct.inversionista || ct.numero;
    var label  = ct.numero + ' ' + nombre;
    var saldoLabel = ct.saldo_actual ? ' · ' + fm(ct.saldo_actual) : '';

    // Filtrar contratos ya vencidos (no mostrar eventos futuros de contratos pasados)
    var vd = ct.fecha_vencimiento || ct.proximo_vencimiento;
    var contratoVencido = false;
    if (vd) {
      var dvCheck = new Date(vd+'T12:00:00');
      if (dvCheck < today) contratoVencido = true;
    }

    // Vencimiento contrato (solo si vence en este mes)
    if (vd) {
      var dv = new Date(vd+'T12:00:00');
      if (dv.getFullYear()===y && dv.getMonth()===m)
        addEv(dv.getDate(), {tipo:'vence', label:label, color:'#e06200', numero:ct.numero, sublabel:'Saldo '+fm(ct.saldo_actual)});
      // Notif 60d antes (solo si no ha vencido)
      if (!contratoVencido) {
        var notif60 = new Date(dv); notif60.setDate(notif60.getDate()-60);
        if (notif60.getFullYear()===y && notif60.getMonth()===m)
          addEv(notif60.getDate(), {tipo:'notif', label:'Notif. '+ct.numero+' '+nombre, color:'#d4870a', numero:ct.numero, sublabel:'Notificar antes de vencimiento (60d)'});
      }
    }

    // Próximo reporte de rendimiento (solo contratos activos / no vencidos)
    if (ct.fecha_proximo_corte && !contratoVencido) {
      var dc = new Date(ct.fecha_proximo_corte+'T12:00:00');
      if (dc.getFullYear()===y && dc.getMonth()===m)
        addEv(dc.getDate(), {tipo:'corte', label:label, color:'#00A98D', numero:ct.numero, sublabel:'Reporte '+(ct.tipo_liquidacion||'Trimestral')+saldoLabel});
      // Prep memo 7d antes
      var prep = new Date(dc); prep.setDate(prep.getDate()-7);
      if (prep.getFullYear()===y && prep.getMonth()===m && prep>=today)
        addEv(prep.getDate(), {tipo:'prep', label:'Prep. '+ct.numero+' '+nombre, color:'#5B8DB8', numero:ct.numero, sublabel:'Preparar memo (7d antes del corte)'});
    }
  });

  var primerDia = new Date(y, m, 1).getDay();
  var diasMes   = new Date(y, m+1, 0).getDate();
  var hoy       = today.getFullYear()===y && today.getMonth()===m ? today.getDate() : -1;

  var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';
  diasSem.forEach(function(ds){ html+='<div style="text-align:center;font-size:9px;font-weight:700;color:var(--t3);padding:6px 2px;font-family:\'Syne\',sans-serif;letter-spacing:.5px">'+ds+'</div>'; });
  for (var i=0;i<primerDia;i++) html+='<div style="min-height:76px"></div>';
  for (var d=1;d<=diasMes;d++) {
    var evs=eventos[d]||[];
    var isHoy=d===hoy, has=evs.length>0;
    html+='<div style="min-height:76px;border-radius:8px;padding:4px;background:'+(isHoy?'rgba(0,169,141,0.1)':has?'var(--sf2)':'transparent')+';border:1px solid '+(isHoy?'rgba(0,169,141,0.4)':has?'var(--br)':'transparent')+'">';
    html+='<div style="text-align:right;font-size:9.5px;font-weight:'+(isHoy||has?'700':'400')+';color:'+(isHoy?'#00D5B0':has?'var(--t)':'var(--t3)')+';margin-bottom:3px;font-family:\'DM Mono\',monospace;padding-right:2px">'+d+'</div>';
    evs.slice(0,3).forEach(function(ev){
      html+='<div style="font-size:8.5px;padding:2px 4px;border-radius:3px;background:'+ev.color+'18;color:'+ev.color+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;border-left:2px solid '+ev.color+';line-height:1.3;cursor:pointer" title="'+ev.label+' — '+ev.sublabel+'" onclick="openPerfil(\''+ev.numero+'\')">'+ev.label+'</div>';
    });
    if(evs.length>3) html+='<div style="font-size:6.5px;color:var(--t3);text-align:center">+' +(evs.length-3)+' más</div>';
    html+='</div>';
  }
  html+='</div>';
  $('ty-calendar').innerHTML=html;

  // Lista
  var listMes=[];
  Object.keys(eventos).sort(function(a,b){return parseInt(a)-parseInt(b);}).forEach(function(dia){
    eventos[dia].forEach(function(ev){listMes.push({dia:parseInt(dia),ev:ev});});
  });
  if(!listMes.length){$('ty-cal-list').innerHTML='<div style="text-align:center;color:var(--t3);padding:20px;font-size:12px">Sin eventos en este mes</div>';return;}

  var nV=listMes.filter(function(i){return i.ev.tipo==='vence';}).length;
  var nC=listMes.filter(function(i){return i.ev.tipo==='corte';}).length;
  var nN=listMes.filter(function(i){return i.ev.tipo==='notif'||i.ev.tipo==='prep';}).length;
  var res='';
  if(nV) res+='<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:10px;color:#e06200"><span style="width:7px;height:7px;border-radius:50%;background:#e06200;display:inline-block"></span>'+nV+' vencimiento'+(nV>1?'s':'')+'</span>';
  if(nC) res+='<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:10px;color:#00A98D"><span style="width:7px;height:7px;border-radius:50%;background:#00A98D;display:inline-block"></span>'+nC+' reporte'+(nC>1?'s':'')+'</span>';
  if(nN) res+='<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#d4870a"><span style="width:7px;height:7px;border-radius:50%;background:#d4870a;display:inline-block"></span>'+nN+' aviso'+(nN>1?'s':'')+'</span>';

  // Build grid: group events by inversionista (numero), organize by type columns
  var evByInv = {};
  listMes.forEach(function(item) {
    var key = item.ev.numero;
    if (!evByInv[key]) evByInv[key] = {numero: key, label: '', vence: null, corte: null, notif: null, prep: null, diaMin: 99};
    evByInv[key][item.ev.tipo] = {dia: item.dia, ev: item.ev};
    if (item.dia < evByInv[key].diaMin) evByInv[key].diaMin = item.dia;
    // Get the investor name from label (first occurrence)
    if (!evByInv[key].label || item.ev.tipo === 'vence' || item.ev.tipo === 'corte') {
      evByInv[key].label = item.ev.label;
    }
  });
  var gridRows = Object.values(evByInv).sort(function(a,b){return a.diaMin - b.diaMin;});

  var gridHTML = '<table style="width:100%;border-collapse:separate;border-spacing:0;font-size:11px">'
    +'<thead><tr style="background:var(--sf2)">'
    +'<th style="text-align:left;padding:8px 10px;font-size:9px;font-weight:700;color:var(--t3);letter-spacing:1px;border-bottom:1px solid var(--br);font-family:\'Syne\',sans-serif">INVERSIONISTA</th>'
    +'<th style="text-align:center;padding:8px 10px;font-size:9px;font-weight:700;color:#e06200;letter-spacing:1px;border-bottom:1px solid var(--br);font-family:\'Syne\',sans-serif;min-width:130px">VENCIMIENTO</th>'
    +'<th style="text-align:center;padding:8px 10px;font-size:9px;font-weight:700;color:#00A98D;letter-spacing:1px;border-bottom:1px solid var(--br);font-family:\'Syne\',sans-serif;min-width:140px">REPORTES</th>'
    +'<th style="text-align:center;padding:8px 10px;font-size:9px;font-weight:700;color:#d4870a;letter-spacing:1px;border-bottom:1px solid var(--br);font-family:\'Syne\',sans-serif;min-width:130px">AVISOS</th>'
    +'</tr></thead><tbody>';

  gridRows.forEach(function(row) {
    var vCell = '—', cCell = '—', aCell = '—';

    // Vencimiento column
    if (row.vence) {
      vCell = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">'
        +'<span style="font-family:\'DM Mono\',monospace;font-weight:700;color:#e06200;font-size:12px">'+meses[m]+' '+row.vence.dia+'</span>'
        +'<span style="font-size:9px;color:#e06200">' + row.vence.ev.sublabel + '</span></div>';
    }

    // Reporte column
    if (row.corte) {
      cCell = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">'
        +'<span style="font-family:\'DM Mono\',monospace;font-weight:700;color:#00A98D;font-size:12px">'+meses[m]+' '+row.corte.dia+'</span>'
        +'<span style="font-size:9px;color:#00A98D">' + row.corte.ev.sublabel + '</span></div>';
    }

    // Avisos column (notif + prep combined)
    var avisos = [];
    if (row.notif) avisos.push('<span style="font-size:9px;color:#d4870a">'+meses[m]+' '+row.notif.dia+' · '+row.notif.ev.sublabel+'</span>');
    if (row.prep) avisos.push('<span style="font-size:9px;color:#5B8DB8">'+meses[m]+' '+row.prep.dia+' · '+row.prep.ev.sublabel+'</span>');
    if (avisos.length) aCell = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">'+avisos.join('')+'</div>';

    gridHTML += '<tr style="border-bottom:1px solid var(--br);cursor:pointer" onclick="openPerfil(\''+row.numero+'\')">'
      +'<td style="padding:10px;border-bottom:1px solid var(--br)">'
        +'<div style="font-weight:600;color:var(--t)">'+row.label+'</div>'
      +'</td>'
      +'<td style="padding:10px;text-align:center;border-bottom:1px solid var(--br)">'+vCell+'</td>'
      +'<td style="padding:10px;text-align:center;border-bottom:1px solid var(--br)">'+cCell+'</td>'
      +'<td style="padding:10px;text-align:center;border-bottom:1px solid var(--br)">'+aCell+'</td>'
      +'</tr>';
  });
  gridHTML += '</tbody></table>';

  $('ty-cal-list').innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
    '<div style="font-size:10px;font-weight:700;color:var(--t3);letter-spacing:1.5px;font-family:\'Syne\',sans-serif">EVENTOS DEL MES</div>'+
    '<div>'+res+'</div></div>'+
    '<div class="tw"><div class="tw-scroll">'+gridHTML+'</div></div>';
}

// ── CONTRATOS TABLE ──────────────────────────────────────────
function renderTY() {
  var q=$('ty-q').value.toLowerCase(), f=F.ty;
  var rows=TYC_DATA.filter(function(r){
    if(f==='urgente'&&r.dias_al_vencimiento>=30) return false;
    if(f==='proximo'&&r.dias_al_vencimiento>=180) return false;
    if(f==='hold'&&r.estado!=='On Hold') return false;
    if(q&&!r.inversionista.toLowerCase().includes(q)&&!r.numero.toLowerCase().includes(q)) return false;
    return true;
  });
  if(!rows.length){
    $('ty-body').innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:20px">Sin resultados</td></tr>';
    $('ty-cards').innerHTML=''; return;
  }
  $('ty-body').innerHTML=rows.map(function(r,ix){
    var col=PAL[ix%PAL.length], d=r.dias_al_vencimiento;
    var vd=r.fecha_vencimiento||r.proximo_vencimiento;
    var dpill=d<30?'<span class="pill" style="background:var(--ord);color:var(--or);border:1px solid rgba(255,122,0,0.35)"><span class="dot"></span>'+d+'d</span>':d<180?'<span class="pill pw"><span class="dot"></span>'+d+'d</span>':'<span style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--t3)">'+d+'d</span>';
    var sp=r.estado==='On Hold'?'<span class="pill ph"><span class="dot"></span>On Hold</span>':r.estado==='Terminado'?'<span class="pill pd"><span class="dot"></span>Terminado</span>':r.estado==='Liquidado'?'<span class="pill" style="background:rgba(91,103,112,0.15);color:#5B6770;border:1px solid rgba(91,103,112,0.3)"><span class="dot" style="background:#5B6770"></span>Liquidado</span>':'<span class="pill pg"><span class="dot"></span>Activo</span>';
    var pct=Math.min(98,Math.max(2,(Math.max(0,d)/365)*100));
    return '<tr onclick="openPerfil(\''+r.numero+'\')">'+
      '<td><div class="ic"><div class="iav" style="background:'+col+'18;color:'+col+';border:1px solid '+col+'30">'+ini(r.inversionista)+'</div><div class="inm">'+r.inversionista+'</div></div></td>'+
      '<td><span class="mn" style="color:'+col+'">'+r.numero+'</span></td>'+
      '<td><span class="mn" style="color:#00D5B0;font-weight:600">'+(r.saldo_actual?fm(r.saldo_actual):'—')+'</span></td>'+
      '<td><span class="mn" style="color:var(--t2)">'+fm(r.valor_inicial)+'</span></td>'+
      '<td><span style="font-size:10px;color:var(--t2)">'+(r.tipo_liquidacion||'—')+'</span></td>'+
      '<td><span style="font-size:10px;color:var(--t2)">'+fd(vd)+'</span><div class="vb"><div class="vbf" style="width:'+pct+'%;background:'+(d<30?'var(--or)':d<180?'var(--w)':'#5B8DB8')+'"></div></div></td>'+
      '<td>'+dpill+'</td><td>'+sp+'</td>'+
      '<td><button onclick="event.stopPropagation();editarContrato(\''+r.numero+'\')" style="background:rgba(91,141,184,0.1);border:1px solid rgba(91,141,184,0.3);border-radius:5px;padding:3px 10px;color:#5B8DB8;font-size:10px;cursor:pointer">&#9998; Editar</button></td>'+
    '</tr>';
  }).join('');
  $('ty-cards').innerHTML=rows.map(function(r,ix){
    var col=PAL[ix%PAL.length], d=r.dias_al_vencimiento;
    var vd=r.fecha_vencimiento||r.proximo_vencimiento;
    var dpill=d<30?'<span class="pill" style="background:var(--ord);color:var(--or);border:1px solid rgba(255,122,0,0.35)"><span class="dot"></span>'+d+'d</span>':d<180?'<span class="pill pw"><span class="dot"></span>'+d+'d</span>':'<span style="font-size:9.5px;color:var(--t3)">'+d+'d</span>';
    return '<div class="mcard">'+
      '<div class="mcard-hdr"><div class="ic"><div class="iav" style="background:'+col+'18;color:'+col+';border:1px solid '+col+'30">'+ini(r.inversionista)+'</div>'+
      '<div><div class="mcard-title">'+r.inversionista+'</div><div class="iid" style="color:'+col+'">'+r.numero+'</div></div></div>'+dpill+'</div>'+
      '<div class="mcard-grid" onclick="openPerfil(\''+r.numero+'\')">'+
      '<div class="mg-item"><div class="mgk">Capital inicial</div><div class="mgv" style="color:var(--t2)">'+fm(r.valor_inicial)+'</div></div>'+
      '<div class="mg-item"><div class="mgk">Saldo actual</div><div class="mgv" style="color:#00D5B0;font-weight:600">'+(r.saldo_actual?fm(r.saldo_actual):'—')+'</div></div>'+
      '<div class="mg-item"><div class="mgk">Vence</div><div class="mgv" style="color:'+(d<30?'var(--or)':d<180?'var(--w)':'var(--t2)')+'">'+fd(vd)+'</div></div>'+
      '<div class="mg-item"><div class="mgk">Estado</div><div class="mgv">'+(r.estado||'Activo')+'</div></div>'+
      '</div>'+
      '<div style="display:flex;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--br);margin-top:8px">'+
      '<button onclick="editarContrato(\''+r.numero+'\')" style="background:rgba(91,141,184,0.1);border:1px solid rgba(91,141,184,0.3);border-radius:5px;padding:3px 10px;color:#5B8DB8;font-size:10px;cursor:pointer">&#9998; Editar</button>'+
      '</div></div>';
  }).join('');
}


// ── PERFIL INVERSIONISTA ──────────────────────────────────────
async function openPerfil(numero) {
  // Load profile data
  const {data: perfil} = await db.from('vista_perfil_contrato').select('*').eq('numero', numero).single();
  const {data: movs} = await db.from('movimientos')
    .select('*')
    .eq('contrato_id', perfil?.contrato_id)
    .order('fecha', {ascending: true});

  const inv = TYC_DATA.find(c=>c.numero===numero) || {};
  const col = PAL[TYC_DATA.indexOf(inv) % PAL.length] || '#2ecc71';
  const vd = inv.fecha_vencimiento || inv.proximo_vencimiento;
  const p = perfil || {};
  const ms = movs || [];

  // Build sparkline chart from cortes
  const cortes = ms.filter(m=>m.tipo==='corte_rendimiento' && m.saldo_resultado);
  let chartSVG = '';
  if(cortes.length > 1) {
    const vals = cortes.map(c=>c.saldo_resultado);
    const min = Math.min(...vals), max = Math.max(...vals);
    const W=460, H=60;
    const pts = vals.map((v,i)=>{
      const x=(i/(vals.length-1))*W;
      const y=H-((v-min)/(max-min||1))*(H-8)-4;
      return `${x},${y}`;
    }).join(' ');
    chartSVG = `
      <div style="background:var(--sf2);border-radius:8px;padding:14px 16px;margin-bottom:14px">
        <div style="font-family:"DM Mono",monospace;font-size:8.5px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">
          Evolución del capital · ${cortes.length} cortes
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:60px">
          <polyline fill="${col}" fill-opacity="0.08" stroke="none"
            points="0,${H} ${pts} ${W},${H}"/>
          <polyline fill="none" stroke="${col}" stroke-width="2" points="${pts}"/>
        </svg>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-family:"DM Mono",monospace;font-size:9.5px;color:var(--t3)">${fm(vals[0])}</span>
          <span style="font-family:"DM Mono",monospace;font-size:9.5px;color:${col}">${fm(vals[vals.length-1])}</span>
        </div>
      </div>`;
  }

  // Summary grid
  // % rendimiento = suma de los porcentajes de cada corte (no rendimiento_total / capital)
  const cortesMovs = ms.filter(m => m.tipo === 'corte_rendimiento');
  const sumPct = cortesMovs.reduce((a, m) => a + (parseFloat(m.porcentaje) || 0), 0);
  const rendPctDisplay = (sumPct * 100).toFixed(2);
  const totalRend = cortesMovs.reduce((a, m) => a + (parseFloat(m.valor_rendimiento) || 0), 0);
  const totalRetiros = ms.filter(m => m.pago_capital_mov < 0).reduce((a, m) => a + Math.abs(parseFloat(m.pago_capital_mov) || 0), 0);
  const summaryHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px">
      <div style="background:var(--sf2);border-radius:8px;padding:12px">
        <div style="font-size:8.5px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Saldo actual</div>
        <div style="font-size:16px;font-weight:700;color:var(--bl)">${fm(ms.length && ms[ms.length-1].saldo_resultado ? ms[ms.length-1].saldo_resultado : inv.saldo_actual)}</div>
      </div>
      <div style="background:var(--sf2);border-radius:8px;padding:12px">
        <div style="font-size:8.5px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Capital inicial</div>
        <div style="font-size:16px;font-weight:700">${fm(inv.valor_inicial)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div style="background:var(--sf2);border-radius:8px;padding:12px">
        <div style="font-size:8.5px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Total rendimientos</div>
        <div style="font-size:14px;font-weight:600;color:#00D5B0">${fm(totalRend)}</div>
      </div>
      <div style="background:var(--sf2);border-radius:8px;padding:12px">
        <div style="font-size:8.5px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">% Rendimiento total</div>
        <div style="font-size:14px;font-weight:600;color:${sumPct<0?'var(--d)':'#00D5B0'}">${rendPctDisplay}%</div>
      </div>
      <div style="background:var(--sf2);border-radius:8px;padding:12px">
        <div style="font-size:8.5px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Retiros</div>
        <div style="font-size:14px;font-weight:600;color:var(--w)">${fm(totalRetiros)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div><div style="font-size:8.5px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:2px">Inicio contrato</div><div style="font-size:12px">${fd(inv.fecha_inicio)}</div></div>
      <div><div style="font-size:8.5px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:2px">Próx. vencimiento</div><div style="font-size:12px;color:${inv.dias_al_vencimiento<60?'var(--w)':'var(--t)'}">${fd(vd)}</div></div>
      <div><div style="font-size:8.5px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:2px">Liquidación</div><div style="font-size:12px">${inv.tipo_liquidacion||'—'}</div></div>
    </div>`;

  // Annual summary by investment cycle
  // Usa tipo_liquidacion almacenado POR MOVIMIENTO (campo en BD)
  // Trimestral = 4 cortes por ciclo · Semestral = 2 · Anual = 1
  const anualHTML = (() => {
    const cortes = ms.filter(m=>m.tipo==='corte_rendimiento' && m.fecha);
    if(!cortes.length) return '';

    const cycles = {};
    let cycleNum = 0, countInCycle = 0, currentTipo = null, currentRpc = null;

    cortes.forEach(m => {
      // Leer tipo del movimiento; si null, heredar del contrato
      const tipo = m.tipo_liquidacion || inv.tipo_liquidacion || 'Trimestral';
      const rpc = tipo.toLowerCase().includes('semest') ? 2
                : tipo.toLowerCase().includes('anual') ? 1 : 4;

      // Nuevo ciclo si cambia el tipo O se completaron los reportes del ciclo actual
      if(tipo !== currentTipo || countInCycle >= currentRpc) {
        cycleNum++;
        countInCycle = 0;
        currentTipo = tipo;
        currentRpc = rpc;
      }
      countInCycle++;

      const key = 'Ciclo '+cycleNum+' · '+tipo;
      if(!cycles[key]) cycles[key] = {cortes:[], totalRend:0, totalReinv:0, pcts:[]};
      cycles[key].cortes.push(m);
      cycles[key].totalRend += parseFloat(m.valor_rendimiento)||0;
      cycles[key].totalReinv += parseFloat(m.valor_reinversion)||0;
      if(m.porcentaje) cycles[key].pcts.push(parseFloat(m.porcentaje));
    });
    const rows = Object.entries(cycles).map(([key, data]) => {
      const avgPct = data.pcts.length ? (data.pcts.reduce((a,b)=>a+b,0)/data.pcts.length*100).toFixed(2)+'%' : '—';
      const lastSaldo = data.cortes[data.cortes.length-1] ? data.cortes[data.cortes.length-1].saldo_resultado : null;
      return '<tr style="border-bottom:1px solid var(--br)">'
        +'<td style="padding:8px 10px;font-size:11px;font-weight:600;color:var(--t)">'+key+'</td>'
        +'<td style="padding:8px 10px;text-align:center;font-size:10px;color:var(--t2)">'+data.cortes.length+'</td>'
        +'<td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:11px;color:var(--bl)">'+fm(data.totalRend)+'</td>'
        +'<td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:11px;color:var(--t2)">'+fm(data.totalReinv)+'</td>'
        +'<td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:11px;color:var(--bl)"><b>'+avgPct+'</b></td>'
        +'<td style="padding:8px 10px;text-align:right;font-family:monospace;font-size:11px;font-weight:700">'+fm(lastSaldo)+'</td>'
        +'</tr>';
    }).join('');
    return '<div style="margin-bottom:14px">'
      +'<div style="font-family:monospace;font-size:8.5px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Resumen por ciclo anual</div>'
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:400px;background:var(--sf2);border-radius:8px;overflow:hidden">'
      +'<thead><tr style="border-bottom:1px solid var(--br);background:var(--sf2)">'
      +'<th style="padding:7px 10px;text-align:left;font-family:monospace;font-size:8px;color:var(--t3)">Ciclo</th>'
      +'<th style="padding:7px 10px;text-align:center;font-family:monospace;font-size:8px;color:var(--t3)">Cortes</th>'
      +'<th style="padding:7px 10px;text-align:right;font-family:monospace;font-size:8px;color:var(--t3)">Total rendim.</th>'
      +'<th style="padding:7px 10px;text-align:right;font-family:monospace;font-size:8px;color:var(--t3)">Reinversión</th>'
      +'<th style="padding:7px 10px;text-align:right;font-family:monospace;font-size:8px;color:var(--t3)">% prom.</th>'
      +'<th style="padding:7px 10px;text-align:right;font-family:monospace;font-size:8px;color:var(--t3)">Saldo cierre</th>'
      +'</tr></thead><tbody>'+rows+'</tbody>'
      +'</table></div></div>';
  })();

    // Movements history
  const movHTML = ms.length ? `
    <div style="font-family:"DM Mono",monospace;font-size:8.5px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">
      Historial de movimientos (${ms.length})
    </div>
    <div style="max-height:220px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;min-width:400px">
        <thead><tr style="border-bottom:1px solid var(--br)">
          <th style="padding:6px 8px;text-align:left;font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1px">Memo</th>
          <th style="padding:6px 8px;text-align:left;font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1px">Fecha</th>
          <th style="padding:6px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1px">Capital base</th>
          <th style="padding:6px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1px">% Período</th>
          <th style="padding:6px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1px">$ Rendimiento</th>
          <th style="padding:6px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1px">Reinversión</th>
          <th style="padding:6px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1px">Saldo</th>
          <th style="padding:6px 8px;text-align:left;font-family:"DM Mono",monospace;font-size:8px;color:var(--t3);letter-spacing:1px">Nota</th>
          ${USER_ROL==='admin' ? '<th style="padding:6px 8px;font-size:8px;color:var(--t3)"></th>' : ''}
        </tr></thead>
        <tbody>
          ${[...ms].reverse().map(m=>{
            const isCorte = m.tipo==='corte_rendimiento';
            const isRetiro = m.tipo==='retiro_capital';
            const isCapNuevo = m.tipo==='capital_nuevo';
            const rowBg = isRetiro?'background:rgba(210,38,48,0.04)':isCapNuevo?'background:rgba(0,213,176,0.04)':'';
            const tipoColor = isCorte?'#00A98D':isRetiro?'var(--or)':isCapNuevo?'#5B8DB8':'var(--t2)';
            const tipoLabel = isCorte?'Corte':isRetiro?'Retiro':isCapNuevo?'Capital nuevo':'Ajuste';
            const pctDisplay = m.porcentaje ? (m.porcentaje*100).toFixed(2)+'%' : '—';
            return `<tr style="border-bottom:1px solid var(--br);${rowBg}">
              <td style="padding:7px 8px;font-family:"DM Mono",monospace;font-size:10px;color:var(--bl)">${m.numero_memo||'—'}<div style="font-size:8px;color:${tipoColor}">${tipoLabel}</div></td>
              <td style="padding:7px 8px;font-size:10px;color:var(--t2)">${fd(m.fecha)}</td>
              <td style="padding:7px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:10px">${m.capital_base?fm(m.capital_base):'—'}</td>
              <td style="padding:7px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:10px;color:${m.porcentaje&&m.porcentaje<0?'var(--d)':m.porcentaje?'var(--bl)':'var(--t3)'}"><b>${pctDisplay}</b></td>
              <td style="padding:7px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:10px;color:${m.valor_rendimiento&&m.valor_rendimiento<0?'var(--d)':m.valor_rendimiento?'var(--bl)':m.pago_capital_mov&&m.pago_capital_mov<0?'var(--d)':'var(--t3)'}">${m.valor_rendimiento?fm(m.valor_rendimiento):m.pago_capital_mov?fm(m.pago_capital_mov):'—'}</td>
              <td style="padding:7px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:10px;color:var(--t2)">${m.valor_reinversion?fm(m.valor_reinversion):'—'}</td>
              <td style="padding:7px 8px;text-align:right;font-family:"DM Mono",monospace;font-size:10px;font-weight:700;color:var(--t)">${fm(m.saldo_resultado)}</td>
              <td style="padding:7px 8px;font-size:9px;color:var(--t3);max-width:120px">${(()=>{const {texto,url}=parseSoporte(m.anotaciones);return texto+(url?` <a href="${url}" target="_blank" style="color:var(--ac);text-decoration:none">📄</a>`:'')})()||''}</td>
              <td style="padding:7px 8px;white-space:nowrap">
                ${USER_ROL==='admin' ? `
                  <button onclick="editarMov('${m.id}','${numero}')" style="background:rgba(0,213,176,0.1);border:1px solid #00A98D;color:#00D5B0;border-radius:5px;padding:3px 8px;font-size:9px;cursor:pointer;margin-right:4px">Editar</button>
                  <button onclick="eliminarMov('${m.id}','${numero}')" style="background:rgba(210,38,48,0.1);border:1px solid #D22630;color:#D22630;border-radius:5px;padding:3px 8px;font-size:9px;cursor:pointer">Borrar</button>
                ` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : `<div style="color:var(--t3);font-size:12px;padding:12px 0;text-align:center">Sin movimientos registrados</div>`;

  // New movement form
  const formHTML = `
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--br)">
      <div style="font-family:"DM Mono",monospace;font-size:8.5px;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">
        ➕ Registrar nuevo movimiento
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Tipo</div>
          <select id="mov-tipo" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
            <option value="corte_rendimiento">Corte de rendimiento</option>
            <option value="retiro_capital">Retiro de capital</option>
            <option value="capital_nuevo">Capital nuevo</option>
            <option value="ajuste">Ajuste / N.C.</option>
          </select>
        </div>
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Liquidación</div>
          <select id="mov-liq" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
            <option value="Trimestral">Trimestral</option>
            <option value="Semestral">Semestral</option>
            <option value="Anual">Anual</option>
          </select>
        </div>
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Fecha</div>
          <input id="mov-fecha" type="date" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Memo #</div>
          <input id="mov-memo" type="text" placeholder="ej: 1331" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
        </div>
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Capital base <span style="color:var(--bl);font-size:8px">AUTO</span></div>
          <input id="mov-capital" type="number" placeholder="0.00" oninput="movRecalc()" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--bl);font-size:12px;font-weight:600;outline:none">
        </div>
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">% Período</div>
          <input id="mov-pct" type="number" step="0.0001" placeholder="0.0300" oninput="movRecalc()" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
        </div>
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">$ Rendimiento <span style="color:var(--bl);font-size:8px">AUTO</span></div>
          <input id="mov-rend" type="number" placeholder="0.00" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--bl);font-size:12px;font-weight:600;outline:none" readonly>
        </div>
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">$ Reinversión</div>
          <input id="mov-reinv" type="number" placeholder="0.00" oninput="movRecalc()" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
        </div>
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">(-) Pago / Retiro de capital</div>
          <input id="mov-pago" type="number" placeholder="0.00 (negativo p.ej. -19511)" oninput="movRecalc()" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
        </div>
        <div>
          <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Saldo resultado <span style="color:var(--bl);font-size:8px">AUTO</span></div>
          <input id="mov-saldo" type="number" placeholder="0.00" style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--bl);font-size:12px;font-weight:700;outline:none" readonly>
        </div>
      </div>
      <div style="margin-bottom:8px">
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">Anotaciones</div>
        <input id="mov-nota" type="text" placeholder="Observaciones opcionales..." style="width:100%;background:var(--sf2);border:1px solid var(--br);border-radius:7px;padding:7px 10px;color:var(--t);font-size:12px;outline:none">
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:9px;color:var(--t3);font-family:"DM Mono",monospace;margin-bottom:4px">📎 Soporte / Memo</div>
        <label style="display:flex;align-items:center;gap:8px;background:var(--sf2);border:1px dashed var(--br);border-radius:7px;padding:9px 12px;cursor:pointer"
          onmouseover="this.style.borderColor='var(--ac)'" onmouseout="this.style.borderColor='var(--br)'">
          <span style="font-size:18px">📄</span>
          <div>
            <div style="font-size:11px;color:var(--t)">Adjuntar memo o comprobante</div>
            <div style="font-size:9px;color:var(--t3)" id="mov-file-label">JPG, PNG, PDF · máx 5MB</div>
          </div>
          <input type="file" id="mov-file" accept="image/*,.pdf" style="display:none" onchange="previewFile(this,'mov-file-label')">
        </label>
      </div>
      <button onclick="guardarMovimiento('${numero}')" style="width:100%;background:var(--ac);color:#07100a;border:none;border-radius:7px;padding:9px;font-size:13px;font-weight:700;cursor:pointer">
        Guardar movimiento
      </button>
      <div id="mov-err" style="font-size:11px;color:var(--d);margin-top:6px;min-height:14px"></div>
    </div>`;

  $('m-t').textContent = inv.inversionista || numero;
  $('m-s').textContent = `${numero} · ${inv.tipo_liquidacion||''} · ${inv.estado||''}`;
  $('m-b').innerHTML = summaryHTML + chartSVG + anualHTML + movHTML + (USER_ROL==='admin'?formHTML:'');
  // Auto-fill capital base desde el último saldo del contrato
  if(USER_ROL === 'admin') {
    const lastSaldo = ms.length ? ms[ms.length-1].saldo_resultado : null;
    if(lastSaldo && $('mov-capital')) {
      $('mov-capital').value = Math.round(lastSaldo * 100) / 100;
    }
    // Listener para recalcular al cambiar la fecha (podría cambiar el capital base)
    if($('mov-fecha')) $('mov-fecha').addEventListener('change', function() {
      const fechaNueva = this.value;
      const movAnteriores = ms.filter(m => m.fecha < fechaNueva && m.saldo_resultado);
      if(movAnteriores.length) {
        const ultimo = movAnteriores[movAnteriores.length-1];
        if($('mov-capital')) $('mov-capital').value = Math.round(ultimo.saldo_resultado * 100) / 100;
        movRecalc();
      }
    });
  }
  // Add ficha + edit contract buttons to modal header
  const mhdr = document.querySelector('.mhdr');
  if(mhdr) {
    if(!$('btn-ficha-inv')) {
      const btn = document.createElement('button');
      btn.id = 'btn-ficha-inv';
      btn.className = 'btn btn-g';
      btn.style.fontSize = '10px';
      btn.textContent = '👤 Ficha';
      btn.onclick = () => openInvFicha(inv.inversionista);
      mhdr.appendChild(btn);
    } else {
      $('btn-ficha-inv').onclick = () => openInvFicha(inv.inversionista);
    }
    if(!$('btn-edit-contrato')) {
      const btnE = document.createElement('button');
      btnE.id = 'btn-edit-contrato';
      btnE.className = 'btn btn-g';
      btnE.style.cssText = 'font-size:10px;background:rgba(91,141,184,0.12);border:1px solid rgba(91,141,184,0.35);color:#5B8DB8';
      btnE.textContent = '✎ Editar contrato';
      btnE.onclick = () => { closeM(); setTimeout(() => editarContrato(numero), 100); };
      mhdr.appendChild(btnE);
    } else {
      $('btn-edit-contrato').onclick = () => { closeM(); setTimeout(() => editarContrato(numero), 100); };
    }
  }
  $('ov').classList.add('on');
}

function movRecalc() {
  const cap  = parseFloat($('mov-capital') && $('mov-capital').value) || 0;
  const pct  = parseFloat($('mov-pct') && $('mov-pct').value) || 0;
  const reinv = parseFloat($('mov-reinv') && $('mov-reinv').value) || 0;
  const pago = parseFloat($('mov-pago') && $('mov-pago').value) || 0;
  // $ Rendimiento = capital × % (auto, readonly)
  if($('mov-rend')) {
    const rend = cap > 0 && pct > 0 ? Math.round(cap * pct * 100) / 100 : 0;
    $('mov-rend').value = rend > 0 ? rend : '';
  }
  // Saldo = capital + reinversion + pago (pago negativo = retiro)
  if($('mov-saldo') && cap > 0) {
    const saldo = Math.round((cap + reinv + pago) * 100) / 100;
    $('mov-saldo').value = saldo;
  }
}

async function guardarMovimiento(numero) {
  const contrato = TYC_DATA.find(c=>c.numero===numero);
  if(!contrato) return;

  // Get contrato_id
  const {data: ct} = await db.from('contratos_tycoon').select('id').eq('numero', numero).single();
  if(!ct) { $('mov-err').textContent='Error: contrato no encontrado'; return; }

  const tipo   = $('mov-tipo').value;
  const fecha  = $('mov-fecha').value;
  const memo   = $('mov-memo').value || null;
  const cap    = parseFloat($('mov-capital').value) || null;
  const pct    = parseFloat($('mov-pct').value) || null;
  const rend   = parseFloat($('mov-rend').value) || null;
  const reinv  = parseFloat($('mov-reinv').value) || null;
  const pago   = parseFloat($('mov-pago') && $('mov-pago').value) || null;
  const saldo  = parseFloat($('mov-saldo').value) || null;
  const nota   = $('mov-nota').value || null;
  const liq    = $('mov-liq') ? $('mov-liq').value : null;

  if(!fecha) { $('mov-err').textContent='La fecha es obligatoria'; return; }
  if(!saldo) { $('mov-err').textContent='El saldo resultado es obligatorio'; return; }

  const {data: movData, error} = await db.from('movimientos').insert({
    contrato_id: ct.id,
    numero_memo: memo,
    fecha, tipo,
    tipo_liquidacion: liq,
    capital_base: cap,
    porcentaje: pct,
    valor_rendimiento: rend,
    valor_reinversion: reinv,
    pago_capital_mov: pago,
    saldo_resultado: saldo,
    anotaciones: nota
  }).select().single();

  if(error) { $('mov-err').textContent='Error al guardar: '+error.message; return; }

  // Upload file soporte if selected
  const fileEl = $('mov-file');
  if(fileEl && fileEl.files && fileEl.files[0] && movData) {
    const file = fileEl.files[0];
    const ts = Date.now();
    const ext = file.name.split('.').pop();
    const path = `tycoon/${numero}/mov-${movData.id}-${ts}.${ext}`;
    const {error: errFile} = await db.storage.from('soportes-tycoon').upload(path, file, {upsert:true});
    if(!errFile) {
      const {data: urlData} = db.storage.from('soportes-tycoon').getPublicUrl(path);
      // Acumular: preservar texto + todos los [soporte:URL] previos + el nuevo
      const anotBase = (nota||'');
      const nuevaAnotacion = anotBase + '[soporte:' + urlData.publicUrl + ']';
      await db.from('movimientos').update({anotaciones: nuevaAnotacion}).eq('id', movData.id);
    }
  }

  // Update saldo_actual in contract
  if(saldo) {
    await db.from('contratos_tycoon').update({saldo_actual: saldo}).eq('numero', numero);
  }

  toast('Movimiento guardado ✓','ok');
  closeM();
  await loadTycoon();
}

// ── DÍAZ ──────────────────────────────────────────────────────
