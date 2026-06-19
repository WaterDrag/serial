import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

/* ══════════════════════════════════════════════════════════
   FIREBASE
══════════════════════════════════════════════════════════ */
const FB_CONFIG = {
  apiKey: 'AIzaSyCfDHO3OF6tlo7t_HaNytXzkveh1-melGg',
  authDomain: 'anistream-93872.firebaseapp.com',
  projectId: 'anistream-93872',
  storageBucket: 'anistream-93872.firebasestorage.app',
  messagingSenderId: '68171222024',
  appId: '1:68171222024:web:772bbb1e3df6444bca95bd',
};

let fbDb = null;
let fbAuth = null;
let fbUid = null;

async function _initFirebaseInner() {
  const app = initializeApp(FB_CONFIG);
  fbDb = getFirestore(app);
  fbAuth = getAuth(app);

  await new Promise(resolve => {
    const unsub = onAuthStateChanged(fbAuth, async user => {
      unsub();
      if (user) {
        fbUid = user.uid;
        renderAuthUI(user);
        await syncFromFirestore();
      }
      resolve();
    });
  });
}

async function initFirebase() {
  try {
    await Promise.race([
      _initFirebaseInner(),
      new Promise(r => setTimeout(r, 6000)),
    ]);
  } catch(e) {
    console.warn('[Firebase] init error:', e);
  }
}

function showLoginOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'loginOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:24px;';
  overlay.innerHTML = `
    <div style="text-align:center;">
      <div style="display:flex;align-items:center;gap:10px;justify-content:center;margin-bottom:8px;">
        <div style="width:20px;height:20px;border-radius:50%;background:var(--accent);box-shadow:0 0 20px var(--accent);flex-shrink:0;"></div>
        <span style="font-size:32px;font-weight:900;color:var(--text-1);">🌊 WaterStream</span>
      </div>
      <p style="color:var(--text-3);font-size:14px;margin:0;">Přihlas se pro přístup k obsahu</p>
    </div>
    <button id="googleSignInBtn" onclick="signInWithGoogle()" style="display:flex;align-items:center;gap:12px;background:#fff;color:#1f2937;border:none;border-radius:var(--r-md);padding:14px 24px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,.4);font-family:inherit;">
      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Přihlásit se přes Google
    </button>
    <p style="color:var(--text-3);font-size:12px;margin:0;">Data budou synchronizována napříč zařízeními</p>
  `;
  document.body.appendChild(overlay);
}

function renderAuthUI(user) {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;
  headerRight.querySelector('#authArea')?.remove();
  const el = document.createElement('div');
  el.id = 'authArea';
  el.style.cssText = 'position:relative;display:flex;align-items:center;';
  if (user) {
    const av = user.photoURL
      ? `<img src="${user.photoURL}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);display:block;" alt="">`
      : `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;">${(user.displayName||'?')[0].toUpperCase()}</div>`;
    el.innerHTML = `
      <button id="profileBtn" onclick="toggleProfileDropdown()" style="background:none;border:none;cursor:pointer;padding:0;line-height:0;border-radius:50%;">${av}</button>
      <div id="profileDropdown" class="profile-dropdown" style="display:none;">
        <div class="profile-dropdown-header">
          ${av}
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:700;color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.displayName||'Uživatel'}</div>
            <div style="font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.email||''}</div>
          </div>
        </div>
        <div class="profile-menu">
          <a class="profile-menu-item" href="search.html">🔍 Hledat</a>
          <a class="profile-menu-item" href="history.html">❤️ Oblíbené</a>
          <a class="profile-menu-item" href="history.html">📋 Historie</a>
          <div style="height:1px;background:var(--border);margin:4px 0;"></div>
          <a class="profile-menu-item" onclick="openConfig();toggleProfileDropdown()">⚙️ Nastavení</a>
          <div style="height:1px;background:var(--border);margin:4px 0;"></div>
          <a class="profile-menu-item danger" onclick="signOutUser()">🚪 Odhlásit se</a>
        </div>
      </div>`;
  } else {
    el.innerHTML = `<button class="btn-icon" onclick="signInWithGoogle()">🔑 Přihlásit</button>`;
  }
  headerRight.appendChild(el);
}

function toggleProfileDropdown() {
  const dd = document.getElementById('profileDropdown');
  if (!dd) return;
  const willOpen = dd.style.display === 'none';
  dd.style.display = willOpen ? 'block' : 'none';
  if (willOpen) {
    setTimeout(() => {
      function outsideClick(e) {
        if (!document.getElementById('authArea')?.contains(e.target)) {
          const d = document.getElementById('profileDropdown');
          if (d) d.style.display = 'none';
          document.removeEventListener('click', outsideClick);
        }
      }
      document.addEventListener('click', outsideClick);
    }, 10);
  }
}

async function signInWithGoogle() {
  const btn = document.getElementById('googleSignInBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Přihlašuji…'; }
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(fbAuth, provider);
    fbUid = result.user.uid;
    renderAuthUI(result.user);
    await syncFromFirestore();
    document.getElementById('loginOverlay')?.remove();
  } catch(e) {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Přihlásit se přes Google'; }
    if (e.code === 'auth/unauthorized-domain') {
      showToast('Přidej tuto doménu do Firebase → Authentication → Authorized domains', false);
    } else if (e.code !== 'auth/popup-closed-by-user') {
      showToast('Přihlášení selhalo: ' + (e.code || e.message), false);
    }
  }
}

async function signOutUser() {
  try {
    await signOut(fbAuth);
    fbUid = null;
    window.location.reload();
  } catch(e) {
    console.warn('[Firebase] sign-out error:', e);
  }
}

async function syncFromFirestore() {
  if (!fbDb || !fbUid) return;
  try {
    const snap = await getDoc(doc(fbDb, 'users', fbUid));
    if (!snap.exists()) return;
    const d = snap.data();
    if (d.settings) {
      const cfg = getCfg();
      Object.assign(cfg, d.settings);
      setCfg(cfg);
    }
    if (d.favs)    localStorage.setItem('ani_favs',    JSON.stringify(d.favs));
    if (d.watched) {
      const localTs  = parseInt(localStorage.getItem('ani_watched_ts') || '0');
      const remoteTs = d.watchedAt || 0;
      if (remoteTs >= localTs) {
        localStorage.setItem('ani_watched',    JSON.stringify(d.watched));
        localStorage.setItem('ani_watched_ts', remoteTs.toString());
      }
    }
    if (d.history) localStorage.setItem('ani_history', JSON.stringify(d.history));
  } catch(e) {
    console.warn('[Firebase] sync error:', e);
  }
}

function saveSettingsToFirestore() {
  if (!fbDb || !fbUid) return;
  setDoc(doc(fbDb, 'users', fbUid), { settings: getCfg() }, { merge: true })
    .catch(e => console.warn('[Firebase] save settings:', e));
}

let _saveUserdataTO = null;
function saveUserdataToFirestore() {
  if (!fbDb || !fbUid) return;
  clearTimeout(_saveUserdataTO);
  _saveUserdataTO = setTimeout(() => {
    const watchedTs = parseInt(localStorage.getItem('ani_watched_ts') || '0');
    setDoc(doc(fbDb, 'users', fbUid), {
      settings: getCfg(),
      favs:    getFavs(),
      watched: getWatched(),
      watchedAt: watchedTs,
      history: getHistory(),
    }).catch(e => console.warn('[Firebase] save userdata:', e));
  }, 800);
}

/* ══════════════════════════════════════════════════════════
   CONFIG & STORAGE
══════════════════════════════════════════════════════════ */
const DEFAULT_PROXY = 'https://anisteam.zitkatomik007.workers.dev';

function getCfg(){try{return JSON.parse(localStorage.getItem('ani_cfg6')||'{}');}catch{return {};}}
function setCfg(d){localStorage.setItem('ani_cfg6',JSON.stringify(d));}
function getProxy(){return (getCfg().proxy||DEFAULT_PROXY).replace(/\/$/,'');}
function getDefaultSource(){return getCfg().defaultSource||'auto';}

/* ══════════════════════════════════════════════════════════
   APPEARANCE — Themes & Layouts
══════════════════════════════════════════════════════════ */
const _THEME_PRESETS={
  neon:    {accent:'#8b6ef5',accentH:'#b39ef8',accentDim:'rgba(139,110,245,0.15)',bg:'#0d0d0f',bgCard:'#1a1a1f'},
  frost:   {accent:'#00b4d8',accentH:'#33ccf0',accentDim:'rgba(0,180,216,0.15)',  bg:'#0d0d0f',bgCard:'#1a1a1f'},
  ember:   {accent:'#f97316',accentH:'#fb923c',accentDim:'rgba(249,115,22,0.15)', bg:'#0d0d0f',bgCard:'#1a1a1f'},
  carbon:  {h:215,s:40,l:60,bg:'#0c0d10',bgCard:'#0f1014'},
  midnight:{h:200,s:35,l:52,bg:'#060708',bgCard:'#08090a'},
  abyss:   {h:180,s:25,l:42,bg:'#020203',bgCard:'#030404'},
};
const _LAYOUT_CSS={
  standard:'',
  cinema:`@media(min-width:960px){.watch-grid{grid-template-columns:1fr!important;}}.watch-grid{max-width:1080px!important;margin:0 auto!important;}.watch-sidebar{position:static!important;max-height:none!important;overflow:visible!important;}.watch-sidebar #epList{overflow:visible!important;flex:none!important;}.ep-list-wide{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;padding-bottom:8px!important;gap:6px!important;}.ep-list-wide li{flex-shrink:0!important;}.ep-list-wide li a{white-space:nowrap!important;}.ep-list-wide li a:hover{transform:none!important;}`,
  compact:`@media(min-width:960px){.watch-grid{grid-template-columns:1fr 210px!important;gap:12px!important;}}.watch-sidebar #epList li a{padding:6px 10px!important;font-size:12px!important;gap:10px!important;}.ep-num-box{min-width:22px!important;font-size:12px!important;}.ep-name-wide{font-size:12px!important;}.ep-lang-btn{font-size:9px!important;padding:1px 5px!important;}`,
  ultrawide:`.main{max-width:1800px!important;}@media(min-width:960px){.watch-grid{grid-template-columns:1fr 380px!important;gap:24px!important;}}.watch-sidebar #epList li a{padding:11px 14px!important;font-size:13.5px!important;}`,
};
function _buildThemeVars(name){
  const customH=parseInt(localStorage.getItem('ws_custom_h'))||200;
  const customBgW=parseInt(localStorage.getItem('ws_custom_bg'))||50;
  if(name==='custom'){
    let bgH=0,bgS=0;
    if(customBgW<50){bgH=220;bgS=Math.round((50-customBgW)*0.22);}
    else if(customBgW>50){bgH=25;bgS=Math.round((customBgW-50)*0.28);}
    return{accent:`hsl(${customH},75%,65%)`,accentH:`hsl(${customH},75%,78%)`,accentDim:`hsla(${customH},75%,65%,0.15)`,bg:`hsl(${bgH},${bgS}%,5%)`,bgCard:`hsl(${bgH},${bgS}%,9%)`};
  }
  const p=_THEME_PRESETS[name];if(!p)return null;
  if(p.h!==undefined){const lH=Math.min(p.l+13,88);return{accent:`hsl(${p.h},${p.s}%,${p.l}%)`,accentH:`hsl(${p.h},${p.s}%,${lH}%)`,accentDim:`hsla(${p.h},${p.s}%,${p.l}%,0.15)`,bg:p.bg,bgCard:p.bgCard};}
  return{accent:p.accent,accentH:p.accentH,accentDim:p.accentDim,bg:p.bg,bgCard:p.bgCard};
}
function applyTheme(name){
  const v=_buildThemeVars(name);if(!v)return;
  const r=document.documentElement;
  r.style.setProperty('--accent',v.accent);r.style.setProperty('--accent-h',v.accentH);
  r.style.setProperty('--accent-dim',v.accentDim);r.style.setProperty('--bg',v.bg);
  r.style.setProperty('--bg-card',v.bgCard);
  localStorage.setItem('ws_theme',name);
  // custom panel: open for custom, close for others
  document.getElementById('wsCustomPanel')?.classList.toggle('open',name==='custom');
  _syncAppearUI();
}
function applyLayout(name){
  let el=document.getElementById('ws-layout-css');
  if(!el){el=document.createElement('style');el.id='ws-layout-css';document.head.appendChild(el);}
  el.textContent=_LAYOUT_CSS[name]||'';
  localStorage.setItem('ws_layout',name);
  _syncAppearUI();
}
function initAppearance(){
  const t=localStorage.getItem('ws_theme')||'neon';
  const l=localStorage.getItem('ws_layout')||'standard';
  applyTheme(t);applyLayout(l);
}
function _syncAppearUI(){
  const t=localStorage.getItem('ws_theme')||'neon';
  const l=localStorage.getItem('ws_layout')||'standard';
  document.querySelectorAll('[data-ws-theme]').forEach(b=>b.classList.toggle('active',b.dataset.wsTheme===t));
  document.querySelectorAll('[data-ws-layout]').forEach(b=>b.classList.toggle('active',b.dataset.wsLayout===l));
  _syncSwatchUI();
}
function _syncSwatchUI(){
  const h=parseInt(document.getElementById('wsSliderAccent')?.value||localStorage.getItem('ws_custom_h')||200);
  const bgW=parseInt(document.getElementById('wsSliderBg')?.value||localStorage.getItem('ws_custom_bg')||50);
  const swatch=document.getElementById('wsColorSwatch');
  const accentLbl=document.getElementById('wsAccentVal');
  const bgLbl=document.getElementById('wsBgVal');
  if(swatch)swatch.style.background=`hsl(${h},75%,65%)`;
  if(accentLbl)accentLbl.textContent=h+'°';
  if(bgLbl)bgLbl.textContent=bgW;
}
function _initCustomSliders(){
  const sH=document.getElementById('wsSliderAccent'),sBg=document.getElementById('wsSliderBg');
  if(!sH||!sBg)return;
  sH.value=localStorage.getItem('ws_custom_h')||'200';
  sBg.value=localStorage.getItem('ws_custom_bg')||'50';
  _syncSwatchUI();
  sH.addEventListener('input',()=>{
    localStorage.setItem('ws_custom_h',sH.value);
    if(localStorage.getItem('ws_theme')==='custom')applyTheme('custom');
    _syncSwatchUI();
  });
  sBg.addEventListener('input',()=>{
    localStorage.setItem('ws_custom_bg',sBg.value);
    if(localStorage.getItem('ws_theme')==='custom')applyTheme('custom');
    _syncSwatchUI();
  });
}
// Run on every page load
initAppearance();

function openConfig(){
  const modal=document.querySelector('#configModal .modal');
  if(modal){
    if(!document.getElementById('appearSection')){
      const firstSection=modal.querySelector('.config-section');
      const sec=document.createElement('div');
      sec.className='config-section';sec.id='appearSection';
      sec.innerHTML=`<div class="config-section-title">🎨 Vzhled</div>
        <div class="appear-sublabel">Barevné schéma</div>
        <div class="appear-row">
          <button class="appear-btn" data-ws-theme="neon" style="--btn-accent:#8b6ef5" onclick="applyTheme('neon')"><span class="appear-dot"></span>Neon Purple</button>
          <button class="appear-btn" data-ws-theme="frost" style="--btn-accent:#00b4d8" onclick="applyTheme('frost')"><span class="appear-dot"></span>Frost</button>
          <button class="appear-btn" data-ws-theme="ember" style="--btn-accent:#f97316" onclick="applyTheme('ember')"><span class="appear-dot"></span>Ember</button>
          <button class="appear-btn" data-ws-theme="custom" onclick="applyTheme('custom')" style="--btn-accent:var(--accent)"><svg class="appear-icon" viewBox="0 0 16 16" fill="none"><defs><linearGradient id="rgC" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(0,80%,65%)"/><stop offset="33%" stop-color="hsl(120,80%,65%)"/><stop offset="66%" stop-color="hsl(240,80%,65%)"/><stop offset="100%" stop-color="hsl(360,80%,65%)"/></linearGradient></defs><circle cx="8" cy="8" r="6.5" stroke="url(#rgC)" stroke-width="2" fill="none"/><circle cx="8" cy="8" r="2.5" fill="url(#rgC)"/></svg>Vlastní</button>
        </div>
        <div id="wsCustomPanel" class="appear-custom-panel">
          <div class="appear-slider-row">
            <div class="appear-slider-label">Barva akcentu <span id="wsAccentVal">200°</span></div>
            <input type="range" id="wsSliderAccent" class="appear-slider" min="0" max="359" value="200" style="background:linear-gradient(to right,hsl(0,75%,65%),hsl(45,75%,65%),hsl(90,75%,65%),hsl(135,75%,65%),hsl(180,75%,65%),hsl(225,75%,65%),hsl(270,75%,65%),hsl(315,75%,65%),hsl(360,75%,65%))">
          </div>
          <div class="appear-slider-row">
            <div class="appear-slider-label">Teplota pozadí <span id="wsBgVal">50</span></div>
            <input type="range" id="wsSliderBg" class="appear-slider" min="0" max="100" value="50" style="background:linear-gradient(to right,#060c18,#0a0a0a,#120b04)">
          </div>
          <div class="appear-custom-footer">
            <div id="wsColorSwatch" class="appear-swatch"></div>
            <span style="font-size:11px;color:var(--text-3);">Živý náhled</span>
          </div>
        </div>
        <div class="appear-sublabel" style="margin-top:8px;">Noční témata</div>
        <div class="appear-row">
          <button class="appear-btn" data-ws-theme="carbon" style="--btn-accent:hsl(215,40%,60%)" onclick="applyTheme('carbon')"><span class="appear-dot"></span>Carbon</button>
          <button class="appear-btn" data-ws-theme="midnight" style="--btn-accent:hsl(200,35%,52%)" onclick="applyTheme('midnight')"><span class="appear-dot"></span>Midnight</button>
          <button class="appear-btn" data-ws-theme="abyss" style="--btn-accent:hsl(180,25%,42%)" onclick="applyTheme('abyss')"><span class="appear-dot"></span>Abyss</button>
        </div>
        <div style="height:1px;background:var(--border);margin:12px 0;"></div>
        <div class="appear-sublabel">Rozložení</div>
        <div class="appear-row">
          <button class="appear-btn" data-ws-layout="standard" onclick="applyLayout('standard')"><svg class="appear-icon" viewBox="0 0 16 16"><rect x="1" y="1" width="9" height="14" rx="1"/><rect x="11" y="1" width="4" height="14" rx="1"/></svg>Standard</button>
          <button class="appear-btn" data-ws-layout="cinema" onclick="applyLayout('cinema')"><svg class="appear-icon" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="9" rx="1"/><rect x="1" y="12" width="14" height="3" rx="1"/></svg>Cinema</button>
          <button class="appear-btn" data-ws-layout="compact" onclick="applyLayout('compact')"><svg class="appear-icon" viewBox="0 0 16 16"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="6.5" y="1" width="4" height="4" rx="0.5"/><rect x="12" y="1" width="3" height="4" rx="0.5"/><rect x="1" y="6.5" width="4" height="4" rx="0.5"/><rect x="6.5" y="6.5" width="4" height="4" rx="0.5"/><rect x="12" y="6.5" width="3" height="4" rx="0.5"/><rect x="1" y="12" width="4" height="3" rx="0.5"/><rect x="6.5" y="12" width="4" height="3" rx="0.5"/><rect x="12" y="12" width="3" height="3" rx="0.5"/></svg>Kompaktní</button>
          <button class="appear-btn" data-ws-layout="ultrawide" onclick="applyLayout('ultrawide')"><svg class="appear-icon" viewBox="0 0 16 16"><rect x="0.5" y="3" width="15" height="10" rx="1.5"/><line x1="5" y1="3" x2="5" y2="13" stroke="currentColor" stroke-width="0.8" opacity="0.4"/><line x1="11" y1="3" x2="11" y2="13" stroke="currentColor" stroke-width="0.8" opacity="0.4"/></svg>Ultrawide</button>
        </div>`;
      if(firstSection)modal.insertBefore(sec,firstSection);else modal.appendChild(sec);
      _initCustomSliders();
    }
    _syncAppearUI();
    if(!document.getElementById('notifPrefsSection')){
      const saveBtn=modal.querySelector('.btn-save');
      const section=document.createElement('div');
      section.className='config-section';section.id='notifPrefsSection';
      section.innerHTML=`<div class="config-section-title">🔔 Upozornění — jazyk</div>
        <div class="config-hint" style="margin-bottom:12px;">Zvoneček zobrazí nové epizody s vybraným překladem z tvých oblíbených.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:8px 16px;font-size:13px;font-weight:700;color:var(--text-2);transition:all .15s;"><input type="checkbox" id="notifTitulky" style="accent-color:var(--accent);width:14px;height:14px;flex-shrink:0;"><span>💬 Titulky</span></label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:8px 16px;font-size:13px;font-weight:700;color:var(--text-2);transition:all .15s;"><input type="checkbox" id="notifDabing" style="accent-color:var(--accent);width:14px;height:14px;flex-shrink:0;"><span>🔊 Dabing</span></label>
        </div>`;
      if(saveBtn)modal.insertBefore(section,saveBtn);else modal.appendChild(section);
    }
  }
  const cfg=getCfg();
  document.getElementById('cfgProxy').value=cfg.proxy||DEFAULT_PROXY;
  document.getElementById('cfgSource').value=cfg.defaultSource||'auto';
  if(document.getElementById('cfgTmdbKey'))document.getElementById('cfgTmdbKey').value=cfg.tmdbKey||'';
  setStatusBadge('tmdbKeyStatus',!!cfg.tmdbKey);
  if(document.getElementById('cfgGeminiKey'))document.getElementById('cfgGeminiKey').value=cfg.geminiKey||'';
  setStatusBadge('geminiKeyStatus',!!cfg.geminiKey);
  if(document.getElementById('cfgDeeplKey'))document.getElementById('cfgDeeplKey').value=cfg.deeplKey||'';
  setStatusBadge('deeplKeyStatus',!!cfg.deeplKey);
  const notif=cfg.notifPrefs||{titulky:true,dabing:false};
  const tel=document.getElementById('notifTitulky');const del=document.getElementById('notifDabing');
  if(tel)tel.checked=notif.titulky!==false;
  if(del)del.checked=!!notif.dabing;
  setStatusBadge('proxyStatus',!!cfg.proxy);
  document.getElementById('configModal').classList.add('open');
}
function closeConfig(){document.getElementById('configModal').classList.remove('open');}
function setStatusBadge(id,ok){
  const el=document.getElementById(id);if(!el)return;
  el.className='config-status '+(ok?'ok':'missing');
  el.textContent=ok?'✓ Nastaveno':'Nenastaveno';
}
function saveConfig(){
  const cfg=getCfg();
  cfg.proxy=document.getElementById('cfgProxy').value.trim().replace(/\/$/,'');
  cfg.defaultSource=document.getElementById('cfgSource').value;
  const tmdbVal=document.getElementById('cfgTmdbKey')?.value.trim();
  if(tmdbVal!==undefined)cfg.tmdbKey=tmdbVal;
  const geminiVal=document.getElementById('cfgGeminiKey')?.value.trim();
  if(geminiVal!==undefined)cfg.geminiKey=geminiVal;
  const deeplVal=document.getElementById('cfgDeeplKey')?.value.trim();
  if(deeplVal!==undefined)cfg.deeplKey=deeplVal;
  cfg.notifPrefs={
    titulky:document.getElementById('notifTitulky')?.checked!==false,
    dabing:!!document.getElementById('notifDabing')?.checked,
  };
  setCfg(cfg);closeConfig();showToast('Nastavení uloženo',true);saveSettingsToFirestore();
  if(cfg.tmdbKey)hideTmdbPrompt();
}

function getWatched(){try{return JSON.parse(localStorage.getItem('ani_watched')||'{}');}catch{return {};}}
function setWatched(d){localStorage.setItem('ani_watched',JSON.stringify(d));localStorage.setItem('ani_watched_ts',Date.now().toString());saveUserdataToFirestore();}
function getFavs(){try{return JSON.parse(localStorage.getItem('ani_favs')||'[]');}catch{return [];}}
function setFavs(d){localStorage.setItem('ani_favs',JSON.stringify(d));saveUserdataToFirestore();}
function getHistory(){try{return JSON.parse(localStorage.getItem('ani_history')||'[]');}catch{return [];}}
function addHistory(anime){
  let h=getHistory().filter(x=>x.id!==anime.id);
  h.unshift({id:anime.id,title:anime.title,cover:anime.cover,ts:Date.now()});
  if(h.length>50)h=h.slice(0,50);
  localStorage.setItem('ani_history',JSON.stringify(h));
  saveUserdataToFirestore();
}
function isEpWatched(aId,epNum,season){return !!(getWatched()[`${aId}_s${season}`]?.[epNum]);}
function markEpWatched(aId,epNum,season,val){
  const w=getWatched(),key=`${aId}_s${season}`;
  if(!w[key])w[key]={};
  if(val)w[key][epNum]=true;else delete w[key][epNum];
  setWatched(w);
}

/* ══════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════ */
const state={
  currentAnime:null,currentEp:null,currentEpIndex:0,
  episodes:[],allSeasons:{},availableSeasons:[],currentSeason:1,
  svtSlug:null,svtTvShowId:null,svtEpisodes:[],svtIsDub:false,
  provider:'svt',
  modes:{svt:false,animegg:false},
  animeggSlug:null,animeggEpisodes:[],animeggHasDub:false,animeggIsDub:false,
  svtSources:[],svtSourceIndex:0,
  page:1,filter:'TRENDING',
  hlsInstance:null,
};

/* ══════════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════════ */
let toastTO;
let _renderEpTO=null;
function showToast(msg,success=false){
  const t=document.getElementById('toast');if(!t)return;
  document.getElementById('toastDot').style.background=success?'var(--success)':'var(--accent)';
  document.getElementById('toastMsg').textContent=msg;
  clearTimeout(toastTO);t.classList.add('show');
  toastTO=setTimeout(()=>t.classList.remove('show'),3200);
}
function capitalize(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
function getTitle(a){return a.title?.english||a.title?.romaji||a.title?.native||'—';}
function stripHtml(html){if(!html)return '';const d=new DOMParser().parseFromString(html,'text/html');return d.body.textContent||'';}
function simplifyTitle(title){return title.toLowerCase().replace(/(?:season|série|part|cour)\s*\d+.*$/i,'').replace(/[^a-z0-9]/g,'');}

function showTmdbPrompt(){
  if(document.getElementById('tmdbPrompt'))return;
  const el=document.createElement('div');
  el.id='tmdbPrompt';
  el.style.cssText='position:fixed;inset:0;z-index:9998;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;text-align:center;padding:24px;';
  el.innerHTML=`
    <div style="width:64px;height:64px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:4px;">🎬</div>
    <div>
      <div style="font-size:22px;font-weight:800;color:var(--text-1);margin-bottom:8px;">Chybí TMDB API klíč</div>
      <div style="font-size:14px;color:var(--text-3);max-width:340px;line-height:1.6;">WaterStream používá TMDB pro zobrazení anime.<br>Registrace a klíč jsou <strong style="color:var(--text-2)">zdarma</strong>.</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px;">
      <a href="https://www.themoviedb.org/settings/api" target="_blank" style="display:block;padding:12px 24px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);color:var(--accent-h);font-size:13px;font-weight:600;text-decoration:none;">Získat klíč zdarma ↗</a>
      <button onclick="openConfig()" style="padding:14px 24px;background:var(--accent);color:#fff;border:none;border-radius:var(--r-md);font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">⚙️ Zadat klíč v nastavení</button>
    </div>`;
  document.body.appendChild(el);
}
function hideTmdbPrompt(){
  document.getElementById('tmdbPrompt')?.remove();
  const page=document.body.dataset.page;
  if(page==='home')loadFilter('TRENDING');
  else if(page==='search')browseLoad();
}
function checkTmdbKey(){if(!getCfg().tmdbKey)showTmdbPrompt();}

/* ══════════════════════════════════════════════════════════
   PROXY FETCH (SVT)
══════════════════════════════════════════════════════════ */
async function proxyFetch(path){
  const url=path.startsWith('http')?path:getProxy()+path;
  const res=await fetch(url);
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ══════════════════════════════════════════════════════════
   TMDB API
══════════════════════════════════════════════════════════ */
const TMDB_BASE='https://api.themoviedb.org/3';
const TMDB_IMG='https://image.tmdb.org/t/p/w500';
const TMDB_IMG_ORIG='https://image.tmdb.org/t/p/original';
const TMDB_GENRE_NAMES={16:'Animation',35:'Comedy',18:'Drama',10759:'Action & Adventure',10765:'Sci-Fi & Fantasy',9648:'Mystery',10749:'Romance',27:'Horror',878:'Science Fiction',14:'Fantasy',28:'Action',12:'Adventure',10762:'Kids',53:'Thriller',80:'Crime',99:'Documentary'};

async function tmdbFetch(path,params={}){
  const key=getCfg().tmdbKey;
  if(!key)throw new Error('NO_KEY');
  const url=new URL(TMDB_BASE+path);
  url.searchParams.set('api_key',key);
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!=='')url.searchParams.set(k,String(v));});
  const res=await fetch(url);
  if(!res.ok)throw new Error(`TMDB ${res.status}`);
  return res.json();
}
function normalizeTmdb(item){
  const year=parseInt((item.first_air_date||item.release_date||'').split('-')[0])||null;
  return{
    id:item.id,
    title:{english:item.name||item.title,romaji:item.original_name||item.original_title},
    coverImage:{large:item.poster_path?TMDB_IMG+item.poster_path:null,extraLarge:item.poster_path?TMDB_IMG_ORIG+item.poster_path:null},
    bannerImage:item.backdrop_path?TMDB_IMG_ORIG+item.backdrop_path:null,
    averageScore:Math.round((item.vote_average||0)*10),
    episodes:item.number_of_episodes||null,
    seasonYear:year,
    genres:item.genres?item.genres.map(g=>g.name):(item.genre_ids||[]).map(id=>TMDB_GENRE_NAMES[id]).filter(Boolean),
    format:item.media_type==='movie'?'MOVIE':'TV',
    description:item.overview||'',
    status:item.status||null,
    _tmdbSeasons:item.seasons||null,
  };
}
async function fetchList(sortKey,page=1,extra=''){
  const today=new Date().toISOString().split('T')[0];
  const sortMap={TRENDING_DESC:'popularity.desc',POPULARITY_DESC:'popularity.desc',SCORE_DESC:'vote_average.desc',START_DATE_DESC:'first_air_date.desc'};
  const params={sort_by:sortMap[sortKey]||'popularity.desc',page,with_genres:'16',with_original_language:'ja','first_air_date.lte':today};
  if(sortKey==='TRENDING_DESC'){
    // "Trending" = highly popular anime aired in the last 90 days
    const d=new Date();d.setDate(d.getDate()-90);
    params['first_air_date.gte']=d.toISOString().split('T')[0];
  }
  if(sortKey==='SCORE_DESC')params['vote_count.gte']='100';
  if(extra==='seasonal'){
    const mo=new Date().getMonth(),y=new Date().getFullYear();
    const sd=[{gte:`${y}-01-01`,lte:`${y}-02-28`},{gte:`${y}-01-01`,lte:`${y}-02-28`},{gte:`${y}-03-01`,lte:`${y}-05-31`},{gte:`${y}-03-01`,lte:`${y}-05-31`},{gte:`${y}-03-01`,lte:`${y}-05-31`},{gte:`${y}-06-01`,lte:`${y}-08-31`},{gte:`${y}-06-01`,lte:`${y}-08-31`},{gte:`${y}-06-01`,lte:`${y}-08-31`},{gte:`${y}-09-01`,lte:`${y}-11-30`},{gte:`${y}-09-01`,lte:`${y}-11-30`},{gte:`${y}-09-01`,lte:`${y}-11-30`},{gte:`${y}-12-01`,lte:`${y+1}-01-31`}][mo];
    if(sd){params['first_air_date.gte']=sd.gte;params['first_air_date.lte']=sd.lte;}
  }
  const data=await tmdbFetch('/discover/tv',params);
  const items=(data.results||[]).map(normalizeTmdb);
  const hasMore=page<Math.min(data.total_pages||1,500);
  return{items,hasMore};
}
async function searchAnime(q){
  const data=await tmdbFetch('/search/tv',{query:q,include_adult:true});
  return(data.results||[]).map(normalizeTmdb);
}
async function fetchAnimeDetail(id){
  const data=await tmdbFetch(`/tv/${id}`);
  return normalizeTmdb(data);
}


/* ══════════════════════════════════════════════════════════
   SVT SCRAPER UTILITIES
══════════════════════════════════════════════════════════ */
async function svtSearch(query){
  const html=await proxyFetch(`/?searchfor=${encodeURIComponent(query)}`);
  const NAV=new Set(['novinky','oblibene','top','serial','anime','search','hledat','index','kategorie','zanr']);
  const matches=[...html.matchAll(/href="[^"]*\/serial\/([a-z0-9-]+)[^"]*"/g)];
  if(!matches.length)return[];
  return[...new Set(matches.map(m=>m[1]).filter(s=>s&&!NAV.has(s)))].slice(0,8);
}
function scoreSlugMatch(query,slug){
  const qWords=query.toLowerCase().replace(/[^\p{L}\d\s]/gu,' ').split(/\s+/).filter(w=>w.length>=2);
  const sWords=slug.split('-').filter(w=>w.length>=2);
  if(!qWords.length||!sWords.length)return 0;
  let matches=0;
  for(const qw of qWords){
    if(sWords.includes(qw))matches+=1;
    else if(sWords.some(sw=>sw.startsWith(qw)&&sw.length<=qw.length*1.5))matches+=0.6;
  }
  const coverage=qWords.length/sWords.length;
  return(matches/qWords.length)*Math.min(1,coverage*1.5);
}
async function findSvtSlug(anime,onProgress){
  const queries=new Set([anime.title?.english,anime.title?.romaji,anime.title?.native,...(anime.synonyms||[])].filter(Boolean));
  for(const t of Array.from(queries)){
    const base=t.replace(/(?:\s*[-:]\s*)?(?:season|série|part|cour)\s*\d+.*$/i,'').trim();
    if(base!==t)queries.add(base);
    const noPunct=base.replace(/[^\p{L}\d\s]/gu,' ').replace(/\s+/g,' ').trim();
    if(noPunct&&noPunct!==base)queries.add(noPunct);
    const split=base.split(/[:\-]/)[0].trim();
    if(split.length>3)queries.add(split);
  }
  const candidates=new Map();
  for(const q of Array.from(queries)){
    try{
      if(onProgress)onProgress(`Hledám CZ: ${q}…`);
      const slugs=await svtSearch(q);
      for(const slug of slugs){
        let best=0;
        for(const qAlt of Array.from(queries)){const sc=scoreSlugMatch(qAlt,slug);if(sc>best)best=sc;}
        if(!candidates.has(slug)||candidates.get(slug)<best)candidates.set(slug,best);
      }
    }catch{}
  }
  if(!candidates.size)return null;
  const sorted=[...candidates.entries()].sort((a,b)=>b[1]-a[1]);
  console.log('[SVT] Slug candidates:',sorted.slice(0,5));
  const[bestSlug,bestScore]=sorted[0];
  return bestScore>=0.5?bestSlug:null;
}
function extractTvShowId(html){
  const patterns=[/tvShowId[=:]\s*['"]?(\d+)/i,/tvShowId[=&](\d+)/i,/data-tvshowid="(\d+)"/i,/"tvShowId":\s*(\d+)/i,/tvshow_id[=:&]\s*(\d+)/i,/showId[=:]\s*(\d+)/i];
  for(const re of patterns){const m=html.match(re);if(m)return m[1];}
  return null;
}
async function svtEpisodes(slug,season,tvShowId){
  const epHtml=await proxyFetch(`/episodes-list?tvShowId=${tvShowId}&season=${season}&episode=1`);
  const epMatches=[...epHtml.matchAll(/href="[^"]*\/serial\/[^/]+\/(s\d+e\d+)[^"]*"/g)];
  const nameMatches=[...epHtml.matchAll(/class="ep_name[^"]*"[^>]*>\s*([^<]+)\s*</g)];
  const eps=epMatches.map((m,i)=>{
    const epNum=parseInt(m[1].match(/e(\d+)/)[1]);
    const segEnd=epMatches[i+1]?.index??epHtml.length;
    const seg=epHtml.slice(m.index,segEnd).toLowerCase();
    // SVT uses "TIT"/"DAB" badge text (not full word "titulky") in episode list HTML
    const hasDub=/dabing|\bdab\b/.test(seg);
    const hasTit=/titulky|\btit\b/.test(seg);
    const hasCz=hasDub||hasTit;
    return{number:epNum,title:(nameMatches[i]?nameMatches[i][1].trim():null)||`Epizoda ${epNum}`,code:m[1],slug,season,hasCz,isDubEp:hasDub&&!hasTit};
  });
  // If detection gave a mixed result (some have CZ, some don't) → reliable, use it
  const czCount=eps.filter(e=>e.hasCz).length;
  if(czCount>0&&czCount<eps.length)return eps;
  // All same (all true or all false) → text detection unreliable → reset hasCz to undefined (show-level fallback)
  eps.forEach(e=>{e.hasCz=undefined;});
  return eps;
}
function extractSvtSources(html){
  const sources=[],seen=new Set();
  let m;
  function addSrc(provider,b64){if(!seen.has(b64)){seen.add(b64);sources.push({provider,b64});}}
  const reA=/class="source_link\s+(\w+)[^"]*"[^>]*data-iframe="([A-Za-z0-9+/=]+)"/g;
  while((m=reA.exec(html))!==null)addSrc(m[1],m[2]);
  const reB=/data-iframe="([A-Za-z0-9+/=]+)"[^>]*class="source_link\s+(\w+)/g;
  while((m=reB.exec(html))!==null)addSrc(m[2],m[1]);
  if(!sources.length){
    const reC=/class="source_link\s+(\w+)[^"]*"[\s\S]{0,300}?data-iframe="([A-Za-z0-9+/=]+)"/g;
    while((m=reC.exec(html))!==null)addSrc(m[1],m[2]);
    const reD=/data-iframe="([A-Za-z0-9+/=]+)"[\s\S]{0,300}?class="source_link\s+(\w+)/g;
    while((m=reD.exec(html))!==null)addSrc(m[2],m[1]);
  }
  if(!sources.length){
    const reE=/data-iframe="([A-Za-z0-9+/=]{20,})"/g;
    while((m=reE.exec(html))!==null){
      if(!seen.has(m[1])){
        const ctx=html.substring(Math.max(0,m.index-500),m.index+100);
        const prov=ctx.match(/source_link\s+(\w+)/)?.[1]||'embed';
        addSrc(prov,m[1]);
      }
    }
  }
  return sources;
}
/* ══════════════════════════════════════════════════════════
   SLEDUJSERIALY.IO FALLBACK
══════════════════════════════════════════════════════════ */
async function findSledujSerialySlug(anime){
  const queries=[anime.title?.english,anime.title?.romaji].filter(Boolean);
  for(const q of queries){
    try{
      const res=await fetch(getProxy()+'/sledujserialy/theme/json/searchform1.php',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:`term=${encodeURIComponent(q)}&selected_language_id=1&v=656`,
        signal:AbortSignal.timeout(8000),
      });
      if(!res.ok)continue;
      const data=await res.json();
      if(Array.isArray(data)&&data[0]?.tvshow_id!=='0'&&data[0]?.slug)return data[0].slug;
    }catch{}
  }
  return null;
}
function buildSsEpUrl(slug,season,ep){
  return`https://sledujserialy.io/cz/episode/${slug}-s${String(season).padStart(2,'0')}e${String(ep).padStart(2,'0')}`;
}
function parseSsEpList(html,slug,season){
  const re=/class="s2-episode-link"\s+href="[^"]*-(s\d{2}e(\d{2,3}))"\s*>\s*\d+\.\s*([^<\n]+)/g;
  const eps=[];let m;
  while((m=re.exec(html))!==null){
    const code=m[1];const epNum=parseInt(m[2]);const rawTitle=m[3].trim();
    const seg=html.slice(Math.max(0,m.index-50),m.index+600);
    eps.push({number:epNum,title:rawTitle||`Epizoda ${epNum}`,code,slug:'__ss__',season,ssSlug:slug,ssUrl:buildSsEpUrl(slug,season,epNum),hasCz:seg.includes('fa-cc')});
  }
  return eps;
}
async function probeSledujSerialy(anime,onProgress){
  if(onProgress)onProgress('Hledám na SledujSerialy…');
  const slug=await findSledujSerialySlug(anime);
  if(!slug)return null;
  if(onProgress)onProgress(`Načítám epizody (${slug})…`);
  const html1=await fetch(getProxy()+'/sledujserialy/cz/episode/'+slug+'-s01e01',{signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.text():null).catch(()=>null);
  if(!html1)return null;
  const seasonMatches=[...html1.matchAll(/href="[^"]*\/episode\/[^"]*-s(\d{2})e01"/g)];
  const seasonNums=[...new Set(seasonMatches.map(m=>parseInt(m[1])))].sort((a,b)=>a-b);
  if(!seasonNums.length)seasonNums.push(1);
  const allEps=parseSsEpList(html1,slug,seasonNums[0]);
  if(seasonNums.length>1){
    const htmls=await Promise.all(seasonNums.slice(1).map(s=>
      fetch(getProxy()+'/sledujserialy/cz/episode/'+slug+'-s'+String(s).padStart(2,'0')+'e01',{signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.text():null).catch(()=>null)
    ));
    htmls.forEach((html,i)=>{if(html)allEps.push(...parseSsEpList(html,slug,seasonNums[i+1]));});
  }
  return allEps.length?{slug,episodes:allEps,seasons:seasonNums}:null;
}

function resolveIframeUrl(b64){
  let decoded;try{decoded=atob(b64);}catch(e){throw new Error('Neplatný base64');}
  decoded=decoded.trim();
  if(decoded.startsWith('/'))return getProxy()+decoded;
  if(decoded.startsWith('http'))return decoded;
  return getProxy()+'/'+decoded;
}

/* ══════════════════════════════════════════════════════════
   AI SUBTITLE TRANSLATOR (SK → CZ)
══════════════════════════════════════════════════════════ */
const _sub={cues:[],timer:null,startMs:0,offsetMs:0,active:false,rawText:'',fileName:'',paused:false,pausedAt:0,lang:'sk'};

function extractSubtitleUrl(html){
  // SVT-specific download link: /downloadSubs?urlSubs=slug-sN-eN-lang-ID.vtt
  const svt=html.match(/downloadSubs[^"'\s<>]*urlSubs[=:]([^"'\s&<>]+)/i);
  if(svt)return `/downloadSubs?urlSubs=${svt[1]}`;
  // No generic patterns here — false positives blocked the b64 fallback
  return null;
}

function parseVtt(text){
  const cues=[];
  const blocks=text.replace(/\r\n/g,'\n').split(/\n\n+/);
  for(const block of blocks){
    const lines=block.trim().split('\n');
    const timeLine=lines.find(l=>/-->/.test(l));
    if(!timeLine)continue;
    const [startStr,endStr]=timeLine.split('-->').map(s=>s.trim().split(' ')[0]);
    const toMs=t=>{const[h,m,rest]=t.split(':');const[s,ms]=(rest||'0').split(/[.,]/);return((+h||0)*3600+(+m||0)*60+(+s||0))*1000+(+ms||0);};
    const text=lines.slice(lines.indexOf(timeLine)+1).join(' ').replace(/<[^>]+>/g,'').trim();
    if(text)cues.push({start:toMs(startStr),end:toMs(endStr),sk:text,cz:text});
  }
  return cues;
}

async function translateWithDeepL(cues,key){
  const BATCH=50;
  const proxyBase=getProxy();
  for(let i=0;i<cues.length;i+=BATCH){
    const batch=cues.slice(i,i+BATCH);
    // Voláme přes CF Worker /deepl — DeepL blokuje přímé requesty z prohlížeče (CORS)
    const res=await fetch(`${proxyBase}/deepl`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({_key:key,text:batch.map(c=>c.sk),source_lang:_sub.lang==='en'?'EN':'SK',target_lang:'CS'}),
    });
    if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(`DeepL ${res.status}: ${err?.message||''}`);}
    const json=await res.json();
    json.translations?.forEach((t,bi)=>{if(t.text&&cues[i+bi])cues[i+bi].cz=t.text;});
  }
}

async function translateCuesCz(cues,onProgress){
  const cfg=getCfg();
  if(!cues.length)return cues;

  // DeepL primary — 500k chars/month free, batched 50 per request, better quality
  if(cfg.deeplKey){
    try{
      await translateWithDeepL(cues,cfg.deeplKey);
      if(cues.some(c=>c.cz!==c.sk))return cues;
    }catch(e){
      console.warn('[AI Subs] DeepL failed:',e.message);
      showToast('DeepL selhal, zkouším Gemini…');
    }
  }

  // Gemini fallback
  const key=cfg.geminiKey;
  if(!key)return cues;
  if(onProgress)onProgress(1,1);
  const srcLang=_sub.lang==='en'?'anglické':'slovenské';
  const prompt=`Přelož tyto ${srcLang} filmové titulky do češtiny. Odpověz POUZE přeloženými titulky, každý na novém řádku, ve stejném pořadí a počtu:\n`+cues.map((c,i)=>`${i+1}. ${c.sk}`).join('\n');
  const models=['gemini-2.0-flash','gemini-1.5-flash','gemini-2.0-flash-lite'];
  for(const model of models){
    let attempts=2;
    let rateLimited=false;
    while(attempts-->0){
      try{
        const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({contents:[{parts:[{text:prompt}]}]}),
        });
        if(res.status===429){
          if(attempts>0){showToast(`${model}: rate limit — čekám 65s…`);await new Promise(r=>setTimeout(r,65000));continue;}
          rateLimited=true;break;
        }
        const json=await res.json();
        const lines=(json.candidates?.[0]?.content?.parts?.[0]?.text||'').split('\n').filter(l=>l.trim());
        lines.forEach((line,i)=>{const text=line.replace(/^\d+\.\s*/,'').trim();if(text&&cues[i])cues[i].cz=text;});
        return cues;
      }catch(e){console.warn('[AI Subs] translate error',e);break;}
    }
    if(!rateLimited)break;
  }
  if(!cues.some(c=>c.cz!==c.sk))showToast('Překlad selhal — nastav DeepL nebo Gemini klíč v ⚙️ Nastavení',false);
  return cues;
}

async function loadAiSubs(svtHtml){
  let url=extractSubtitleUrl(svtHtml);

  // Subtitle URL is embedded in the decoded data-iframe base64 as subtitles[]=LANG;code;https://...
  if(!url && state.svtSources?.length){
    for(const src of state.svtSources){
      try{
        const decoded=atob(src.b64);
        const m=decoded.match(/subtitles\[\]=([^&#\s]+)/);
        if(m){
          const raw=m[1];
          const parts=(raw.includes('%')? decodeURIComponent(raw):raw).split(';');
          const subUrl=parts.find(p=>p.startsWith('http'));
          if(subUrl){url=subUrl;console.log('[AI Subs] found in b64 source:',subUrl);break;}
        }
      }catch{}
    }
  }

  if(!url)return false;
  const fullUrl=url.startsWith('http')?url:(getProxy()+(url.startsWith('/')?url:'/'+url));
  try{
    const resp=await fetch(fullUrl);
    if(!resp.ok)throw resp.status;
    const text=await resp.text();
    const cues=parseVtt(text);
    if(!cues.length)return false;
    _sub.cues=cues;
    _sub.rawText=text;
    _sub.fileName=url.split('/').pop().split('?')[0]||'titulky.vtt';
    return true;
  }catch(e){console.warn('[AI Subs] fetch error',e);return false;}
}

function _subSetBtnState(on){
  const btn=document.getElementById('aiSubBtn');
  const pauseBtn=document.getElementById('aiSubSyncBtn');
  const timeInput=document.getElementById('subTimeInput');
  if(btn){btn.style.background=on?'var(--accent)':'var(--surface)';btn.style.color=on?'#fff':'var(--text-1)';}
  if(pauseBtn){
    pauseBtn.style.display=on?'inline-flex':'none';
    const vid=document.querySelector('#playerWrap video');
    const isPaused=vid?vid.paused:_sub.paused;
    pauseBtn.textContent=isPaused?'▶ Pokračovat':'⏸ Pauza';
  }
  if(timeInput){
    timeInput.style.display=on?'inline-block':'none';
    if(!on)timeInput.value='';
  }
}

function _msToTimeStr(ms){
  const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
  return h>0?`${h}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
            :`${m}:${String(s%60).padStart(2,'0')}`;
}

function _subTick(){
  if(!_sub.active)return;
  const video=document.querySelector('#playerWrap video');
  let elapsed;
  if(video){
    // Video-synced mode: přesná synchronizace přes currentTime, žádný drift
    elapsed=video.currentTime*1000;
  }else{
    // Manuální timer mode (iframe zdroje)
    if(_sub.paused)return;
    elapsed=performance.now()-_sub.startMs;
  }
  const cue=_sub.cues.find(c=>elapsed>=c.start&&elapsed<=c.end);
  const el=document.getElementById('aiSubText');
  if(el)el.textContent=cue?cue.cz:'';
  const ti=document.getElementById('subTimeInput');
  if(ti&&document.activeElement!==ti)ti.value=_msToTimeStr(elapsed);
  requestAnimationFrame(_subTick);
}

function seekSubTo(ms){
  const video=document.querySelector('#playerWrap video');
  if(video){video.currentTime=ms/1000;return;}
  if(_sub.paused)_sub.startMs=_sub.pausedAt-ms;
  else _sub.startMs=performance.now()-ms;
}

function seekSubToInput(){
  const input=document.getElementById('subTimeInput');
  if(!input)return;
  const parts=input.value.trim().split(':').map(Number);
  let ms=0;
  if(parts.length===1)ms=(parts[0]||0)*1000;
  else if(parts.length===2)ms=((parts[0]||0)*60+(parts[1]||0))*1000;
  else if(parts.length===3)ms=((parts[0]||0)*3600+(parts[1]||0)*60+(parts[2]||0))*1000;
  seekSubTo(ms);
  input.blur();
  showToast('Titulky synchronizovány → '+input.value,true);
}

function startSubTimer(){
  _sub.startMs=performance.now()-_sub.offsetMs;
  _sub.active=true;
  _sub.paused=false;
  const overlay=document.getElementById('aiSubOverlay');
  if(overlay)overlay.style.display='block';
  _subSetBtnState(true);
  requestAnimationFrame(_subTick);
}

function stopSubTimer(){
  _sub.active=false;
  _sub.paused=false;
  _sub.cues=[];
  _sub.offsetMs=0;
  _sub.rawText='';
  _sub.fileName='';
  _sub.lang='sk';
  const overlay=document.getElementById('aiSubOverlay');
  if(overlay)overlay.style.display='none';
  _subSetBtnState(false);
}

function pauseSubTimer(){
  if(!_sub.active||_sub.paused)return;
  _sub.paused=true;
  _sub.pausedAt=performance.now();
  // skrýt titulkový text
  const el=document.getElementById('aiSubText');
  if(el)el.textContent='';
  _subSetBtnState(true);
}

function resumeSubTimer(){
  if(!_sub.active||!_sub.paused)return;
  _sub.startMs+=performance.now()-_sub.pausedAt;
  _sub.paused=false;
  _subSetBtnState(true);
  // V video-módu loop běží nepřetržitě, restartovat ho jen v manuálním módu
  if(!document.querySelector('#playerWrap video'))requestAnimationFrame(_subTick);
}

function tryControlVideo(cmd){
  // Nativní <video> (HLS direct play) — funguje spolehlivě
  const video=document.querySelector('#playerWrap video');
  if(video){
    if(cmd==='pause')video.pause();
    else video.play().catch(()=>{});
    return;
  }
  // iframe embed (VOE, Doodstream…) — zkusíme postMessage, záleží na playeru
  const iframe=document.querySelector('#playerWrap iframe');
  if(!iframe)return;
  const msgs=cmd==='pause'
    ?['{"method":"pause"}',{method:'pause'},'pause','{"event":"command","func":"pauseVideo"}']
    :['{"method":"play"}',{method:'play'},'play','{"event":"command","func":"playVideo"}'];
  msgs.forEach(m=>{try{iframe.contentWindow.postMessage(m,'*');}catch(e){}});
}

function toggleSubPause(){
  const video=document.querySelector('#playerWrap video');
  if(video){
    // Video-synced mode: přímo ovládáme video, titulky sledují automaticky
    if(video.paused)video.play().catch(()=>{});
    else video.pause();
    setTimeout(()=>_subSetBtnState(true),50);
    return;
  }
  // Manuální mode (iframe)
  if(_sub.paused){resumeSubTimer();tryControlVideo('play');}
  else{pauseSubTimer();tryControlVideo('pause');}
}

async function toggleAiSubs(){
  if(_sub.active){stopSubTimer();showToast('AI titulky vypnuty');return;}
  if(!getCfg().geminiKey&&!getCfg().deeplKey){showToast('Nastav DeepL nebo Gemini API klíč v ⚙️ Nastavení',false);openConfig();return;}
  if(!_sub.cues.length){showToast('Titulkový soubor nebyl nalezen pro tuto epizodu',false);return;}
  showToast('Překládám titulky…');
  await translateCuesCz(_sub.cues);
  if(!_sub.cues.some(c=>c.cz!==c.sk)){showToast('Překlad selhal — zkontroluj DeepL nebo Gemini API klíč',false);return;}
  startSubTimer();
  showToast('AI titulky zapnuty ✓',true);
}

async function downloadSubs(){
  if(!_sub.rawText&&!_sub.cues.length)return;
  const msToTime=ms=>{
    const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000),f=ms%1000;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(f).padStart(3,'0')}`;
  };
  // Auto-translate with Gemini if key is set and not yet translated
  const alreadyTranslated=_sub.cues.some(c=>c.cz!==c.sk);
  if(!alreadyTranslated&&(getCfg().deeplKey||getCfg().geminiKey)){
    const btn=document.getElementById('subDownloadBtn');
    if(btn){btn.textContent='⏳…';btn.disabled=true;}
    showToast('Překládám titulky…');
    await translateCuesCz(_sub.cues);
    if(btn){btn.textContent='⬇ TIT';btn.disabled=false;}
  }
  const isCz=_sub.cues.some(c=>c.cz!==c.sk);
  let content,filename;
  if(isCz){
    content='WEBVTT\n\n'+_sub.cues.map((c,i)=>`${i+1}\n${msToTime(c.start)} --> ${msToTime(c.end)}\n${c.cz}`).join('\n\n');
    filename='titulky_cz.vtt';
  }else{
    content=_sub.rawText;
    filename=_sub.fileName||'titulky.vtt';
  }
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type:'text/vtt;charset=utf-8'}));
  a.download=filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(isCz?'CZ titulky staženy ✓':'SK titulky staženy',true);
}

async function loadHlsSubtitles(hls){
  // Krátká pauza aby hls.js dokončil parsování subtitle tracků
  await new Promise(r=>setTimeout(r,300));
  const tracks=hls.subtitleTracks||[];
  if(!tracks.length)return false;
  const enTrack=tracks.find(t=>
    t.lang?.toLowerCase().startsWith('en')||
    /eng|english/i.test(t.name||'')
  )||tracks[0];
  if(!enTrack?.url)return false;
  const proxy=getProxy();
  try{
    const res=await fetch(`${proxy}/hls?url=${encodeURIComponent(enTrack.url)}`);
    if(!res.ok)return false;
    const text=await res.text();
    let vttText=text;
    // Subtitle track může být m3u8 playlist fragmentů VTT
    if(text.includes('#EXTM3U')){
      const lines=text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
      if(!lines.length)return false;
      const frags=await Promise.all(lines.map(async line=>{
        const fragUrl=new URL(line,enTrack.url).href;
        try{const r=await fetch(`${proxy}/hls?url=${encodeURIComponent(fragUrl)}`);return r.ok?await r.text():'';}
        catch{return '';}
      }));
      // Sloučit: jeden WEBVTT header, zbytek bez
      vttText=frags.map((f,i)=>i===0?f:f.replace(/^WEBVTT[^\n]*\n+/i,'')).join('\n');
    }
    const cues=parseVtt(vttText);
    if(!cues.length)return false;
    _sub.cues=cues;
    _sub.rawText=vttText;
    _sub.fileName='en_subtitles.vtt';
    _sub.lang='en';
    console.log(`[HLS Subs] načteno ${cues.length} EN cues`);
    return true;
  }catch(e){console.warn('[HLS Subs] chyba:',e);return false;}
}

function toggleManualSub(){
  const inp=document.getElementById('manualSubInput');
  const overlay=document.getElementById('aiSubOverlay');
  if(!inp)return;
  const open=inp.style.display==='none';
  inp.style.display=open?'':'none';
  if(open){inp.focus();}
  else{inp.value='';const el=document.getElementById('aiSubText');if(el)el.textContent='';if(overlay)overlay.style.display='none';}
}
function updateManualSub(val){
  const overlay=document.getElementById('aiSubOverlay');
  const el=document.getElementById('aiSubText');
  if(!el||!overlay)return;
  if(val.trim()){overlay.style.display='block';el.textContent=val;}
  else{el.textContent='';overlay.style.display='none';}
}
Object.assign(window,{toggleAiSubs,toggleSubPause,seekSubToInput,downloadSubs,toggleManualSub,updateManualSub,_markNotifRead});
function getPreferredSourceIndex(sources){
  const pref=getDefaultSource();
  if(pref!=='auto'){const idx=sources.findIndex(s=>s.provider.toLowerCase()===pref.toLowerCase());if(idx>=0)return idx;}
  const order=['voe','filemoon','doodstream','vidmoly','streamtape','mixdrop'];
  for(const name of order){const idx=sources.findIndex(s=>s.provider.toLowerCase()===name);if(idx>=0)return idx;}
  return 0;
}

/* ══════════════════════════════════════════════════════════
   HEADER SEARCH (all pages)
══════════════════════════════════════════════════════════ */
function initSearch(){
  const inp=document.getElementById('searchInput');
  const res=document.getElementById('searchResults');
  if(!inp||!res)return;
  let searchTO;
  inp.addEventListener('input',function(){
    clearTimeout(searchTO);
    const q=this.value.trim();
    if(!q){res.classList.remove('open');return;}
    res.innerHTML='<div style="padding:16px;text-align:center;color:var(--text-3);font-size:13px">Hledám…</div>';
    res.classList.add('open');
    searchTO=setTimeout(async()=>{
      try{
        const items=await searchAnime(q);
        const unique=[],seen=new Set();
        for(const item of items){const base=simplifyTitle(getTitle(item));if(base&&!seen.has(base)){seen.add(base);unique.push(item);}}
        if(!unique.length){res.innerHTML='<div style="padding:16px;text-align:center;color:var(--text-3);font-size:13px">Nic nenalezeno</div>';return;}
        res.innerHTML=unique.map(a=>`<div class="search-result-item" onclick="goToAnime(${a.id})"><img class="search-result-img" src="${a.coverImage?.large||''}"><div style="flex:1"><div class="search-result-title">${getTitle(a)}</div><div class="search-result-sub">${a.format||''} · ${a.episodes||'?'} ep · ${a.seasonYear||''}</div></div></div>`).join('');
      }catch{res.innerHTML='<div style="padding:16px;text-align:center;color:var(--danger);font-size:13px">Chyba hledání</div>';}
    },400);
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))res.classList.remove('open');});
}

/* ══════════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════════ */
function goToAnime(id){clearTimeout(toastTO);window.location.href=`anime.html?id=${id}`;}
function goHome(){clearTimeout(toastTO);window.location.href='index.html';}

/* ══════════════════════════════════════════════════════════
   NOTIFIKACE
══════════════════════════════════════════════════════════ */
function openNotifModal(){
  const existing=document.getElementById('notifDropdown');
  if(existing){existing.remove();return;}
  const btn=document.querySelector('[onclick="openNotifModal()"]');
  if(!btn)return;
  const wrap=btn.parentElement;
  wrap.style.position='relative';
  const dd=document.createElement('div');
  dd.id='notifDropdown';dd.className='notif-dropdown';
  dd.innerHTML=`<div class="notif-dropdown-header">🔔 Nové epizody z oblíbených</div><div class="notif-dropdown-body" id="notifDropdownBody"><div style="text-align:center;padding:20px;color:var(--text-3)"><div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto;"></div></div></div>`;
  wrap.appendChild(dd);
  setTimeout(()=>{
    function oc(e){if(!dd.contains(e.target)&&!btn.contains(e.target)){dd.remove();document.removeEventListener('click',oc);}}
    document.addEventListener('click',oc);
  },10);
  loadNotifDropdown();
}
function _notifTimeAgo(ms){
  const m=Math.floor(ms/60000),h=Math.floor(ms/3600000),d=Math.floor(ms/86400000);
  if(d>=1)return`Před ${d} d`;
  if(h>=1)return`Před ${h} h`;
  if(m>=1)return`Před ${m} min`;
  return'Právě teď';
}
function _getReadNotifs(){try{return new Set(JSON.parse(localStorage.getItem('ani_notif_read')||'[]'));}catch{return new Set();}}
function _markNotifRead(key){const r=_getReadNotifs();r.add(key);localStorage.setItem('ani_notif_read',JSON.stringify([...r]));}
function _updateNotifBadge(count){
  document.querySelectorAll('[onclick="openNotifModal()"]').forEach(btn=>{
    let badge=btn.querySelector('.notif-count-badge');
    if(count>0){
      if(!badge){badge=document.createElement('span');badge.className='notif-count-badge';btn.style.position='relative';btn.appendChild(badge);}
      badge.textContent=count>9?'9+':count;
    }else if(badge){badge.remove();}
  });
}
async function loadNotifDropdown(){
  const body=document.getElementById('notifDropdownBody');if(!body)return;
  body.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3);font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;"><div class="spinner" style="width:16px;height:16px;border-width:2px;flex-shrink:0;"></div> Načítám…</div>';
  const favs=getFavs();
  if(!favs.length){body.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3);font-size:13px;">Žádné oblíbené anime</div>';return;}
  const _notifTimeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error('TIMEOUT')),10000));
  try{
    await Promise.race([_notifTimeout,(async()=>{
    const sevenDays=7*24*3600*1000,now=Date.now();
    const results=await Promise.allSettled(favs.slice(0,20).map(f=>tmdbFetch(`/tv/${f.id}`)));
    const read=_getReadNotifs();
    const rawItems=[];
    results.forEach(r=>{
      if(r.status!=='fulfilled')return;
      const show=r.value,ep=show.last_episode_to_air;
      if(!ep?.air_date)return;
      const age=now-new Date(ep.air_date).getTime();
      if(age>sevenDays)return;
      const s=String(ep.season_number).padStart(2,'0');
      const e=String(ep.episode_number).padStart(2,'0');
      const key=`${show.id}_s${s}e${e}`;
      rawItems.push({show,ep,age,key,read:read.has(key)});
    });
    // Fetch isDub from Firestore for each show
    const svtMeta=await Promise.allSettled(rawItems.map(i=>getGlobalSvtSlug(i.show.id)));
    const items=rawItems.map((item,idx)=>{
      const meta=svtMeta[idx].status==='fulfilled'?svtMeta[idx].value:null;
      return{...item,hasSvt:!!meta,isDub:meta?.isDub??false};
    });
    const unreadCount=items.filter(i=>!i.read).length;
    _updateNotifBadge(unreadCount);
    if(!items.length){body.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3);font-size:13px;">Žádné nové epizody v posledních 7 dnech</div>';return;}
    items.sort((a,b)=>a.read-b.read||a.age-b.age);
    body.innerHTML=items.map(({show,ep,age,key,read,hasSvt,isDub})=>{
      const title=show.name||'—';
      const s=String(ep.season_number).padStart(2,'0');
      const e=String(ep.episode_number).padStart(2,'0');
      const epCode=`s${s}e${e}`;
      const timeAgo=_notifTimeAgo(age);
      const titBadge=hasSvt?'<span class="ep-lang-btn tit" style="font-size:9px;padding:2px 6px;pointer-events:none;">TIT</span>':'';
      const dabBadge=isDub?'<span class="ep-lang-btn dab" style="font-size:9px;padding:2px 6px;pointer-events:none;">DAB</span>':'';
      const badges=titBadge+dabBadge;
      const desc=isDub?'Přidané titulky a dabing do epizody':'Přidané titulky do epizody';
      const cover=show.poster_path?TMDB_IMG+show.poster_path:'';
      const opacity=read?'opacity:.45;':'';
      return `<div class="notif-dd-item" style="${opacity}" onclick="_markNotifRead('${key}');document.getElementById('notifDropdown')?.remove();window.location.href='watch.html?id=${show.id}&ep=${ep.episode_number}&season=${ep.season_number}'">
        <img src="${cover}" class="notif-dd-thumb">
        <div class="notif-dd-info">
          <div class="notif-dd-title">${title} <span style="color:var(--text-3);font-weight:600;">- ${epCode}</span></div>
          <div class="notif-dd-sub">${timeAgo} ${badges||'<span style="color:var(--text-3);font-size:9px;">CZ neznámo</span>'}</div>
          <div class="notif-dd-desc">${desc}</div>
        </div>
      </div>`;
    }).join('');
    })()]);
  }catch(e){
    if(e.message==='TIMEOUT'){body.innerHTML='<div style="text-align:center;padding:20px;color:var(--danger);font-size:13px;">Načítání trvalo příliš dlouho — zkus to znovu</div>';return;}
    if(e.message==='NO_KEY'){body.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3);font-size:13px;">Nastav TMDB klíč v ⚙️ Nastavení</div>';return;}
    body.innerHTML=`<div style="text-align:center;padding:20px;color:var(--danger);font-size:13px;">${e.message}</div>`;
  }
}
function closeNotifModal(){document.getElementById('notifDropdown')?.remove();}
async function openSvtDirectly(slug){
  closeNotifModal();
  const res=await searchAnime(slug.replace(/-/g,' '));
  if(res?.length)goToAnime(res[0].id);else showToast('Seriál nenalezen v AniList');
}

/* ══════════════════════════════════════════════════════════
   AI DOPORUČENÍ (Gemini)
══════════════════════════════════════════════════════════ */
function openAiModal(){}
function closeAiModal(){}
function searchFromAi(name){
  closeAiModal();
  const page=document.body.dataset.page;
  if(page==='home'||page==='search'){
    const inp=document.getElementById('searchInput');
    if(inp){inp.value=name;inp.dispatchEvent(new Event('input'));inp.focus();}
  }else{
    window.location.href=`search.html?q=${encodeURIComponent(name)}`;
  }
}

/* ══════════════════════════════════════════════════════════
   HISTORIE & OBLÍBENÉ MODAL
══════════════════════════════════════════════════════════ */
function openHistory(){ window.location.href='history.html'; }
function closeHistory(){ const m=document.getElementById('historyModal');if(m)m.classList.remove('open'); }

/* ══════════════════════════════════════════════════════════
   HISTORY PAGE
══════════════════════════════════════════════════════════ */
let _historyTab='favs';

function showHistoryTab(tab){
  _historyTab=tab;
  document.querySelectorAll('.history-tab').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.tab===tab);
  });
  renderHistoryContent();
}

function getAnimeWatchStatus(animeId){
  const w=getWatched();
  let total=0,maxEp=0;
  for(const[k,eps]of Object.entries(w)){
    if(!k.startsWith(`${animeId}_s`))continue;
    const nums=Object.keys(eps).map(Number).filter(n=>eps[n]);
    total+=nums.length;
    if(nums.length)maxEp=Math.max(maxEp,...nums);
  }
  if(!total)return'none';
  if(total>=maxEp&&maxEp>0)return'completed';
  return'watching';
}

function renderHistoryContent(){
  const sort=document.getElementById('historySortSelect')?.value||'recent';
  const activeFilter=document.querySelector('.filter-chip.active')?.dataset.filter||'all';
  const container=document.getElementById('historyPageContent');
  if(!container)return;
  let items=_historyTab==='favs'?getFavs():getHistory();
  if(activeFilter!=='all'){
    items=items.filter(a=>{
      const st=getAnimeWatchStatus(a.id);
      return activeFilter==='watched'?st!=='none':st==='none';
    });
  }
  items=[...items];
  if(sort==='alpha-asc')items.sort((a,b)=>(a.title||'').localeCompare(b.title||'','cs'));
  else if(sort==='alpha-desc')items.sort((a,b)=>(b.title||'').localeCompare(a.title||'','cs'));
  else if(sort==='score')items.sort((a,b)=>(b.score||0)-(a.score||0));
  else if(sort==='year')items.sort((a,b)=>(b.year||0)-(a.year||0));
  if(!items.length){
    container.innerHTML=`<div style="text-align:center;padding:80px 0;color:var(--text-3);font-size:14px;font-weight:600;">${_historyTab==='favs'?'Žádné oblíbené anime.':'Žádná historie sledování.'}</div>`;
    return;
  }
  container.innerHTML=`<div class="anime-grid">${items.map(a=>{
    const st=getAnimeWatchStatus(a.id);
    const badge=st==='completed'?'<div class="card-ep-badge" style="background:rgba(74,222,128,.22);color:var(--success);">✓ Dokoukáno</div>':st==='watching'?'<div class="card-ep-badge" style="background:rgba(139,110,245,.18);color:var(--accent-h);">▶ Rozkoukáno</div>':'';
    return `<div class="anime-card" onclick="goToAnime(${a.id})">
      <div class="card-poster">
        <img src="${a.cover||''}" loading="lazy">
        ${a.score?`<div class="card-rating">★ ${(a.score/10).toFixed(1)}</div>`:''}
        ${badge}
        <div class="card-overlay"><div class="play-icon"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div>
      </div>
      <div class="card-title">${a.title||''}</div>
      <div class="card-meta">${a.year||''}${a.year&&a.genres?.[0]?' · ':''}${a.genres?.[0]||''}</div>
    </div>`;
  }).join('')}</div>`;
}

function initHistoryPage(){
  initSearch();
  showHistoryTab(location.hash==='#history'?'history':'favs');
  document.getElementById('historySortSelect')?.addEventListener('change',renderHistoryContent);
  document.querySelectorAll('.filter-chip').forEach(btn=>{
    btn.addEventListener('click',function(){
      document.querySelectorAll('.filter-chip').forEach(b=>b.classList.remove('active'));
      this.classList.add('active');
      renderHistoryContent();
    });
  });
}

/* ══════════════════════════════════════════════════════════
   SDÍLENÉ RENDEROVÁNÍ EPIZOD
══════════════════════════════════════════════════════════ */
function renderEpList(){
  const list=document.getElementById('epList');if(!list)return;
  const aId=state.currentAnime?.id,s=state.currentSeason;
  const isWatch=document.body.dataset.page==='watch';
  const svtDub=state.svtIsDub;
  const checkSvg=`<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
  list.innerHTML=state.episodes.map((ep,i)=>{
    const w=isEpWatched(aId,ep.number,s);
    const curr=isWatch&&state.currentEp?.number===ep.number;
    const epHasCz=state.modes.svt&&(ep.hasCz??true);
    const langBtns=epHasCz
      ?`<button class="ep-lang-btn ${svtDub?'dab':'tit'}" onclick="playEpWithMode(event,${ep.number},${s},'svt')" title="${svtDub?'CZ dabing':'CZ titulky'}">${svtDub?'DAB':'TIT'}</button>`
      :'';
    return `<li id="ep-item-${ep.number}"><a href="#" class="${curr?'current':''} ${w?'watched':''}" onclick="onEpisodeClick(${i});return false">
      <span class="ep-num-box">${ep.number}</span>
      <span class="ep-name-wide">${ep.title}</span>
      ${ep.isFiller?'<span class="ep-filler">Filler</span>':''}
      ${langBtns}
      <button class="ep-watched-btn${w?' checked':''}" onclick="toggleEpWatched(event,${i})" title="${w?'Zrušit zhlédnutí':'Označit jako zhlédnuté'}">${checkSvg}</button>
    </a></li>`;
  }).join('');
}

function playEpWithMode(event,epNumber,season,mode){
  event.preventDefault();event.stopPropagation();
  if(mode==='svt'&&state.modes.svt)activateMode('svt');
  const idx=state.episodes.findIndex(ep=>ep.number===epNumber);
  if(idx>=0)onEpisodeClick(idx);
}

function onEpisodeClick(index){
  if(document.body.dataset.page==='watch'){
    playEp(index);
  }else{
    const ep=state.episodes[index];
    if(!ep)return;
    sessionStorage.setItem('ani_watch_state',JSON.stringify({
      anime:state.currentAnime,
      episodes:state.episodes,
      svtSlug:state.svtSlug,
      svtTvShowId:state.svtTvShowId,
      availableSeasons:state.availableSeasons,
      allSeasons:state.allSeasons,
      modes:state.modes,
      provider:state.provider,
      animeggSlug:state.animeggSlug,
      animeggEpisodes:state.animeggEpisodes,
      currentSeason:state.currentSeason,
    }));
    window.location.href=`watch.html?id=${state.currentAnime.id}&ep=${ep.number}&season=${ep.season||state.currentSeason}`;
  }
}

/* ══════════════════════════════════════════════════════════
   HOME PAGE
══════════════════════════════════════════════════════════ */
function renderSkeletons(n=12){
  document.getElementById('animeGrid').innerHTML=Array.from({length:n},()=>`<div class="anime-card"><div class="card-poster skeleton skeleton-poster"></div><div class="skeleton skeleton-title"></div></div>`).join('');
}
function renderCards(items,append=false){
  const grid=document.getElementById('animeGrid');
  if(!append)grid.innerHTML='';
  items.forEach((a,i)=>{
    const title=getTitle(a);
    const card=document.createElement('div');
    card.className='anime-card';card.style.animationDelay=`${(i%12)*0.03}s`;
    card.innerHTML=`<div class="card-poster"><img src="${a.coverImage?.large||''}" alt="${title}" loading="lazy">${a.averageScore?`<div class="card-rating">★ ${(a.averageScore/10).toFixed(1)}</div>`:''}<div class="card-ep-badge">${a.episodes||a.nextAiringEpisode?.episode-1||'?'} ep</div><div class="card-overlay"><div class="play-icon"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div></div><div class="card-title">${title}</div><div class="card-meta">${a.seasonYear||''} ${a.genres?.[0]?`· ${a.genres[0]}`:''}</div>`;
    card.onclick=()=>goToAnime(a.id);
    grid.appendChild(card);
  });
}
const FILTERS={
  TRENDING:{sort:'TRENDING_DESC',label:'Výběr',extra:''},
  POPULAR:{sort:'POPULARITY_DESC',label:'Populární',extra:''},
  TOP_RATED:{sort:'SCORE_DESC',label:'Top hodnocení',extra:''},
  SEASONAL:{sort:'POPULARITY_DESC',label:'Tato sezona',extra:'seasonal'},
};
async function loadFilter(filter,append=false){
  const f=FILTERS[filter];
  if(!append){renderSkeletons();state.page=1;document.getElementById('sectionTitle').textContent=f.label;}
  const btn=document.getElementById('loadMoreBtn');btn.disabled=true;
  try{
    const{items,hasMore}=await fetchList(f.sort,state.page,f.extra);
    const unique=[],seen=new Set();
    for(const item of items){const base=simplifyTitle(getTitle(item));if(base&&!seen.has(base)){seen.add(base);unique.push(item);}}
    if(!append&&unique.length>0){
      const heroItems=unique.splice(0,5);
      initCarousel(heroItems);
      document.getElementById('heroSection').classList.add('active');
    }else if(!append){document.getElementById('heroSection').classList.remove('active');}
    renderCards(unique,append);
    btn.disabled=!hasMore;btn.style.display=hasMore?'':'none';
  }catch(e){
    if(e.message==='NO_KEY'){showTmdbPrompt();return;}
    document.getElementById('animeGrid').innerHTML=`<div style="grid-column:1/-1;text-align:center;color:var(--danger)">Chyba: ${e.message}</div>`;
  }
}
function switchFilter(btn,filter){
  document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');state.filter=filter;state.page=1;loadFilter(filter);
}
function loadMore(){state.page++;loadFilter(state.filter,true);}

async function initHomeNotifications(){
  const favs=getFavs();
  if(!favs.length)return;
  const section=document.getElementById('homeNewEpsSection');
  const grid=document.getElementById('homeNewEpsGrid');
  if(!section||!grid)return;
  try{
    const sevenDays=14*24*3600*1000,now=Date.now();
    // Fetch in batches to avoid too many parallel requests
    const allResults=[];
    for(let i=0;i<favs.length;i+=20){
      const batch=await Promise.allSettled(favs.slice(i,i+20).map(f=>tmdbFetch(`/tv/${f.id}`)));
      allResults.push(...batch);
    }
    const items=[];
    allResults.forEach(r=>{
      if(r.status!=='fulfilled')return;
      const show=r.value,ep=show.last_episode_to_air;
      if(!ep?.air_date)return;
      const age=now-new Date(ep.air_date).getTime();
      if(age>sevenDays)return;
      items.push({show,ep,age});
    });
    if(!items.length)return;
    items.sort((a,b)=>a.age-b.age);
    section.style.display='block';
    grid.innerHTML=items.map(({show,ep})=>{
      const title=show.name||'—';
      const date=new Date(ep.air_date).toLocaleDateString('cs-CZ',{day:'numeric',month:'short'});
      const cover=show.poster_path?TMDB_IMG+show.poster_path:'';
      return `<div class="new-ep-card" onclick="window.location.href='watch.html?id=${show.id}&ep=${ep.episode_number}&season=${ep.season_number}'">
        <div class="new-ep-thumb">
          <img src="${cover}" loading="lazy">
          <div class="new-ep-badge">Ep. ${ep.episode_number}</div>
        </div>
        <div class="new-ep-title">${title}</div>
        <div class="new-ep-date">${date}</div>
      </div>`;
    }).join('');
  }catch(e){console.warn('[HomeNotif]',e.message);}
}

/* ══════════════════════════════════════════════════════════
   HOME CAROUSEL
══════════════════════════════════════════════════════════ */
let _carouselIdx=0,_carouselTotal=0,_carouselTimer=null;
function initCarousel(items){
  const section=document.getElementById('heroSection');
  if(!section)return;
  _carouselTotal=items.length;_carouselIdx=0;
  section.innerHTML=`
    <div class="hero-slides" id="heroSlides"></div>
    <button class="hero-prev" onclick="carouselNav(-1)">&#8249;</button>
    <button class="hero-next" onclick="carouselNav(1)">&#8250;</button>
    <div class="hero-dots" id="heroDots"></div>`;
  const slides=document.getElementById('heroSlides');
  const dots=document.getElementById('heroDots');
  items.forEach((a,i)=>{
    const t=getTitle(a);const bg=a.bannerImage||a.coverImage?.extraLarge||'';
    const slide=document.createElement('div');
    slide.className='hero-slide'+(i===0?' active':'');
    slide.innerHTML=`<div class="hero-bg" style="background-image:url('${bg}')"></div><div class="hero-overlay"></div><div class="hero-content"><div class="hero-tag">${a.genres?.[0]||'Trending'}</div><h1 class="hero-title">${t}</h1><p class="hero-desc">${(stripHtml(a.description||'')).substring(0,180)}…</p><button class="btn-play-hero" onclick="goToAnime(${a.id})"><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>Přehrát</button></div>`;
    slides.appendChild(slide);
    const dot=document.createElement('div');
    dot.className='hero-dot'+(i===0?' active':'');
    dot.onclick=()=>carouselGo(i);
    dots.appendChild(dot);
  });
  clearInterval(_carouselTimer);
  _carouselTimer=setInterval(()=>carouselNav(1),6000);
}
function carouselNav(d){carouselGo((_carouselIdx+d+_carouselTotal)%_carouselTotal);}
function carouselGo(idx){
  const slides=document.querySelectorAll('.hero-slide');
  const dots=document.querySelectorAll('.hero-dot');
  slides[_carouselIdx]?.classList.remove('active');
  dots[_carouselIdx]?.classList.remove('active');
  _carouselIdx=idx;
  slides[idx]?.classList.add('active');
  dots[idx]?.classList.add('active');
  clearInterval(_carouselTimer);
  _carouselTimer=setInterval(()=>carouselNav(1),6000);
}

function initHomePage(){
  initSearch();
  checkTmdbKey();
  const urlQ=new URLSearchParams(location.search).get('q');
  if(urlQ){
    const inp=document.getElementById('searchInput');
    if(inp){inp.value=urlQ;inp.dispatchEvent(new Event('input'));inp.focus();}
  }else{
    loadFilter('TRENDING');
    initHomeNotifications();
  }
}

let _browsePage=1,_browseSort='TRENDING_DESC',_browseGenre='',_browseYear='',_browseFormat='',_browseStatus='',_browseScore='';
async function browseLoad(append=false){
  const grid=document.getElementById('searchPageGrid');
  const titleEl=document.getElementById('searchPageResultsTitle');
  const loadMoreBtn=document.getElementById('searchLoadMore');
  if(!grid)return;
  if(!append){_browsePage=1;grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-3);"><div class="spinner" style="margin:0 auto;"></div></div>';}
  try{
    const today=new Date().toISOString().split('T')[0];
    let data;
    const hasFilters=_browseGenre||_browseYear||_browseStatus||_browseScore||_browseFormat;
    if(_browseSort==='TRENDING_DESC'&&!hasFilters){
      data=await tmdbFetch('/trending/tv/week',{page:_browsePage});
      data={...data,results:(data.results||[]).filter(i=>i.genre_ids?.includes(16)||i.original_language==='ja')};
    }else{
      const sortMap={TRENDING_DESC:'popularity.desc',POPULARITY_DESC:'popularity.desc',SCORE_DESC:'vote_average.desc',START_DATE_DESC:'first_air_date.desc'};
      const params={sort_by:sortMap[_browseSort]||'popularity.desc',page:_browsePage,with_genres:'16',with_original_language:'ja','first_air_date.lte':today};
      if(_browseSort==='SCORE_DESC')params['vote_count.gte']='100';
      if(_browseSort==='START_DATE_DESC')params['vote_count.gte']='10';
      if(_browseGenre)params.with_genres=`16,${_browseGenre}`;
      if(_browseYear)params.first_air_date_year=_browseYear;
      if(_browseStatus)params.with_status=_browseStatus;
      if(_browseFormat)params.with_type=_browseFormat;
      if(_browseScore)params['vote_average.gte']=_browseScore;
      data=await tmdbFetch('/discover/tv',params);
    }
    const items=(data.results||[]).map(normalizeTmdb);
    const hasMore=_browsePage<Math.min(data.total_pages||1,500);
    const unique=[],seen=new Set();
    for(const a of items){const k=simplifyTitle(getTitle(a));if(k&&!seen.has(k)){seen.add(k);unique.push(a);}}
    if(!append)grid.innerHTML='';
    if(!unique.length&&!append){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-3);">Nic nenalezeno</div>';if(loadMoreBtn)loadMoreBtn.style.display='none';return;}
    unique.forEach((a,i)=>{
      const t=getTitle(a);const card=document.createElement('div');card.className='anime-card';card.style.animationDelay=`${(i%12)*0.03}s`;
      card.innerHTML=`<div class="card-poster"><img src="${a.coverImage?.large||''}" alt="${t}" loading="lazy">${a.averageScore?`<div class="card-rating">★ ${(a.averageScore/10).toFixed(1)}</div>`:''}<div class="card-ep-badge">${a.episodes||'?'} ep</div><div class="card-overlay"><div class="play-icon"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div></div><div class="card-title">${t}</div><div class="card-meta">${a.seasonYear||''} ${a.genres?.[0]?`· ${a.genres[0]}`:''}</div>`;
      card.onclick=()=>goToAnime(a.id);grid.appendChild(card);
    });
    if(loadMoreBtn)loadMoreBtn.style.display=hasMore?'':'none';
    const sortLabel={TRENDING_DESC:'Trending',POPULARITY_DESC:'Populární',SCORE_DESC:'Dle hodnocení',START_DATE_DESC:'Nejnovější'}[_browseSort]||'Výsledky';
    const activeFilters=[_browseGenre&&'Žánr',_browseYear,_browseStatus&&'Stav',_browseFormat&&'Typ',_browseScore&&`${_browseScore}+`].filter(Boolean);
    if(titleEl&&!append)titleEl.textContent=activeFilters.length?`Filtrováno: ${activeFilters.join(' · ')}`:sortLabel;
  }catch(e){
    if(e.message==='NO_KEY'){showTmdbPrompt();return;}
    if(!append)grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--danger);">${e.message}</div>`;
  }
}
function browseLoadMore(){_browsePage++;browseLoad(true);}

function initSearchPage(){
  initSearch();
  checkTmdbKey();
  const inp=document.getElementById('searchInput');
  const grid=document.getElementById('searchPageGrid');
  const titleEl=document.getElementById('searchPageResultsTitle');

  // Sort chips
  document.querySelectorAll('#browseSortChips .filter-chip').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('#browseSortChips .filter-chip').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      _browseSort=btn.dataset.sort;
      if(!inp?.value.trim())browseLoad();
    };
  });

  // Dropdowns
  const genreSel=document.getElementById('filterGenre');
  const yearSel=document.getElementById('filterYear');
  const statusSel=document.getElementById('filterStatus');
  const typeSel=document.getElementById('filterType');
  const scoreSel=document.getElementById('filterScore');
  if(genreSel)genreSel.onchange=()=>{_browseGenre=genreSel.value;if(!inp?.value.trim())browseLoad();};
  if(yearSel)yearSel.onchange=()=>{_browseYear=yearSel.value;if(!inp?.value.trim())browseLoad();};
  if(statusSel)statusSel.onchange=()=>{_browseStatus=statusSel.value;if(!inp?.value.trim())browseLoad();};
  if(typeSel)typeSel.onchange=()=>{_browseFormat=typeSel.value;if(!inp?.value.trim())browseLoad();};
  if(scoreSel)scoreSel.onchange=()=>{_browseScore=scoreSel.value;if(!inp?.value.trim())browseLoad();};

  // Search override
  if(inp){
    inp.addEventListener('input',function(){
      const q=this.value.trim();
      if(q.length>=2){
        if(titleEl)titleEl.textContent=`Výsledky pro "${q}"`;
        clearTimeout(inp._spTO);
        inp._spTO=setTimeout(async()=>{
          if(grid)grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-3);"><div class="spinner" style="margin:0 auto;"></div></div>';
          try{
            const items=await searchAnime(q);
            const unique=[],seen=new Set();
            for(const a of items){const k=simplifyTitle(getTitle(a));if(k&&!seen.has(k)){seen.add(k);unique.push(a);}}
            if(!unique.length){if(grid)grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-3);">Nic nenalezeno</div>';return;}
            if(grid){grid.innerHTML='';unique.forEach((a,i)=>{const t=getTitle(a);const card=document.createElement('div');card.className='anime-card';card.style.animationDelay=`${(i%12)*0.03}s`;card.innerHTML=`<div class="card-poster"><img src="${a.coverImage?.large||''}" alt="${t}" loading="lazy">${a.averageScore?`<div class="card-rating">★ ${(a.averageScore/10).toFixed(1)}</div>`:''}<div class="card-ep-badge">${a.episodes||'?'} ep</div><div class="card-overlay"><div class="play-icon"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div></div></div><div class="card-title">${t}</div><div class="card-meta">${a.seasonYear||''} ${a.genres?.[0]?`· ${a.genres[0]}`:''}</div>`;card.onclick=()=>goToAnime(a.id);grid.appendChild(card);});}
          }catch(e){if(grid)grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--danger);">${e.message}</div>`;}
        },400);
      }else browseLoad();
    });
    const urlQ=new URLSearchParams(location.search).get('q');
    if(urlQ){inp.value=urlQ;inp.dispatchEvent(new Event('input'));}
    else browseLoad();
    setTimeout(()=>inp.focus(),100);
  }else browseLoad();
}

/* ══════════════════════════════════════════════════════════
   ANIME DETAIL PAGE
══════════════════════════════════════════════════════════ */
async function loadSvtBySlug(slug,anime,setMsg){
  state.svtSlug=slug;
  if(setMsg)setMsg(`Načítám SVT data (${slug})…`);
  let tvShowId=null,firstHtml='';
  const pagesToTry=[`/serial/${slug}`,`/serial/${slug}/s01e01`,`/serial/${slug}/s01e01/`];
  for(const path of pagesToTry){
    try{
      const h=await proxyFetch(path);
      tvShowId=extractTvShowId(h);
      if(tvShowId){firstHtml=h;break;}
    }catch(e){console.warn('[SVT] fetch error for',path,e.message);}
  }
  if(!tvShowId)return false;
  // Detect CZ dabing vs CZ titulky from the SVT page HTML
  const hl=firstHtml.toLowerCase();
  state.svtIsDub=/\bdabing\b/.test(hl)||/czsk[-\s]dab/.test(hl)||/cz[-\s]dab/.test(hl);
  state.svtTvShowId=tvShowId;
  let targetS=1;
  const titleStr=`${anime.title?.english||''} ${anime.title?.romaji||''}`.toLowerCase();
  const sm=titleStr.match(/(?:season|part|série)\s*(\d+)/);
  if(sm)targetS=parseInt(sm[1]);
  const checks=await Promise.all(Array.from({length:15},(_,i)=>i+1).map(async s=>{
    try{return(await proxyFetch(`/episodes-list?tvShowId=${tvShowId}&season=${s}&episode=1`)).includes('/serial/')?s:null;}catch{return null;}
  }));
  state.availableSeasons=checks.filter(Boolean).length?checks.filter(Boolean):[1];
  state.currentSeason=state.availableSeasons.includes(targetS)?targetS:(state.availableSeasons.includes(1)?1:state.availableSeasons[0]);
  renderSeasonTabs();
  const eps=await svtEpisodes(slug,state.currentSeason,tvShowId);
  // Záloha: pokud stránka seriálu neobsahuje "dabing", zkus episode segmenty
  if(!state.svtIsDub&&eps.filter(e=>e.isDubEp).length>0)state.svtIsDub=true;
  state.allSeasons[state.currentSeason]=eps;state.svtEpisodes=eps;
  return true;
}



/* ══════════════════════════════════════════════════════════
   ANIMEGG.ORG — EN záloha
══════════════════════════════════════════════════════════ */
function makeAnimeggSlug(title){
  return (title||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
async function animeggFetch(path){
  const proxy=getProxy();
  const res=await fetch(`${proxy}/animegg${path}`,{signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw new Error(`AnimeGG ${res.status}`);
  return res.text();
}
function extractAnimeggEmbedIds(html){
  // data-video="/embed/{id}" pattern (tab-based players)
  const dvMatches=[...html.matchAll(/data-video=["']\/embed\/(\d+)["']/g)];
  if(dvMatches.length>=1){
    const ids=[...new Set(dvMatches.map(m=>m[1]))];
    return{subId:ids[0]||null,dubId:ids[1]||null};
  }
  // fallback: any /embed/{id} links
  const allMatches=[...html.matchAll(/\/embed\/(\d+)/g)];
  const ids=[...new Set(allMatches.map(m=>m[1]))];
  return{subId:ids[0]||null,dubId:ids[1]||null};
}
function extractAnimeggSources(html){
  const m=html.match(/var videoSources\s*=\s*(\[[\s\S]*?\]);/);
  if(!m)return[];
  try{
    // JS object literal has unquoted keys — convert to valid JSON
    const jsonStr=m[1]
      .replace(/([{,]\s*)(\w+)\s*:/g,'$1"$2":')
      .replace(/:\s*false([,}\]])/g,':false$1')
      .replace(/:\s*true([,}\]])/g,':true$1');
    const arr=JSON.parse(jsonStr);
    return arr.map(s=>({label:s.label||'SD',url:'https://www.animegg.org'+s.file})).filter(s=>s.url.includes('/play/'));
  }catch(e){console.warn('[ANIMEGG] parse error',e);return[];}
}
async function probeAnimegg(anime){
  const titles=[anime.title?.english,anime.title?.romaji,anime.title?.native].filter(Boolean);
  for(const title of titles){
    const slug=makeAnimeggSlug(title);
    if(!slug)continue;
    for(const path of[`/${slug}-episode-1`,`/${slug}-season-1-episode-1`]){
      try{
        const html=await animeggFetch(path);
        if(!html||html.length<500)continue;
        const{subId,dubId}=extractAnimeggEmbedIds(html);
        if(!subId)continue;
        console.log(`[ANIMEGG probe] nalezeno: ${path}, dub=${!!dubId}`);
        return{slug,epCount:anime.episodes||12,hasDub:!!dubId};
      }catch{}
    }
  }
  return null;
}
async function playAnimeggEp(ep,wrap,ph,isDub){
  if(isDub===undefined)isDub=state.animeggIsDub;
  ph.style.display='flex';
  ph.innerHTML='<div class="spinner"></div><span style="color:var(--text-3)">Načítám z AnimeGG…</span>';
  destroyHls();wrap.querySelectorAll('video,iframe').forEach(el=>el.remove());
  try{
    const epHtml=await animeggFetch(`/${state.animeggSlug}-episode-${ep.number}`);
    const{subId,dubId}=extractAnimeggEmbedIds(epHtml);
    const embedId=isDub?(dubId||subId):subId;
    if(!embedId)throw new Error('Embed ID nenalezen');
    const embedHtml=await animeggFetch(`/embed/${embedId}`);
    const sources=extractAnimeggSources(embedHtml);
    if(!sources.length)throw new Error('Video sources nenalezeny');
    const best=sources.find(s=>s.label==='720p')||sources[sources.length-1];
    ph.style.display='none';
    const srcRow=document.getElementById('sourceRow');
    srcRow.style.display='flex';
    let subDubHtml='';
    if(state.animeggHasDub&&dubId){
      subDubHtml=`<div class="subdub-toggle" style="display:flex;gap:4px;margin-right:8px;">
        <button class="source-btn${!isDub?' active':''}" onclick="animeggSwitchSubDub(false)">SUB</button>
        <button class="source-btn${isDub?' active':''}" onclick="animeggSwitchSubDub(true)">DUB</button>
      </div>`;
    }
    document.getElementById('sourceBtns').innerHTML=subDubHtml+sources.map(s=>
      `<button class="source-btn${s===best?' active':''}" onclick="animeggLoadSource('${s.url.replace(/'/g,"\\'")}',this)">${s.label}</button>`
    ).join('');
    const badge=isDub?'🎙️ EN dub (AnimeGG)':'🌐 EN sub (AnimeGG)';
    document.getElementById('langBadge').innerHTML=`<span class="sub-badge en">${badge}</span>`;
    animeggLoadSource(best.url,null);
  }catch(e){
    console.warn('[ANIMEGG]',e);
    ph.style.display='flex';
    ph.innerHTML=`<svg width="40" height="40" fill="none" stroke="var(--danger)" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    <span style="color:var(--danger);font-weight:700;">AnimeGG: nedostupné</span>
    <span style="font-size:13px;color:var(--text-3)">${e.message}</span>`;
  }
}
function animeggSwitchSubDub(isDub){
  state.animeggIsDub=isDub;
  const wrap=document.getElementById('playerWrap');
  const ph=document.getElementById('playerPlaceholder');
  const ep=state.episodes[state.currentEpIndex];
  if(ep)playAnimeggEp(ep,wrap,ph,isDub);
}
function animeggLoadSource(url,btn){
  if(btn){document.querySelectorAll('#sourceBtns .source-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  destroyHls();
  const wrap=document.getElementById('playerWrap');
  wrap.querySelectorAll('video,iframe').forEach(el=>el.remove());
  document.getElementById('playerPlaceholder').style.display='none';
  const vid=document.createElement('video');
  vid.controls=true;vid.autoplay=true;
  vid.style.cssText='position:absolute;inset:0;width:100%;height:100%;background:#000;';
  wrap.appendChild(vid);
  const path=url.replace('https://www.animegg.org','');
  vid.src=`${getProxy()}/animegg${path}`;
  vid.play().catch(()=>{});
}

function currentModeKey(){
  if(state.provider==='animegg')return 'animegg';
  if(state.provider==='ss')return 'ss';
  return 'svt';
}
function renderModeSwitch(){
  const el=document.getElementById('modeSwitch');if(!el)return;
  const btns=[];
  if(state.modes.svt)btns.push({mode:'svt',label:'🇨🇿 CZ / SK',sub:'svetserialu'});
  if(state.modes.animegg)btns.push({mode:'animegg',label:'🌐 EN sub',sub:'AnimeGG'});
  if(state.modes.ss)btns.push({mode:'ss',label:'🔗 SK / CZ',sub:'sledujserialy'});
  if(btns.length<=1){el.style.display='none';return;}
  el.style.display='flex';
  const cur=currentModeKey();
  el.innerHTML=btns.map(b=>
    `<button class="mode-btn ${cur===b.mode?'active':''}" onclick="activateMode('${b.mode}')">${b.label}<span class="mode-btn-sub">${b.sub}</span></button>`
  ).join('');
}
function activateMode(mode){
  state.currentEp=null;
  if(mode==='svt'){
    state.provider='svt';
    state.episodes=state.allSeasons[state.currentSeason]||state.svtEpisodes;
    renderSeasonTabs();
  }else if(mode==='animegg'){
    state.provider='animegg';
    state.currentSeason=1;
    state.episodes=state.animeggEpisodes;
    const tabs=document.getElementById('seasonTabs');
    if(tabs)tabs.style.display='none';
  }else if(mode==='ss'){
    state.provider='ss';
    const bySeason={};
    state.ssEpisodes.forEach(ep=>{if(!bySeason[ep.season])bySeason[ep.season]=[];bySeason[ep.season].push(ep);});
    Object.entries(bySeason).forEach(([s,eps])=>{state.allSeasons[s]=eps;});
    state.availableSeasons=Object.keys(bySeason).map(Number).sort((a,b)=>a-b);
    state.currentSeason=state.availableSeasons[0]||1;
    state.episodes=bySeason[state.currentSeason]||state.ssEpisodes;
    renderSeasonTabs();
  }
  renderEpList();setupMainPlayBtn();renderModeSwitch();updateMarkSeasonBtn();
}

function renderSeasonTabs(){
  const tabs=document.getElementById('seasonTabs');if(!tabs)return;
  if(state.availableSeasons.length<=1){tabs.style.display='none';return;}
  tabs.style.display='block';
  const sel=document.createElement('select');
  sel.className='season-select';
  state.availableSeasons.forEach(s=>{
    const o=document.createElement('option');o.value=s;o.textContent=`Série ${s}`;o.selected=s===state.currentSeason;sel.appendChild(o);
  });
  sel.onchange=()=>switchSeason(parseInt(sel.value));
  tabs.innerHTML='';tabs.appendChild(sel);
}
async function switchSeason(season){
  if(season===state.currentSeason&&state.allSeasons[season])return;
  state.currentSeason=season;
  const sel=document.querySelector('.season-select');if(sel)sel.value=season;
  document.getElementById('epList').innerHTML=`<li style="padding:20px;text-align:center;color:var(--text-3);"><div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto;"></div></li>`;
  try{
    if(!state.allSeasons[season]){
      if(state.provider==='ss')throw new Error('Sezóna nenačtena');
      state.allSeasons[season]=await svtEpisodes(state.svtSlug,season,state.svtTvShowId);
    }
    state.episodes=state.allSeasons[season];state.currentEp=null;
    renderEpList();setupMainPlayBtn();
  }catch(e){document.getElementById('epList').innerHTML=`<li style="color:var(--danger);padding:20px;text-align:center;">Chyba: ${e.message}</li>`;}
}
function setupMainPlayBtn(){
  const btn=document.getElementById('mainPlayBtn');if(!btn)return;
  if(!state.episodes.length){btn.disabled=true;return;}
  btn.disabled=false;
  const idx=state.episodes.findIndex(ep=>!isEpWatched(state.currentAnime.id,ep.number,ep.season||1));
  document.getElementById('mainPlayBtnText').textContent=idx===-1?'Přehrát znovu':idx>0?`Pokračovat (Ep. ${state.episodes[idx].number})`:'Začít sledovat';
}
function playNextOrFirstEp(){
  let idx=state.episodes.findIndex(ep=>!isEpWatched(state.currentAnime.id,ep.number,ep.season||1));
  onEpisodeClick(idx===-1?0:idx);
}
function showSvtManualBanner(){
  document.querySelectorAll('.svt-manual-banner').forEach(b=>b.remove());
  const banner=document.createElement('div');
  banner.className='svt-manual-banner';
  banner.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-radius:var(--r-md);background:rgba(139,110,245,.08);border:1px solid rgba(139,110,245,.25);margin-bottom:16px;font-size:13px;';
  const t=state.currentAnime?encodeURIComponent(getTitle(state.currentAnime)):'';
  banner.innerHTML=`<span style="color:var(--accent-h);font-weight:700;flex-shrink:0;">🇨🇿 CZ slug ručně:</span>
    <input id="svtSlugInput" type="text" placeholder="např. re-zero (z URL /serial/...)" style="flex:1;min-width:160px;background:var(--bg);border:1px solid var(--border);color:var(--text-1);border-radius:var(--r-sm);padding:8px 12px;font-size:13px;font-family:inherit;">
    <button onclick="useSvtSlugManual()" style="background:var(--accent);color:#fff;border:none;border-radius:var(--r-sm);padding:8px 16px;font-size:13px;font-weight:800;cursor:pointer;flex-shrink:0;">Načíst CZ</button>
    <span style="color:var(--text-3);font-size:11px;width:100%;">Otevři svetserialu.io, najdi anime, zkopíruj slug z URL (svetserialu.io/serial/<b>tento-text</b>)</span>
    ${t?`<div style="display:flex;gap:10px;flex-wrap:wrap;padding-top:6px;border-top:1px solid rgba(255,255,255,.06);width:100%;align-items:center;">
      <span style="color:var(--text-3);font-size:11px;">Sleduj externě:</span>
      <a href="https://allanime.day/search?keyword=${t}" target="_blank" style="color:var(--accent-h);font-size:12px;text-decoration:underline;">AllAnime ↗</a>
      <a href="https://animepahe.ch/?s=${t}" target="_blank" style="color:var(--accent-h);font-size:12px;text-decoration:underline;">AnimePahe ↗</a>
      <a id="ssShowLink" href="https://sledujserialy.io/cz/?term=${t}" target="_blank" style="color:var(--accent-h);font-size:12px;text-decoration:underline;">SledujSerialy ↗</a>
    </div>`:''}`;
  const epSection=document.querySelector('.episodes-section');
  if(epSection)epSection.insertBefore(banner,epSection.firstChild);
  if(state.currentAnime){
    findSledujSerialySlug(state.currentAnime).then(slug=>{
      const a=banner.querySelector('#ssShowLink');
      if(a&&slug){a.href=`https://sledujserialy.io/cz/serial/${slug}`;a.textContent='SledujSerialy ✓ ↗';}
    });
  }
}
async function getGlobalSvtSlug(tmdbId){
  if(!fbDb)return null;
  try{
    const snap=await getDoc(doc(fbDb,'svtSlugs',String(tmdbId)));
    if(!snap.exists())return null;
    const d=snap.data();
    return{slug:d.slug,isDub:d.isDub??false};
  }catch{return null;}
}
async function saveGlobalSvtSlug(tmdbId,slug,isDub=false){
  if(!fbDb)return;
  try{
    await setDoc(doc(fbDb,'svtSlugs',String(tmdbId)),{slug,isDub,updatedAt:Date.now(),updatedBy:fbUid||'anonymous'},{merge:true});
  }catch(e){console.warn('[Firebase] saveGlobalSvtSlug:',e);}
}
async function useSvtSlugManual(){
  const input=document.getElementById('svtSlugInput');if(!input)return;
  const slug=input.value.trim().replace(/^\/+|\/+$/g,'').replace(/.*\/serial\//,'');
  if(!slug){showToast('Zadej slug',false);return;}
  const btn=input.nextElementSibling;
  const origTxt=btn.textContent;btn.disabled=true;btn.textContent='Načítám…';
  try{
    const ok=await loadSvtBySlug(slug,state.currentAnime||{title:{}},null);
    if(ok){
      state.modes.svt=true;
      document.querySelectorAll('.svt-manual-banner').forEach(b=>b.remove());
      document.querySelectorAll('.episodes-section .mode-banner.err').forEach(b=>b.remove());
      activateMode('svt');renderModeSwitch();
      if(state.currentAnime?.id)await saveGlobalSvtSlug(state.currentAnime.id,slug,state.svtIsDub);
      showToast('✓ CZ zdroj načten a uložen globálně',true);
    }else{showToast('Slug nalezen, ale tvShowId se nepodařilo extrahovat — zkontroluj konzoli (F12)',false);}
  }catch(e){showToast('Chyba: '+e.message,false);}
  finally{btn.disabled=false;btn.textContent=origTxt;}
}
function showNoSourceFallback(anime){
  state.provider='svt';
  state.episodes=Array.from({length:anime.episodes||12},(_,i)=>({
    number:i+1,title:`Epizoda ${i+1}`,code:`ep${i+1}`,slug:'__unavailable__',season:1,
  }));
  renderEpList();setupMainPlayBtn();
  const errBanner=document.createElement('div');
  errBanner.className='mode-banner err';
  errBanner.innerHTML=`⚠️ Nenašel jsem CZ zdroj.<br><small style="font-weight:400;opacity:.8">Zkus zadat slug ručně nebo sleduj na externím webu.</small>`;
  const epSection=document.querySelector('.episodes-section');
  epSection.insertBefore(errBanner,epSection.firstChild);
  const t=encodeURIComponent(getTitle(state.currentAnime));
  document.getElementById('epList').insertAdjacentHTML('beforeend',`<li style="padding:16px 20px;text-align:center;font-size:13px;color:var(--text-3);display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">
    <a href="https://allanime.day/search?keyword=${t}" target="_blank" style="color:var(--accent-h);text-decoration:underline;">Sledovat na AllAnime ↗</a>
    <a href="https://animepahe.ch/?s=${t}" target="_blank" style="color:var(--accent-h);text-decoration:underline;">Sledovat na AnimePahe ↗</a>
  </li>`);
}
async function markSeriesWatched(){
  if(!state.currentAnime)return;
  const id=state.currentAnime.id;
  const seasons=state.availableSeasons.length?state.availableSeasons:[1];
  const w=getWatched();
  const allLoaded=seasons.every(s=>state.allSeasons[s]);
  const allWatched=allLoaded&&seasons.every(s=>
    (state.allSeasons[s]||[]).every(ep=>isEpWatched(id,ep.number,s))
  );
  const newVal=!allWatched;
  const btn=document.getElementById('markAllWatchedBtn');
  if(btn){btn.disabled=true;btn.style.opacity='.5';}
  for(const s of seasons){
    if(!state.allSeasons[s]){
      try{state.allSeasons[s]=await svtEpisodes(state.svtSlug,s,state.svtTvShowId);}
      catch{state.allSeasons[s]=[];}
    }
    const eps=state.allSeasons[s]||[];
    const key=`${id}_s${s}`;
    if(!w[key])w[key]={};
    eps.forEach(ep=>{if(newVal)w[key][ep.number]=1;else delete w[key][ep.number];});
  }
  setWatched(w);
  renderEpList();setupMainPlayBtn();updateMarkSeasonBtn();
  if(btn){
    btn.disabled=false;btn.style.opacity='1';
    btn.style.borderColor=newVal?'var(--accent)':'var(--border)';
    btn.style.color=newVal?'var(--accent)':'var(--text-3)';
    btn.style.background=newVal?'var(--accent-dim)':'var(--surface)';
  }
  showToast(newVal?'✓ Celý seriál označen jako zhlédnutý':'Seriál odznačen',newVal);
}
function markSeasonWatched(){
  if(!state.currentAnime||!state.episodes.length)return;
  const allWatched=state.episodes.every(ep=>isEpWatched(state.currentAnime.id,ep.number,state.currentSeason));
  const newVal=!allWatched;
  const w=getWatched();
  state.episodes.forEach(ep=>{
    const key=`${state.currentAnime.id}_s${ep.season||state.currentSeason}`;
    if(!w[key])w[key]={};
    if(newVal)w[key][ep.number]=1;else delete w[key][ep.number];
  });
  setWatched(w);
  updateMarkSeasonBtn();renderEpList();setupMainPlayBtn();
  showToast(newVal?'✓ Celá série označena jako zhlédnutá':'Série odznačena',newVal);
}
function updateMarkSeasonBtn(){
  const btn=document.getElementById('markSeasonBtn');
  const txt=document.getElementById('markSeasonBtnText');
  if(!btn||!state.currentAnime||!state.episodes.length)return;
  btn.style.display='inline-flex';
  const allWatched=state.episodes.every(ep=>isEpWatched(state.currentAnime.id,ep.number,state.currentSeason));
  if(txt)txt.textContent=allWatched?'Zrušit zhlédnutí série':'Označit sérii jako zhlédnutou';
  btn.className=allWatched?'btn-primary':'btn-outline';
  btn.style.fontSize='12px';btn.style.padding='8px 18px';
}

function toggleFav(){
  if(!state.currentAnime)return;
  let f=getFavs();const idx=f.findIndex(x=>x.id===state.currentAnime.id);
  if(idx>=0){f.splice(idx,1);showToast('Odebráno z oblíbených');}else{f.unshift(state.currentAnime);showToast('Přidáno do oblíbených',true);}
  setFavs(f);updateFavBtn();
}
function updateFavBtn(){
  if(!state.currentAnime)return;
  const inFav=getFavs().some(x=>x.id===state.currentAnime.id);
  const btn=document.getElementById('favBtn');if(!btn)return;
  btn.className=inFav?'btn-outline active':'btn-outline';
  document.getElementById('favBtnText').textContent=inFav?'V oblíbených':'Do oblíbených';
}

async function initAnimePage(){
  initSearch();
  const params=new URLSearchParams(location.search);
  const animeId=parseInt(params.get('id'));
  if(!animeId){document.title='WaterStream';return;}

  const epList=document.getElementById('epList');
  function setMsg(msg){if(epList)epList.innerHTML=`<li style="padding:20px;text-align:center;color:var(--text-3);display:flex;align-items:center;justify-content:center;gap:10px;"><div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> ${msg}</li>`;}
  setMsg('Načítám anime…');

  let anime;
  try{anime=await fetchAnimeDetail(animeId);}
  catch(e){setMsg(`Chyba: ${e.message}`);return;}

  state.currentAnime={id:anime.id,title:getTitle(anime),cover:anime.coverImage?.large||anime.coverImage?.extraLarge,genres:anime.genres||[],score:anime.averageScore,year:anime.seasonYear,format:anime.format};
  state.provider='svt';state.modes={svt:false,animegg:false,ss:false};
  state.allSeasons={};state.availableSeasons=[];state.currentSeason=1;
  state.episodes=[];state.svtEpisodes=[];state.animeggEpisodes=[];state.ssEpisodes=[];
  state.svtSlug=null;state.svtTvShowId=null;state.svtIsDub=false;state.animeggSlug=null;state.animeggHasDub=false;state.animeggIsDub=false;state.ssSlug=null;

  addHistory(state.currentAnime);
  document.title=`${state.currentAnime.title} — WaterStream`;
  document.getElementById('detailTitle').textContent=state.currentAnime.title;
  document.getElementById('detailPosterImg').src=state.currentAnime.cover||'';
  document.getElementById('detailDesc').textContent=stripHtml(anime.description)||'Bez popisu.';
  document.getElementById('detailMeta').innerHTML=[
    anime.format?`<span class="tag">${anime.format}</span>`:'',
    anime.seasonYear?`<span class="tag">${anime.seasonYear}</span>`:'',
    anime.averageScore?`<span class="tag accent">★ ${(anime.averageScore/10).toFixed(1)}</span>`:'',
    ...(anime.genres||[]).slice(0,3).map(g=>`<span class="tag">${g}</span>`),
  ].join('');
  document.getElementById('modeSwitch').style.display='none';
  document.getElementById('mainPlayBtn').disabled=true;
  document.getElementById('mainPlayBtnText').textContent='Načítám...';
  updateFavBtn();

  setMsg('Hledám zdroje…');

  // SVT a AnimeGG probe paralelně — oba dokončí před navigací
  const [svtSettled,ggSettled]=await Promise.allSettled([
    (async()=>{
      const cached=await getGlobalSvtSlug(anime.id);
      let slug=cached?cached.slug:null;
      if(slug){setMsg(`Načítám CZ zdroj (uložený slug)…`);}
      else slug=await findSvtSlug(anime,setMsg);
      if(!slug){console.warn('[SVT] Slug nenalezen pro:',getTitle(anime));return false;}
      return await loadSvtBySlug(slug,anime,setMsg);
    })(),
    probeAnimegg(anime),
  ]);

  const svtOk=svtSettled.status==='fulfilled'&&svtSettled.value===true;
  const gg=ggSettled.status==='fulfilled'?ggSettled.value:null;

  state.modes.svt=svtOk;
  if(gg){
    state.animeggSlug=gg.slug;state.animeggHasDub=gg.hasDub||false;state.modes.animegg=true;
    state.animeggEpisodes=Array.from({length:gg.epCount},(_,i)=>({
      number:i+1,title:`Epizoda ${i+1}`,code:String(i+1),slug:'__animegg__',season:1,
    }));
  }

  if(svtOk){
    activateMode('svt');
    // auto-save isDub to Firestore so notifications can use real data
    if(anime.id&&state.svtSlug)saveGlobalSvtSlug(anime.id,state.svtSlug,state.svtIsDub);
  }else if(gg){
    activateMode('animegg');
    showSvtManualBanner();
  }else{
    const ssResult=await probeSledujSerialy(anime,setMsg);
    if(ssResult){
      state.ssSlug=ssResult.slug;state.ssEpisodes=ssResult.episodes;state.modes.ss=true;
      activateMode('ss');
      showSvtManualBanner();
    }else{
      setMsg('Anime není dostupné v žádném ze zdrojů.');
      document.getElementById('mainPlayBtn').disabled=true;
      document.getElementById('mainPlayBtnText').textContent='Nedostupné';
      showSvtManualBanner();
    }
  }
  renderModeSwitch();
}


/* ══════════════════════════════════════════════════════════
   WATCH PAGE
══════════════════════════════════════════════════════════ */
function destroyHls(){if(state.hlsInstance){state.hlsInstance.destroy();state.hlsInstance=null;}}

async function playEp(index){
  const ep=state.episodes[index];
  if(!ep)return;
  state.currentEp=ep;state.currentEpIndex=index;
  const url=new URL(window.location);
  url.searchParams.set('ep',ep.number);
  url.searchParams.set('season',ep.season||state.currentSeason);
  history.replaceState(null,'',url.toString());

  renderEpList();updateNavBtns();updateWatchedBtn();stopSubTimer();destroyHls();

  const wrap=document.getElementById('playerWrap');
  wrap.querySelectorAll('video,iframe').forEach(el=>el.remove());
  const ph=document.getElementById('playerPlaceholder');
  ph.style.display='none';
  document.getElementById('sourceRow').style.display='none';
  document.getElementById('sourceBtns').innerHTML='';
  document.getElementById('langBadge').innerHTML='';
  ['aiSubBtn','subDownloadBtn','aiSubSyncBtn','subTimeInput'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.display='none';
  });
  if(_sub.active)stopSubTimer();
  _sub.cues=[];_sub.active=false;_sub.rawText='';_sub.fileName='';

  const epLabel=document.getElementById('watchEpLabel');
  if(epLabel)epLabel.textContent=`Ep. ${ep.number}${ep.title&&ep.title!==`Epizoda ${ep.number}`?' — '+ep.title:''}`;

  if(ep.slug==='__animegg__'){await playAnimeggEp(ep,wrap,ph);return;}

  if(ep.slug==='__ss__'){
    ph.style.display='flex';
    ph.innerHTML=`<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-h)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z" fill="var(--accent-h)" stroke="none"/></svg>
    <span style="color:var(--text-1);font-weight:700;font-size:15px;">Přehrát na SledujSerialy</span>
    <span style="color:var(--text-3);font-size:13px;">Epizoda ${ep.number}${ep.hasCz?' · CZ titulky':''}</span>
    <a href="${ep.ssUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;text-decoration:none;border-radius:var(--r-md);padding:12px 28px;font-size:14px;font-weight:800;margin-top:4px;">
      Otevřít epizodu ↗
    </a>
    <span style="color:var(--text-3);font-size:11px;opacity:.6;">Otevře se na sledujserialy.io v novém okně</span>`;
    return;
  }

  if(ep.slug==='__unavailable__'){
    const _t=encodeURIComponent(getTitle(state.currentAnime));
    ph.style.display='flex';
    ph.innerHTML=`<svg width="52" height="52" fill="none" stroke="var(--warn)" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r=".5" fill="var(--warn)"/></svg>
    <span style="color:var(--warn);font-weight:700;">Epizoda nedostupná</span>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
      <a href="https://allanime.day/search?keyword=${_t}" target="_blank" style="color:var(--accent-h);font-size:13px;">AllAnime ↗</a>
      <a href="https://animepahe.ch/?s=${_t}" target="_blank" style="color:var(--accent-h);font-size:13px;">AnimePahe ↗</a>
      <a id="ssEpLink" href="https://sledujserialy.io/cz/?term=${_t}" target="_blank" style="color:var(--accent-h);font-size:13px;">SledujSerialy ↗</a>
    </div>
    <div style="width:100%;max-width:480px;margin-top:8px;display:flex;flex-direction:column;gap:8px;align-items:stretch;">
      <div style="color:var(--text-3);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;">Zadat URL ručně</div>
      <div style="display:flex;gap:8px;">
        <input id="manualUrlInput" type="text" placeholder="https://… (m3u8 nebo iframe URL)" style="flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text-1);border-radius:var(--r-sm);padding:10px 14px;font-size:13px;font-family:inherit;">
        <button onclick="playManualUrl()" style="background:var(--accent);color:#fff;border:none;border-radius:var(--r-sm);padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer;">▶</button>
      </div>
    </div>`;
    const _snapEp=ep;
    findSledujSerialySlug(state.currentAnime).then(slug=>{
      if(!slug)return;
      const a=document.getElementById('ssEpLink');
      if(a){a.href=buildSsEpUrl(slug,_snapEp.season||state.currentSeason||1,_snapEp.number);a.textContent='SledujSerialy ✓ ↗';}
    });
    return;
  }

  // SVT CZ/SK mode
  const loadDiv=document.createElement('div');
  loadDiv.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:var(--text-1);background:rgba(0,0,0,.9);z-index:10;font-size:14px;font-weight:600;';
  loadDiv.innerHTML='<div class="spinner"></div><span style="color:var(--text-3)">Načítám CZ zdroje...</span>';
  wrap.appendChild(loadDiv);
  try{
    const html=await proxyFetch(`/serial/${ep.slug}/${ep.code}`);
    const sources=extractSvtSources(html);
    if(!sources.length)throw new Error('Epizoda zatím nemá dostupné zdroje');
    state.svtSources=sources;
    stopSubTimer();_sub.offsetMs=0;
    loadAiSubs(html).then(found=>{
      const btn=document.getElementById('aiSubBtn');
      const dlBtn=document.getElementById('subDownloadBtn');
      const showSub=found&&!state.svtIsDub;
      if(btn)btn.style.display=showSub?'inline-flex':'none';
      if(dlBtn)dlBtn.style.display=showSub?'inline-flex':'none';
    });
    loadDiv.remove();
    document.getElementById('sourceRow').style.display='flex';
    document.getElementById('sourceBtns').innerHTML=sources.map((s,i)=>`<button class="source-btn" onclick="loadSvtSource(${i})">${capitalize(s.provider)}</button>`).join('');
    document.getElementById('langBadge').innerHTML=`<span class="sub-badge cz">${state.svtIsDub?'🎙️ CZ dabing':'CZ / SK'}</span>`;
    loadSvtSource(getPreferredSourceIndex(sources));
  }catch(svtErr){
    loadDiv?.remove();
    ph.style.display='flex';
    ph.innerHTML=`<svg width="40" height="40" fill="none" stroke="var(--danger)" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    <span style="color:var(--danger);font-weight:700;">Stream nedostupný</span>
    <span style="font-size:13px;color:var(--text-3)">${svtErr.message}</span>`;
  }
}

function loadSvtSource(index){
  const src=state.svtSources?.[index];if(!src)return;
  state.svtSourceIndex=index;
  document.querySelectorAll('#sourceBtns .source-btn').forEach((b,i)=>b.classList.toggle('active',i===index));
  const wrap=document.getElementById('playerWrap');
  wrap.querySelectorAll('video,iframe').forEach(el=>el.remove());
  document.getElementById('playerPlaceholder').style.display='none';
  try{
    const iframe=document.createElement('iframe');
    iframe.src=resolveIframeUrl(src.b64);
    iframe.allowFullscreen=true;
    iframe.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';
    iframe.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:none;background:#000;';
    wrap.appendChild(iframe);
    const timer=setTimeout(()=>{
      const next=index+1;
      if(next<state.svtSources.length){showToast(`${capitalize(src.provider)} pomalý, zkouším ${capitalize(state.svtSources[next].provider)}…`);loadSvtSource(next);}
    },15000);
    iframe.onload=()=>clearTimeout(timer);
  }catch(e){
    const next=index+1;
    if(next<state.svtSources.length)setTimeout(()=>loadSvtSource(next),400);
  }
}

function playManualUrl(){
  const input=document.getElementById('manualUrlInput');if(!input)return;
  const url=input.value.trim();
  if(!url){showToast('Zadej URL streamu',false);return;}
  const wrap=document.getElementById('playerWrap');
  const ph=document.getElementById('playerPlaceholder');
  wrap.querySelectorAll('video,iframe').forEach(el=>el.remove());
  ph.style.display='none';destroyHls();
  const isM3u8=/\.m3u8(\?|$)/i.test(url);
  if(isM3u8){
    const video=document.createElement('video');
    video.controls=true;video.autoplay=true;
    video.style.cssText='position:absolute;inset:0;width:100%;height:100%;background:#000;';
    wrap.appendChild(video);
    if(typeof Hls!=='undefined'&&Hls.isSupported()){
      const hls=new Hls({enableWorker:true});
      hls.loadSource(url);hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED,async()=>{
        video.play().catch(()=>{});
        stopSubTimer();
        const hasSubs=await loadHlsSubtitles(hls);
        const btn=document.getElementById('aiSubBtn');
        const dlBtn=document.getElementById('subDownloadBtn');
        if(btn)btn.style.display=hasSubs?'inline-flex':'none';
        if(dlBtn)dlBtn.style.display=hasSubs?'inline-flex':'none';
        if(hasSubs)showToast('EN titulky nalezeny — klikni 🤖 AI CZ pro překlad',true);
      });
      hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal){hls.destroy();showToast('HLS chyba: '+d.details,false);}});
      state.hlsInstance=hls;
    }else{video.src=url;video.play().catch(()=>{});}
  }else{
    const iframe=document.createElement('iframe');
    iframe.src=url;iframe.allowFullscreen=true;
    iframe.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';
    iframe.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:none;background:#000;';
    wrap.appendChild(iframe);
  }
  showToast('Přehrávám manuální zdroj',true);
}


function updateNavBtns(){
  const prev=document.getElementById('prevEpBtn');
  const next=document.getElementById('nextEpBtn');
  if(prev)prev.disabled=state.currentEpIndex<=0;
  if(next)next.disabled=state.currentEpIndex>=state.episodes.length-1;
}
function navigateEp(d){
  if(d===1&&state.currentEp&&state.currentAnime){
    markEpWatched(state.currentAnime.id,state.currentEp.number,state.currentEp.season||1,true);
  }
  const nx=state.currentEpIndex+d;
  if(nx>=0&&nx<state.episodes.length)playEp(nx);
}
function toggleWatched(){
  if(!state.currentEp||!state.currentAnime)return;
  const was=isEpWatched(state.currentAnime.id,state.currentEp.number,state.currentEp.season||1);
  markEpWatched(state.currentAnime.id,state.currentEp.number,state.currentEp.season||1,!was);
  updateWatchedBtn();
  clearTimeout(_renderEpTO);
  _renderEpTO=setTimeout(renderEpList,80);
}
function toggleEpWatched(event,idx){
  event.preventDefault();event.stopPropagation();
  const ep=state.episodes[idx];if(!ep||!state.currentAnime)return;
  const s=state.currentSeason,aId=state.currentAnime.id;
  const was=isEpWatched(aId,ep.number,s);
  markEpWatched(aId,ep.number,s,!was);
  // Toggle class directly for instant feedback, then re-render
  const btn=event.currentTarget;
  btn.classList.toggle('checked',!was);
  btn.closest('a')?.classList.toggle('watched',!was);
  btn.title=!was?'Zrušit zhlédnutí':'Označit jako zhlédnuté';
  updateMarkSeasonBtn?.();
}
function updateWatchedBtn(){
  if(!state.currentEp||!state.currentAnime)return;
  const w=isEpWatched(state.currentAnime.id,state.currentEp.number,state.currentEp.season||1);
  const btn=document.getElementById('watchedBtn');
  if(btn)btn.innerHTML=`<svg width="24" height="24" fill="none" stroke="${w?'var(--success)':'var(--text-3)'}" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
}

async function initWatchPage(){
  initSearch();
  const params=new URLSearchParams(location.search);
  const animeId=parseInt(params.get('id'));
  const epNum=parseInt(params.get('ep')||'1');
  const season=parseInt(params.get('season')||'1');

  if(!animeId){document.title='WaterStream';return;}

  let cached=null;
  try{
    const raw=sessionStorage.getItem('ani_watch_state');
    if(raw){const parsed=JSON.parse(raw);if(parsed.anime?.id===animeId)cached=parsed;}
  }catch{}

  if(cached){
    state.currentAnime=cached.anime;
    state.svtSlug=cached.svtSlug;
    state.svtTvShowId=cached.svtTvShowId;
    state.availableSeasons=cached.availableSeasons||[];
    state.allSeasons=cached.allSeasons||{};
    state.modes=cached.modes||{svt:false,animegg:false};
    state.provider=cached.provider||'svt';
    state.animeggSlug=cached.animeggSlug||null;
    state.animeggEpisodes=cached.animeggEpisodes||[];
    state.currentSeason=cached.currentSeason||season;
    state.episodes=cached.episodes||[];
  }else{
    const ph=document.getElementById('playerPlaceholder');
    if(ph){ph.style.display='flex';ph.innerHTML='<div class="spinner"></div><span style="color:var(--text-3)">Načítám anime…</span>';}
    try{
      const anime=await fetchAnimeDetail(animeId);
      state.currentAnime={id:anime.id,title:getTitle(anime),cover:anime.coverImage?.large||anime.coverImage?.extraLarge,genres:anime.genres||[],score:anime.averageScore,year:anime.seasonYear,format:anime.format};
      state.currentSeason=season;

      if(ph)ph.innerHTML='<div class="spinner"></div><span style="color:var(--text-3)">Hledám CZ zdroj…</span>';
      const slug=await findSvtSlug(anime);
      if(slug){
        state.svtSlug=slug;
        let tvShowId=null;
        for(const path of[`/serial/${slug}`,`/serial/${slug}/s01e01`]){
          try{const h=await proxyFetch(path);tvShowId=extractTvShowId(h);if(tvShowId)break;}catch{}
        }
        if(tvShowId){
          state.svtTvShowId=tvShowId;
          const eps=await svtEpisodes(slug,season,tvShowId);
          state.allSeasons[season]=eps;state.episodes=eps;
          state.provider='svt';state.modes.svt=true;
        }
      }
      if(!state.modes.svt){
        const gg=await probeAnimegg(anime);
        if(gg){
          state.animeggSlug=gg.slug;state.animeggHasDub=gg.hasDub||false;state.modes.animegg=true;
          state.animeggEpisodes=Array.from({length:gg.epCount},(_,i)=>({
            number:i+1,title:`Epizoda ${i+1}`,code:String(i+1),slug:'__animegg__',season:1,
          }));
          state.provider='animegg';state.episodes=state.animeggEpisodes;
        }
      }
    }catch(e){
      if(document.getElementById('playerPlaceholder'))
        document.getElementById('playerPlaceholder').innerHTML=`<span style="color:var(--danger)">Chyba: ${e.message}</span>`;
      return;
    }
  }

  document.title=`${state.currentAnime?.title||'WaterStream'} — ep. ${epNum}`;
  const titleEl=document.getElementById('watchAnimeTitle');
  const thumbEl=document.getElementById('watchAnimeThumbnail');
  if(titleEl)titleEl.textContent=state.currentAnime?.title||'';
  if(thumbEl)thumbEl.src=state.currentAnime?.cover||'';
  const infoBar=document.getElementById('watchAnimeInfoBar');
  if(infoBar)infoBar.onclick=()=>{window.location.href=`anime.html?id=${animeId}`;};


  addHistory(state.currentAnime);

  state.currentSeason=season;
  if(state.provider==='svt'&&state.allSeasons[season]){
    state.episodes=state.allSeasons[season];
  }

  let epIndex=state.episodes.findIndex(ep=>ep.number===epNum);

  // Epizoda nenalezena — SVT čísluje relativně (1-N v každé sérii), TMDB absolutně
  if(epIndex<0&&state.provider==='svt'&&state.svtSlug&&state.svtTvShowId){
    const ph=document.getElementById('playerPlaceholder');
    if(ph)ph.innerHTML='<div class="spinner"></div><span style="color:var(--text-3)">Hledám epizodu v jiných sériích…</span>';
    let absoluteOffset=0;
    for(let s=1;s<=15;s++){
      try{
        let eps=state.allSeasons[s];
        if(!eps){eps=await svtEpisodes(state.svtSlug,s,state.svtTvShowId);if(eps.length)state.allSeasons[s]=eps;}
        if(!eps.length)break;
        // Zkus přímou shodu čísla epizody v této sérii
        const direct=eps.findIndex(ep=>ep.number===epNum);
        if(direct>=0){state.currentSeason=s;state.episodes=eps;epIndex=direct;break;}
        // Zkus absolutní mapování: ep 77 = offset + relativní
        absoluteOffset+=eps.length;
        if(absoluteOffset>=epNum){
          // Zkontroluj zda existuje další série — pokud ne, jsme v poslední a cílíme na nejnovější díl
          let nextEps=state.allSeasons[s+1];
          if(!nextEps){
            try{nextEps=await svtEpisodes(state.svtSlug,s+1,state.svtTvShowId);}catch{nextEps=[];}
            if(nextEps&&nextEps.length)state.allSeasons[s+1]=nextEps;
          }
          if(!nextEps||!nextEps.length){
            // Poslední dostupná série — notifikace vždy cílí na nejnovější epizodu
            state.currentSeason=s;state.episodes=eps;epIndex=eps.length-1;
          }else{
            const relEp=epNum-(absoluteOffset-eps.length);
            const clampedEp=Math.min(relEp,eps.length);
            const relIdx=eps.findIndex(ep=>ep.number===clampedEp);
            if(relIdx>=0){state.currentSeason=s;state.episodes=eps;epIndex=relIdx;}
            else{state.currentSeason=s;state.episodes=eps;epIndex=eps.length-1;}
          }
          break;
        }
      }catch{break;}
    }
  }

  renderSeasonTabs();
  renderEpList();
  if(epIndex>=0){
    state.currentEp=state.episodes[epIndex];
    state.currentEpIndex=epIndex;
    playEp(epIndex);
  }else{
    const ph=document.getElementById('playerPlaceholder');
    if(ph){ph.style.display='flex';ph.innerHTML=`<span style="color:var(--warn)">Epizoda ${epNum} nenalezena</span>`;}
  }
  updateNavBtns();
}

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await initFirebase();
  if (!fbUid) {
    showLoginOverlay();
    return;
  }
  const page = document.body.dataset.page;
  if(page === 'home') initHomePage();
  else if(page === 'anime') initAnimePage();
  else if(page === 'watch') initWatchPage();
  else if(page === 'history') initHistoryPage();
  else if(page === 'search') initSearchPage();
});

/* ══════════════════════════════════════════════════════════
   WINDOW EXPORTS (onclick attributes need global scope)
══════════════════════════════════════════════════════════ */
Object.assign(window, {
  openAiModal, closeAiModal, searchFromAi,
  openNotifModal, closeNotifModal, openSvtDirectly,
  openHistory, closeHistory,
  openConfig, closeConfig, saveConfig, hideTmdbPrompt,
  applyTheme, applyLayout,
  switchFilter, loadMore,
  goHome, goToAnime,
  playNextOrFirstEp, toggleFav,
  switchSeason, activateMode,
  onEpisodeClick,
  navigateEp, toggleWatched,
  loadSvtSource, playManualUrl, animeggLoadSource, animeggSwitchSubDub,
  useSvtSlugManual, showSvtManualBanner,
  signInWithGoogle, signOutUser,
  toggleProfileDropdown,
  showHistoryTab,
  markSeasonWatched, markSeriesWatched,
  playEpWithMode,
  toggleEpWatched,
  carouselNav, carouselGo,
  browseLoadMore,
});
