/* =========================================================================
   ENGINE SOUND — привязка к RPM из main.js
   Один слой idle + один слой rev, кроссфейд по оборотам
   ========================================================================= */
(() => {
  "use strict";

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const actx = new AudioCtx();

  const master = actx.createGain();
  master.gain.value = 0.9;
  master.connect(actx.destination);

  const IDLE_URL = "ex_idle.wav";
  const REV_URL = "ex_rev.wav";

  let ready = false;
  let idleGain = null;
  let revGain = null;
  let revSrc = null;

  const REV_CENTER = 0.4;
  const LOOP_HALF_WINDOW = 0.4;

  function loadBuffer(url) {
    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.arrayBuffer();
      })
      .then(arr => actx.decodeAudioData(arr));
  }

  function startIdleLoop(idleBuffer) {
    idleGain = actx.createGain();
    idleGain.gain.value = 1;
    idleGain.connect(master);

    const src = actx.createBufferSource();
    src.buffer = idleBuffer;
    src.loop = true;
    src.connect(idleGain);
    src.start();
  }

  function startRevLoop(revBuffer) {
    const dur = revBuffer.duration;
    const center = REV_CENTER * (dur - 0.1);
    const loopStart = Math.max(0, center - LOOP_HALF_WINDOW);
    const loopEnd = Math.min(dur, center + LOOP_HALF_WINDOW);

    revGain = actx.createGain();
    revGain.gain.value = 0;
    revGain.connect(master);

    revSrc = actx.createBufferSource();
    revSrc.buffer = revBuffer;
    revSrc.loop = true;
    revSrc.loopStart = loopStart;
    revSrc.loopEnd = loopEnd;
    revSrc.connect(revGain);
    revSrc.start(0, loopStart);
  }

  Promise.all([loadBuffer(IDLE_URL), loadBuffer(REV_URL)])
    .then(([idleBuffer, revBuffer]) => {
      startIdleLoop(idleBuffer);
      startRevLoop(revBuffer);
      ready = true;
    })
    .catch(e => {
      console.warn("Engine audio: не удалось загрузить звуки", e);
    });

  window.updateEngineAudio = function (rpm, idleRpm, redlineRpm) {
    if (!ready) return;

    const denom = Math.max(1, redlineRpm - idleRpm);
    const frac = Math.max(0, Math.min(1, (rpm - idleRpm) / denom));
    const now = actx.currentTime;

    const idleVol = Math.max(0, 1 - frac * 1.6);
    const revVol = Math.min(1, frac * 1.35);

    if (idleGain) idleGain.gain.setTargetAtTime(idleVol, now, 0.08);
    if (revGain) revGain.gain.setTargetAtTime(revVol, now, 0.08);

    if (revSrc) {
      const rate = Math.max(0.45, Math.min(2.3, frac / REV_CENTER));
      revSrc.playbackRate.setTargetAtTime(rate, now, 0.15);
    }
  };

  window.setEngineVolume = function (v) {
    master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), actx.currentTime, 0.05);
  };

  function unlock() {
    if (actx.state === "suspended") {
      actx.resume().catch(() => {});
    }
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  }

  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
})();