(function(){
"use strict";

const grid = document.getElementById('carGrid');

document.getElementById('chosenTrackLine').innerHTML =
  'Трасса: <b>' + TRACK_DEF.name.toUpperCase() + '</b>';

Object.keys(CARS).forEach(id=>{
  const def = CARS[id];
  const a = document.createElement('a');
  a.className = 'carTile' + (id===SELECTED_CAR_ID ? ' current' : '');
  a.href = 'race.html?track=' + encodeURIComponent(SELECTED_TRACK_ID) + '&car=' + encodeURIComponent(id);
  a.setAttribute('data-nav','');

  if(id===SELECTED_CAR_ID){
    const badge = document.createElement('div');
    badge.className = 'currentBadge';
    badge.textContent = 'ТЕКУЩАЯ';
    a.appendChild(badge);
  }

  const img = document.createElement('img');
  img.alt = '';
  img.onerror = ()=>{ img.style.display = 'none'; };
  img.src = def.selectTexture;
  a.appendChild(img);

  const info = document.createElement('div');
  info.className = 'info';
  const power = Math.round(def.power/735.5); // Вт -> л.с.
  const vmaxKmh = Math.round(def.vmax*3.6);
  info.innerHTML = '<div class="cName">' + def.name + '</div>' +
                    '<div class="cMeta">' + power + ' л.с. · ' + vmaxKmh + ' км/ч' +
                    (def.turboLag>0 ? ' · турбо' : '') + '</div>';
  a.appendChild(info);

  grid.appendChild(a);
});

})();
