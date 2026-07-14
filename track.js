/* =========================================================================
   РЕЕСТР ТРАСС
   Каждая трасса: waypoints (опорные точки контура, метры), width (м),
   gravelZones (полигоны гравийных ловушек, метры) и опционально pitlane.
   ========================================================================= */
const TRACKS = {

  'sketch-circuit-01': {
    name: 'Sketch Circuit',
    width: 13,
    waypoints: [
      [1057.0,472.5],[1004.5,434.0],[962.5,402.5],[896.0,413.0],[829.5,420.0],
      [763.0,448.0],[696.5,507.5],[637.0,567.0],[605.5,630.0],[560.0,682.5],
      [493.5,703.5],[444.5,679.0],[497.0,612.5],[563.5,556.5],[616.0,497.0],
      [647.5,430.5],[707.0,381.5],[773.5,374.5],[840.0,367.5],[906.5,353.5],
      [973.0,329.0],[1032.5,357.0],[1081.5,409.5],[1148.0,399.0],[1214.5,420.0],
      [1281.0,476.0],[1347.5,493.5],[1410.5,497.0],[1477.0,490.0],[1543.5,479.5],
      [1610.0,493.5],[1624.0,560.0],[1585.5,623.0],[1519.0,626.5],[1456.0,605.5],
      [1389.5,581.0],[1323.0,560.0],[1256.5,539.0],[1190.0,514.5],[1123.5,493.5]
    ],
    gravelZones: [],
    pitlane: null
  }

};

/* ---- Выбор активной трассы: ?track=id в URL -> localStorage -> трасса по умолчанию ---- */
function pickTrackId(){
  try{
    const q = new URLSearchParams(location.search).get('track');
    if(q && TRACKS[q]) return q;
  }catch(e){}
  try{
    const stored = localStorage.getItem('gt3_selectedTrack');
    if(stored && TRACKS[stored]) return stored;
  }catch(e){}
  return 'sketch-circuit-01';
}
const SELECTED_TRACK_ID = pickTrackId();
const TRACK_DEF = TRACKS[SELECTED_TRACK_ID];
try{ localStorage.setItem('gt3_selectedTrack', SELECTED_TRACK_ID); }catch(e){}

const TRACK_WIDTH = TRACK_DEF.width;
const WAYPOINTS = TRACK_DEF.waypoints;

// Catmull-Rom интерполяция ЗАМКНУТОГО контура -> плотный набор точек центральной линии
function buildCenterline(waypoints, samplesPerSeg){
  const pts = [];
  const n = waypoints.length;
  function pt(i){ return waypoints[((i % n) + n) % n]; }
  for(let i=0;i<n;i++){
    const p0=pt(i-1), p1=pt(i), p2=pt(i+1), p3=pt(i+2);
    for(let s=0;s<samplesPerSeg;s++){
      const t = s/samplesPerSeg;
      const t2=t*t, t3=t2*t;
      const x = 0.5*((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
      const y = 0.5*((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
      pts.push([x,y]);
    }
  }
  return pts;
}

// Catmull-Rom интерполяция ОТКРЫТОЙ кривой (для пит-лейна) - концы не заворачиваются
function buildOpenCenterline(waypoints, samplesPerSeg){
  const pts = [];
  const n = waypoints.length;
  function pt(i){ return waypoints[Math.max(0, Math.min(n-1, i))]; }
  for(let i=0;i<n-1;i++){
    const p0=pt(i-1), p1=pt(i), p2=pt(i+1), p3=pt(i+2);
    for(let s=0;s<samplesPerSeg;s++){
      const t = s/samplesPerSeg;
      const t2=t*t, t3=t2*t;
      const x = 0.5*((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
      const y = 0.5*((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
      pts.push([x,y]);
    }
  }
  pts.push(pt(n-1));
  return pts;
}

const CENTER = buildCenterline(WAYPOINTS, 14);
const N = CENTER.length;

// Кумулятивная длина дуги + касательные
const CUM = new Float64Array(N+1);
const TAN = [];
for(let i=0;i<N;i++){
  const a = CENTER[i], b = CENTER[(i+1)%N];
  const dx=b[0]-a[0], dy=b[1]-a[1];
  const len = Math.hypot(dx,dy) || 1e-6;
  CUM[i+1] = CUM[i] + len;
  TAN.push([dx/len, dy/len]);
}
const TRACK_LENGTH = CUM[N];

function normalAt(i){
  const t = TAN[i];
  return [-t[1], t[0]];
}

const HALF_W = TRACK_WIDTH/2;
const LEFT_EDGE = [], RIGHT_EDGE = [];
for(let i=0;i<N;i++){
  const c = CENTER[i], nrm = normalAt(i);
  LEFT_EDGE.push([c[0]+nrm[0]*HALF_W, c[1]+nrm[1]*HALF_W]);
  RIGHT_EDGE.push([c[0]-nrm[0]*HALF_W, c[1]-nrm[1]*HALF_W]);
}

// Поиск ближайшей точки центральной линии (простой линейный поиск, N ~560 - дёшево на кадр)
function nearestIndex(x,y){
  let best=0, bestD=Infinity;
  for(let i=0;i<N;i++){
    const c=CENTER[i];
    const dx=c[0]-x, dy=c[1]-y;
    const d=dx*dx+dy*dy;
    if(d<bestD){bestD=d; best=i;}
  }
  return {idx:best, dist:Math.sqrt(bestD)};
}

/* =========================================================================
   ГРАВИЙНО-ПЕСОЧНЫЕ ЗОНЫ ВЫЛЕТА
   ========================================================================= */
const GRAVEL_ZONES = TRACK_DEF.gravelZones || [];

function pointInPolygon(x, y, poly){
  let inside = false;
  for(let i=0, j=poly.length-1; i<poly.length; j=i++){
    const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
    const intersect = ((yi>y) !== (yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi);
    if(intersect) inside = !inside;
  }
  return inside;
}

function isInGravel(x, y){
  for(const zone of GRAVEL_ZONES){
    if(pointInPolygon(x, y, zone)) return true;
  }
  return false;
}

/* =========================================================================
   ПИТ-ЛЕЙН (если есть у выбранной трассы)
   ========================================================================= */
let PIT = null;
if(TRACK_DEF.pitlane){
  const def = TRACK_DEF.pitlane;
  const pc = buildOpenCenterline(def.waypoints, 14);
  const pn = pc.length;
  const ptan = [];
  for(let i=0;i<pn;i++){
    const a = pc[Math.max(0,i-1)], b = pc[Math.min(pn-1,i+1)];
    const dx=b[0]-a[0], dy=b[1]-a[1];
    const len = Math.hypot(dx,dy) || 1e-6;
    ptan.push([dx/len, dy/len]);
  }
  const halfW = def.width/2;
  const pLeft = [], pRight = [];
  for(let i=0;i<pn;i++){
    const c = pc[i], t = ptan[i], nrm = [-t[1], t[0]];
    pLeft.push([c[0]+nrm[0]*halfW, c[1]+nrm[1]*halfW]);
    pRight.push([c[0]-nrm[0]*halfW, c[1]-nrm[1]*halfW]);
  }
  PIT = { center: pc, left: pLeft, right: pRight, halfWidth: halfW, speedLimitKmh: def.speedLimitKmh || 80 };
}

// Ближайшее расстояние от точки до произвольной (незамкнутой) полилинии - для пит-лейна
function nearestDistOnOpenPath(x, y, path){
  let best = Infinity;
  for(const p of path){
    const dx = p[0]-x, dy = p[1]-y;
    const d = dx*dx+dy*dy;
    if(d<best) best = d;
  }
  return Math.sqrt(best);
}
