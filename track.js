/* =========================================================================
   ТРАССА
   Центральная линия восстановлена из твоего наброска (скелетизация линии),
   направление движения выставлено по красной стрелке на фото.
   Масштаб: 3.5 м на "пиксель" скетча -> итоговая длина трассы ~3.06 км.
   ========================================================================= */
const TRACK_WIDTH = 13; // метров, типично для гоночных трасс GT3

const WAYPOINTS = [
  [1057.0,472.5],[1004.5,434.0],[962.5,402.5],[896.0,413.0],[829.5,420.0],
  [763.0,448.0],[696.5,507.5],[637.0,567.0],[605.5,630.0],[560.0,682.5],
  [493.5,703.5],[444.5,679.0],[497.0,612.5],[563.5,556.5],[616.0,497.0],
  [647.5,430.5],[707.0,381.5],[773.5,374.5],[840.0,367.5],[906.5,353.5],
  [973.0,329.0],[1032.5,357.0],[1081.5,409.5],[1148.0,399.0],[1214.5,420.0],
  [1281.0,476.0],[1347.5,493.5],[1410.5,497.0],[1477.0,490.0],[1543.5,479.5],
  [1610.0,493.5],[1624.0,560.0],[1585.5,623.0],[1519.0,626.5],[1456.0,605.5],
  [1389.5,581.0],[1323.0,560.0],[1256.5,539.0],[1190.0,514.5],[1123.5,493.5]
];

// Catmull-Rom интерполяция замкнутого контура -> плотный набор точек центральной линии
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

const CENTER = buildCenterline(WAYPOINTS, 14); // ~560 точек
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
  return [-t[1], t[0]]; // повёрнутый на 90°
}

// Полигоны левого/правого края трассы (для отрисовки асфальта)
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
