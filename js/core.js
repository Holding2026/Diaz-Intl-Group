// ── SUPABASE CONFIG ──────────────────────────────────────────
const SB_URL  = 'https://flmfgrgnmigdwdnrzgkw.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsbWZncmdubWlnZHdkbnJ6Z2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODU3MzUsImV4cCI6MjA5MDU2MTczNX0.xCXujNCVTc7D7S6J8qK3qM-2ROv0n6JADT9qTN9PBlI';
const { createClient } = supabase;
const db = createClient(SB_URL, SB_KEY);
const supabaseStorage = db; // same client, storage is accessed via db.storage

// ── STATE ───────────────────────────────────────────────────
let TYC_DATA = [], KII_DATA = [], FACT_DATA = [], INV_MAP_DATA = [];
let F = {ty:'todos', dz:'todos', kii:'todos', inv:'todos'};
const PAL = ["#2ecc71","#3498db","#e67e22","#9b59b6","#1abc9c","#e74c3c","#f39c12","#27ae60","#2980b9","#8e44ad","#16a085","#d35400"];
const TODAY = new Date();

// ── HELPERS ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
var _fmCache = {};
const fm = function(n) {
  if (n==null) return '—';
  var k = Math.round(Number(n)*100);
  return _fmCache[k] || (_fmCache[k] = '$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}));
};
const fmk = n => n==null ? '—' : Number(n).toLocaleString('en-US',{maximumFractionDigits:0});
const fd = s => s ? new Date(s+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const ini = n => n.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
const todayStr = () => TODAY.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

var _lastToast='', _toastTimer=null;
function toast(msg, type='ok') {
  if (msg===_lastToast && _toastTimer) return; // deduplicar
  _lastToast=msg;
  const t=$('te');
  $('ti').textContent = type==='ok'?'✓ ':type==='d'?'✕ ':'⚠ ';
  $('tm').textContent = msg;
  t.className = 'toast on '+type;
  t.style.cursor='pointer';
  t.onclick=function(){t.className='toast';_lastToast='';clearTimeout(_toastTimer);};
  if(_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>{t.className='toast';_lastToast='';_toastTimer=null;}, 3200);
}
function closeM() { $('ov').classList.remove('on'); $('ov').removeAttribute('data-lock'); }
if($('ov')) $('ov').addEventListener('click', e=>{
  if(e.target===$('ov') && !$('ov').hasAttribute('data-lock')) closeM();
});
if($('inv-ov')) $('inv-ov').addEventListener('click', e=>{ if(e.target===$('inv-ov')) closeInvModal(); });

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // ESC closes any open modal
  if (e.key === 'Escape') {
    if ($('ov')?.classList.contains('on')) closeM();
    if ($('inv-ov')?.classList.contains('on')) closeInvModal();
  }
  // Ctrl+K — focus search if available
  if ((e.ctrlKey||e.metaKey) && e.key === 'k') {
    e.preventDefault();
    var srch = document.querySelector('.srch:not([style*="display:none"])');
    if (srch) { srch.focus(); srch.select(); }
  }
});

function setChip(el, v, g) {
  el.closest('.ctls').querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');
  F[g] = v;
}

let PRESTAMOS_LOADED = false;
let CONT_DASH_TY_LOADED = false;
let CONT_DASH_DZ_LOADED = false;

// ── Activación de tema desde JS ──
function setTheme(theme){
  document.body.classList.remove('theme-ty','theme-dz','theme-kii','theme-tycoon','theme-diaz');
  document.body.classList.add('theme-' + theme);
}

function goTab(t, navEl) {
  // Guard: flujo de caja (registro) only for admin
  if((t==='cont'||t==='contdiaz') && USER_ROL !== 'admin') {
    toast('Acceso restringido — solo administrador','d'); return;
  }
  // Guard: dashboard contable — admin + equipo only (not tycoon_kii)
  if((t==='cont-dash-ty'||t==='cont-dash-dz'||t==='contab-ty'||t==='contab-dz') && USER_ROL === 'tycoon_kii') {
    toast('Acceso restringido','d'); return;
  }
  // Guard: Díaz tabs for tycoon_kii
  if((t==='dz'||t==='facturacion'||t==='contdiaz'||t==='cont-dash-dz'||t==='contab-dz') && USER_ROL === 'tycoon_kii') {
    toast('Sin acceso al módulo Díaz','d'); return;
  }

  const allTabs = ['ty','inv','dz','kii','cont','contdiaz','prestamos','facturacion','cont-dash-ty','cont-dash-dz','terceros-ty','terceros-dz','inv-port-ty','inv-port-dz','nomina-ty','nomina-dz','reporte-nom-ty','reporte-nom-dz','contab-ty','contab-dz','prestamos-emp-ty','prestamos-emp-dz','empresas'];
  allTabs.forEach(x=>{
    const el=$('tab-'+x); if(el) el.style.display = x===t?'block':'none';
  });
  // Scroll al top al cambiar de tab
  window.scrollTo(0, 0);
  document.querySelectorAll('.ni,.mob-tab').forEach(n=>n.classList.remove('on'));
  if(navEl) navEl.classList.add('on');
  const mt=$('mtab-'+t); if(mt&&mt!==navEl) mt.classList.add('on');

  const themeMap = {
    inv:'ty', prestamos:'ty',
    cont:'ty', 'cont-dash-ty':'ty', 'terceros-ty':'ty', 'inv-port-ty':'ty', 'nomina-ty':'ty', 'reporte-nom-ty':'ty', 'contab-ty':'ty', 'prestamos-emp-ty':'ty',
    dz:'dz', facturacion:'dz', contdiaz:'dz', 'cont-dash-dz':'dz', 'terceros-dz':'dz', 'inv-port-dz':'dz', 'nomina-dz':'dz', 'reporte-nom-dz':'dz', 'contab-dz':'dz', 'prestamos-emp-dz':'dz',
    kii:'kii',
    empresas:'ty'
  };
  document.body.className = 'theme-' + (themeMap[t] || t);

  // Logo switcher
  const logoMap = {ty:'ty', inv:'ty', prestamos:'ty', cont:'ty', 'cont-dash-ty':'ty', 'terceros-ty':'ty', 'inv-port-ty':'ty', 'nomina-ty':'ty', 'reporte-nom-ty':'ty', 'contab-ty':'ty', 'prestamos-emp-ty':'ty', dz:'dz', facturacion:'dz', contdiaz:'dz', 'cont-dash-dz':'dz', 'terceros-dz':'dz', 'inv-port-dz':'dz', 'nomina-dz':'dz', 'reporte-nom-dz':'dz', 'contab-dz':'dz', 'prestamos-emp-dz':'dz', kii:'kii', empresas:'ty'};
  ['ty','dz','kii'].forEach(x=>{
    const el=$('sb-logo-'+x);
    if(el) el.style.display = (logoMap[t]===x) ? 'block' : 'none';
  });

  if(t==='cont' && !CONT_LOADED) loadCont('tycoon');
  if(t==='contdiaz' && !CONTDIAZ_LOADED) loadCont('diaz');
  if(t==='prestamos' && !PRESTAMOS_LOADED) loadPrestamos();
  if(t==='cont-dash-ty' && !CONT_DASH_TY_LOADED) loadContDash('tycoon');
  if(t==='cont-dash-dz' && !CONT_DASH_DZ_LOADED) loadContDash('diaz');
  if(t==='facturacion') renderFacuracion();
  if(t==='inv' && !INV_LOADED) loadInv();
  if(t==='terceros-ty') loadTercerosTY();
  if(t==='terceros-dz') loadTercerosDZ();
  if(t==='inv-port-ty') loadInvPort('tycoon');
  if(t==='inv-port-dz') loadInvPort('diaz');
  if(t==='nomina-ty') loadNomina('tycoon');
  if(t==='nomina-dz') loadNomina('diaz');
  if(t==='reporte-nom-ty') loadReporteNomina('tycoon');
  if(t==='reporte-nom-dz') loadReporteNomina('diaz');
  if(t==='contab-ty') loadContabNiif('tycoon');
  if(t==='contab-dz') loadContabNiif('diaz');
  if(t==='prestamos-emp-ty') loadPrestamosEmp('tycoon');
  if(t==='prestamos-emp-dz') loadPrestamosEmp('diaz');
  if(t==='empresas') loadEmpresas();
}

// ── AUTH ─────────────────────────────────────────────────────
async function doLogin() {
  const email = $('login-email').value.trim();
  const pw    = $('login-pw').value;
  $('login-err').textContent = '';
  if(!email||!pw) { $('login-err').textContent='Complete todos los campos'; return; }
  const {data, error} = await db.auth.signInWithPassword({email, password: pw});
  if(error) { $('login-err').textContent = 'Correo o contraseña incorrectos'; return; }
  showApp(data.user);
}

async function doLogout() {
  await db.auth.signOut();
  location.reload();
}

let USER_ROL = "equipo";
let USER_DISPLAY_NAME = "";

async function showApp(user) {
  $('login-screen').style.display = 'none';
  const email = user.email || '';
  const nameFromEmail = email.split('@')[0].split('.').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');
  USER_DISPLAY_NAME = nameFromEmail;
  $('user-name').textContent = nameFromEmail;
  $('user-av').textContent   = ini(nameFromEmail);

  const {data: profile} = await db.from('profiles').select('rol,nombre').eq('id', user.id).single();
  if(profile) {
    USER_ROL = profile.rol;
    const displayName = profile.nombre || nameFromEmail;
    USER_DISPLAY_NAME = displayName;
    $('user-name').textContent = displayName;
    $('user-av').textContent   = ini(displayName);
  }

  aplicarPermisos(USER_ROL);

  // Mostrar pantalla de selección de empresa (no el dashboard directamente)
  const firstName = (USER_DISPLAY_NAME.split(' ')[0]) || '';
  const esName = $('es-name'); if(esName) esName.textContent = firstName ? ', ' + firstName : '';
  // Ocultar card de Díaz si el rol es tycoon_kii
  if(USER_ROL === 'tycoon_kii') {
    const esDz = $('es-card-dz'); if(esDz) esDz.style.display = 'none';
  }
  $('empresa-select-screen').classList.add('on');
}

// Entra al dashboard de la empresa seleccionada y carga sus datos
function enterEmpresa(emp) {
  // Validar permisos: tycoon_kii no entra a Díaz
  if(emp === 'dz' && USER_ROL === 'tycoon_kii') {
    toast('Sin acceso al módulo Díaz','d'); return;
  }
  $('empresa-select-screen').classList.remove('on');
  $('app').style.display = 'block';

  // Aplicar tema y mostrar tab principal de esa empresa
  document.body.className = 'theme-' + emp;
  // Marcar el ítem de nav correspondiente como activo
  const sel = emp==='ty' ? "[onclick*=\"goTab('ty'\"]"
            : emp==='dz' ? "[onclick*=\"goTab('dz'\"]"
            : "[onclick*=\"goTab('kii'\"]";
  const navEl = document.querySelector('.sb-nav ' + sel);

  // Mostrar SOLO el bloque de la empresa seleccionada en el sidebar
  document.querySelectorAll('.sb-empresa[data-emp]').forEach(function(blk){
    blk.style.display = (blk.dataset.emp === emp) ? '' : 'none';
  });
  // Mobile nav: marcar tab activo de la empresa
  document.querySelectorAll('.mob-tab').forEach(function(t){t.classList.remove('on');});

  goTab(emp, navEl);
  // Cargar datos si aún no están cargados
  loadAll();
}

// Vuelve al selector de empresa (botón en el sidebar)
function volverSelector() {
  $('app').style.display = 'none';
  // Restaurar visibilidad de todos los bloques (para que el próximo enterEmpresa elija)
  document.querySelectorAll('.sb-empresa[data-emp]').forEach(function(blk){
    blk.style.display = '';
  });
  // Saludo en el selector
  const firstName = (USER_DISPLAY_NAME.split(' ')[0]) || '';
  const esName = $('es-name'); if(esName) esName.textContent = firstName ? ', ' + firstName : '';
  // Reaplicar permisos por si rol es tycoon_kii (oculta Díaz)
  if(USER_ROL === 'tycoon_kii') {
    const esDz = $('es-card-dz'); if(esDz) esDz.style.display = 'none';
  }
  $('empresa-select-screen').classList.add('on');
}

function aplicarPermisos(rol) {
  // ── tycoon_kii: sin Díaz, sin contabilidad ──
  if(rol === 'tycoon_kii') {
    document.querySelectorAll('.ni-diaz').forEach(el => el.style.display = 'none');
    const dzTab = $('mtab-dz'); if(dzTab) dzTab.style.display = 'none';
    document.querySelectorAll('.nlbl.dz').forEach(el => el.style.display = 'none');
    // También ocultar contabilidad Díaz section label
    document.querySelectorAll('.ni-cont.ni-diaz').forEach(el => el.style.display = 'none');
  }

  // ── NO admin: ocultar flujo de caja (ni-admin) ──
  if(rol !== 'admin') {
    document.querySelectorAll('.ni-admin').forEach(el => el.style.display = 'none');
  }

  // ── tycoon_kii: también ocultar dashboards contables (ni-cont-dash) ──
  if(rol === 'tycoon_kii') {
    document.querySelectorAll('.ni-cont').forEach(el => el.style.display = 'none');
  }

  // ── Label Contabilidad Tycoon: visible para admin+equipo, oculto para tycoon_kii ──
  // Ya manejado arriba

  // ── Badge de rol ──
  const badge = {
    admin:       {txt:'Admin',  bg:'rgba(210,38,48,0.2)',   col:'#ff8080'},
    equipo:      {txt:'Equipo', bg:'rgba(0,213,176,0.15)',  col:'#00D5B0'},
    tycoon_kii:  {txt:'KII',   bg:'rgba(199,169,248,0.15)', col:'#C7A9F8'},
  }[rol] || {txt:rol, bg:'rgba(255,255,255,0.1)', col:'rgba(255,255,255,0.6)'};

  const badgeEl = document.createElement('span');
  badgeEl.textContent = badge.txt;
  badgeEl.style.cssText = `font-size:8px;font-family:"DM Mono",monospace;letter-spacing:1px;padding:2px 6px;border-radius:4px;background:${badge.bg};color:${badge.col};margin-left:6px;vertical-align:middle`;
  const nameEl = $('user-name');
  if(nameEl && !nameEl.querySelector('.rol-badge')) {
    badgeEl.className = 'rol-badge';
    nameEl.appendChild(badgeEl);
  }
}

// ── DEBOUNCE ─────────────────────────────────────────────────
function debounce(fn, ms) {
  var timer;
  return function() {
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(null, args); }, ms||300);
  };
}
var renderINVd  = debounce(function(){ if(typeof renderINV==='function') renderINV(); }, 250);
var renderTYd   = debounce(function(){ if(typeof renderTY==='function') renderTY(); }, 250);
var renderDZd   = debounce(function(){ if(typeof renderDZ==='function') renderDZ(); }, 250);
var renderKIId  = debounce(function(){ if(typeof renderKII==='function') renderKII(); }, 250);

// ── GLOBAL ERROR HANDLER ────────────────────────────────────
window.onerror = function(msg, src, line, col, err) {
  console.error('[Global]', msg, src+':'+line);
};
window.onunhandledrejection = function(e) {
  console.error('[Promise]', e.reason);
};

// ── DB QUERY HELPER (centralizado con error handling) ─────────
async function dbQ(fn) {
  try {
    var result = await fn();
    if (result && result.error) {
      console.error('[DB]', result.error.message, result.error);
    }
    return result;
  } catch(e) {
    console.error('[DB Exception]', e);
    return {data: null, error: e};
  }
}

// ── INPUT SANITIZER ──────────────────────────────────────────
function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// ── CONFIRM DIALOG ───────────────────────────────────────────
function confirmAction(msg, fn) {
  if (window.confirm(msg)) fn();
}

// ── LOADING STATE HELPER ─────────────────────────────────────
function setLoading(el, isLoading, originalText) {
  if (!el) return;
  el.disabled = isLoading;
  el.textContent = isLoading ? 'Procesando...' : originalText;
}

// fd() — usa const fd definida en helpers de formato

// ── LOAD DATA FROM SUPABASE ───────────────────────────────────
