/* Triela Checklists — acabamento mobile leve + identidade no login */
(function(){
'use strict';
const mq=window.matchMedia('(max-width:760px)');
const icons={overview:'⌂',routine:'✓',execute:'☑',analyze:'▥'};
function brandSrc(){return document.querySelector('.triela-fixed-mark img,.triela-powered-lockup img,.triela-brand-top img')?.src||'triela-mark.svg'}
function polishLogin(){const brand=document.querySelector('.official-auth-brand');if(!brand||brand.dataset.trielaOfficial==='1')return;brand.dataset.trielaOfficial='1';brand.innerHTML='<img class="official-auth-logo-img" src="'+brandSrc()+'" alt="Triela Soluções"><div><strong>TRIELA</strong><span>SOLUÇÕES</span></div>'}
function polishTabs(){document.querySelectorAll('.mobile-tabs button[data-page]').forEach(b=>b.setAttribute('data-mobile-icon',icons[b.dataset.page]||'•'))}
function polishSidebar(){document.querySelectorAll('.sidebar .navbtn[data-page]').forEach(b=>{if(b.dataset.mobileClose==='1')return;b.dataset.mobileClose='1';b.addEventListener('click',()=>{if(mq.matches)document.getElementById('sidebar')?.classList.remove('open')})})}
function run(){document.body?.classList.toggle('triela-mobile',mq.matches);polishLogin();polishTabs();polishSidebar()}
function boot(){run();[500,1500,3500].forEach(ms=>setTimeout(run,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
if(mq.addEventListener)mq.addEventListener('change',run);else mq.addListener(run);
window.addEventListener('focus',()=>setTimeout(run,100));
})();
