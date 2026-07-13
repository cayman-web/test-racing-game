(function(){
"use strict";

/* ---- Приглушённый layout трассы как фон кнопки Drive ----
   Рисуется прямо из геометрии track.js, так что не требует никаких файлов.
   Если рядом лежит файл track-bg.jpg (своя фотка/текстура трассы) - он покажется
   как фон под линией, просто положи файл с этим именем рядом с index.html. */
const thumb = document.getElementById('driveThumb');
function drawThumb(){
  const rect = thumb.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  thumb.width = Math.round(rect.width*dpr);
  thumb.height = Math.round(rect.height*dpr);
  thumb.style.width = rect.width+'px';
  thumb.style.height = rect.height+'px';
  const ctx = thumb.getContext('2d');
  ctx.clearRect(0,0,thumb.width,thumb.height);

  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of CENTER){ minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); }
  const pad = 26*dpr;
  const s = Math.min((thumb.width-2*pad)/(maxX-minX), (thumb.height-2*pad)/(maxY-minY));
  const offX = (thumb.width - (maxX-minX)*s)/2;
  const offY = (thumb.height - (maxY-minY)*s)/2;
  function tx(p){ return offX + (p[0]-minX)*s; }
  function ty(p){ return offY + (p[1]-minY)*s; }

  ctx.strokeStyle = 'rgba(215,230,0,0.6)';
  ctx.lineWidth = 5*dpr;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(tx(CENTER[0]), ty(CENTER[0]));
  for(let i=1;i<N;i++) ctx.lineTo(tx(CENTER[i]), ty(CENTER[i]));
  ctx.closePath();
  ctx.stroke();
}
drawThumb();
window.addEventListener('resize', drawThumb);

/* ---- Своя текстура машины (тот же car.png, что и в самой игре) поверх превью ---- */
const carImg = document.getElementById('driveCarImg');
carImg.onerror = ()=>{ carImg.style.display = 'none'; };
carImg.src = 'car.png';

/* ---- Своя фотка/текстура трассы (опционально) ---- */
const trackBg = document.getElementById('trackBgImg');
trackBg.onerror = ()=>{ trackBg.style.display = 'none'; };
trackBg.src = 'track-bg.jpg';

/* ---- Память последнего заезда ---- */
try{
  const lastTrack = JSON.parse(localStorage.getItem('gt3_lastTrack') || 'null');
  const lastCar = JSON.parse(localStorage.getItem('gt3_lastCar') || 'null');
  if(lastTrack || lastCar){
    const trackName = lastTrack ? lastTrack.name : '—';
    const carName = lastCar ? lastCar.name : '—';
    document.getElementById('lastRunInfo').textContent = trackName + ' · ' + carName;
  }
}catch(e){}

/* ---- Текущий приоритетный метод управления (из настроек) ---- */
try{
  const pref = localStorage.getItem('gt3_controlPref') || 'touch';
  document.getElementById('controlPrefLabel').textContent =
    'Управление: ' + (pref==='gamepad' ? 'геймпад' : 'экран');
}catch(e){}

})();
