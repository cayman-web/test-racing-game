/* =========================================================================
   ВРЕМЯ СУТОК / СОЛНЦЕ
   Простая, "аркадная" модель на 24 часа (не астрономическая точность,
   а правдоподобная и приятная картинка): яркость дня, тёплый оттенок у
   рассвета/заката, и направление тени, которое реально крутится в течение
   суток независимо от того, куда повёрнута машина.
   ========================================================================= */

function pickHour(){
  try{
    const q = new URLSearchParams(location.search).get('hour');
    if(q!==null && q!=='' && !isNaN(+q)) return Math.max(0, Math.min(23, Math.round(+q)));
  }catch(e){}
  try{
    const stored = localStorage.getItem('gt3_timeOfDay');
    if(stored!==null && !isNaN(+stored)) return Math.max(0, Math.min(23, Math.round(+stored)));
  }catch(e){}
  return 13; // по умолчанию - светлый день
}
const SELECTED_HOUR = pickHour();
try{ localStorage.setItem('gt3_timeOfDay', String(SELECTED_HOUR)); }catch(e){}

function hoursCircularDiff(a,b){
  const d = Math.abs(a-b);
  return Math.min(d, 24-d);
}

// hour может быть дробным (для предпросмотра/анимации), обычно приходит целым 0-23
function getSunState(hour){
  const h = ((hour % 24) + 24) % 24;

  // Яркость дня: 0 глубокой ночью, 1 в полдень, плавный синус-переход
  const dayPhase = Math.cos((h-12)/24*2*Math.PI); // 1 в полдень, -1 в полночь
  const brightness = Math.max(0, Math.min(1, (dayPhase+0.55)/1.15));

  // "Сумеречность" - насколько близко к рассвету (6ч) или закату (18ч)
  const distDawn = hoursCircularDiff(h,6), distDusk = hoursCircularDiff(h,18);
  const twilight = Math.max(0, 1 - Math.min(distDawn,distDusk)/2.5);

  const isNight = brightness < 0.18;

  // Направление на солнце (в мировых координатах, 2D-упрощение): плавно
  // обходит по кругу за сутки, восход ~6ч, закат ~18ч
  const azimuthRad = ((h-6)/12) * Math.PI; // 6ч->0, 12ч->PI/2, 18ч->PI
  const sunDir = { x: Math.cos(azimuthRad), y: Math.sin(azimuthRad) };
  // тень падает в противоположную от солнца сторону
  const shadowDir = { x: -sunDir.x, y: -sunDir.y };
  // чем ниже солнце - тем длиннее тень (и тем менее резкая/плотная)
  const shadowLengthFactor = 1 + (1-brightness)*1.8;
  const shadowAlphaFactor = 0.35 + 0.55*brightness; // ночью тень мягче/бледнее

  // Цвет и сила ночного/сумеречного оверлея для сцены
  const nightAlpha = (1-brightness)*0.62;
  const warmAlpha = twilight*0.30;

  let label = 'ДЕНЬ';
  if(isNight) label = 'НОЧЬ';
  else if(twilight>0.35 && h<12) label = 'РАССВЕТ';
  else if(twilight>0.35 && h>=12) label = 'ЗАКАТ';

  return { hour:h, brightness, twilight, isNight, sunDir, shadowDir, shadowLengthFactor, shadowAlphaFactor, nightAlpha, warmAlpha, label };
}

function fmtHour(h){
  return String(((h%24)+24)%24).padStart(2,'0')+':00';
}
