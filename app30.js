/* Triela Checklists — foco operacional mobile otimizado */
(function(){
'use strict';
const O=()=>window.TRIELA_OFFICIAL||{};
const P=()=>O().profile||{};
const mobile=()=>window.matchMedia('(max-width:760px)').matches||document.documentElement.classList.contains('triela-native-android')||/TrielaAndroid\//i.test(navigator.userAgent);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>P().role||'auditor';
let runnerTimer=null,lastSnapshot='',lastRole='';

function hideCommercial(){
  document.body.classList.add('triela-focus-app');
  ['platformSaas','saasLicenseCard','trielaNotificationCard','trielaAccountChip','commercialLicenseConsole'].forEach(id=>document.getElementById(id)?.classList.add('triela-focus-hidden'));
  document.querySelectorAll('.saas-platform-nav,.commercial-activate-link,.account-create-link,.saas-new-account').forEach(el=>el.classList.add('triela-focus-hidden'));
}
function pageTitle(page){return({overview:'Visão geral',routine:'Minha rotina',execute:'Checklists',correct:'Pendências',analyze:'Análises',training:'Treinamento',help:'Ajuda',users:'Equipe',settings:'Configurações'})[page]||'Triela Checklists'}
function syncMobileTabs(){
  if(!mobile())return;const active=document.querySelector('.section.active')?.id;
  document.querySelectorAll('.mobile-tabs [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===active));
  const title=document.querySelector('.topbar .brandtext strong');if(title)title.textContent=pageTitle(active);
}
function configureMobileTabs(){
  if(!mobile())return;const tabs=document.querySelector('.mobile-tabs');if(!tabs)return;
  const r=role(),key=r==='auditor'?'operational':'management';if(tabs.dataset.trielaFocusRole===key)return;
  tabs.dataset.trielaFocusRole=key;
  const items=r==='auditor'?[{p:'routine',l:'Rotina',i:'✓'},{p:'execute',l:'Checklists',i:'▣'},{p:'training',l:'Treinar',i:'◎'},{p:'more',l:'Mais',i:'☰'}]:[{p:'overview',l:'Início',i:'⌂'},{p:'correct',l:'Pendências',i:'!'},{p:'analyze',l:'Análises',i:'▥'},{p:'more',l:'Mais',i:'☰'}];
  tabs.innerHTML=items.map(x=>`<button type="button" ${x.p==='more'?'data-mobile-more="1"':`data-page="${x.p}"`} data-mobile-icon="${x.i}">${x.l}</button>`).join('');
  tabs.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>window.navigate?.(b.dataset.page));
  tabs.querySelector('[data-mobile-more]')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.add('open'));
  syncMobileTabs();
}
function refreshGreeting(){
  const p=P();if(!p.full_name)return;const first=String(p.full_name).trim().split(/\s+/)[0],hr=new Date().getHours(),g=hr<12?'Bom dia':hr<18?'Boa tarde':'Boa noite';
  const el=document.getElementById('overviewGreeting');if(el)el.textContent=`${g}, ${first}.`;
}
function snapshot(){
  const runs=window.state?.runs||[],actions=window.state?.actions||[],templates=window.state?.templates||[];
  return `${role()}|${runs.length}|${runs[0]?.id||''}|${actions.length}|${actions[0]?.id||''}|${templates.length}`;
}
function renderLightCards(force=false){
  if(!mobile())return;const sig=snapshot();if(!force&&sig===lastSnapshot)return;lastSnapshot=sig;
  const runs=window.state?.runs||[],actions=window.state?.actions||[],templates=window.state?.templates||[];
  if(role()!=='auditor'){
    const kpis=document.getElementById('overviewKpis');if(kpis){let card=document.getElementById('mobileOperationalFocus');if(!card){card=document.createElement('div');card.id='mobileOperationalFocus';card.className='mobile-operational-focus';kpis.insertAdjacentElement('beforebegin',card)}
      const d=new Date(),key=d.toISOString().slice(0,10),today=runs.filter(r=>new Date(r.date).toISOString().slice(0,10)===key),completed=today.filter(r=>r.status==='completed').length,pending=actions.filter(a=>a.status!=='done').length,late=actions.filter(a=>a.status==='overdue').length;
      card.innerHTML=`<div class="mof-top"><div><span>HOJE NA OPERAÇÃO</span><strong>${completed?`${completed} checklist${completed===1?'':'s'} concluído${completed===1?'':'s'}`:'Acompanhe as prioridades do dia'}</strong></div><b>${late?`${late} atrasada${late===1?'':'s'}`:'Em dia'}</b></div><div class="mof-stats"><div><strong>${completed}</strong><span>Concluídos</span></div><div><strong>${pending}</strong><span>Pendências</span></div><div><strong>${late}</strong><span>Atrasadas</span></div></div><div class="mof-actions"><button type="button" data-go="execute">✓ Executar checklist</button><button type="button" data-go="correct" class="secondary">Ver pendências</button></div>`;card.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>window.navigate?.(b.dataset.go));
    }
  }
  const sec=document.getElementById('execute');if(sec){let box=document.getElementById('mobileRecentRuns');if(!box){box=document.createElement('div');box.id='mobileRecentRuns';box.className='mobile-native-list';sec.appendChild(box)}const rows=runs.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);box.innerHTML=`<div class="mnl-head"><div><span>HISTÓRICO RÁPIDO</span><strong>Últimas execuções</strong></div><small>${rows.length} recentes</small></div>${rows.length?rows.map(r=>{const t=templates.find(x=>x.id===r.templateId);return `<div class="mnl-row"><div class="mnl-icon ${Number(r.compliance)>=90?'ok':Number(r.compliance)>=75?'warn':'bad'}">✓</div><div class="mnl-main"><strong>${esc(t?.name||'Checklist')}</strong><small>${new Date(r.date).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></div><div class="mnl-score"><strong>${r.status==='completed'?`${Math.round(Number(r.compliance)||0)}%`:'—'}</strong><small>${r.nc||0} NC</small></div></div>`}).join(''):'<div class="mnl-empty">Ainda não há execuções registradas.</div>'}`}
}
function enhanceFileInputs(modal){
  modal.querySelectorAll('.answer input[type="file"]').forEach(input=>{if(input.dataset.mobileEnhanced)return;input.dataset.mobileEnhanced='1';input.classList.add('mobile-file-input');const wrap=document.createElement('label');wrap.className='mobile-evidence-button';wrap.innerHTML='<span>📷</span><div><strong>Adicionar evidência</strong><small>Usar câmera ou escolher uma foto</small></div>';input.insertAdjacentElement('beforebegin',wrap);wrap.appendChild(input);input.addEventListener('change',()=>{const s=wrap.querySelector('small');if(s)s.textContent=input.files?.[0]?.name||'Usar câmera ou escolher uma foto';wrap.classList.toggle('has-file',!!input.files?.length)})})
}
function enhanceRunner(){
  if(!mobile())return;const modal=document.querySelector('#runModal .modal');if(!modal||modal.dataset.mobileStepper==='1')return;
  const body=modal.querySelector('.modalbody'),answers=[...modal.querySelectorAll('.answer')],footer=modal.querySelector('.modalfooter'),finish=document.getElementById('finishBtn');if(!body||!answers.length||!footer||!finish)return;
  modal.dataset.mobileStepper='1';modal.classList.add('mobile-runner');enhanceFileInputs(modal);
  const progress=document.createElement('div');progress.className='mobile-run-progress';progress.innerHTML='<div class="mrp-copy"><span id="mobileRunStepLabel"></span><strong id="mobileRunStepTitle">Responda com atenção</strong></div><div class="mrp-track"><span id="mobileRunProgressBar"></span></div>';body.insertAdjacentElement('afterbegin',progress);
  answers.forEach((a,i)=>{a.classList.add('mobile-run-answer');a.dataset.step=String(i)});
  footer.querySelector('.secondary')?.classList.add('mobile-run-cancel');const prev=document.createElement('button');prev.type='button';prev.className='btn secondary mobile-run-prev';prev.textContent='← Voltar';const next=document.createElement('button');next.type='button';next.className='btn mobile-run-next';next.textContent='Próxima →';finish.textContent='Finalizar checklist';finish.classList.add('mobile-run-finish');footer.insertBefore(prev,finish);footer.insertBefore(next,finish);
  let step=0;answers[0].classList.add('mobile-step-active');
  function show(i){const target=Math.max(0,Math.min(answers.length-1,i));if(target!==step){answers[step]?.classList.remove('mobile-step-active');answers[target]?.classList.add('mobile-step-active');step=target}const pct=Math.round((step+1)/answers.length*100),q=answers[step];document.getElementById('mobileRunStepLabel').textContent=`Pergunta ${step+1} de ${answers.length}`;document.getElementById('mobileRunStepTitle').textContent=q.querySelector('h4')?.textContent?.replace(/^\d+\.\s*/,'')||'Responda com atenção';document.getElementById('mobileRunProgressBar').style.width=`${pct}%`;prev.style.visibility=step?'visible':'hidden';next.style.display=step===answers.length-1?'none':'';body.scrollTop=0}
  prev.onclick=()=>show(step-1);next.onclick=()=>show(step+1);show(0);
  answers.forEach((a,i)=>a.querySelectorAll('.choice button').forEach(b=>b.addEventListener('click',()=>{if(i<answers.length-1){clearTimeout(runnerTimer);runnerTimer=setTimeout(()=>show(i+1),180)}})));
}
function wrapRunner(name){const old=window[name];if(typeof old!=='function'||old.__trielaFocusWrapped)return;const wrapped=function(){const out=old.apply(this,arguments);setTimeout(enhanceRunner,50);return out};wrapped.__trielaFocusWrapped=true;window[name]=wrapped}
function refresh(force=false){hideCommercial();configureMobileTabs();refreshGreeting();renderLightCards(force);syncMobileTabs();wrapRunner('startRun');wrapRunner('startScheduledRun');enhanceRunner();const r=role();if(lastRole!==r){lastRole=r;configureMobileTabs()}}
const oldNavigate=window.navigate;if(typeof oldNavigate==='function'&&!oldNavigate.__trielaPerfWrapped){const w=function(page){const out=oldNavigate.apply(this,arguments);requestAnimationFrame(()=>{syncMobileTabs();renderLightCards(false)});return out};w.__trielaPerfWrapped=true;window.navigate=w}
function boot(){refresh(true);[500,1500,3500].forEach(ms=>setTimeout(()=>refresh(ms===3500),ms));const root=document.getElementById('modalRoot');if(root)new MutationObserver(()=>requestAnimationFrame(enhanceRunner)).observe(root,{childList:true,subtree:false})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('focus',()=>setTimeout(()=>refresh(true),120));let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>refresh(false),180)});
})();
