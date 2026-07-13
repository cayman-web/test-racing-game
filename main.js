/* =========================================================================
   БЛОКИРОВКА PINCH-ZOOM / DOUBLE-TAP ZOOM (iOS Safari игнорирует touch-action
   для этих жестов, нужны отдельные обработчики)
   ========================================================================= */
document.addEventListener('gesturestart', e=>e.preventDefault());
document.addEventListener('gesturechange', e=>e.preventDefault());
document.addEventListener('gestureend', e=>e.preventDefault());
document.addEventListener('touchmove', e=>{ if(e.touches.length>1) e.preventDefault(); }, {passive:false});
let lastTouchEndTime = 0;
document.addEventListener('touchend', e=>{
  const now = Date.now();
  if(now - lastTouchEndTime <= 350) e.preventDefault();
  lastTouchEndTime = now;
}, {passive:false});

/* =========================================================================
   ВВОД (клавиатура для отладки на компьютере + тач-кнопки для телефона)
   ========================================================================= */
const keys = {};
window.addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='KeyR'){ resetCar(); resetGearSim(); }
  if(e.code==='Equal' || e.code==='NumpadAdd'){ setZoom(ZOOM*1.15); }
  if(e.code==='Minus' || e.code==='NumpadSubtract'){ setZoom(ZOOM*0.87); }
});
window.addEventListener('keyup', e=>{ keys[e.code]=false; });

// Привязка тач/мышь-кнопки к тем же кодам клавиш, которые понимает car.js
function bindHoldButton(el, code){
  const press = ev=>{ ev.preventDefault(); keys[code]=true; };
  const release = ev=>{ ev.preventDefault(); keys[code]=false; };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
  el.addEventListener('contextmenu', ev=>ev.preventDefault());
}
bindHoldButton(document.getElementById('steerLeft'), 'KeyA');
bindHoldButton(document.getElementById('steerRight'), 'KeyD');
bindHoldButton(document.getElementById('gasBtn'), 'KeyW');
bindHoldButton(document.getElementById('brakeBtn'), 'KeyS');
document.getElementById('zoomIn').addEventListener('pointerdown', e=>{ e.preventDefault(); setZoom(ZOOM*1.15); });
document.getElementById('zoomOut').addEventListener('pointerdown', e=>{ e.preventDefault(); setZoom(ZOOM*0.87); });

/* =========================================================================
   КОСМЕТИЧЕСКАЯ СИМУЛЯЦИЯ ПЕРЕДАЧ/ОБОРОТОВ (на физику не влияет)
   6-ступенчатая последовательная КПП. Пять переходов между передачами:
   1->2: 108-113 км/ч, 2->3: 140-143, 3->4: 170-174, 4->5: 209-212, 5->6: 240-242.
   Внутри каждого диапазона переключение случайно и линейно связано с редлайном
   8500-9000 об/мин (нижняя граница диапазона ~8500, верхняя ~9000).
   У 6-й (последней) передачи верхней границы переключения нет - едем до
   реального физического предела машины, обороты стремятся к ~9000.
   ========================================================================= */
const SHIFT_RANGES_KMH = [
  [108,113],   // переключение 1 -> 2
  [140,143],   // переключение 2 -> 3
  [170,174],   // переключение 3 -> 4
  [209,212],   // переключение 4 -> 5
  [240,242],   // переключение 5 -> 6
];
const IDLE_RPM = 1000;
const LOW_RPM_AFTER_SHIFT = 4800; // во сколько падают обороты сразу после переключения вверх (кроме старта с 1-й передачи)
const REV_LIMITER_RPM = 9000;     // потолок отображения оборотов на 6-й передаче

function rollShift(i){
  const r = Math.random();
  const [lo,hi] = SHIFT_RANGES_KMH[i];
  return { kmh: lo + r*(hi-lo), rpm: 8500 + r*500 };
}

let gear = 1;
let shiftRoll = SHIFT_RANGES_KMH.map((_,i)=>rollShift(i));

function resetGearSim(){
  gear = 1;
  shiftRoll = SHIFT_RANGES_KMH.map((_,i)=>rollShift(i));
}

function updateGearSim(kmh){
  // апшифт: пока скорость перевалила через точку переключения текущей передачи
  while(gear<6 && kmh >= shiftRoll[gear-1].kmh){
    const leavingIdx = gear-1;
    gear++;
    shiftRoll[leavingIdx] = rollShift(leavingIdx); // новый рандом на случай повторного возврата в эту передачу
  }
  // даунш ифт с небольшим гистерезисом против дребезга на границе
  while(gear>1 && kmh < shiftRoll[gear-2].kmh - 2){
    gear--;
  }

  const lowKmh = gear===1 ? 0 : shiftRoll[gear-2].kmh;
  const lowRpm = gear===1 ? IDLE_RPM : LOW_RPM_AFTER_SHIFT;
  let topKmh, topRpm;
  if(gear<=5){
    topKmh = shiftRoll[gear-1].kmh;
    topRpm = shiftRoll[gear-1].rpm;
  } else {
    // 6-я передача - границы переключения нет, используем реальную максималку машины
    topKmh = CAR.vmax*3.6;
    topRpm = REV_LIMITER_RPM;
  }
  const frac = Math.max(0, Math.min(1, (kmh-lowKmh)/(topKmh-lowKmh)));
  const rpm = lowRpm + frac*(topRpm-lowRpm);
  return { gear, rpm };
}

/* =========================================================================
   HUD
   ========================================================================= */
function updateHud(){
  const kmh = Math.abs(car.speed)*3.6;

  let gearLabel, rpmVal;
  if(car.speed < -0.3){
    gearLabel = 'R'; rpmVal = IDLE_RPM + Math.min(1,Math.abs(car.speed)/Math.abs(CAR.reverseMax))*1500;
  } else if(Math.abs(car.speed) < 0.3){
    gearLabel = 'N'; rpmVal = IDLE_RPM;
  } else {
    const sim = updateGearSim(kmh);
    gearLabel = sim.gear; rpmVal = sim.rpm;
  }

  document.getElementById('gearBig').textContent = gearLabel;
  document.getElementById('rpmNum').textContent = Math.round(rpmVal);
  document.getElementById('rpmFill').style.width = Math.max(0,Math.min(100, (rpmVal-IDLE_RPM)/(9000-IDLE_RPM)*100)) + '%';
  document.getElementById('speedSmall').innerHTML = Math.round(kmh) + '<span> км/ч</span>';

  document.getElementById('lapCount').textContent = lap.count;
  const curLapEl = document.getElementById('curLap');
  curLapEl.textContent = fmtTime(lap.currentT);
  curLapEl.style.color = lap.invalid ? 'var(--warn)' : '';
  document.getElementById('bestLap').textContent = lap.best===null ? '—' : fmtTime(lap.best);

  document.getElementById('offtrack').style.opacity = car.onTrack<0.85 ? '1':'0';
}

/* =========================================================================
   ГЛАВНЫЙ ЦИКЛ
   ========================================================================= */
let lastT = performance.now();
function loop(now){
  let dt = (now-lastT)/1000;
  lastT = now;
  dt = Math.min(dt, 0.033); // защита от скачков при потере фокуса вкладки
  update(dt);
  render();
  updateHud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
