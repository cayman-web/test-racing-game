/* =========================================================================
   ФИЗИКА АВТОМОБИЛЯ
   Векторная модель: скорость хранится как мировой вектор (car.vx, car.vy),
   отдельно от направления кузова (car.heading). Раньше машина ехала строго
   туда, куда повёрнут нос (без честного заноса) - теперь руление вращает
   курс, а СКОРОСТЬ по инерции продолжает двигаться в старом направлении,
   пока сцепление шин постепенно не "догонит" её до нового курса. На асфальте
   это происходит почти мгновенно (не отличить от прежнего поведения), а вот
   на траве/гравии сцепления не хватает - и машину реально сносит юзом,
   не просто крутит на месте.

   CAR (характеристики текущей выбранной машины) приходит из cars.js,
   которая подключается раньше этого файла.
   ========================================================================= */
const AIR_RHO = 1.225;
const G = 9.81;

/* =========================================================================
   ПАМЯТЬ ИГРЫ: последняя трасса/машина + статистика пилота (localStorage,
   переживает закрытие вкладки/приложения).
   ========================================================================= */
const CURRENT_TRACK = { id: SELECTED_TRACK_ID, name: TRACK_DEF.name };
const CURRENT_CAR   = { id: SELECTED_CAR_ID,   name: CAR_DEF.name };
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

// Закрутка от пробуксовки на траве/гравии (не связана с рулением, накапливается стихийно)
let grassSpin = 0;
// Наддув турбо (только у машин с turboLag>0, иначе всегда 1 - мгновенный отклик)
let engineSpool = 1;

function gripAccel(v){ // м/с^2, растёт с прижимной силой на скорости
  const f = Math.min(Math.abs(v)/CAR.vmax, 1);
  return CAR_DEF.gripBase + CAR_DEF.gripAdd*f*f;
}
// Бонус к поворотливости, плавно и процентно зависящий от скорости: на малой
// скорости руление максимально острое, чем ближе к максималке - тем сложнее
// повернуть (реалистичный эффект прижимной силы/инерции, без резких порогов).
function turnAssist(v){
  const f = Math.min(Math.abs(v)/CAR.vmax, 1);
  return 1 + CAR_DEF.turnAssistBonus*Math.pow(1-f, 1.6);
}
function brakeDecel(v){
  const f = Math.min(Math.abs(v)/CAR.vmax, 1);
  return CAR_DEF.brakeBase + CAR_DEF.brakeAdd*f*f;
}

const car = {
  x: CENTER[0][0], y: CENTER[0][1],
  heading: Math.atan2(TAN[0][0], -TAN[0][1]), // 0 = "север" (вверх), совпадает с ориентацией спрайта
  vx: 0, vy: 0,       // мировой вектор скорости, м/с
  speed: 0,           // отображаемая скорость (знак = вперёд/назад, модуль = реальная путевая скорость с учётом заноса)
  onTrack: 1,          // 1 = чистый асфальт, меньше -> глубже в траве/гравии
};

function resetCar(){
  car.x = CENTER[0][0]; car.y = CENTER[0][1];
  car.heading = Math.atan2(TAN[0][0], -TAN[0][1]);
  car.vx = 0; car.vy = 0; car.speed = 0;
  grassSpin = 0; engineSpool = 1;
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

  const heading0 = car.heading;
  const fx0 = Math.sin(heading0), fy0 = -Math.cos(heading0);
  const rx0 = Math.cos(heading0), ry0 = Math.sin(heading0);

  // Раскладываем мировую скорость на продольную (vF, вперёд/назад по курсу)
  // и поперечную (vR, занос/снос вбок) относительно ТЕКУЩЕГО курса кузова.
  let vF = car.vx*fx0 + car.vy*fy0;
  let vR = car.vx*rx0 + car.vy*ry0;
  const speedAbs = Math.abs(vF);

  // Статистика пилота: суммарный пробег (реальная путевая скорость, с учётом заноса)
  stats.totalKm += Math.hypot(vF,vR)*dt/1000;
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

  if(offLimits || pitSpeeding){
    lap.invalid = true;
  }

  // Наддув турбо (актуально только для машин с turboLag>0, иначе всегда 1)
  if(CAR_DEF.turboLag>0){
    const targetSpool = throttle>0.15 ? 1 : 0.15;
    const rate = 1/Math.max(0.05, CAR_DEF.turboLag);
    engineSpool += (targetSpool-engineSpool)*Math.min(1, rate*dt);
  } else {
    engineSpool = 1;
  }

  // Тяга (ограничена и мощностью, и сцеплением), едет только вперёд от газа.
  // Пока машина реально скользит вбок (большой vR), шинам нечем толкать вперёд -
  // доступная тяга по сцеплению снижается пропорционально боковому сносу.
  let force = 0;
  const slipFactor = 1/(1+Math.abs(vR)*0.04);
  if(throttle>0 && brake===0){
    const tractionLimited = CAR.maxTraction * onTrackFactor * slipFactor * engineSpool;
    const powerLimited = CAR.power / Math.max(speedAbs, 1.5) * engineSpool;
    force += Math.min(tractionLimited, powerLimited);
  }
  // Реверс (только если почти стоим и жмём тормоз/назад)
  if(brake>0 && speedAbs < 0.6 && throttle===0){
    force += -4500;
  }

  // Сопротивление воздуха и качению (всегда против направления продольной скорости)
  const drag = 0.5*AIR_RHO*CAR.cdA*vF*vF*Math.sign(vF||1);
  const roll = CAR.rollingCoef*CAR.mass*G*Math.sign(vF) * (speedAbs>0.05?1:0);
  force -= drag;
  force -= roll;

  // Торможение
  if(brake>0 && speedAbs>0.6){
    const maxBrakeForce = brakeDecel(vF)*CAR.mass*onTrackFactor;
    force -= Math.sign(vF)*maxBrakeForce*brake;
  }

  // Гравий - гораздо суровее травы, реально "хватает" машину за днище.
  // Трава - сопротивление умеренное, машина всё ещё может разгоняться,
  // просто менее эффективно и с риском потерять контроль (см. закрутку ниже)
  if(inGravel && speedAbs>0.05){
    const gravelDrag = 4400 + 42*speedAbs;
    force -= Math.sign(vF)*gravelDrag;
  } else if(grassPenalty>0 && speedAbs>0.05){
    const grassDrag = grassPenalty*(1300 + 20*speedAbs);
    force -= Math.sign(vF)*grassDrag;
  }

  const accel = force/CAR.mass;
  vF += accel*dt;
  vF = Math.max(CAR.reverseMax, Math.min(CAR.vmax*1.05, vF));
  if(Math.abs(vF)<0.03 && throttle===0 && brake===0) vF = 0;

  // Руление: желаемый радиус поворота -> ограничение по сцеплению (курс кузова).
  // Это НЕ то же самое, что реальное направление движения - оно считается ниже.
  let yawRate = 0;
  if(Math.abs(steer)>0.01 && Math.abs(vF)>0.05){
    const radius = CAR.minTurnRadius/Math.abs(steer);
    const grip = gripAccel(vF)*onTrackFactor*turnAssist(vF);
    const maxYawRate = grip/Math.max(Math.abs(vF),3);
    yawRate = (vF/radius)*Math.sign(steer);
    yawRate = Math.max(-maxYawRate, Math.min(maxYawRate, yawRate));
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

  // Новый курс кузова = руление + стихийная закрутка
  car.heading = heading0 + (yawRate+grassSpin)*dt;

  // Пересобираем старый мировой вектор скорости (продольная vF уже обновлена
  // тягой/тормозом, поперечная vR пока не тронута - её трогают только шины ниже)
  const worldVx = vF*fx0 + vR*rx0;
  const worldVy = vF*fy0 + vR*ry0;

  // Раскладываем ТОТ ЖЕ мировой вектор в осях НОВОГО курса. Раз курс повернулся,
  // а вектор скорости - нет, часть её "превращается" в поперечную - это и есть
  // занос по инерции.
  const fx1 = Math.sin(car.heading), fy1 = -Math.cos(car.heading);
  const rx1 = Math.cos(car.heading), ry1 = Math.sin(car.heading);
  let vF2 = worldVx*fx1 + worldVy*fy1;
  let vR2 = worldVx*rx1 + worldVy*ry1;

  // Сцепление шин пытается погасить занос (vR2 -> 0), но не быстрее, чем
  // позволяет доступный грип на этой поверхности - на асфальте почти мгновенно,
  // на траве/гравии - медленно, и машину ощутимо сносит юзом.
  const maxLateralDeltaV = gripAccel(vF2)*onTrackFactor*dt;
  if(Math.abs(vR2) <= maxLateralDeltaV){
    vR2 = 0;
  } else {
    vR2 -= Math.sign(vR2)*maxLateralDeltaV;
  }

  car.vx = vF2*fx1 + vR2*rx1;
  car.vy = vF2*fy1 + vR2*ry1;
  if(Math.abs(vF2)<0.03 && Math.abs(vR2)<0.03 && throttle===0 && brake===0){
    car.vx = 0; car.vy = 0; vF2 = 0; vR2 = 0;
  }

  car.x += car.vx*dt;
  car.y += car.vy*dt;
  car.speed = Math.sign(vF2||1) * Math.hypot(vF2, vR2);

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
