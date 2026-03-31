// ============================================================
// DÍAZ INTL GROUP — WhatsApp Bot
// Vercel Serverless Function
// ============================================================

const SUPABASE_URL = 'https://wxxkqrapzyckcmssgdyp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGtxcmFwenlja2Ntc3NnZHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDE4MjQsImV4cCI6MjA5MDIxNzgyNH0.UoHdwn-kBUuS8Jkv5IYp5LCAaUH5tyzo7Gq3eIdeAmo';
const ULTRAMSG_INSTANCE = 'instance168037';
const ULTRAMSG_TOKEN = '7b6klistnx4jz7gu';

// Números autorizados (equipo interno)
const AUTHORIZED = [
  '573152739169', // John
  '57'            // agregar más aquí
];

// ── SUPABASE QUERY ────────────────────────────────────────────
async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

// ── SEND WHATSAPP MESSAGE ─────────────────────────────────────
async function sendMsg(to, body) {
  await fetch(`https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: ULTRAMSG_TOKEN, to, body })
  });
}

// ── FORMAT HELPERS ────────────────────────────────────────────
const fm = n => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fd = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── BOT LOGIC ─────────────────────────────────────────────────
async function procesarMensaje(texto, from) {
  const msg = texto.toLowerCase().trim();

  // AYUDA
  if (msg.includes('ayuda') || msg === 'hola' || msg === 'menu' || msg === 'menú') {
    return `🏢 *Díaz Intl Group — Bot interno*

Comandos disponibles:

📊 *Tycoon*
• \`saldo [nombre]\` — Saldo de un inversionista
• \`resumen [nombre o contrato]\` — Resumen ejecutivo completo
• \`vencimientos\` — Contratos próximos a vencer
• \`contratos\` — Lista todos los contratos

⬡ *KII Exchange*
• \`kii [nombre]\` — Posición KII de un inversionista
• \`kii todos\` — Resumen total KII

💼 *Díaz International*
• \`facturas\` — Cartera pendiente
• \`cartera\` — Saldo por cobrar

Escribe el comando y yo busco la info 🚀`;
  }

  // VENCIMIENTOS
  if (msg.includes('vencimiento') || msg.includes('vence') || msg.includes('próximo')) {
    const data = await query('vista_contratos_vencimiento', '?order=dias_al_vencimiento.asc&limit=10');
    if (!data || !data.length) return '❌ No se pudieron obtener los vencimientos.';

    const urgentes = data.filter(c => c.dias_al_vencimiento < 60);
    let resp = `📅 *Próximos vencimientos Tycoon*\n\n`;

    if (urgentes.length) {
      resp += `⚠️ *URGENTES (< 60 días):*\n`;
      urgentes.forEach(c => {
        const emoji = c.dias_al_vencimiento < 30 ? '🔴' : '🟡';
        resp += `${emoji} *${c.inversionista}* · ${c.numero}\n`;
        resp += `   Vence: ${fd(c.fecha_vencimiento)} (${c.dias_al_vencimiento}d)\n`;
        resp += `   Saldo: ${fm(c.saldo_actual)}\n\n`;
      });
    }

    const proximos = data.filter(c => c.dias_al_vencimiento >= 60 && c.dias_al_vencimiento < 180);
    if (proximos.length) {
      resp += `📋 *Próximos 6 meses:*\n`;
      proximos.forEach(c => {
        resp += `🟢 ${c.inversionista} · ${c.numero} — ${c.dias_al_vencimiento}d\n`;
      });
    }
    return resp;
  }

  // CONTRATOS (lista general)
  if (msg === 'contratos' || msg === 'todos los contratos') {
    const data = await query('vista_contratos_vencimiento', '?order=dias_al_vencimiento.asc');
    if (!data || !data.length) return '❌ No se pudieron obtener los contratos.';

    let resp = `📊 *Contratos Tycoon — ${data.length} activos*\n\n`;
    data.forEach(c => {
      const emoji = c.estado === 'On Hold' ? '⏸' : c.estado === 'Terminado' ? '🔴' : '🟢';
      resp += `${emoji} *${c.numero}* · ${c.inversionista}\n`;
      resp += `   Saldo: ${fm(c.saldo_actual)} · Vence: ${c.dias_al_vencimiento}d\n`;
    });
    const total = data.reduce((a, c) => a + (c.saldo_actual || 0), 0);
    resp += `\n💰 *Capital total: ${fm(total)}*`;
    return resp;
  }

  // RESUMEN / SALDO por nombre o contrato
  if (msg.startsWith('saldo ') || msg.startsWith('resumen ') || msg.startsWith('inv ')) {
    const termino = msg.replace(/^(saldo|resumen|inv)\s+/, '').trim();

    // Buscar por nombre o número de contrato
    const data = await query('vista_perfil_contrato',
      `?or=(inversionista.ilike.*${encodeURIComponent(termino)}*,numero.ilike.*${encodeURIComponent(termino)}*)`);

    if (!data || !data.length) {
      return `❌ No encontré ningún inversionista con "*${termino}*".\nIntente con el nombre completo o número de contrato (ej: T8, T17).`;
    }

    let resp = '';
    for (const c of data.slice(0, 3)) {
      const crec = c.crecimiento_pct || 0;
      const rendPct = c.rendimiento_total_pct || 0;
      const vd = c.fecha_vencimiento;
      const dias = c.dias_al_vencimiento;
      const alertaVenc = dias < 30 ? '🔴 VENCE PRONTO' : dias < 60 ? '🟡 Próximo a vencer' : '🟢 Al día';

      resp += `━━━━━━━━━━━━━━━━━━━━\n`;
      resp += `👤 *${c.inversionista}*\n`;
      resp += `📋 Contrato: *${c.numero}* · ${c.tipo_liquidacion}\n\n`;
      resp += `💰 *Resumen financiero:*\n`;
      resp += `• Capital inicial: ${fm(c.valor_inicial)}\n`;
      resp += `• Saldo actual: *${fm(c.saldo_actual)}*\n`;
      resp += `• Crecimiento: ${crec > 0 ? '📈' : '📉'} *${crec}%*\n`;
      resp += `• Total rendimientos: ${fm(c.total_rendimientos)}\n`;
      resp += `• % Rendimiento total: *${rendPct}%*\n`;
      resp += `• Total retiros: ${fm(c.total_retiros)}\n\n`;
      resp += `📅 *Vencimiento:*\n`;
      resp += `• Fecha: ${fd(vd)} (${dias} días)\n`;
      resp += `• Estado: ${alertaVenc}\n`;
      resp += `• Notificar antes: ${fd(new Date(new Date(vd + 'T12:00:00').setDate(new Date(vd + 'T12:00:00').getDate() - 60)).toISOString().split('T')[0])}\n\n`;

      // Últimos 3 cortes
      if (c.contrato_id) {
        const movs = await query('movimientos',
          `?contrato_id=eq.${c.contrato_id}&tipo=eq.corte_rendimiento&order=fecha.desc&limit=3`);
        if (movs && movs.length) {
          resp += `📊 *Últimos cortes:*\n`;
          movs.forEach(m => {
            const pct = m.porcentaje ? (m.porcentaje * 100).toFixed(2) + '%' : '—';
            resp += `• ${fd(m.fecha)} · ${pct} · ${fm(m.valor_rendimiento)} → Saldo: ${fm(m.saldo_resultado)}\n`;
          });
        }
      }
      resp += '\n';
    }

    if (data.length > 3) resp += `_... y ${data.length - 3} contrato(s) más_`;
    return resp.trim();
  }

  // KII
  if (msg.startsWith('kii')) {
    const termino = msg.replace(/^kii\s*/, '').trim();

    if (!termino || termino === 'todos' || termino === 'total') {
      const data = await query('posiciones_kii', '?order=valor_inversion.desc&limit=5');
      if (!data || !data.length) return '❌ No se encontraron posiciones KII.';

      const totalInv = data.reduce((a, i) => a + i.valor_inversion, 0);
      const totalTok = data.reduce((a, i) => a + (i.total_tokens || 0), 0);

      let resp = `⬡ *KII Exchange — Resumen*\n\n`;
      resp += `💰 Total invertido: ${fm(totalInv)}\n`;
      resp += `🪙 Total tokens: ${Number(totalTok).toLocaleString('en-US', { maximumFractionDigits: 0 })}\n`;
      resp += `💵 Valor @$0.02: ${fm(totalTok * 0.02)}\n\n`;
      resp += `*Top 5 posiciones:*\n`;
      data.forEach(i => {
        resp += `• ${i.inversionista_nombre} (${i.contrato})\n`;
        resp += `  ${Number(i.total_tokens || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} tokens · ${fm((i.total_tokens || 0) * 0.02)}\n`;
      });
      return resp;
    }

    // KII por nombre
    const data = await query('posiciones_kii',
      `?inversionista_nombre=ilike.*${encodeURIComponent(termino)}*`);
    if (!data || !data.length) return `❌ No encontré posición KII para "*${termino}*".`;

    let resp = `⬡ *KII — ${data[0].inversionista_nombre}*\n\n`;
    data.forEach(i => {
      resp += `📋 Contrato: ${i.contrato}\n`;
      resp += `📅 Inversión: ${fd(i.fecha_inversion)}\n`;
      resp += `💰 Invertido: ${fm(i.valor_inversion)}\n`;
      resp += `🪙 KII Coins: ${Number(i.kii_coins).toLocaleString()}\n`;
      resp += `📈 Staking acum.: ${Number(i.staking_acumulado || 0).toLocaleString()}\n`;
      resp += `🏦 Total tokens: *${Number(i.total_tokens || 0).toLocaleString()}*\n`;
      resp += `💵 Valor @$0.02: *${fm((i.total_tokens || 0) * 0.02)}*\n`;
      resp += `📆 Fecha corte: ${fd(i.fecha_corte)}\n\n`;
    });
    return resp.trim();
  }

  // FACTURAS / CARTERA
  if (msg.includes('factura') || msg.includes('cartera') || msg.includes('pendiente')) {
    const data = await query('facturas_diaz',
      `?estado=in.(Abono,Pendiente)&order=fecha_factura.desc`);
    if (!data || !data.length) return '✅ No hay facturas pendientes actualmente.';

    let resp = `💼 *Díaz International — Cartera pendiente*\n\n`;
    data.forEach(f => {
      const emoji = f.estado === 'Abono' ? '🟡' : '🔴';
      resp += `${emoji} *${f.cliente_nombre}*\n`;
      resp += `   Factura #${f.numero_factura} · ${f.moneda} ${fm(f.valor)}\n`;
      resp += `   Fecha: ${fd(f.fecha_factura)}\n`;
      if (f.observaciones) resp += `   📝 ${f.observaciones}\n`;
      resp += '\n';
    });

    const totalUSD = data.filter(f => f.moneda === 'USD').reduce((a, f) => a + f.valor, 0);
    const totalEUR = data.filter(f => f.moneda === 'EUR').reduce((a, f) => a + f.valor, 0);
    resp += `*Total cartera:*\n`;
    if (totalUSD > 0) resp += `• USD: ${fm(totalUSD)}\n`;
    if (totalEUR > 0) resp += `• EUR: ${fm(totalEUR)}\n`;
    return resp;
  }

  // Mensaje no reconocido
  return `🤖 No entendí la consulta. Escribe *ayuda* para ver los comandos disponibles.`;
}

// ── MAIN HANDLER ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Bot activo ✅' });
  }

  try {
    const body = req.body;
    const from = body.data?.from || body.from || '';
    const text = body.data?.body || body.body || '';
    const type = body.data?.type || body.type || '';

    // Solo procesar mensajes de texto
    if (type !== 'chat' && type !== 'text') {
      return res.status(200).json({ status: 'ignored' });
    }

    // Ignorar mensajes del bot mismo
    if (body.data?.fromMe || from.includes(ULTRAMSG_INSTANCE)) {
      return res.status(200).json({ status: 'own message' });
    }

    // Procesar y responder
    const respuesta = await procesarMensaje(text, from);
    await sendMsg(from, respuesta);

    return res.status(200).json({ status: 'ok', sent: true });
  } catch (error) {
    console.error('Bot error:', error);
    return res.status(200).json({ status: 'error', message: error.message });
  }
}

