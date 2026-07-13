/* =========================================================================
   ЗВУК ДВИГАТЕЛЯ — привязан к RPM из main.js (rpmVal, IDLE_RPM, REV_LIMITER_RPM)

   Два исходных файла:
   - ex_idle.wav  — холостые обороты, чистый луп
   - ex_rev.wav   — один непрерывный "разгон" двигателя от холостых до
                    отсечки (реальная запись, ~9-10 сек)

   Подход: idle играется лупом всегда. rev.wav НЕ просто питчится — вместо
   этого мы держим "виртуальную позицию" воспроизведения внутри записи,
   которая соответствует текущим оборотам (линейная развёртка idle->redline
   вдоль длины файла). Когда обороты меняются, мы плавно (кроссфейдом)
   перезапускаем сэмпл в нужной точке, слегка подстраивая playbackRate,
   чтобы звук "догонял" нужное место без резких скачков.

   Громкость idle и rev кроссфейдятся между собой по текущим оборотам.
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

let idleBuffer = null, revBuffer = null, ready = false;

async function loadBuffer(url){
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  return actx.decodeAudioData(arr);
}

Promise.all([loadBuffer(IDLE_URL), loadBuffer(REV_URL)])
  .then(([ib, rb])=>{
    idleBuffer = ib; revBuffer = rb; ready = true;
    startIdleLoop();
  })
  .catch(e=>{ console.warn('Engine audio: не удалось загрузить звуки', e); });

/* ---- IDLE: простой бесконечный луп ---- */
let idleGain = null;
function startIdleLoop(){
  idleGain = actx.createGain();
  idleGain.gain.value = 1;
  idleGain.connect(master);
  const src = actx.createBufferSource();
  src.buffer = idleBuffer;
  src.loop = true;
  src.connect(idleGain);
  src.start();
}

/* ---- REV: сэмпл с "виртуальной головкой", привязанной к оборотам ---- */
let revGain = null;
let revSrc = null;
let revSrcStartCtxTime = 0;
let revSrcStartOffset = 0;

const RETRIGGER_MIN_INTERVAL = 0.12; // сек - не чаще перезапускаем позицию
const DRIFT_TOLERANCE = 0.25;        // сек - насколько позволяем разъехаться до коррекции
const CROSSFADE = 0.05;              // сек - длительность кроссфейда при коррекции
let lastRetrigger = 0;

function ensureRevGain(){
  if(revGain) return;
  revGain = actx.createGain();
  revGain.gain.value = 0;
  revGain.connect(master);
}

function currentSourcePos(){
  if(!revSrc) return 0;
  return revSrcStartOffset + (actx.currentTime - revSrcStartCtxTime);
}

function triggerRevSource(offset){
  ensureRevGain();
  const now = actx.currentTime;
  const clampedOffset = Math.max(0, Math.min(revBuffer.duration - 0.05, offset));

  const newSrc = actx.createBufferSource();
  newSrc.buffer = revBuffer;
  newSrc.loop = false; // виртуальная позиция сама себя переустанавливает, зацикливать не нужно

  const g = actx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(1, now + CROSSFADE);
  newSrc.connect(g);
  g.connect(revGain);
  newSrc.start(now, clampedOffset);

  if(revSrc && revSrc._gainNode){
    const oldGain = revSrc._gainNode;
    const oldSrc = revSrc;
    oldGain.gain.cancelScheduledValues(now);
    oldGain.gain.setValueAtTime(oldGain.gain.value, now);
    oldGain.gain.linearRampToValueAtTime(0, now + CROSSFADE);
    setTimeout(()=>{ try{ oldSrc.stop(); }catch(e){} }, (CROSSFADE+0.03)*1000);
  }

  newSrc._gainNode = g;
  revSrc = newSrc;
  revSrcStartCtxTime = now;
  revSrcStartOffset = clampedOffset;
}

/* ---- Вызывается каждый кадр из main.js (updateHud) ---- */
window.updateEngineAudio = function(rpm, idleRpm, redlineRpm){
  if(!ready) return;
  const frac = Math.max(0, Math.min(1, (rpm - idleRpm) / (redlineRpm - idleRpm)));

  // Целевая позиция внутри rev.wav (предполагаем линейную развёртку записи)
  const targetPos = frac * (revBuffer.duration - 0.1);

  const now = actx.currentTime;
  if(now - lastRetrigger > RETRIGGER_MIN_INTERVAL){
    lastRetrigger = now;
    const drift = Math.abs(currentSourcePos() - targetPos);
    if(!revSrc || drift > DRIFT_TOLERANCE){
      triggerRevSource(targetPos);
    }
  }

  // Кроссфейд громкости idle <-> rev по оборотам (без резкого порога)
  const revVol = Math.min(1, frac * 1.35);
  const idleVol = Math.max(0, 1 - frac * 1.6);
  if(revGain)  revGain.gain.setTargetAtTime(revVol, now, 0.05);
  if(idleGain) idleGain.gain.setTargetAtTime(idleVol, now, 0.05);

  // Небольшая подстройка playbackRate, чтобы звук плавно "догонял" нужную
  // точку записи между перезапусками (сглаживает мелкие рассинхронизации)
  if(revSrc){
    const err = targetPos - currentSourcePos();
    const rate = Math.max(0.75, Math.min(1.35, 1 + err*1.5));
    revSrc.playbackRate.setTargetAtTime(rate, now, 0.08);
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
