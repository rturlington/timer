// The TV side: shows the timer and listens for commands from the remote.
// It can be reached three ways:
//   1. Chrome's Presentation API (the default "Cast to TV" button)
//   2. The Google Cast SDK, when running as a registered Custom Web Receiver
//   3. A BroadcastChannel, when opened as a "Big screen" window on the same computer
(function () {
  'use strict';
  const T = window.Tolliver;
  const cfg = window.TOLLIVER_CONFIG || {};

  T.rainbowTitle(document.getElementById('title'));
  const face = new T.TimerFace(document.getElementById('face'));
  const digits = document.getElementById('digits');
  const message = document.getElementById('message');
  const statusEl = document.getElementById('status');

  let state = null;
  let celebratedSeq = null;
  const replyFns = new Set();

  function setStatus(s) { statusEl.textContent = s; }

  function apply(msg) {
    if (!msg || msg.type !== 'state') return;
    state = T.localize(msg.state);
    if (T.remainingNow(state) > 0) celebratedSeq = null;
  }

  function snapshot() {
    if (!state) return null;
    const rem = T.remainingNow(state);
    return {
      duration: state.duration, remaining: rem, running: state.running && rem > 0,
      buddy: state.buddy, label: state.label, seq: state.seq,
    };
  }
  function hello() { return { type: 'hello', state: snapshot() }; }

  function onMessage(raw, reply) {
    let msg = raw;
    if (typeof raw === 'string') { try { msg = JSON.parse(raw); } catch (e) { return; } }
    if (msg && msg.type === 'ping') { (reply || broadcast)(hello()); return; }
    apply(msg);
  }
  function broadcast(m) { replyFns.forEach((fn) => fn(m)); }

  function tick() {
    const { rem, f, mode } = face.render(state);
    digits.textContent = T.formatTime(rem);
    message.textContent = state ? T.messageFor(mode, f, state) : 'Waiting for the remote… 📱';
    if (mode === 'done' && state && celebratedSeq !== state.seq) {
      celebratedSeq = state.seq;
      T.playFanfare();
      T.celebrate(80);
      replyFns.forEach((fn) => fn({ type: 'done', seq: state.seq }));
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // 1. Presentation API receiver
  if (navigator.presentation && navigator.presentation.receiver) {
    navigator.presentation.receiver.connectionList.then((list) => {
      const add = (conn) => {
        setStatus('📺 Connected');
        const reply = (m) => { try { conn.send(JSON.stringify(m)); } catch (e) {} };
        conn.onmessage = (e) => onMessage(e.data, reply);
        replyFns.add(reply);
        conn.onclose = conn.onterminate = () => replyFns.delete(reply);
        reply(hello());
      };
      list.connections.forEach(add);
      list.onconnectionavailable = (e) => add(e.connection);
    });
  }

  // 2. Google Cast Custom Web Receiver (only when running on a Cast device)
  const onCastDevice = /CrKey/.test(navigator.userAgent);
  if (onCastDevice) {
    const s = document.createElement('script');
    s.src = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';
    s.onload = () => {
      const ctx = cast.framework.CastReceiverContext.getInstance();
      const ns = cfg.CAST_NAMESPACE || 'urn:x-cast:com.tolliver.timer';
      ctx.addCustomMessageListener(ns, (e) => onMessage(e.data, (m) => {
        try { ctx.sendCustomMessage(ns, e.senderId, m); } catch (err) {}
      }));
      replyFns.add((m) => { try { ctx.sendCustomMessage(ns, undefined, m); } catch (e) {} });
      const opts = new cast.framework.CastReceiverOptions();
      opts.disableIdleTimeout = true;
      opts.skipPlayersLoad = true;
      opts.customNamespaces = { [ns]: cast.framework.system.MessageType.JSON };
      ctx.start(opts);
      setStatus('📺 Ready');
    };
    document.head.appendChild(s);
  }

  // 3. Same-computer "Big screen" window
  if ('BroadcastChannel' in window) {
    const bc = new BroadcastChannel('tolliver-timer');
    const bcReply = (m) => bc.postMessage(m);
    bc.onmessage = (e) => onMessage(e.data, bcReply);
    replyFns.add(bcReply);
    bc.postMessage(hello());
  }

  // Make sure sound can play if someone clicks the TV window.
  document.addEventListener('pointerdown', T.unlockAudio);
})();
