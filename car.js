/* =========================================================================
   ФИЗИКА АВТОМОБИЛЯ — Porsche 911 (992) GT3 R
   Точечная масса + тяга (ограничена мощностью/сцеплением), аэродинамика,
   сцепление зависящее от скорости (эффект прижимной силы). Без честного
   заноса — по договорённости "не грузим физику сильно".

   ВЕРСИЯ 2: разгон приглушён (реальные 3.2-3.4с до 100 км/ч вместо
   игрушечных 2.2с), руление ощутимо агрессивнее на средних скоростях,
   съезд на траву ощутимо гасит скорость.
   ========================================================================= */
const CAR = {
  length: 4.57,     // м, реальная длина 992 GT3 R
  width: 2.0,       // м (с уширенными арками)
  mass: 1300,       // кг, боевой вес с гонщиком
  power: 420000,    // Вт, ~565 л.с.
  maxTraction: 12500,  // Н, ограничение по сцеплению при старте с места (было 16500 - слишком резко)
  cdA: 1.27,        // Cx*A, крупное антикрыло GT3 => высокое сопротивление
  rollingCoef: 0.015,
  vmax: 80.5,       // м/с (~290 км/ч) — расчётная максималка на равнине
  minTurnRadius: 6.0,   // м, на полном руле и малой скорости (было 8.5 -> 7.0 -> 6.0, ещё резче)
  reverseMax: -8,   // м/с, скорость заднего хода
};
const AIR_RHO = 1.225;
const G = 9.81;

/* =========================================================================
   ПАМЯТЬ ИГРЫ: последняя трасса/машина + статистика пилота (localStorage,
   переживает закрытие вкладки/приложения). Сейчас трасса и машина всегда
   одни и те же, но структура уже готова под несколько трасс/машин в будущем -
   тогда просто CURRENT_TRACK/CURRENT_CAR будут выбираться на экране Drive.
   ========================================================================= */
const CURRENT_TRACK = { id: SELECTED_TRACK_ID, name: TRACK_DEF.name };
const CURRENT_CAR   = { id: 'porsche-992-gt3r',  name: 'Porsche 992 GT3 R' };
try{
  localStorage.setItem('gt3_lastTrack', JSON.stringify(CURRENT_TRACK));
  localStorage.setItem('gt3_lastCar', JSON.stringify(CURRENT_CAR));
}catch(e){}

const STATS_KEY = 'gt3_stats';
function loadStats(){
  const base = { totalLaps:0, cleanLaps:0, dirtyLaps:0, totalKm:0 };
  try{
    const raw = JSON.parse(localStorage.getItem(STATS_KEY) || 'null');
    if(raw) return Object.assign(base, raw);
  }catch(e){}
  return base;
}
const stats = loadStats();
let statsDirty = false;
function saveStats(){
  try{ localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }catch(e){}
  statsDirty = false;
}
document.addEventListener('visibilitychange', ()=>{ if(document.hidden && statsDirty) saveStats(); });
window.addEventListener('pagehide', ()=>{ if(statsDirty) saveStats(); });

// Закрутка от пробуксовки на траве (не связана с рулением, накапливается стихийно)
let grassSpin = 0;

function gripAccel(v){ // м/с^2, растёт с прижимной силой на скорости
  const f = Math.min(Math.abs(v)/CAR.vmax, 1);
  return 17 + 9*f*f; // ~1.73g на малой скорости -> ~2.65g на максималке (руление ещё агрессивнее)
}
// Бонус к поворотливости, плавно и процентно зависящий от скорости: на малой
// скорости руление максимально острое, чем ближе к максималке - тем сложнее
// повернуть (реалистичный эффект прижимной силы/инерции, без резких порогов).
function turnAssist(v){
  const f = Math.min(Math.abs(v)/CAR.vmax, 1); // 0 на месте -> 1 на максималке
  return 1 + 1.6*Math.pow(1-f, 1.6); // ~2.6x на месте, плавно спадает к 1.0x на максималке
}
function brakeDecel(v){
  const f = Math.min(Math.abs(v)/CAR.vmax, 1);
  return 12 + 4*f*f; // 1.2g -> ~1.65g с аэродинамической прижимной силой
}

const car = {
  x: CENTER[0][0], y: CENTER[0][1],
  heading: Math.atan2(TAN[0][0], -TAN[0][1]), // 0 = "север" (вверх), совпадает с ориентацией спрайта
  speed: 0,
  onTrack: 1, // 1 = чистый асфальт, меньше -> глубже в траве
};

function resetCar(){
  car.x = CENTER[0][0]; car.y = CENTER[0][1];
  car.heading = Math.atan2(TAN[0][0], -TAN[0][1]);
  car.speed = 0;
  lap.currentT = 0; lap.checkpointPassed = false; lap.invalid = false;
}

/* ---- Круги/время ---- */
const lap = { count:1, currentT:0, best:null, checkpointPassed:false, lastFrac:0, invalid:false };

function fmtTime(t){
  const m = Math.floor(t/60);
  const s = t - m*60;
  return m+':'+s.toFixed(2).padStart(5,'0');
}

/* =========================================================================
   ЦИКЛ ОБНОВЛЕНИЯ ФИЗИКИ
   ========================================================================= */
function update(dt){
  const steer = input.steer;      // -1..1, аналоговый со стика геймпада или -1/0/1 с клавиатуры/тач-кнопок
  const throttle = input.throttle; // 0..1
  const brake = input.brake;       // 0..1

  const v = car.speed;
  const speedAbs = Math.abs(v);

  // Статистика пилота: суммарный пробег (в реальности едешь - счётчик крутится,
  // независимо от того, по трассе ты или свернул в траву)
  stats.totalKm += speedAbs*dt/1000;
  statsDirty = true;

  // Насколько глубоко машина съехала с асфальта: 0 = на трассе, 1 = глубоко в траве
  const near0 = nearestIndex(car.x, car.y);
  let grassPenalty = Math.max(0, Math.min(1, (near0.dist - HALF_W) / 6));
  let onTrackFactor = 1 - 0.45*grassPenalty; // на траве сцепление слабее, но не нулевое - зацеп в жизни есть
  let offLimits = near0.dist > HALF_W + 0.5;

  // Пит-лейн (если он есть у трассы): законная часть трассы, но со своим
  // лимитом скорости - превысил его - нарушение, как в жизни
  let onPitlane = false, pitSpeeding = false;
  if(PIT){
    const pdist = nearestDistOnOpenPath(car.x, car.y, PIT.center);
    if(pdist <= PIT.halfWidth + 0.5){
      onPitlane = true;
      offLimits = false;
      grassPenalty = 0;
      onTrackFactor = 1;
      if(speedAbs*3.6 > PIT.speedLimitKmh) pitSpeeding = true;
    }
  }

  // Гравийно-песочная зона вылета: гораздо суровее травы, и это всегда нарушение лимитов
  let inGravel = false;
  if(!onPitlane && isInGravel(car.x, car.y)){
    inGravel = true;
    offLimits = true;
    onTrackFactor = 0.22;
  }

  car.onTrack = onTrackFactor;
  car.onPitlane = onPitlane;
  car.pitSpeeding = pitSpeeding;
  car.inGravel = inGravel;

  // Лимиты трассы/питлейна нарушены - текущий круг не будет засчитан как быстрый
  // (но продолжаем ехать как обычно, это не блокирующее наказание)
  if(offLimits || pitSpeeding){
    lap.invalid = true;
  }

  // Тяга (ограничена и мощностью, и сцеплением), едет только вперёд от газа
  let force = 0;
  if(throttle>0 && brake===0){
    const tractionLimited = CAR.maxTraction * onTrackFactor;
    const powerLimited = CAR.power / Math.max(speedAbs, 1.5);
    force += Math.min(tractionLimited, powerLimited);
  }
  // Реверс (только если почти стоим и жмём тормоз/назад)
  if(brake>0 && speedAbs < 0.6 && throttle===0){
    force += -4500;
  }

  // Сопротивление воздуха и качению (всегда против направления скорости)
  const drag = 0.5*AIR_RHO*CAR.cdA*v*v*Math.sign(v||1);
  const roll = CAR.rollingCoef*CAR.mass*G*Math.sign(v) * (speedAbs>0.05?1:0);
  force -= drag;
  force -= roll;

  // Торможение
  if(brake>0 && speedAbs>0.6){
    const maxBrakeForce = brakeDecel(v)*CAR.mass*onTrackFactor;
    force -= Math.sign(v)*maxBrakeForce*brake;
  }

  // Гравий - гораздо суровее травы, реально "хватает" машину за днище.
  // Трава - сопротивление умеренное, машина всё ещё может разгоняться,
  // просто менее эффективно и с риском потерять контроль (см. закрутку ниже)
  if(inGravel && speedAbs>0.05){
    const gravelDrag = 4400 + 42*speedAbs;
    force -= Math.sign(v)*gravelDrag;
  } else if(grassPenalty>0 && speedAbs>0.05){
    const grassDrag = grassPenalty*(1300 + 20*speedAbs);
    force -= Math.sign(v)*grassDrag;
  }

  const accel = force/CAR.mass;
  car.speed += accel*dt;
  car.speed = Math.max(CAR.reverseMax, Math.min(CAR.vmax*1.05, car.speed));
  if(Math.abs(car.speed)<0.03 && throttle===0 && brake===0) car.speed = 0;

  // Руление: желаемый радиус поворота -> ограничение по сцеплению (без честного заноса)
  if(Math.abs(steer)>0.01 && Math.abs(car.speed)>0.05){
    const radius = CAR.minTurnRadius/Math.abs(steer);
    const grip = gripAccel(car.speed)*onTrackFactor*turnAssist(car.speed);
    const maxYawRate = grip/Math.max(Math.abs(car.speed),3);
    let yawRate = (car.speed/radius)*Math.sign(steer);
    yawRate = Math.max(-maxYawRate, Math.min(maxYawRate, yawRate));
    car.heading += yawRate*dt;

    // Реальная потеря скорости в повороте: чем сильнее машина реально "грузит"
    // шины боковым ускорением, тем больше она теряет в скорости - как в жизни,
    // прямая всегда быстрее поворота на той же тяге.
    const CORNER_DRAG_COEF = 0.12;
    const lateralAccel = Math.abs(car.speed*yawRate);
    const corneringLoss = Math.min(CORNER_DRAG_COEF*lateralAccel*dt, Math.abs(car.speed));
    car.speed -= Math.sign(car.speed)*corneringLoss;
  }

  // Пробуксовка на траве/гравии: если сильно газовать при слабом сцеплении, машину
  // начинает стихийно закручивать (шины теряют сцепление неравномерно). В гравии
  // риск выше, чем в траве. На асфальте закрутка быстро гасится.
  if((grassPenalty>0.12 || inGravel) && speedAbs>2 && throttle>0){
    const riskBase = inGravel ? 1 : grassPenalty;
    const spinRisk = riskBase*throttle*(inGravel ? 1.4 : 1);
    if(spinRisk>0.18){
      const kick = (Math.random()-0.5)*2; // случайное направление рывка
      grassSpin += kick*spinRisk*34*dt;
    }
  }
  const spinDamp = onTrackFactor>0.9 ? 4.5 : 0.7; // на асфальте гасится в разы быстрее
  grassSpin *= Math.max(0, 1-spinDamp*dt);
  grassSpin = Math.max(-6, Math.min(6, grassSpin));
  car.heading += grassSpin*dt;

  car.x += Math.sin(car.heading)*car.speed*dt;
  car.y += -Math.cos(car.heading)*car.speed*dt;

  // Учёт кругов по прогрессу вдоль трассы (используем уже посчитанный near0)
  const frac = near0.idx/N;
  if(frac>0.4 && frac<0.6) lap.checkpointPassed = true;
  if(lap.lastFrac>0.85 && frac<0.15 && lap.checkpointPassed){
    if(!lap.invalid && (lap.best===null || lap.currentT<lap.best)) lap.best = lap.currentT;
    stats.totalLaps++;
    if(lap.invalid) stats.dirtyLaps++; else stats.cleanLaps++;
    saveStats();
    lap.count++;
    lap.currentT = 0;
    lap.checkpointPassed = false;
    lap.invalid = false;
  }
  lap.lastFrac = frac;
  lap.currentT += dt;

  return {throttle, brake};
}
