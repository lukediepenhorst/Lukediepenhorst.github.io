/*
  Office ambience and a short music loop, both made in the browser.
  Nothing is fetched. Sound stays off until a tap, and the mute choice
  is remembered on this device.
*/

const KEY = "bothq-muted";

export function createAudio() {
  let ctx = null;
  let master = null;
  let ambience = null;
  let music = null;
  let timer = 0;
  let step = 0;
  let muted = localStorage.getItem(KEY) !== "0";
  let unlocked = false;

  function ensure() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.22;
    master.connect(ctx.destination);

    const seconds = 2;
    const noise = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    ambience = ctx.createBufferSource();
    ambience.buffer = noise;
    ambience.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const ambGain = ctx.createGain();
    ambGain.gain.value = 0.35;
    ambience.connect(filter);
    filter.connect(ambGain);
    ambGain.connect(master);
    ambience.start();

    music = ctx.createGain();
    music.gain.value = 0.5;
    music.connect(master);
  }

  const notes = [262, 294, 330, 392, 440, 392, 330, 294];

  function blip() {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = notes[step % notes.length];
    step += 1;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(music);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  function unlock() {
    unlocked = true;
    ensure();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function update(dt) {
    if (!unlocked || muted || !ctx) return;
    timer += dt;
    if (timer > 0.55) {
      timer = 0;
      blip();
    }
  }

  function toggle() {
    muted = !muted;
    localStorage.setItem(KEY, muted ? "1" : "0");
    unlock();
    if (master) master.gain.value = muted ? 0 : 0.22;
    return muted;
  }

  function isMuted() {
    return muted;
  }

  return { unlock: unlock, update: update, toggle: toggle, isMuted: isMuted };
}
