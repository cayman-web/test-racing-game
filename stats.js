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
})();
