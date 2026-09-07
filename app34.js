/* Triela Checklists — correções mobile críticas: logos, finalização e atualização visual */
(function(){
'use strict';
const O=()=>window.TRIELA_OFFICIAL||{};
const P=()=>O().profile||{};
const mobile=()=>window.matchMedia('(max-width:760px)').matches||document.documentElement.classList.contains('triela-native-android')||/TrielaAndroid\//i.test(navigator.userAgent);
const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
const BRAND='triela-mark.svg';
let wrapped=false;

function applyBrand(){
  const top=document.querySelector('.sidebar-brand');
  if(top){
    top.classList.add('triela-brand-fixed');
    top.innerHTML=`<div class="triela-fixed-lockup"><span class="triela-fixed-mark"><img src="${BRAND}" alt="Triela"></span><div><strong>TRIELA</strong><span>SOLUÇÕES</span></div></div>`;
  }
  const bottom=document.querySelector('.sidebar-powered');
  if(bottom){
    bottom.classList.add('triela-powered-fixed');
    bottom.innerHTML=`<span class="triela-platform-label">PLATAFORMA</span><div class="triela-powered-lockup"><img src="${BRAND}" alt="Triela"><div><strong>TRIELA</strong><span>SOLUÇÕES</span></div></div>`;
  }
  const auth=document.querySelector('.official-auth-brand');
  if(auth&&!auth.dataset.logoFixed){auth.dataset.logoFixed='1';auth.innerHTML=`<img class="official-auth-logo-img triela-auth-mark" src="${BRAND}" alt="Triela"><div><strong>TRIELA</strong><span>SOLUÇÕES</span></div>`;}
}

function requiredMissing(t,answers){
  const missing=[];
  (t?.questions||[]).forEach((q,i)=>{
    if(q.required===false)return;
    let value=answers?.[q.id]?.value;
    const input=document.querySelector(`[data-input-q='${q.id}']`);
    if(input){value=input.type==='file'?(input.files?.[0]?.name||''):input.value;}
    if(value===undefined||value===null||String(value).trim()==='')missing.push({q,i});
  });
  return missing;
}
function goToStep(index){
  const cards=[...document.querySelectorAll('#runModal .mobile-run-answer')];
  if(!cards.length){document.querySelector(`#answersBody .answer:nth-child(${index+1})`)?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  const current=Math.max(0,cards.findIndex(x=>x.classList.contains('mobile-step-active')));
  const diff=index-current;
  const btn=diff>0?document.querySelector('#runModal .mobile-run-next'):document.querySelector('#runModal .mobile-run-prev');
  for(let i=0;i<Math.abs(diff);i++)btn?.click();
  setTimeout(()=>cards[index]?.scrollIntoView({behavior:'smooth',block:'center'}),60);
}
function wrapFinish(){
  if(wrapped||typeof window.finishRun!=='function')return;
  const old=window.finishRun;
  window.finishRun=async function(t,answers){
    const modal=document.getElementById('runModal');
    if(modal?.dataset.finalizing==='1')return;
    const missing=requiredMissing(t,answers);
    if(missing.length){
      const first=missing[0];
      notify(`Faltam ${missing.length} resposta${missing.length===1?'':'s'} obrigatória${missing.length===1?'':'s'}. Indo para a primeira pendente.`);
      goToStep(first.i);
      const btn=document.getElementById('finishBtn');if(btn){btn.disabled=false;btn.textContent='Finalizar checklist';}
      return;
    }
    if(modal)modal.dataset.finalizing='1';
    const btn=document.getElementById('finishBtn');if(btn){btn.disabled=true;btn.textContent='Salvando... não feche esta tela';}
    try{return await old.apply(this,arguments);}finally{const live=document.getElementById('runModal');if(live)live.dataset.finalizing='0';}
  };
  window.finishRun.__trielaStable=true;wrapped=true;
}

function stabilizeRunner(){
  if(!mobile())return;
  const modal=document.getElementById('runModal');
  document.body.classList.toggle('triela-checklist-open',!!modal);
  if(!modal)return;
  const box=modal.querySelector('.modal');if(box)box.classList.add('triela-runner-stable');
  const footer=modal.querySelector('.modalfooter');if(footer)footer.classList.add('triela-runner-footer-stable');
  const finish=document.getElementById('finishBtn');if(finish){finish.classList.add('triela-finish-always');if(!finish.disabled&&finish.textContent.trim()!=='Finalizar checklist')finish.textContent='Finalizar checklist';}
  const body=modal.querySelector('.modalbody');if(body)body.classList.add('triela-runner-body-stable');
}

function refresh(){applyBrand();wrapFinish();stabilizeRunner();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{refresh();setTimeout(refresh,500);setTimeout(refresh,1800)});else{refresh();setTimeout(refresh,500);setTimeout(refresh,1800)}
const obs=new MutationObserver(()=>refresh());obs.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',refresh);window.addEventListener('focus',()=>setTimeout(refresh,120));
})();
