/* =========================================================================
   РЕНДЕР
   ========================================================================= */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = 1;
function resizeCanvas(){
  DPR = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * DPR);
  canvas.height = Math.round(window.innerHeight * DPR);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resizeCanvas); resizeCanvas();

// Зум: пикселей на метр. Регулируется колесом мыши или клавишами +/-.
let ZOOM = 9.5;
const ZOOM_MIN = 3.5, ZOOM_MAX = 22;
function setZoom(z){ ZOOM = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); }

window.addEventListener('wheel', e=>{
  e.preventDefault();
  setZoom(ZOOM * (e.deltaY>0 ? 0.9 : 1.1));
}, {passive:false});

function getCss(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

/* ---- Спрайт машины: файл текстуры зависит от выбранной машины (нос смотрит вверх/на север), с запасным силуэтом ---- */
const carImg = new Image();
let carImgOk = false;
let carShadowCanvas = null; // силуэт текстуры (по альфа-каналу) для отрисовки тени по форме машины

function buildCarShadow(){
  const w = carImg.naturalWidth, h = carImg.naturalHeight;
  if(!w || !h){ carShadowCanvas = null; return; }
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d');
  octx.drawImage(carImg, 0, 0, w, h);
  // "source-in": оставляет только там, где у текстуры была непрозрачность,
  // и красит эти пиксели в сплошной тёмный цвет - получаем силуэт машины
  octx.globalCompositeOperation = 'source-in';
  octx.fillStyle = 'rgba(0,0,0,0.55)';
  octx.fillRect(0,0,w,h);
  carShadowCanvas = off;
}

carImg.onload = ()=>{ carImgOk = true; buildCarShadow(); };
carImg.onerror = ()=>{ carImgOk = false; carShadowCanvas = null; };
carImg.src = CAR_DEF.texture;

function drawPlaceholderCar(pxLen, pxWid){
  ctx.save();
  ctx.fillStyle = '#17181a';
  ctx.strokeStyle = getCss('--grello');
  ctx.lineWidth = Math.max(0.05, pxWid*0.05);
  const hl = pxLen/2, hw = pxWid/2;
  ctx.beginPath();
  ctx.moveTo(0,-hl);
  ctx.bezierCurveTo(hw*0.9,-hl*0.7, hw,-hl*0.1, hw*0.85, hl*0.35);
  ctx.lineTo(hw*0.95, hl*0.55);
  ctx.lineTo(hw*0.6, hl*0.95);
  ctx.lineTo(-hw*0.6, hl*0.95);
  ctx.lineTo(-hw*0.95, hl*0.55);
  ctx.lineTo(-hw*0.85, hl*0.35);
  ctx.bezierCurveTo(-hw,-hl*0.7, -hw*0.9,-hl*0.7, 0,-hl);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = getCss('--grello');
  ctx.fillRect(-hw*0.9, hl*0.7, hw*1.8, hl*0.14);
  ctx.fillStyle = 'rgba(215,230,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0,-hl*0.25, hw*0.55, hl*0.28, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// Та же форма, что и заглушка выше, но сплошной тёмной заливкой - используется как тень,
// пока не подставлена своя текстура car.png
function drawPlaceholderSilhouette(pxLen, pxWid){
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const hl = pxLen/2, hw = pxWid/2;
  ctx.beginPath();
  ctx.moveTo(0,-hl);
  ctx.bezierCurveTo(hw*0.9,-hl*0.7, hw,-hl*0.1, hw*0.85, hl*0.35);
  ctx.lineTo(hw*0.95, hl*0.55);
  ctx.lineTo(hw*0.6, hl*0.95);
  ctx.lineTo(-hw*0.6, hl*0.95);
  ctx.lineTo(-hw*0.95, hl*0.55);
  ctx.lineTo(-hw*0.85, hl*0.35);
  ctx.bezierCurveTo(-hw,-hl*0.7, -hw*0.9,-hl*0.7, 0,-hl);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTrack(){
  ctx.fillStyle = '#274d22';
  ctx.fillRect(-6000,-6000,12000,12000);

  drawGravelZones();
  drawPitlane();

  // асфальт
  ctx.beginPath();
  ctx.moveTo(LEFT_EDGE[0][0], LEFT_EDGE[0][1]);
  for(let i=1;i<N;i++) ctx.lineTo(LEFT_EDGE[i][0], LEFT_EDGE[i][1]);
  ctx.closePath();
  for(let i=N-1;i>=0;i--) ctx.lineTo(RIGHT_EDGE[i][0], RIGHT_EDGE[i][1]);
  ctx.closePath();
  ctx.fillStyle = '#3b3b3f';
  ctx.fill('evenodd');

  drawCurb(LEFT_EDGE);
  drawCurb(RIGHT_EDGE);

  ctx.setLineDash([2.2,2.2]);
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(CENTER[0][0], CENTER[0][1]);
  for(let i=1;i<N;i++) ctx.lineTo(CENTER[i][0], CENTER[i][1]);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  drawFinishLine();
}

function drawGravelZones(){
  if(!GRAVEL_ZONES || !GRAVEL_ZONES.length) return;
  for(const zone of GRAVEL_ZONES){
    ctx.fillStyle = '#9c8156';
    ctx.beginPath();
    ctx.moveTo(zone[0][0], zone[0][1]);
    for(let i=1;i<zone.length;i++) ctx.lineTo(zone[i][0], zone[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6f5a3a';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    // лёгкая штриховка в духе исходного скетча, для "гравийной" фактуры
    ctx.save();
    ctx.clip();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const p of zone){ minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); }
    ctx.strokeStyle = 'rgba(111,90,58,0.55)';
    ctx.lineWidth = 0.35;
    const step = 3;
    for(let d=-(maxY-minY); d<(maxX-minX); d+=step){
      ctx.beginPath();
      ctx.moveTo(minX+d, minY);
      ctx.lineTo(minX+d+(maxY-minY), maxY);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPitlane(){
  if(!PIT) return;
  ctx.beginPath();
  ctx.moveTo(PIT.left[0][0], PIT.left[0][1]);
  for(let i=1;i<PIT.left.length;i++) ctx.lineTo(PIT.left[i][0], PIT.left[i][1]);
  for(let i=PIT.right.length-1;i>=0;i--) ctx.lineTo(PIT.right[i][0], PIT.right[i][1]);
  ctx.closePath();
  ctx.fillStyle = '#4a4a50';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,59,48,0.7)';
  ctx.lineWidth = 0.3;
  ctx.stroke();
  // осевая линия пит-лейна
  ctx.setLineDash([1.5,1.5]);
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(PIT.center[0][0], PIT.center[0][1]);
  for(let i=1;i<PIT.center.length;i++) ctx.lineTo(PIT.center[i][0], PIT.center[i][1]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCurb(edge){
  const seg = 3.2;
  let acc=0, colorIdx=0;
  for(let i=0;i<N;i++){
    const a = edge[i], b = edge[(i+1)%N];
    const d = Math.hypot(b[0]-a[0], b[1]-a[1]);
    acc += d;
    if(acc>=seg){ acc=0; colorIdx++; }
    ctx.strokeStyle = (colorIdx%2===0) ? '#c0392b' : '#eceff1';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
  }
}

function drawFinishLine(){
  const c = CENTER[0], nrm = normalAt(0);
  const p1 = [c[0]+nrm[0]*HALF_W, c[1]+nrm[1]*HALF_W];
  const p2 = [c[0]-nrm[0]*HALF_W, c[1]-nrm[1]*HALF_W];
  const steps=10;
  for(let i=0;i<steps;i++){
    const t0=i/steps, t1=(i+1)/steps;
    ctx.fillStyle = (i%2===0)?'#eceff1':'#111';
    ctx.beginPath();
    ctx.moveTo(p1[0]+(p2[0]-p1[0])*t0, p1[1]+(p2[1]-p1[1])*t0);
    ctx.lineTo(p1[0]+(p2[0]-p1[0])*t1, p1[1]+(p2[1]-p1[1])*t1);
    ctx.lineTo(p1[0]+(p2[0]-p1[0])*t1 + TAN[0][0]*1.6, p1[1]+(p2[1]-p1[1])*t1 + TAN[0][1]*1.6);
    ctx.lineTo(p1[0]+(p2[0]-p1[0])*t0 + TAN[0][0]*1.6, p1[1]+(p2[1]-p1[1])*t0 + TAN[0][1]*1.6);
    ctx.closePath(); ctx.fill();
  }
}

function drawCar(){
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading);
  const pxLen = CAR.length, pxWid = CAR.width;

  // тень по форме текстуры: смещена вниз/в сторону от солнца и слегка размыта
  const shDx = pxLen*0.025, shDy = pxLen*0.06;
  ctx.save();
  ctx.translate(shDx, shDy);
  try{ ctx.filter = 'blur(0.05px)'; }catch(e){}
  if(carImgOk && carShadowCanvas){
    ctx.drawImage(carShadowCanvas, -pxWid/2, -pxLen/2, pxWid, pxLen);
  } else {
    drawPlaceholderSilhouette(pxLen, pxWid);
  }
  ctx.restore();

  if(carImgOk){
    ctx.drawImage(carImg, -pxWid/2, -pxLen/2, pxWid, pxLen);
  } else {
    drawPlaceholderCar(pxLen, pxWid);
  }
  ctx.restore();
}

const minimap = document.getElementById('minimap');
const MINIMAP_CSS = 54; // отображаемый размер в CSS-пикселях
let minimapDPR = 1;
function setupMinimap(){
  minimapDPR = window.devicePixelRatio || 1;
  minimap.width = Math.round(MINIMAP_CSS*minimapDPR);
  minimap.height = Math.round(MINIMAP_CSS*minimapDPR);
  minimap.style.width = MINIMAP_CSS+'px';
  minimap.style.height = MINIMAP_CSS+'px';
}
setupMinimap();
window.addEventListener('resize', setupMinimap);

function drawMinimap(){
  const mw = minimap.width, mh = minimap.height;
  const mctx = minimap.getContext('2d');
  mctx.clearRect(0,0,mw,mh);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of CENTER){ minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); }
  const pad=4*minimapDPR, w=mw-2*pad, h=mh-2*pad;
  const s = Math.min(w/(maxX-minX), h/(maxY-minY));
  function tx(p){ return pad + (p[0]-minX)*s; }
  function ty(p){ return pad + (p[1]-minY)*s; }
  mctx.strokeStyle = 'rgba(231,231,234,.5)';
  mctx.lineWidth = 1.5*minimapDPR;
  mctx.beginPath();
  mctx.moveTo(tx(CENTER[0]), ty(CENTER[0]));
  for(let i=1;i<N;i++) mctx.lineTo(tx(CENTER[i]), ty(CENTER[i]));
  mctx.closePath(); mctx.stroke();
  mctx.fillStyle = getCss('--grello');
  mctx.beginPath();
  mctx.arc(tx([car.x,car.y]), ty([car.x,car.y]), 2*minimapDPR, 0, Math.PI*2);
  mctx.fill();
}

function render(){
  ctx.save();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.scale(ZOOM*DPR,ZOOM*DPR);
  ctx.translate(-car.x,-car.y);
  drawTrack();
  drawCar();
  ctx.restore();
  drawMinimap();
}
