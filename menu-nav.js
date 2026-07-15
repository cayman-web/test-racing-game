(function(){
"use strict";

const items = Array.from(document.querySelectorAll('[data-nav]'));
if(!items.length) return;

let idx = 0;
let showGlow = false; // обводка включается ТОЛЬКО реальным вводом с геймпада

function applyVisual(){
  items.forEach((it,i)=>{ it.classList.toggle('navFocused', showGlow && i===idx); });
}

function focusItem(i){
  idx = ((i % items.length) + items.length) % items.length;
  applyVisual();
  if(showGlow) items[idx].scrollIntoView({block:'nearest', inline:'nearest', behavior:'smooth'});
}

function activate(){
  const el = items[idx];
  if(el.tagName==='A' || el.tagName==='BUTTON'){
    el.click();
  } else {
    const inner = el.querySelector('a[href], button');
    (inner || el).click();
  }
}

/* Мышь/тач - убираем геймпадную обводку, человек снова управляет пальцем/курсором */
window.addEventListener('pointerdown', ()=>{
  if(showGlow){ showGlow=false; applyVisual(); }
}, {passive:true});

/* ---- Клавиатура: тоже листает пункты, но без геймпадной обводки (её включает только геймпад) ---- */
window.addEventListener('keydown', e=>{
  if(e.code==='ArrowRight' || e.code==='ArrowDown'){ showGlow=false; focusItem(idx+1); e.preventDefault(); }
  else if(e.code==='ArrowLeft' || e.code==='ArrowUp'){ showGlow=false; focusItem(idx-1); e.preventDefault(); }
  else if(e.code==='Enter' || e.code==='Space'){ activate(); e.preventDefault(); }
});

/* ---- Геймпад: крестовина/стик - выбор пункта (включает обводку), A - активировать ---- */
let padCooldown = 0;
function pollPad(){
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for(const gp of pads){
    if(!gp) continue;
    const now = performance.now();
    if(now < padCooldown) break;
    const dUp = gp.buttons[12] && gp.buttons[12].pressed;
    const dDown = gp.buttons[13] && gp.buttons[13].pressed;
    const dLeft = gp.buttons[14] && gp.buttons[14].pressed;
    const dRight = gp.buttons[15] && gp.buttons[15].pressed;
    const aBtn = gp.buttons[0] && gp.buttons[0].pressed;
    const axisX = gp.axes[0] || 0, axisY = gp.axes[1] || 0;

    if(dDown || dRight || axisX>0.5 || axisY>0.5){ showGlow=true; focusItem(idx+1); padCooldown = now+220; }
    else if(dUp || dLeft || axisX<-0.5 || axisY<-0.5){ showGlow=true; focusItem(idx-1); padCooldown = now+220; }
    else if(aBtn){ showGlow=true; applyVisual(); activate(); padCooldown = now+300; }
    break;
  }
  requestAnimationFrame(pollPad);
}
requestAnimationFrame(pollPad);

})();
