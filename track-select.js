(function(){
"use strict";

const grid = document.getElementById('trackGrid');

function drawThumbInto(canvas, waypoints){
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = rect.width || 220, cssH = rect.height || 150;
  canvas.width = Math.round(cssW*dpr);
  canvas.height = Math.round(cssH*dpr);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const pts = buildCenterline(waypoints, 10);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of pts){ minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); }
  const pad = 16*dpr;
  const s = Math.min((canvas.width-2*pad)/(maxX-minX), (canvas.height-2*pad)/(maxY-minY));
  const offX = (canvas.width - (maxX-minX)*s)/2;
  const offY = (canvas.height - (maxY-minY)*s)/2;
  function tx(p){ return offX + (p[0]-minX)*s; }
  function ty(p){ return offY + (p[1]-minY)*s; }

  ctx.strokeStyle = 'rgba(215,230,0,0.55)';
  ctx.lineWidth = 4*dpr;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(tx(pts[0]), ty(pts[0]));
  for(let i=1;i<pts.length;i++) ctx.lineTo(tx(pts[i]), ty(pts[i]));
  ctx.closePath();
  ctx.stroke();
}

let lastRunTrack = null;
try{ lastRunTrack = JSON.parse(localStorage.getItem('gt3_lastTrack')||'null'); }catch(e){}

Object.keys(TRACKS).forEach(id=>{
  const def = TRACKS[id];
  const a = document.createElement('a');
  a.className = 'trackTile' + (id===SELECTED_TRACK_ID ? ' current' : '');
  a.href = 'race.html?track=' + encodeURIComponent(id);

  const canvas = document.createElement('canvas');
  a.appendChild(canvas);

  if(id===SELECTED_TRACK_ID){
    const badge = document.createElement('div');
    badge.className = 'currentBadge';
    badge.textContent = 'ПОСЛЕДНЯЯ';
    a.appendChild(badge);
  }

  const info = document.createElement('div');
  info.className = 'info';
  const meta = [];
  if(def.gravelZones && def.gravelZones.length) meta.push('гравий');
  if(def.pitlane) meta.push('питлейн');
  info.innerHTML = '<div class="tName">' + def.name.toUpperCase() + '</div>' +
                    '<div class="tMeta">' + (meta.length ? meta.join(' · ') : 'классический лэйаут') + '</div>';
  a.appendChild(info);

  grid.appendChild(a);
  drawThumbInto(canvas, def.waypoints);
});

})();
