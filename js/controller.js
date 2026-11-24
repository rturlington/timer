// The remote control: pick a time, press Go, and cast it to the TV.
(function () {
  'use strict';
  const T = window.Tolliver;
  const cfg = window.TOLLIVER_CONFIG || {};
  const NS = cfg.CAST_NAMESPACE || 'urn:x-cast:com.tolliver.timer';
  const IS_PHONE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // The Cast App ID can come from config.js, a ?app=XXXX link, or the "TV setup" box (saved on this phone).
  let APP_ID = cfg.CAST_APP_ID || '';
  try {
    const fromUrl = new URLSearchParams(location.search).get('app');
    if (fromUrl) localStorage.setItem('tolliver-cast-app-id', fromUrl.trim());
    if (!APP_ID) APP_ID = localStorage.getItem('tolliver-cast-app-id') || '';
  } catch (e) {}
  const $ = (id) => document.getElementById(id);

  T.rainbowTitle($('title'));
  const face = new T.TimerFace($('face'));

  const PRESETS = [
    { min: 1, e: '🐇', c: '#ffd1dc' },
    { min: 2, e: '🐥', c: '#fff1a8' },
    { min: 5, e: '🦖', c: '#c9f7c4' },
    { min: 10, e: '🚀', c: '#cfe8ff' },
    { min: 15, e: '🐢', c: '#e6d7ff' },
    { min: 20, e: '🌙', c: '#ffe0c2' },
  ];
  const BUDDIES = ['🦖', '🐶', '🐱', '🦄', '🐻', '🐸', '🐙', '🚂', '🚀', '🦕', '🐵', '🤖'];

  // ---- State ------------------------------------------------------------------
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('tolliver-timer') || '{}'); } catch (e) {}

  let minutes = saved.minutes || 5;
  const state = {
    duration: minutes * 60000,
    remaining: minutes * 60000,
    running: false,
    endAt: null,
    buddy: saved.buddy || '🦖',
    label: saved.label || '',
    seq: 1,
  };
  let localDoneSeq = null;

  function persist() {
    try {
      localStorage.setItem('tolliver-timer', JSON.stringify({ minutes, buddy: state.buddy, label: state.label }));
    } catch (e) {}
  }

  function snapshot() {
    return {
      duration: state.duration,
      remaining: T.remainingNow(state),
      running: state.running && T.remainingNow(state) > 0,
      buddy: state.buddy,
      label: state.label,
      seq: state.seq,
    };
  }

  // ---- Controls -----------------------------------------------------------------
  const presetsEl = $('presets');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.style.background = p.c;
    b.dataset.min = p.min;
    b.innerHTML = `<span class="e">${p.e}</span>${p.min} min`;
    b.onclick = () => setMinutes(p.min);
    presetsEl.appendChild(b);
  });

  const buddiesEl = $('buddies');
  BUDDIES.forEach((e) => {
    const b = document.createElement('button');
    b.textContent = e;
    b.setAttribute('aria-label', 'Buddy ' + e);
    b.onclick = () => { T.playBoop(); state.buddy = e; persist(); refreshUI(); send(); };
    buddiesEl.appendChild(b);
  });

  function setMinutes(m) {
    T.playBoop();
    minutes = Math.max(1, Math.min(120, m));
    state.duration = state.remaining = minutes * 60000;
    state.running = false;
    state.endAt = null;
    state.seq++;
    persist();
    refreshUI();
    send();
  }
  $('minus').onclick = () => setMinutes(minutes - 1);
  $('plus').onclick = () => setMinutes(minutes + 1);

  $('startBtn').onclick = () => {
    T.unlockAudio();
    const rem = T.remainingNow(state);
    if (state.running) {
      state.remaining = rem;
      state.running = false;
      state.endAt = null;
    } else {
      if (rem <= 0) { state.remaining = state.duration; state.seq++; }
      state.running = true;
      state.endAt = performance.now() + state.remaining;
    }
    T.playBoop();
    refreshUI();
    send();
  };
  $('resetBtn').onclick = () => setMinutes(minutes);

  const labelEl = $('label');
  labelEl.value = state.label;
  let labelTimer = null;
  labelEl.oninput = () => {
    state.label = labelEl.value.trim();
    persist();
    clearTimeout(labelTimer);
    labelTimer = setTimeout(send, 250);
  };

  function refreshUI() {
    presetsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', +b.dataset.min === minutes));
    buddiesEl.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.textContent === state.buddy));
    $('customVal').textContent = minutes + ' min';
    const rem = T.remainingNow(state);
    const sb = $('startBtn');
    if (state.running && rem > 0) { sb.textContent = '⏸️ Pause'; sb.classList.add('pause'); }
    else {
      sb.classList.remove('pause');
      sb.textContent = rem > 0 && rem < state.duration ? '▶️ Keep going!' : (rem <= 0 ? '🔁 Again!' : '▶️ Go!');
    }
  }

  // ---- Preview loop -------------------------------------------------------------
  let lastMode = null;
  function tick() {
    const { rem, f, mode } = face.render(state);
    $('digits').textContent = T.formatTime(rem);
    $('message').textContent = T.messageFor(mode, f, state);
    if (mode === 'done' && localDoneSeq !== state.seq) {
      localDoneSeq = state.seq;
      state.running = false;
      state.remaining = 0;
      state.endAt = null;
      T.celebrate(40);
      if (!isConnected()) T.playFanfare(); // the TV plays it when casting
    }
    if (mode !== lastMode) { lastMode = mode; refreshUI(); }
    requestAnimationFrame(tick);
  }

  // ---- Talking to the TV ----------------------------------------------------------
  const senders = new Set(); // functions that deliver a message to a screen
  function isConnected() { return senders.size > 0; }
  function send() {
    const msg = { type: 'state', state: snapshot() };
    senders.forEach((fn) => { try { fn(msg); } catch (e) {} });
  }
  // Re-sync every few seconds so the TV never drifts.
  setInterval(() => { if (state.running) send(); }, 5000);

  function onScreenMessage(raw) {
    let msg = raw;
    if (typeof raw === 'string') { try { msg = JSON.parse(raw); } catch (e) { return; } }
    if (msg && msg.type === 'hello') {
      gotHello = true;
      // If the TV already has a timer going (e.g. this page reloaded), take over its state
      // instead of resetting it.
      if (msg.state && msg.state.duration > 0) adopt(msg.state);
      else send();
    }
  }
  let gotHello = false;
  function greet(sendFn) {
    gotHello = false;
    sendFn({ type: 'ping' });
    setTimeout(() => { if (!gotHello) send(); }, 1500);
  }
  function adopt(s) {
    state.duration = s.duration;
    state.remaining = s.remaining;
    state.running = s.running && s.remaining > 0;
    state.endAt = state.running ? performance.now() + s.remaining : null;
    state.buddy = s.buddy || state.buddy;
    state.label = s.label || '';
    state.seq = s.seq || state.seq;
    if (s.remaining <= 0) localDoneSeq = state.seq; // don't re-celebrate
    minutes = Math.max(1, Math.round(s.duration / 60000));
    labelEl.value = state.label;
    persist();
    refreshUI();
  }

  const castBtn = $('castBtn');
  const hint = $('castHint');
  function setCastUI(on, text) {
    castBtn.classList.toggle('on', on);
    castBtn.textContent = on ? '📺 On the TV! (tap to stop)' : '📡 Cast to TV';
    if (text != null) hint.textContent = text;
  }

  // Option A: Google Cast SDK (needs a registered Custom Web Receiver app id)
  function setupCastSdk() {
    window.__onGCastApiAvailable = (ok) => {
      if (!ok) return setupPresentation();
      const ctx = cast.framework.CastContext.getInstance();
      ctx.setOptions({
        receiverApplicationId: APP_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });
      let sendFn = null;
      const attach = () => {
        const session = ctx.getCurrentSession();
        if (!session) return;
        session.addMessageListener(NS, (ns, data) => onScreenMessage(data));
        sendFn = (m) => session.sendMessage(NS, m);
        senders.add(sendFn);
        setCastUI(true, 'Casting to ' + session.getCastDevice().friendlyName + ' 🎉 Your phone is the remote.');
        greet(sendFn);
      };
      ctx.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
        const S = cast.framework.SessionState;
        if (e.sessionState === S.SESSION_STARTED || e.sessionState === S.SESSION_RESUMED) attach();
        if (e.sessionState === S.SESSION_ENDED) {
          if (sendFn) senders.delete(sendFn);
          sendFn = null;
          setCastUI(false, 'Stopped casting.');
        }
      });
      castBtn.onclick = () => {
        T.unlockAudio();
        if (ctx.getCurrentSession()) ctx.endCurrentSession(true);
        else ctx.requestSession().catch(() => {});
      };
      hint.textContent = 'Tap "Cast to TV" and pick your Chromecast. The timer keeps going on the TV even if your phone goes to sleep.';
    };
    const s = document.createElement('script');
    s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    s.onerror = setupPresentation;
    document.head.appendChild(s);
  }

  // Option B: Chrome's Presentation API (no registration needed)
  function setupPresentation() {
    if (IS_PHONE) {
      // Phones can only cast to a registered Cast app.
      castBtn.disabled = true;
      castBtn.style.opacity = 0.5;
      hint.innerHTML = IS_IOS
        ? 'iPhones can\'t cast web pages to a Chromecast. Use Chrome on an Android phone or a computer.'
        : APP_ID
          ? 'Casting isn\'t available in this browser. Open this page in <b>Google Chrome</b> on Android.'
          : 'To cast from your phone, add your Cast App ID in <b>⚙️ TV setup</b> below (see the README).';
      return;
    }
    if (!('PresentationRequest' in window)) {
      castBtn.disabled = true;
      castBtn.style.opacity = 0.5;
      hint.innerHTML = 'Casting needs <b>Google Chrome</b> on a computer.<br>' +
        'Tip: open the big-screen window, then use Chrome\'s ⋮ menu → <b>Cast…</b>';
      return;
    }
    const url = new URL('tv.html', location.href).href;
    const request = new PresentationRequest([url]);
    navigator.presentation.defaultRequest = request; // lets Chrome's own Cast menu work too
    let conn = null;
    let sendFn = null;

    const use = (c) => {
      conn = c;
      try { sessionStorage.setItem('tolliver-presentation', c.id); } catch (e) {}
      const ready = () => {
        if (sendFn) senders.delete(sendFn);
        sendFn = (m) => { if (conn && conn.state === 'connected') conn.send(JSON.stringify(m)); };
        senders.add(sendFn);
        setCastUI(true, 'The timer is on the TV! Keep this page open — it\'s the remote.');
        greet(sendFn);
      };
      c.onconnect = ready;
      if (c.state === 'connected') ready();
      c.onmessage = (e) => onScreenMessage(e.data);
      c.onclose = () => { if (sendFn) senders.delete(sendFn); setCastUI(false, 'Lost the TV — tap Cast to reconnect.'); };
      c.onterminate = () => {
        if (sendFn) senders.delete(sendFn);
        conn = null;
        try { sessionStorage.removeItem('tolliver-presentation'); } catch (e) {}
        setCastUI(false, 'Stopped casting.');
      };
    };
    request.onconnectionavailable = (e) => use(e.connection);

    // Reconnect after a page refresh.
    let prevId = null;
    try { prevId = sessionStorage.getItem('tolliver-presentation'); } catch (e) {}
    if (prevId) request.reconnect(prevId).then(use).catch(() => {});

    castBtn.onclick = () => {
      T.unlockAudio();
      if (conn && conn.state !== 'terminated') { conn.terminate(); return; }
      request.start().then(use).catch((err) => {
        if (err && err.name === 'NotFoundError') hint.textContent = 'No TV found. Is the Chromecast on the same Wi-Fi? 📶';
        else if (err && err.name !== 'AbortError') hint.textContent = 'Couldn\'t cast: ' + err.message;
      });
    };
    hint.textContent = 'Tap "Cast to TV" and pick your Chromecast. Works best in Chrome on a computer.';
  }

  // Option C: a big-screen window on this computer (great for Chrome's "Cast tab")
  if ('BroadcastChannel' in window) {
    const bc = new BroadcastChannel('tolliver-timer');
    const bcSend = (m) => bc.postMessage(m);
    // Only count the big-screen window as "connected" once it says hello.
    bc.onmessage = (e) => {
      if (e.data && e.data.type === 'hello') senders.add(bcSend);
      onScreenMessage(e.data);
    };
    bc.postMessage({ type: 'ping' }); // pick up a big-screen window that's already open
  }
  $('bigBtn').onclick = () => {
    T.unlockAudio();
    window.open('tv.html', 'tolliver-tv', 'width=1280,height=720');
  };

  // ---- TV setup box -------------------------------------------------------------
  const appIdEl = $('appId');
  appIdEl.value = APP_ID;
  $('saveAppId').onclick = () => {
    try {
      const v = appIdEl.value.trim();
      if (v) localStorage.setItem('tolliver-cast-app-id', v);
      else localStorage.removeItem('tolliver-cast-app-id');
    } catch (e) {}
    location.href = location.pathname; // reload without ?app=
  };
  if (!APP_ID) $('setup').open = IS_PHONE && !IS_IOS;

  if (APP_ID) setupCastSdk(); else setupPresentation();

  refreshUI();
  requestAnimationFrame(tick);
})();
