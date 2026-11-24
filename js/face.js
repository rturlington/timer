// Shared pieces used by both the remote (index.html) and the TV screen (tv.html).
(function () {
  'use strict';

  const SIZE = 200;
  const C = SIZE / 2;
  const R = 88;

  // Colors the pie walks through as time runs out: lots of time = green, almost done = pink.
  const STOPS = [
    [0.0, [255, 92, 122]],  // pink/red
    [0.25, [255, 159, 67]], // orange
    [0.5, [255, 217, 61]],  // yellow
    [1.0, [76, 217, 100]],  // green
  ];

  function colorFor(f) {
    f = Math.max(0, Math.min(1, f));
    for (let i = 1; i < STOPS.length; i++) {
      const [f1, c1] = STOPS[i];
      const [f0, c0] = STOPS[i - 1];
      if (f <= f1) {
        const t = (f - f0) / (f1 - f0);
        const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
        return `rgb(${c[0]},${c[1]},${c[2]})`;
      }
    }
    return 'rgb(76,217,100)';
  }

  function wedgePath(f) {
    if (f <= 0) return '';
    if (f >= 0.9999) {
      return `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`;
    }
    const a = f * 2 * Math.PI;
    const x = C + R * Math.sin(a);
    const y = C - R * Math.cos(a);
    const large = f > 0.5 ? 1 : 0;
    return `M ${C} ${C} L ${C} ${C - R} A ${R} ${R} 0 ${large} 1 ${x} ${y} Z`;
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  // ---- Timer state ----------------------------------------------------------
  // A state object travels between remote and TV:
  //   { duration, remaining, running, buddy, label, seq }
  // `remaining` is measured at the moment the message is sent; each side keeps
  // its own local `endAt` so clocks on different devices never need to agree.
  function localize(state) {
    const s = Object.assign({}, state);
    s.endAt = s.running ? performance.now() + s.remaining : null;
    return s;
  }
  function remainingNow(s) {
    if (!s) return 0;
    if (s.running && s.endAt != null) return Math.max(0, s.endAt - performance.now());
    return Math.max(0, s.remaining);
  }

  // ---- The face -------------------------------------------------------------
  class TimerFace {
    constructor(container) {
      this.el = document.createElement('div');
      this.el.className = 'face idle';
      const ticks = [];
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * 2 * Math.PI;
        const big = i % 5 === 0;
        const r1 = big ? 91 : 94;
        ticks.push(
          `<line x1="${C + r1 * Math.sin(a)}" y1="${C - r1 * Math.cos(a)}" ` +
          `x2="${C + 97 * Math.sin(a)}" y2="${C - 97 * Math.cos(a)}" ` +
          `stroke="#2d2a5a" stroke-opacity="${big ? 0.5 : 0.2}" stroke-width="${big ? 2.4 : 1.2}" stroke-linecap="round"/>`
        );
      }
      const dots = ['#ff5c7a', '#ff9f43', '#ffd93d', '#4cd964', '#3fa7ff', '#a66cff'];
      const ring = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 2 * Math.PI;
        ring.push(`<circle cx="${C + 104 * Math.sin(a)}" cy="${C - 104 * Math.cos(a)}" r="5" fill="${dots[i % dots.length]}"/>`);
      }
      this.el.innerHTML = `
        <svg viewBox="-10 -10 220 220" aria-hidden="true">
          <circle cx="${C}" cy="${C + 5}" r="${R + 10}" fill="rgba(45,42,90,0.18)"/>
          <circle cx="${C}" cy="${C}" r="${R + 10}" fill="#fff"/>
          ${ring.join('')}
          <circle cx="${C}" cy="${C}" r="${R}" fill="#eef7ff"/>
          <path class="pie" d="" fill="#4cd964"/>
          ${ticks.join('')}
          <circle cx="${C}" cy="${C}" r="34" fill="#fff" stroke="#2d2a5a" stroke-opacity="0.12" stroke-width="2"/>
        </svg>
        <div class="center"><div class="buddy">🦖</div></div>`;
      container.appendChild(this.el);
      this.pie = this.el.querySelector('.pie');
      this.buddyEl = this.el.querySelector('.buddy');
    }

    render(state) {
      const rem = remainingNow(state);
      const f = state && state.duration > 0 ? rem / state.duration : 0;
      this.pie.setAttribute('d', wedgePath(f));
      this.pie.setAttribute('fill', colorFor(f));
      const buddy = rem <= 0 && state && state.duration > 0 ? '🎉' : (state && state.buddy) || '🦖';
      if (this.buddyEl.textContent !== buddy) this.buddyEl.textContent = buddy;
      let mode = 'idle';
      if (state && state.duration > 0) {
        if (rem <= 0) mode = 'done';
        else if (state.running) mode = 'running';
        else if (rem < state.duration) mode = 'paused';
      }
      this.el.className = 'face ' + mode;
      return { rem, f, mode };
    }
  }

  // ---- Encouraging messages ---------------------------------------------------
  function messageFor(mode, f, state) {
    if (mode === 'done') return "🎉 Hooray! Time's up! 🎉";
    if (mode === 'paused') return '⏸️ Taking a little break…';
    if (mode === 'idle') return state && state.label ? state.label : 'Ready when you are!';
    const label = state && state.label ? state.label + ' — ' : '';
    if (f > 0.75) return label + "Let's go! 🚀";
    if (f > 0.5) return label + "You're doing great! ⭐";
    if (f > 0.25) return label + 'More than halfway! 🌈';
    if (f > 0.1) return label + 'Almost there! 🐢';
    return label + 'Just a tiny bit left! 🐣';
  }

  // ---- Sounds ---------------------------------------------------------------
  let audioCtx = null;
  function unlockAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* no audio, that's okay */ }
  }
  function note(freq, start, dur, type) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  }
  function playFanfare() {
    unlockAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime + 0.05;
    // A happy little "ta-da!" played twice.
    const tune = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const steps = [0, 0.15, 0.3, 0.45, 0.7, 0.85];
    for (let rep = 0; rep < 2; rep++) {
      const off = rep * 1.6;
      tune.forEach((fq, i) => note(fq, t + off + steps[i], i >= 4 ? 0.6 : 0.25));
    }
  }
  function playBoop() {
    unlockAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime + 0.01;
    note(660, t, 0.12, 'sine');
    note(880, t + 0.08, 0.15, 'sine');
  }

  // ---- Confetti -------------------------------------------------------------
  function celebrate(count) {
    const layer = document.createElement('div');
    layer.className = 'confetti';
    const bits = ['🎉', '⭐', '🎈', '🌟', '🍭', '🦄', '🌈', '✨', '🎊'];
    for (let i = 0; i < (count || 60); i++) {
      const b = document.createElement('i');
      b.textContent = bits[Math.floor(Math.random() * bits.length)];
      b.style.left = Math.random() * 100 + 'vw';
      b.style.fontSize = 1.5 + Math.random() * 2.5 + 'rem';
      b.style.animationDuration = 3 + Math.random() * 3 + 's';
      b.style.animationDelay = Math.random() * 2 + 's';
      layer.appendChild(b);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 9000);
  }

  // Wraps each letter of an element's text in a colorful bouncing span.
  function rainbowTitle(el) {
    const colors = ['#ff5c7a', '#ff9f43', '#ffd93d', '#4cd964', '#3fa7ff', '#a66cff'];
    const text = el.textContent;
    el.textContent = '';
    let k = 0;
    for (const ch of text) {
      const s = document.createElement('span');
      s.textContent = ch === ' ' ? ' ' : ch;
      if (ch !== ' ') {
        s.style.color = colors[k % colors.length];
        s.style.animationDelay = (k * 0.12) + 's';
        k++;
      }
      el.appendChild(s);
    }
  }

  window.Tolliver = {
    TimerFace, formatTime, localize, remainingNow, messageFor,
    playFanfare, playBoop, unlockAudio, celebrate, rainbowTitle,
  };
})();
