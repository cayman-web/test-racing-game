(function(){
"use strict";
let s = { totalLaps:0, cleanLaps:0, dirtyLaps:0, totalKm:0 };
try{
  const raw = JSON.parse(localStorage.getItem('gt3_stats') || 'null');
  if(raw) s = Object.assign(s, raw);
}catch(e){}

document.getElementById('statLaps').textContent = s.totalLaps;

const cleanPct = s.totalLaps>0 ? Math.round(100*s.cleanLaps/s.totalLaps) : 0;
document.getElementById('statClean').textContent = cleanPct+'%';
document.querySelector('#statClean').parentElement.querySelector('.statLbl').textContent =
  'чистых кругов (' + s.cleanLaps + ' из ' + s.totalLaps + ')';

document.getElementById('statKm').textContent = s.totalKm.toFixed(1);

/* ---- Вкладка "Лучшие круги": трассы x машины, только реально проеханные ---- */
function fmtTime(t){
  const m = Math.floor(t/60);
  const sec = t - m*60;
  return m+':'+sec.toFixed(2).padStart(5,'0');
}

let bestLaps = {};
try{ bestLaps = JSON.parse(localStorage.getItem('gt3_bestLaps') || '{}'); }catch(e){}

const inner = document.getElementById('bestLapsInner');
let anyRows = false;

Object.keys(TRACKS).forEach(trackId=>{
  const trackTimes = bestLaps[trackId];
  if(!trackTimes) return;
  const carIds = Object.keys(trackTimes).filter(carId=>CARS[carId] && typeof trackTimes[carId]==='number');
  if(!carIds.length) return; // на этой трассе ни на одной машине ещё не ездили с зачётным кругом

  carIds.sort((a,b)=>trackTimes[a]-trackTimes[b]); // от лучшего к худшему

  const group = document.createElement('div');
  group.className = 'trackGroup';
  const title = document.createElement('div');
  title.className = 'trackGroupName';
  title.textContent = TRACKS[trackId].name.toUpperCase();
  group.appendChild(title);

  carIds.forEach(carId=>{
    const row = document.createElement('div');
    row.className = 'lapRow';
    row.innerHTML = '<span class="carName">' + CARS[carId].name + '</span>' +
                     '<span class="lapTime">' + fmtTime(trackTimes[carId]) + '</span>';
    group.appendChild(row);
  });

  inner.appendChild(group);
  anyRows = true;
});

if(!anyRows){
  const empty = document.createElement('div');
  empty.id = 'bestLapsEmpty';
  empty.textContent = 'Пока нет ни одного зачётного круга - прокатись и возвращайся сюда.';
  inner.appendChild(empty);
}

const head = document.getElementById('bestLapsHead');
const body = document.getElementById('bestLapsBody');
head.addEventListener('click', ()=>{
  head.classList.toggle('open');
  body.classList.toggle('open');
});
})();
