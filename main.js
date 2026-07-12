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
   6-ступенчатая последовательная КПП. Редлайн каждой передачи случаен
   в диапазоне 8500-9000 об/мин и линейно связан со скоростью переключения
   в пределах заданного диапазона для этой передачи.
   Диапазон 1-й передачи (83-88 км/ч) не был задан явно и подобран по
   пропорции остальных передач - при желании легко подправить ниже.
   ========================================================================= */
const GEAR_RANGES_KMH = [
  [83,88],     // 1 передача
  [108,113],   // 2 передача
  [140,143],   // 3 передача
  [170,174],   // 4 передача
  [209,212],   // 5 передача
  [240,242],   // 6 передача
];
const IDLE_RPM = 1000;
const LOW_RPM_AFTER_SHIFT = 4800; // во сколько падают обороты сразу после переключения вверх (кроме 1-й передачи)

function rollGear(i){
  const r = Math.random();
  const [lo,hi] = GEAR_RANGES_KMH[i];
  return { topKmh: lo + r*(hi-lo), topRpm: 8500 + r*500 };
}

let gear = 1;
let gearRoll = GEAR_RANGES_KMH.map((_,i)=>rollGear(i));

function resetGearSim(){
  gear = 1;
  gearRoll = GEAR_RANGES_KMH.map((_,i)=>rollGear(i));
}

function updateGearSim(kmh){
  while(gear<6 && kmh >= gearRoll[gear-1].topKmh){
    const leavingIdx = gear-1;
    gear++;
    gearRoll[leavingIdx] = rollGear(leavingIdx); // новый рандом на случай повторного возврата в эту передачу
  }
  while(gear>1 && kmh < gearRoll[gear-2].topKmh - 2){ // небольшой гистерезис против дребезга на границе
    gear--;
  }

  const lowKmh = gear===1 ? 0 : gearRoll[gear-2].topKmh;
  const info = gearRoll[gear-1];
  const lowRpm = gear===1 ? IDLE_RPM : LOW_RPM_AFTER_SHIFT;
  const frac = Math.max(0, Math.min(1, (kmh-lowKmh)/(info.topKmh-lowKmh)));
  const rpm = lowRpm + frac*(info.topRpm-lowRpm);
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
  document.getElementById('curLap').textContent = fmtTime(lap.currentT);
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
