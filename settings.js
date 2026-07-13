(function(){
"use strict";
const buttons = document.querySelectorAll('.optBtn');
let current = 'touch';
try{ current = localStorage.getItem('gt3_controlPref') || 'touch'; }catch(e){}

function applyActive(pref){
  buttons.forEach(b=>b.classList.toggle('active', b.dataset.pref===pref));
}
applyActive(current);

buttons.forEach(b=>{
  b.addEventListener('click', ()=>{
    try{ localStorage.setItem('gt3_controlPref', b.dataset.pref); }catch(e){}
    applyActive(b.dataset.pref);
  });
});
})();
