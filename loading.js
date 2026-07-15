(function(){
"use strict";
/* Простой, честный индикатор загрузки: 3 реальных этапа -
   1) игровые скрипты выполнились (трасса/машина/физика посчитаны)
   2) канвас и рендер готовы
   3) текстура машины загружена (или сработал фолбэк-силуэт)
   Другие вызывающие модули дёргают window.reportAssetLoaded() по мере готовности. */
const TOTAL_STEPS = 3;
let done = 0;

const overlay = document.getElementById('loadingScreen');
const pctEl = document.getElementById('loadingPct');
const barEl = document.getElementById('loadingBarFill');

window.reportAssetLoaded = function(){
  done = Math.min(TOTAL_STEPS, done+1);
  const pct = Math.round(done/TOTAL_STEPS*100);
  if(pctEl) pctEl.textContent = pct+'%';
  if(barEl) barEl.style.width = pct+'%';
  if(done>=TOTAL_STEPS && overlay){
    overlay.classList.add('hide');
    setTimeout(()=>{ overlay.style.display='none'; }, 420);
  }
};
})();
