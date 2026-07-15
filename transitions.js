(function(){
"use strict";
const DURATION = 180;

// Плавное появление страницы при загрузке (класс pageFade уже стоит в разметке -> opacity:0 сразу)
requestAnimationFrame(()=>{
  requestAnimationFrame(()=>{ document.body.classList.add('pageIn'); });
});

// Плавное исчезновение перед переходом по внутренней ссылке
document.addEventListener('click', function(e){
  const a = e.target.closest('a');
  if(!a) return;
  const href = a.getAttribute('href');
  if(!href || href.charAt(0)==='#' || a.target==='_blank') return;
  if(/^https?:\/\//i.test(href) || href.indexOf('mailto:')===0) return;
  if(e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  document.body.classList.remove('pageIn');
  document.body.classList.add('pageOut');
  setTimeout(()=>{ window.location.href = href; }, DURATION);
});
})();
