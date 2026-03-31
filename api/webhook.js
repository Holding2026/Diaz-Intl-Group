// ============================================================
// DÍAZ INTL GROUP — WhatsApp Bot
// ============================================================

const SUPABASE_URL = 'https://flmfgrgnmigdwdnrzgkw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsbWZncmdubWlnZHdkbnJ6Z2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODU3MzUsImV4cCI6MjA5MDU2MTczNX0.xCXujNCVTc7D7S6J8qK3qM-2ROv0n6JADT9qTN9PBlI';
const ULTRAMSG_INSTANCE = 'instance168037';
const ULTRAMSG_TOKEN = '7b6klistnx4jz7gu';

const fm = n => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
const fd = s => s ? new Date(s+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—';

async function supabase(table, params='') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return r.json();
}

async function sendMsg(to, body) {
  await fetch(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`, {
    method: 'POST',
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({token: ULTRAMSG_TOKEN, to, body})
  });
}

// Extraer nombre: quitar palabras comunes y quedarse con lo que parece nombre
function extraerNombre(texto) {
  const QUITAR = /\b(necesito|saber|quiero|ver|dame|dime|muestra|muestrame|cual|cuanto|cuantos|como|que|del|los|las|una|uno|con|por|para|hay|esta|este|pero|mas|sin|muy|saldo|resumen|historial|informacion|información|completo|inversionista|contrato|tycoon|kii|diaz|de|el|la|en|al|su|sus|tiene|queda|devolverle|pendiente|pronto|vence|vencen|cobrar|me|le|fue|fue|ultimo|último|reporte|informe|datos|estado|situacion|situación|portafolio|inversión|inversion|dinero|plata|capital|cuenta|balance|fue|cuál|cuál|dónde|donde|cuando|cómo|porqué|porque|decirme|contarme|mostrarme|darme|explicarme|actualización|actualizacion|novedad|novedades|noticias|ultimo|última|reciente|recientes|nuevo|nueva)\b/gi;
  const limpio = texto.replace(QUITAR, ' ').replace(/\s+/g, ' ').trim();
  // Si quedan varias palabras, tomar las últimas 3 (más probables de ser el nombre)
  const palabras = limpio.split(' ').filter(p => p.length > 1);
  if (!palabras.length) return null;
  return palabras.slice(-3).join(' ').trim();
}

async function buscarInversionista(nombre) {
  if (!nombre || nombre.length < 2) return null;
  const t = encodeURIComponent(nombre);
  const [tycoon, kii] = await Promise.all([
    supabase('vista_perfil_contrato', `?or=(inversionista.ilike.*${t}*,numero.ilike.*${t}*)`),
    supabase('posiciones_kii', `?inversionista_nombre=ilike.*${t}*`)
  ]);
  const ty = Array.isArray(tycoon) ? tycoon : [];
  const ki = Array.isArray(kii) ? kii : [];
  if (!ty.length && !ki.length) return null;
  return {ty, ki};
}

function respuestaInversionista(data, nombre) {
  if (!data) return `❌ No encontré a *${nombre}*.\nIntente con nombre exacto o contrato (T8, T17...)`;
  
  let resp = '';

  if (data.ty.length) {
    data.ty.slice(0,3).forEach(c => {
      const dias = c.dias_al_vencimiento;
      const alerta = dias < 30 ? '🔴 VENCE PRONTO' : dias < 60 ? '🟡 Próximo' : '🟢 Al día';
      resp += '📊 *TYCOON*\n';
      resp += `━━━━━━━━━━━━━━\n`;
      resp += `👤 *${c.inversionista}*\n`;
      resp += `📋 ${c.numero} · ${c.tipo_liquidacion}\n\n`;
      resp += `💰 *Financiero:*\n`;
      resp += `• Capital inicial: ${fm(c.valor_inicial)}\n`;
      resp += `• Saldo actual: *${fm(c.saldo_actual)}*\n`;
      resp += `• Crecimiento: ${(c.crecimiento_pct||0)>=0?'📈':'📉'} *${c.crecimiento_pct||0}%*\n`;
      resp += `• Rendimientos: ${fm(c.total_rendimientos)} (${c.rendimiento_total_pct||0}%)\n`;
      resp += `• Retiros: ${fm(c.total_retiros)}\n\n`;
      resp += `📅 *Vencimiento:*\n`;
      resp += `• ${fd(c.fecha_vencimiento)} · ${dias}d · ${alerta}\n\n`;
    });
  }

  if (data.ki.length) {
    resp += '⬡ *KII EXCHANGE*\n';
    resp += `━━━━━━━━━━━━━━\n`;
    data.ki.forEach(i => {
      resp += `📋 ${i.contrato} · Desde: ${fd(i.fecha_inversion)}\n`;
      resp += `💰 Invertido: ${fm(i.valor_inversion)}\n`;
      resp += `🪙 KII Coins: ${Number(i.kii_coins||0).toLocaleString()}\n`;
      resp += `📈 Staking: ${Number(i.staking_acumulado||0).toLocaleString()}\n`;
      resp += `🏦 Total tokens: *${Number(i.total_tokens||0).toLocaleString()}*\n`;
      resp += `💵 Valor @$0.02: *${fm((i.total_tokens||0)*0.02)}*\n\n`;
    });
  }

  return resp.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({status:'Bot activo ✅'});

  try {
    const body = req.body;
    const from = body.data?.from || body.from || '';
    const text = (body.data?.body || body.body || '').trim();
    const type = body.data?.type || body.type || '';

    if (type !== 'chat' && type !== 'text') return res.status(200).json({status:'ignored'});
    if (body.data?.fromMe) return res.status(200).json({status:'own'});
    if (!text) return res.status(200).json({status:'empty'});

    console.log(`MSG from ${from}: ${text}`);

    const m = text.toLowerCase().trim();

    // AYUDA
    if (/^(hola|ayuda|menu|menú|help|inicio|start)$/.test(m)) {
      await sendMsg(from, `🏢 *Díaz Intl Group*\n\nEscríbeme el nombre de cualquier inversionista y te doy el resumen completo.\n\nEjemplos:\n• _caterine_\n• _alejandro hoyos_\n• _T8_\n• _vencimientos_\n• _kii todos_\n• _facturas_`);
      return res.status(200).json({status:'ok'});
    }

    // VENCIMIENTOS
    if (m.includes('vencimiento') || m.includes('vence') || (m.includes('proximo') || m.includes('próximo'))) {
      const data = await supabase('vista_contratos_vencimiento', '?order=dias_al_vencimiento.asc&limit=15');
      if (!Array.isArray(data) || !data.length) { await sendMsg(from, '❌ No se encontraron datos.'); return res.status(200).json({status:'ok'}); }
      const urg = data.filter(c=>c.dias_al_vencimiento<60);
      let resp = '📅 *Próximos vencimientos*\n\n';
      urg.forEach(c=>{
        const e = c.dias_al_vencimiento<30?'🔴':'🟡';
        resp += `${e} *${c.inversionista}* · ${c.numero}\n`;
        resp += `   ${fd(c.fecha_vencimiento)} · ${c.dias_al_vencimiento}d · ${fm(c.saldo_actual)}\n\n`;
      });
      const otros = data.filter(c=>c.dias_al_vencimiento>=60&&c.dias_al_vencimiento<180);
      if (otros.length) { resp += `📋 *Próx. 6 meses:*\n`; otros.forEach(c=>{ resp+=`🟢 ${c.inversionista} · ${c.numero} · ${c.dias_al_vencimiento}d\n`; }); }
      const total = data.reduce((a,c)=>a+(c.saldo_actual||0),0);
      resp += `\n💰 Capital total: *${fm(total)}*`;
      await sendMsg(from, resp);
      return res.status(200).json({status:'ok'});
    }

    // CONTRATOS TODOS
    if (m==='contratos' || m==='todos los contratos') {
      const data = await supabase('vista_contratos_vencimiento','?order=dias_al_vencimiento.asc');
      let resp = `📊 *Contratos Tycoon — ${data.length}*\n\n`;
      data.forEach(c=>{ const e=c.estado==='On Hold'?'⏸':c.estado==='Terminado'?'🔴':'🟢'; resp+=`${e} *${c.numero}* · ${c.inversionista} · ${fm(c.saldo_actual)} · ${c.dias_al_vencimiento}d\n`; });
      const total = data.reduce((a,c)=>a+(c.saldo_actual||0),0);
      resp += `\n💰 *Total: ${fm(total)}*`;
      await sendMsg(from, resp);
      return res.status(200).json({status:'ok'});
    }

    // FACTURAS / CARTERA
    if (m.includes('factura') || m.includes('cartera') || m.includes('cobrar') || m.includes('pendiente')) {
      const data = await supabase('facturas_diaz','?estado=in.(Abono,Pendiente)&order=fecha_factura.desc');
      if (!Array.isArray(data)||!data.length) { await sendMsg(from,'✅ Sin cartera pendiente.'); return res.status(200).json({status:'ok'}); }
      let resp = '💼 *Cartera pendiente Díaz Intl*\n\n';
      data.forEach(f=>{ resp+=`${f.estado==='Abono'?'🟡':'🔴'} *${f.cliente_nombre}*\n   #${f.numero_factura} · ${f.moneda} ${fm(f.valor)} · ${fd(f.fecha_factura)}\n${f.observaciones?'   📝 '+f.observaciones+'\n':''}\n`; });
      const usd=data.filter(f=>f.moneda==='USD').reduce((a,f)=>a+f.valor,0);
      const eur=data.filter(f=>f.moneda==='EUR').reduce((a,f)=>a+f.valor,0);
      if(usd>0) resp+=`💵 USD: *${fm(usd)}*\n`;
      if(eur>0) resp+=`💶 EUR: *${fm(eur)}*\n`;
      await sendMsg(from, resp);
      return res.status(200).json({status:'ok'});
    }

    // KII TODOS
    if (m==='kii' || m==='kii todos' || m==='kii total') {
      const data = await supabase('posiciones_kii','?order=valor_inversion.desc');
      if (!Array.isArray(data)||!data.length) { await sendMsg(from,'❌ Sin datos KII.'); return res.status(200).json({status:'ok'}); }
      const tt=data.reduce((a,i)=>a+(i.total_tokens||0),0);
      const ti=data.reduce((a,i)=>a+(i.valor_inversion||0),0);
      let resp=`⬡ *KII Exchange — ${data.length} posiciones*\n\n`;
      resp+=`💰 Total invertido: ${fm(ti)}\n`;
      resp+=`🏦 Total tokens: ${Number(tt).toLocaleString()}\n`;
      resp+=`💵 Valor @$0.02: *${fm(tt*0.02)}*\n\n`;
      resp+=`*Top 5:*\n`;
      data.slice(0,5).forEach(i=>{ resp+=`• ${i.inversionista_nombre} (${i.contrato}) — ${Number(i.total_tokens||0).toLocaleString()}\n`; });
      await sendMsg(from, resp);
      return res.status(200).json({status:'ok'});
    }

    // ÚLTIMO REPORTE / ÚLTIMO MEMO
    const esUltimoReporte = m.includes('ultimo') || m.includes('último') || 
      m.includes('reporte') || m.includes('memo') || m.includes('liquidacion') ||
      m.includes('liquidación') || m.includes('ultimo corte') || m.includes('último corte');

    if (esUltimoReporte) {
      const nombreRep = extraerNombre(text);
      if (nombreRep && nombreRep.length >= 3) {
        const t = encodeURIComponent(nombreRep);
        // Buscar contrato
        const contratos = await supabase('contratos_tycoon', 
          `?nombre_inversionista=ilike.*${t}*&select=id,numero,nombre_inversionista,saldo_actual`);
        
        if (Array.isArray(contratos) && contratos.length) {
          let resp = `📋 *Último corte — ${contratos[0].nombre_inversionista}*

`;
          
          for (const c of contratos.slice(0,3)) {
            // Obtener último movimiento
            const movs = await supabase('movimientos',
              `?contrato_id=eq.${c.id}&tipo=eq.corte_rendimiento&order=fecha.desc&limit=1`);
            
            if (Array.isArray(movs) && movs.length) {
              const m = movs[0];
              const pct = m.porcentaje ? (m.porcentaje*100).toFixed(2)+'%' : '—';
              resp += `📊 *${c.numero}*
`;
              resp += `━━━━━━━━━━━━━━
`;
              resp += `📅 Fecha: ${fd(m.fecha)}
`;
              resp += `🔢 Memo: ${m.numero_memo||'—'}
`;
              resp += `💰 Capital base: ${fm(m.capital_base)}
`;
              resp += `📈 % Período: *${pct}*
`;
              resp += `💵 Rendimiento: *${fm(m.valor_rendimiento)}*
`;
              resp += `🔄 Reinversión: ${fm(m.valor_reinversion)}
`;
              resp += `🏦 Saldo resultado: *${fm(m.saldo_resultado)}*
`;
              if (m.anotaciones) resp += `📝 Nota: ${m.anotaciones}
`;
              resp += `
💼 Saldo actual contrato: *${fm(c.saldo_actual)}*

`;
            } else {
              resp += `📊 *${c.numero}* — Sin cortes registrados

`;
            }
          }
          await sendMsg(from, resp.trim());
          return res.status(200).json({status:'ok'});
        } else {
          await sendMsg(from, `❌ No encontré contratos para "${nombreRep}".`);
          return res.status(200).json({status:'ok'});
        }
      }
    }

    // KII por nombre
    if (m.startsWith('kii ')) {
      const nombreKii = extraerNombre(text.replace(/^kii\s+/i,''));
      const kiiData = await supabase('posiciones_kii', `?inversionista_nombre=ilike.*${encodeURIComponent(nombreKii||'')}*`);
      if (Array.isArray(kiiData) && kiiData.length) {
        let resp = '⬡ *KII EXCHANGE*
━━━━━━━━━━━━━━
';
        kiiData.forEach(i => {
          resp += `👤 *${i.inversionista_nombre}* · ${i.contrato}
`;
          resp += `📅 Desde: ${fd(i.fecha_inversion)}
`;
          resp += `💰 Invertido: ${fm(i.valor_inversion)}
`;
          resp += `🪙 KII Coins: ${Number(i.kii_coins||0).toLocaleString()}
`;
          resp += `📈 Staking: ${Number(i.staking_acumulado||0).toLocaleString()}
`;
          resp += `🏦 Total tokens: *${Number(i.total_tokens||0).toLocaleString()}*
`;
          resp += `💵 Valor @$0.02: *${fm((i.total_tokens||0)*0.02)}*

`;
        });
        await sendMsg(from, resp.trim());
      } else {
        await sendMsg(from, `❌ No encontré posición KII para "${nombreKii}".`);
      }
      return res.status(200).json({status:'ok'});
    }

    // BUSQUEDA POR NOMBRE — busca en Tycoon Y KII simultáneamente
    const nombre = extraerNombre(text);
    if (nombre && nombre.length >= 3) {
      const t = encodeURIComponent(nombre);
      const [tycoon, kii] = await Promise.all([
        supabase('vista_perfil_contrato', `?or=(inversionista.ilike.*${t}*,numero.ilike.*${t}*)`),
        supabase('posiciones_kii', `?inversionista_nombre=ilike.*${t}*`)
      ]);
      const ty = Array.isArray(tycoon) ? tycoon : [];
      const ki = Array.isArray(kii) ? kii : [];
      
      if (!ty.length && !ki.length) {
        await sendMsg(from, `❌ No encontré a *${nombre}*.
Intente con nombre exacto o contrato (T8, T17, TK7...)`);
        return res.status(200).json({status:'ok'});
      }

      let resp = '';
      
      // Tycoon
      if (ty.length) {
        ty.slice(0,3).forEach(c => {
          const dias = c.dias_al_vencimiento;
          const alerta = dias<30?'🔴 VENCE PRONTO':dias<60?'🟡 Próximo':'🟢 Al día';
          resp += '📊 *TYCOON*
━━━━━━━━━━━━━━
';
          resp += `👤 *${c.inversionista}*
📋 ${c.numero} · ${c.tipo_liquidacion}

`;
          resp += `💰 *Financiero:*
`;
          resp += `• Capital inicial: ${fm(c.valor_inicial)}
`;
          resp += `• Saldo actual: *${fm(c.saldo_actual)}*
`;
          resp += `• Crecimiento: ${(c.crecimiento_pct||0)>=0?'📈':'📉'} *${c.crecimiento_pct||0}%*
`;
          resp += `• Rendimientos: ${fm(c.total_rendimientos)} (${c.rendimiento_total_pct||0}%)
`;
          resp += `• Retiros: ${fm(c.total_retiros)}

`;
          resp += `📅 *Vencimiento:*
• ${fd(c.fecha_vencimiento)} · ${dias}d · ${alerta}

`;
        });
      }
      
      // KII
      if (ki.length) {
        resp += '⬡ *KII EXCHANGE*
━━━━━━━━━━━━━━
';
        ki.forEach(i => {
          resp += `📋 ${i.contrato} · Desde: ${fd(i.fecha_inversion)}
`;
          resp += `💰 Invertido: ${fm(i.valor_inversion)}
`;
          resp += `🪙 KII Coins: ${Number(i.kii_coins||0).toLocaleString()}
`;
          resp += `📈 Staking: ${Number(i.staking_acumulado||0).toLocaleString()}
`;
          resp += `🏦 Total tokens: *${Number(i.total_tokens||0).toLocaleString()}*
`;
          resp += `💵 Valor @$0.02: *${fm((i.total_tokens||0)*0.02)}*

`;
        });
      }

      await sendMsg(from, resp.trim());
      return res.status(200).json({status:'ok'});
    }

    // No entendido
    await sendMsg(from, `🤖 Escríbeme el nombre del inversionista o uno de estos comandos:\n• _vencimientos_\n• _contratos_\n• _facturas_\n• _kii todos_\n• _ayuda_`);
    return res.status(200).json({status:'ok'});

  } catch(e) {
    console.error(e);
    return res.status(200).json({status:'error'});
  }
}
