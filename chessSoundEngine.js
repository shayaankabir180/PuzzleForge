/* PuzzleForge Realistic Wooden Chess Sound Engine
 * Procedural Web Audio sounds; no external audio files or network requests.
 */
(function (w) {
  "use strict";
  let ctx = null, master = null, muted = false, volume = 0.72;
  const now = () => ctx ? ctx.currentTime : 0;

  function audio() {
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  // A short broadband contact transient plus inharmonic resonances gives a
  // dry wooden "piece-on-board" character without downloading audio assets.
  function tap(opts = {}) {
    const c = audio();
    if (!c || muted) return;
    const t = c.currentTime + (opts.delay || 0);
    const strength = opts.strength || 1;
    const duration = opts.duration || 0.105;
    const noise = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const decay = Math.pow(1 - i / data.length, 3.2);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(opts.cutoff || 2600, t);
    filter.frequency.exponentialRampToValueAtTime(420, t + duration);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.22 * strength, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter); filter.connect(ng); ng.connect(master);
    src.start(t); src.stop(t + duration + 0.01);

    (opts.modes || [430, 690, 1040]).forEach((f, i) => {
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f * (0.985 + Math.random() * 0.03), t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.12);
      const peak = (opts.ring || 0.075) * strength / (i + 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (opts.ringTime || 0.15));
      osc.connect(g); g.connect(master);
      osc.start(t); osc.stop(t + (opts.ringTime || 0.15) + 0.02);
    });
  }

  function play(kind) {
    if (muted) return;
    switch (kind) {
      case "capture":
        tap({ strength: 1.18, cutoff: 1900, modes: [260, 390, 610], ring: .09, ringTime: .19 });
        tap({ delay: .045, strength: .48, cutoff: 1300, modes: [180, 310], ring: .045, ringTime: .13 });
        break;
      case "check":
        tap({ strength: .82, cutoff: 3000, modes: [560, 840, 1260], ring: .055, ringTime: .13 });
        break;
      case "checkmate":
        tap({ strength: 1.2, cutoff: 2200, modes: [300, 450, 675], ring: .12, ringTime: .25 });
        tap({ delay: .12, strength: .8, cutoff: 1800, modes: [240, 360, 540], ring: .08, ringTime: .22 });
        break;
      case "castle":
        tap({ strength: .8, cutoff: 2500, modes: [390, 590, 880] });
        tap({ delay: .105, strength: .9, cutoff: 2300, modes: [420, 630, 940] });
        break;
      case "promotion":
        tap({ strength: 1.05, cutoff: 2800, modes: [520, 780, 1170], ring: .095, ringTime: .2 });
        break;
      case "illegal":
        tap({ strength: .45, cutoff: 900, modes: [150, 225], ring: .025, ringTime: .08 });
        break;
      default:
        tap({ strength: .78, cutoff: 2600, modes: [420, 640, 960], ring: .065, ringTime: .14 });
    }
  }

  function playMove(move, game) {
    if (!move) return;
    let kind = "move";
    try {
      if (game && typeof game.in_checkmate === "function" && game.in_checkmate()) kind = "checkmate";
      else if (move.san && move.san.includes("#")) kind = "checkmate";
      else if (move.san && move.san.includes("+")) kind = "check";
      else if (move.captured) kind = "capture";
      else if (move.flags && String(move.flags).includes("k") || move.flags && String(move.flags).includes("q")) kind = "castle";
      else if (move.promotion) kind = "promotion";
    } catch (_) {}
    play(kind);
  }

  function setMuted(value) {
    muted = !!value;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, .025);
    return muted;
  }
  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (master && ctx && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, .025);
    return volume;
  }
  // Browsers require a user gesture before audio playback.
  ["pointerdown", "touchstart", "keydown"].forEach(type => {
    w.addEventListener(type, () => { const c = audio(); if (c && c.state === "suspended") c.resume().catch(() => {}); }, { once: true, passive: true });
  });

  w.PFChessSound = Object.freeze({
    play, playMove,
    move: () => play("move"),
    capture: () => play("capture"),
    check: () => play("check"),
    checkmate: () => play("checkmate"),
    castle: () => play("castle"),
    promotion: () => play("promotion"),
    illegal: () => play("illegal"),
    mute: setMuted,
    setVolume,
    isMuted: () => muted
  });
})(window);
