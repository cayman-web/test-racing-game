/* =========================================================================
   ЗВУК ДВИГАТЕЛЯ — привязан к RPM из main.js (rpmVal, IDLE_RPM, REV_LIMITER_RPM)

   Два исходных файла:
   - ex_idle.wav  — холостые обороты, чистый луп
   - ex_rev.wav   — один непрерывный "разгон" двигателя от холостых до
                    отсечки (реальная запись, ~9-10 сек)

   ПОДХОД (многополосное смешивание, как в большинстве гоночных игр):
   вместо того чтобы перематывать rev.wav туда-сюда вслед за оборотами
   (это давало "волну" при скачках RPM из-за виртуальной коробки передач),
   вырезаем из записи 3 коротких зацикленных фрагмента, примерно
   соответствующих низким/средним/высоким оборотам, и держим их играющими
   ПОСТОЯННО. По факту меняются только:
   - громкость каждой полосы (треугольный кроссфейд по текущим оборотам)
   - высота тона каждой полосы (playbackRate, чтобы плавно дотягивать
     частоту до реальных оборотов между соседними полосами)

   Никаких перезапусков/перемоток по ходу игры - только плавное смешивание
   уже играющих лупов. Это убирает и "щелчки", и "волну".
   ========================================================================= */
(function(){
"use strict";

const AudioCtx = window.AudioContext || window.webkitAudioContext;
if(!AudioCtx){ return; } // совсем старый браузер без Web Audio - просто без звука

const actx = new AudioCtx();

const master = actx.createGain();
master.gain.value = 0.9;
master.connect(actx.destination);

/* ---- Пути к файлам: лежат рядом с остальными файлами игры в корне репо ---- */
const IDLE_URL = 'ex_idle.wav';
const REV_URL  = 'ex_rev.wav';

let ready = false;

async function loadBuffer(url){
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  return actx.decodeAudioData(arr);
}

Promise.all([loadBuffer(IDLE_URL), loadBuffer(REV_URL)])
  .then(([idleBuffer, revBuffer])=>{
    startIdleLoop(idleBuffer);
    startRevBands(revBuffer);
    ready = true;
  })
  .catch(e=>{ console.warn('Engine audio: не удалось загрузить звуки', e); });

/* ---- IDLE: простой бесконечный луп ---- */
let idleGain = null;
function startIdleLoop(idleBuffer){
  idleGain = actx.createGain();
  idleGain.gain.value = 1;
  idleGain.connect(master);
  const src = actx.createBufferSource();
  src.buffer = idleBuffer;
  src.loop = true;
  src.connect(idleGain);
  src.start();
}

/* ---- REV: несколько параллельных зацикленных полос ---- */
// Центры полос (в долях от диапазона холостые->отсечка, он же условно
// доля длины rev.wav - предполагаем, что запись развёрнута линейно).
const BAND_CENTERS = [0.34, 0.67, 1.0];
const BAND_SPACING = 0.33; // шаг между центрами - используется для треугольного кроссфейда
const LOOP_HALF_WINDOW = 0.35; // сек, половина длины зацикленного фрагмента вокруг центра

let bands = []; // {src, gain, center}

function startRevBands(revBuffer){
  const dur = revBuffer.duration;
  bands = BAND_CENTERS.map(c=>{
    const center = c * (dur - 0.1);
    const loopStart = Math.max(0, center - LOOP_HALF_WINDOW);
    const loopEnd = Math.min(dur, center + LOOP_HALF_WINDOW);

    const gain = actx.createGain();
    gain.gain.value = 0;
    gain.connect(master);

    const src = actx.createBufferSource();
    src.buffer = revBuffer;
    src.loop = true;
    src.loopStart = loopStart;
    src.loopEnd = loopEnd;
    src.connect(gain);
    src.start(0, loopStart);

    return { src, gain, center: c };
  });
}

/* ---- Вызывается каждый кадр из main.js (updateHud) ---- */
window.updateEngineAudio = function(rpm, idleRpm, redlineRpm){
  if(!ready) return;
  const frac = Math.max(0, Math.min(1, (rpm - idleRpm) / (redlineRpm - idleRpm)));
  const now = actx.currentTime;

  // Громкость idle плавно уходит по мере роста оборотов
  const idleVol = Math.max(0, 1 - frac * 1.6);
  if(idleGain) idleGain.gain.setTargetAtTime(idleVol, now, 0.06);

  // Каждая полоса rev.wav: треугольный вес по близости к своему центру +
  // подстройка высоты тона, чтобы соседние полосы сходились по частоте
  // на границе кроссфейда (rate = frac/center)
  for(const b of bands){
    const weight = Math.max(0, 1 - Math.abs(frac - b.center) / BAND_SPACING);
    const rate = Math.max(0.4, Math.min(2.2, frac / b.center));
    b.gain.gain.setTargetAtTime(weight, now, 0.06);
    b.src.playbackRate.setTargetAtTime(rate, now, 0.08);
  }
};

/* ---- Общая громкость (на будущее, если захочешь добавить в SETTINGS) ---- */
window.setEngineVolume = function(v){
  master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), actx.currentTime, 0.05);
};

/* ---- Разблокировка AudioContext по первому касанию/клику (правило iOS Safari) ---- */
function unlock(){
  if(actx.state === 'suspended') actx.resume();
  window.removeEventListener('touchstart', unlock);
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
}
window.addEventListener('touchstart', unlock, {passive:true});
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

})();
