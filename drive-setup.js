(function(){
"use strict";

const carIds = Object.keys(CARS);
const trackIds = Object.keys(TRACKS);

let carIdx = Math.max(0, carIds.indexOf(SELECTED_CAR_ID));
let trackIdx = Math.max(0, trackIds.indexOf(SELECTED_TRACK_ID));
let hour = SELECTED_HOUR;

/* ---- Машина ---- */
const carPhoto = document.getElementById('carPhoto');
const carName = document.getElementById('carName');
const carMeta = document.getElementById('carMeta');

function renderCar(){
  const id = carIds[carIdx];
  const def = CARS[id];
  carPhoto.onerror = ()=>{ carPhoto.style.visibility='hidden'; };
  carPhoto.onload = ()=>{ carPhoto.style.visibility='visible'; };
  carPhoto.src = def.selectTexture;
  carName.textContent = def.name;
  const power = Math.round(def.power/735.5);
  const vmaxKmh = Math.round(def.vmax*3.6);
  carMeta.textContent = power+' л.с. · '+vmaxKmh+' км/ч'+(def.turboLag>0?' · турбо':'');
  try{ localStorage.setItem('gt3_selectedCar', id); }catch(e){}
}

/* ---- Трасса ---- */
const trackThumb = document.getElementById('trackThumb');
const trackName = document.getElementById('trackName');
const trackMeta = document.getElementById('trackMeta');

function drawTrackThumb(waypoints){
  const rect = trackThumb.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  trackThumb.width = Math.round(rect.width*dpr);
  trackThumb.height = Math.round(rect.height*dpr);
  const ctx = trackThumb.getContext('2d');
  ctx.clearRect(0,0,trackThumb.width,trackThumb.height);
  const pts = buildCenterline(waypoints, 10);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of pts){ minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); }
  const pad = 10*dpr;
  const s = Math.min((trackThumb.width-2*pad)/(maxX-minX), (trackThumb.height-2*pad)/(maxY-minY));
  const offX = (trackThumb.width-(maxX-minX)*s)/2, offY = (trackThumb.height-(maxY-minY)*s)/2;
  function tx(p){ return offX+(p[0]-minX)*s; }
  function ty(p){ return offY+(p[1]-minY)*s; }
  ctx.strokeStyle = 'rgba(215,230,0,0.6)';
  ctx.lineWidth = 4*dpr; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(tx(pts[0]), ty(pts[0]));
  for(let i=1;i<pts.length;i++) ctx.lineTo(tx(pts[i]), ty(pts[i]));
  ctx.closePath(); ctx.stroke();
}

function renderTrack(){
  const id = trackIds[trackIdx];
  const def = TRACKS[id];
  trackName.textContent = def.name;
  const meta = [];
  if(def.gravelZones && def.gravelZones.length) meta.push('гравий');
  if(def.pitlane) meta.push('питлейн');
  trackMeta.textContent = meta.length ? meta.join(' · ') : 'классический лэйаут';
  drawTrackThumb(def.waypoints);
  try{ localStorage.setItem('gt3_selectedTrack', id); }catch(e){}
}

/* ---- Время суток ---- */
const timeBig = document.getElementById('timeBig');
const timeLabel = document.getElementById('timeLabel');
const timeSkyMarker = document.getElementById('timeSkyMarker');

function renderTime(){
  timeBig.textContent = fmtHour(hour);
  const sun = getSunState(hour);
  timeLabel.textContent = sun.label;
  timeSkyMarker.style.left = (hour/24*100)+'%';
  try{ localStorage.setItem('gt3_timeOfDay', String(hour)); }catch(e){}
}

/* ---- Кнопки листания ---- */
document.getElementById('carPrev').addEventListener('click', ()=>{ carIdx=(carIdx-1+carIds.length)%carIds.length; renderCar(); });
document.getElementById('carNext').addEventListener('click', ()=>{ carIdx=(carIdx+1)%carIds.length; renderCar(); });
document.getElementById('trackPrev').addEventListener('click', ()=>{ trackIdx=(trackIdx-1+trackIds.length)%trackIds.length; renderTrack(); });
document.getElementById('trackNext').addEventListener('click', ()=>{ trackIdx=(trackIdx+1)%trackIds.length; renderTrack(); });
document.getElementById('timePrev').addEventListener('click', ()=>{ hour=(hour-1+24)%24; renderTime(); });
document.getElementById('timeNext').addEventListener('click', ()=>{ hour=(hour+1)%24; renderTime(); });

document.getElementById('startBtn').addEventListener('click', function(e){
  e.preventDefault();
  const carId = carIds[carIdx], trackId = trackIds[trackIdx];
  const href = 'race.html?track='+encodeURIComponent(trackId)+'&car='+encodeURIComponent(carId)+'&hour='+hour;
  document.body.classList.remove('pageIn');
  document.body.classList.add('pageOut');
  setTimeout(()=>{ window.location.href = href; }, 180);
});

renderCar();
renderTrack();
renderTime();

})();
