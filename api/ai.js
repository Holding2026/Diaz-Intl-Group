// api/ai.js — Proxy Groq + Supabase directo v7

var SB_URL = 'https://flmfgrgnmigdwdnrzgkw.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsbWZncmdubWlnZHdkbnJ6Z2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODU3MzUsImV4cCI6MjA5MDU2MTczNX0.xCXujNCVTc7D7S6J8qK3qM-2ROv0n6JADT9qTN9PBlI';

async function sbGet(path) {
  var r = await fetch(SB_URL + '/rest/v1/' + path, {
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
  });
  return r.json();
}

function fm(n) { return n == null ? '--' : '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fd(s) { return s ? new Date(s+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '--'; }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  var apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(200).json({ reply: 'ERROR: GROQ_API_KEY no configurada.' });

  try {
    var body = req.body || {};
    var query = body.query || '';
    if (!query) return res.status(400).json({ error: 'Se requiere query' });

    var hoy = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    // ── Consultar Supabase en paralelo ──
    var [contratos, movimientos, posicionesKII, facturas, pagos, perfiles] = await Promise.all([
      sbGet('vista_contratos_vencimiento?select=*&order=dias_al_vencimiento.asc'),
      sbGet('movimientos?select=*&order=fecha.asc'),
      sbGet('posiciones_kii?select=*&order=valor_inversion.desc'),
      sbGet('vista_cartera_diaz?select=*&order=fecha_factura.desc'),
      sbGet('pagos_facturas?select=*&order=fecha_pago.desc'),
      sbGet('vista_perfil_contrato?select=*')
    ]);

    // ── Construir contexto TYCOON detallado ──
    var totalSaldo = contratos.reduce(function(a,c){return a+(c.saldo_actual||0);},0);
    var totalInicial = contratos.reduce(function(a,c){return a+(c.valor_inicial||0);},0);
    var crecimiento = totalInicial > 0 ? (((totalSaldo-totalInicial)/totalInicial)*100).toFixed(2) : 0;

    var tycoonCtx = '## TYCOON - FONDO DE INVERSIONES\n';
    tycoonCtx += 'Total contratos: ' + contratos.length + ' | Capital inicial total: ' + fm(totalInicial) + ' | Capital gestionado actual: ' + fm(totalSaldo) + ' | Crecimiento global: ' + crecimiento + '%\n';
    tycoonCtx += 'Contratos urgentes (<30 dias): ' + contratos.filter(function(c){return c.dias_al_vencimiento<30;}).length + '\n\n';

    tycoonCtx += '### DETALLE POR INVERSIONISTA:\n';
    contratos.forEach(function(c) {
      var perfil = perfiles.find(function(p){return p.numero===c.numero;}) || {};
      var movsCon = movimientos.filter(function(m){return m.contrato_id === perfil.contrato_id;});
      var cortes = movsCon.filter(function(m){return m.tipo==='corte_rendimiento';});
      var retiros = movsCon.filter(function(m){return m.tipo==='retiro_capital';});
      var totalRend = cortes.reduce(function(a,m){return a+(m.valor_rendimiento||0);},0);
      var totalReinv = cortes.reduce(function(a,m){return a+(m.valor_reinversion||0);},0);
      var totalRetiros = retiros.reduce(function(a,m){return a+(Math.abs(m.pago_capital_mov||0));},0);
      var pctProm = cortes.length > 0 ? (cortes.reduce(function(a,m){return a+(m.porcentaje||0);},0)/cortes.length*100).toFixed(2) : 0;
      var vd = c.fecha_vencimiento || c.proximo_vencimiento;

      tycoonCtx += '- ' + c.inversionista + ' (' + c.numero + '):\n';
      tycoonCtx += '  Capital inicial: ' + fm(c.valor_inicial) + ' | Saldo actual: ' + fm(c.saldo_actual) + ' | Crecimiento: ' + (perfil.crecimiento_pct||0).toFixed(2) + '%\n';
      tycoonCtx += '  Tipo: ' + (c.tipo_liquidacion||'—') + ' | Vence: ' + fd(vd) + ' (' + c.dias_al_vencimiento + ' dias) | Estado: ' + (c.estado||'Activo') + '\n';
      tycoonCtx += '  Total rendimientos: ' + fm(totalRend) + ' | Total reinversion: ' + fm(totalReinv) + ' | Total retiros: ' + fm(totalRetiros) + ' | % prom periodo: ' + pctProm + '%\n';
      tycoonCtx += '  Movimientos: ' + movsCon.length + ' total (' + cortes.length + ' cortes, ' + retiros.length + ' retiros)\n';
      if(cortes.length > 0) {
        var ultimo = cortes[cortes.length-1];
        tycoonCtx += '  Ultimo corte: ' + fd(ultimo.fecha) + ' | Saldo: ' + fm(ultimo.saldo_resultado) + ' | %: ' + ((ultimo.porcentaje||0)*100).toFixed(2) + '%\n';
      }
    });

    // ── Construir contexto DÍAZ detallado ──
    var pendUSD = facturas.filter(function(f){return f.moneda==='USD'&&(f.saldo_pendiente||0)>0&&!['Pagada','Anulada','Castigo'].includes(f.estado);}).reduce(function(a,f){return a+(f.saldo_pendiente||0);},0);
    var pendEUR = facturas.filter(function(f){return f.moneda==='EUR'&&(f.saldo_pendiente||0)>0&&!['Pagada','Anulada','Castigo'].includes(f.estado);}).reduce(function(a,f){return a+(f.saldo_pendiente||0);},0);
    var fact2026 = facturas.filter(function(f){return f.año===2026;}).reduce(function(a,f){return a+(f.valor_factura||f.valor||0);},0);
    var fact2025 = facturas.filter(function(f){return f.año===2025;}).reduce(function(a,f){return a+(f.valor_factura||f.valor||0);},0);

    var diazCtx = '## DIAZ INTERNATIONAL - FACTURACION\n';
    diazCtx += 'Total facturas: ' + facturas.length + ' | Facturado 2026: ' + fm(fact2026) + ' | Facturado 2025: ' + fm(fact2025) + '\n';
    diazCtx += 'Cartera pendiente USD: ' + fm(pendUSD) + ' | Cartera pendiente EUR: ' + fm(pendEUR) + '\n\n';

    var pendientes = facturas.filter(function(f){return ['Pendiente','Abono'].includes(f.estado);});
    if(pendientes.length > 0) {
      diazCtx += '### FACTURAS PENDIENTES/ABONO:\n';
      pendientes.forEach(function(f) {
        var diasCart = Math.floor((new Date()-new Date(f.fecha_factura+'T12:00:00'))/(1000*60*60*24));
        diazCtx += '- #' + f.numero_factura + ' ' + f.cliente_nombre + ': ' + fm(f.valor_factura||f.valor) + ' ' + f.moneda;
        diazCtx += ' | Saldo: ' + fm(f.saldo_pendiente) + ' | ' + diasCart + ' dias en cartera | Estado: ' + f.estado;
        if(f.fecha_pago_programado) diazCtx += ' | Pago programado: ' + fd(f.fecha_pago_programado);
        diazCtx += '\n';
      });
    }

    // ── Construir contexto KII detallado ──
    var totalInvKII = posicionesKII.reduce(function(a,i){return a+(i.valor_inversion||0);},0);
    var totalTokens = posicionesKII.reduce(function(a,i){return a+(i.total_tokens||0);},0);

    var kiiCtx = '## KII EXCHANGE - POSICIONES\n';
    kiiCtx += 'Total posiciones: ' + posicionesKII.length + ' | Total invertido: ' + fm(totalInvKII) + ' | Total tokens: ' + totalTokens.toLocaleString() + ' | Valor @$0.02: ' + fm(totalTokens*0.02) + '\n\n';
    kiiCtx += '### DETALLE POSICIONES:\n';
    posicionesKII.forEach(function(i) {
      var stakingPct = i.kii_coins > 0 ? ((i.staking_acumulado/i.kii_coins)*100).toFixed(1) : 0;
      kiiCtx += '- ' + i.inversionista_nombre + ' (' + i.contrato + '): Inversion ' + fm(i.valor_inversion);
      kiiCtx += ' | KII Coins: ' + (i.kii_coins||0).toLocaleString() + ' | Staking: ' + (i.staking_acumulado||0).toLocaleString() + ' (' + stakingPct + '%)';
      kiiCtx += ' | Total tokens: ' + (i.total_tokens||0).toLocaleString() + ' | Valor: ' + fm((i.total_tokens||0)*0.02) + '\n';
    });

    var systemPrompt = 'Eres un analista financiero senior del Holding Diaz Intl Group. '
      + 'Tienes acceso completo a todos los datos financieros en tiempo real. '
      + 'DEBES analizar, comparar, detectar riesgos, oportunidades y hacer recomendaciones ejecutivas concretas. '
      + 'NO te limites a mostrar datos — interpreta, calcula ratios, identifica patrones, alerta sobre riesgos. '
      + 'Usa formato Markdown: ## titulos, **negrita** para datos clave, tablas | col | para comparativos, - para listas. '
      + 'Cuando pidan un cuadro o tabla, SIEMPRE genera tabla Markdown completa con | y ---. '
      + 'Responde en espanol ejecutivo. Hoy es ' + hoy + '.\n\n'
      + tycoonCtx + '\n\n' + diazCtx + '\n\n' + kiiCtx;

    var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ]
      })
    });

    var rawText = await response.text();
    if (!response.ok) return res.status(200).json({ reply: 'ERROR ' + response.status + ': ' + rawText });

    var data = JSON.parse(rawText);
    var reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : 'Sin respuesta.';

    return res.status(200).json({ reply: reply });

  } catch (error) {
    return res.status(200).json({ reply: 'CATCH: ' + error.message });
  }
};
