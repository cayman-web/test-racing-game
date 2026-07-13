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
// Границы переключения между соседними полосами - ровно посередине между их центрами
const BOUNDARIES = [ (BAND_CENTERS[0]+BAND_CENTERS[1])/2, (BAND_CENTERS[1]+BAND_CENTERS[2])/2 ];
const BOUNDARY_HALF_WIDTH = 0.03; // насколько узкая зона перехода вокруг границы (было широкое
                                   // перекрытие почти по всему диапазону - от него и были биения:
                                   // две копии одной и той же записи на близкой высоте тона играли
                                   // одновременно почти всегда. Теперь одновременно звучат две полосы
                                   // только на узком стыке.)
const LOOP_HALF_WINDOW = 0.35; // сек, половина длины зацикленного фрагмента вокруг центра

function smoothStep(edge0, edge1, x){
  const t = Math.max(0, Math.min(1, (x-edge0)/(edge1-edge0)));
  return t*t*(3-2*t);
}

// Вес полосы i: 1 почти везде в своей зоне, плавно уходит в 0 только у границ
// с соседями (узкая зона в BOUNDARY_HALF_WIDTH*2 шириной)
function bandWeight(i, frac){
  let gateLow = 1, gateHigh = 1;
  if(i>0){
    const b = BOUNDARIES[i-1];
    gateLow = smoothStep(b-BOUNDARY_HALF_WIDTH, b+BOUNDARY_HALF_WIDTH, frac);
  }
  if(i<BAND_CENTERS.length-1){
    const b = BOUNDARIES[i];
    gateHigh = 1 - smoothStep(b-BOUNDARY_HALF_WIDTH, b+BOUNDARY_HALF_WIDTH, frac);
  }
  return gateLow*gateHigh;
}

let bands = []; // {src, gain, center}

function startRevBands(revBuffer){
  const dur = revBuffer.duration;
  bands = BAND_CENTERS.map((c, idx)=>{
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

    return { src, gain, center: c, idx };
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

  // Каждая полоса rev.wav: почти всегда активна только одна (узкое
  // переключение у границ) + подстройка высоты тона, чтобы соседние полосы
  // сходились по частоте на стыке (rate = frac/center)
  for(const b of bands){
    const weight = bandWeight(b.idx, frac);
    const rate = Math.max(0.4, Math.min(2.2, frac / b.center));
    b.gain.gain.setTargetAtTime(weight, now, 0.12);
    b.src.playbackRate.setTargetAtTime(rate, now, 0.2);
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
