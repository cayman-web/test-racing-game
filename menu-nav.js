(function(){
"use strict";

const items = Array.from(document.querySelectorAll('[data-nav]'));
if(!items.length) return;

let idx = 0;

function focusItem(i){
  if(items[idx]) items[idx].classList.remove('navFocused');
  idx = ((i % items.length) + items.length) % items.length;
  items[idx].classList.add('navFocused');
  items[idx].scrollIntoView({block:'nearest', inline:'nearest', behavior:'smooth'});
}
focusItem(0);

function activate(){
  items[idx].click();
}

/* ---- Клавиатура (стрелки + Enter/Пробел) ---- */
window.addEventListener('keydown', e=>{
  if(e.code==='ArrowRight' || e.code==='ArrowDown'){ focusItem(idx+1); e.preventDefault(); }
  else if(e.code==='ArrowLeft' || e.code==='ArrowUp'){ focusItem(idx-1); e.preventDefault(); }
  else if(e.code==='Enter' || e.code==='Space'){ activate(); e.preventDefault(); }
});

/* ---- Геймпад: крестовина/стик - выбор пункта, A - активировать ---- */
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

    if(dDown || dRight || axisX>0.5 || axisY>0.5){ focusItem(idx+1); padCooldown = now+220; }
    else if(dUp || dLeft || axisX<-0.5 || axisY<-0.5){ focusItem(idx-1); padCooldown = now+220; }
    else if(aBtn){ activate(); padCooldown = now+300; }
    break;
  }
  requestAnimationFrame(pollPad);
}
requestAnimationFrame(pollPad);

})();
