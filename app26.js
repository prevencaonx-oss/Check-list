/* Triela Checklists — acabamento mobile + identidade no login */
(function(){
'use strict';
const mq=window.matchMedia('(max-width:760px)');
const icons={overview:'⌂',routine:'✓',execute:'☑',analyze:'▥'};
function brandSrc(){return document.querySelector('.triela-brand-top img,.triela-brand-bottom img')?.src||'icon-192.svg'}
function polishLogin(){
  const brand=document.querySelector('.official-auth-brand');
  if(!brand||brand.dataset.trielaOfficial==='1')return;
  brand.dataset.trielaOfficial='1';
  brand.innerHTML='<img class="official-auth-logo-img" src="'+brandSrc()+'" alt="Triela Soluções"><div><strong>TRIELA</strong><span>SOLUÇÕES</span></div>';
}
function polishTabs(){document.querySelectorAll('.mobile-tabs button[data-page]').forEach(b=>{b.setAttribute('data-mobile-icon',icons[b.dataset.page]||'•')})}
function polishSidebar(){
  document.querySelectorAll('.sidebar .navbtn[data-page]').forEach(b=>{
    if(b.dataset.mobileClose==='1')return;b.dataset.mobileClose='1';
    b.addEventListener('click',()=>{if(mq.matches)document.getElementById('sidebar')?.classList.remove('open')});
  });
}
function mode(){document.body?.classList.toggle('triela-mobile',mq.matches)}
function run(){mode();polishLogin();polishTabs();polishSidebar()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
const obs=new MutationObserver(()=>run());obs.observe(document.documentElement,{childList:true,subtree:true});
if(mq.addEventListener)mq.addEventListener('change',run);else mq.addListener(run);
setTimeout(run,500);setTimeout(run,1500);
})();
