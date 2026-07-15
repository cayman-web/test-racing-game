/* =========================================================================
   РЕЕСТР МАШИН
   Характеристики подобраны по реальным паспортным данным (округлённо):

   Porsche 911 (992) GT3 R  - гоночная версия, слики, антикрыло, ~565 л.с.,
     ~1300 кг, разгон 0-100 ~3.2-3.4с, максималка ~290 км/ч.
   Porsche Cayman S (987.1/987.2) - 3.4 л атмосферный H6, 291-295 л.с.,
     ~1350 кг, разгон 0-100 ~5.4-5.8с, максималка ~275 км/ч. Мид-эндж-
     компоновка -> отличный баланс и особая с agility в поворотах.
   Porsche 911 Turbo (930, 1975-1989) - 3.3 л турбо H6, ~300 л.с., ~1300 кг,
     разгон 0-100 ~5.0с, максималка ~260 км/ч. Классический турбо-лаг и
     репутация "widowmaker" - заднемоторная развесовка, склонность к сносу
     передней оси на входе с последующим резким сносом задней при отпускании
     газа в повороте. Тут это отражено пониженным сцеплением и турбо-лагом.
   ========================================================================= */
const CARS = {

  'porsche-992-gt3r': {
    name: 'Porsche 911 (992) GT3 R',
    texture: 'car.png',
    sideTexture: 'side_992gt3r.png',
    selectTexture: 'pre_992gt3r.png',
    length: 4.57, width: 2.0, mass: 1300,
    power: 420000,       // ~565 л.с.
    maxTraction: 12500,
    cdA: 1.27,
    rollingCoef: 0.015,
    vmax: 80.5,          // ~290 км/ч
    minTurnRadius: 6.0,
    reverseMax: -8,
    gripBase: 17, gripAdd: 9,        // 1.73g -> 2.65g
    brakeBase: 12, brakeAdd: 4,      // 1.2g -> 1.65g
    turnAssistBonus: 1.6,
    turboLag: 0
  },

  'porsche-987-cayman-s': {
    name: 'Porsche Cayman S (987)',
    texture: 'car-cayman.png',
    sideTexture: 'side_cayman987.png',
    selectTexture: 'pre_cayman987.png',
    length: 4.34, width: 1.80, mass: 1350,
    power: 220000,       // ~295 л.с.
    maxTraction: 9200,
    cdA: 0.76,
    rollingCoef: 0.013,
    vmax: 76.4,          // ~275 км/ч
    minTurnRadius: 6.3,
    reverseMax: -7,
    gripBase: 12, gripAdd: 5,        // 1.2g -> 1.7g, дорожные шины
    brakeBase: 11, brakeAdd: 3,
    turnAssistBonus: 1.85,          // мид-эндж баланс - самая юркая из трёх
    turboLag: 0
  },

  'porsche-930-turbo': {
    name: 'Porsche 911 Turbo (930)',
    texture: 'car-930.png',
    sideTexture: 'side_911930.png',
    selectTexture: 'pre_911930.png',
    length: 4.29, width: 1.78, mass: 1300,
    power: 224000,       // ~300 л.с.
    maxTraction: 8600,
    cdA: 0.91,
    rollingCoef: 0.014,
    vmax: 72.2,          // ~260 км/ч
    minTurnRadius: 7.5,
    reverseMax: -7,
    gripBase: 10, gripAdd: 4,        // ниже всех - period-correct резина + развесовка
    brakeBase: 10, brakeAdd: 3,
    turnAssistBonus: 1.2,           // менее юркая, требует аккуратности
    turboLag: 0.55                  // классическая турбо-яма ~0.55с до полной тяги
  }

};

/* ---- Выбор активной машины: ?car=id в URL -> localStorage -> машина по умолчанию ---- */
function pickCarId(){
  try{
    const q = new URLSearchParams(location.search).get('car');
    if(q && CARS[q]) return q;
  }catch(e){}
  try{
    const stored = localStorage.getItem('gt3_selectedCar');
    if(stored && CARS[stored]) return stored;
  }catch(e){}
  return 'porsche-992-gt3r';
}
const SELECTED_CAR_ID = pickCarId();
const CAR_DEF = CARS[SELECTED_CAR_ID];
try{ localStorage.setItem('gt3_selectedCar', SELECTED_CAR_ID); }catch(e){}

const CAR = {
  length: CAR_DEF.length, width: CAR_DEF.width, mass: CAR_DEF.mass,
  power: CAR_DEF.power, maxTraction: CAR_DEF.maxTraction, cdA: CAR_DEF.cdA,
  rollingCoef: CAR_DEF.rollingCoef, vmax: CAR_DEF.vmax,
  minTurnRadius: CAR_DEF.minTurnRadius, reverseMax: CAR_DEF.reverseMax
};
