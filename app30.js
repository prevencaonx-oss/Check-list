/* Triela Checklists — foco operacional mobile V1 */
(function(){
'use strict';
const O=()=>window.TRIELA_OFFICIAL||{};
const P=()=>O().profile||{};
const mobile=()=>window.matchMedia('(max-width:760px)').matches||document.documentElement.classList.contains('triela-native-android')||/TrielaAndroid\//i.test(navigator.userAgent);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>P().role||'auditor';
let lastRole='',runnerTimer=null;

function hideCommercial(){
  document.body.classList.add('triela-focus-app');
  const ids=['platformSaas','saasLicenseCard','trielaNotificationCard','trielaAccountChip','commercialLicenseConsole'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.setAttribute('aria-hidden','true');});
  document.querySelectorAll('.saas-platform-nav,.commercial-activate-link,.account-create-link,.saas-new-account').forEach(el=>el.classList.add('triela-focus-hidden'));
  if(document.querySelector('#platformSaas.section.active')){
    try{window.navigate?.(role()==='auditor'?'routine':'overview');}catch(_){ }
  }
}

function pageTitle(page){return({overview:'Visão geral',routine:'Minha rotina',execute:'Checklists',correct:'Pendências',analyze:'Análises',training:'Treinamento',help:'Ajuda',users:'Equipe',settings:'Configurações'})[page]||'Triela Checklists';}

function configureMobileTabs(){
  if(!mobile())return;
  const tabs=document.querySelector('.mobile-tabs');if(!tabs)return;
  const r=role(),key=r==='auditor'?'operational':'management';
  if(tabs.dataset.trielaFocusRole===key)return;
  tabs.dataset.trielaFocusRole=key;
  const items=r==='auditor'?
    [{p:'routine',l:'Rotina',i:'✓'},{p:'execute',l:'Checklists',i:'▣'},{p:'training',l:'Treinar',i:'◎'},{p:'more',l:'Mais',i:'☰'}]:
    [{p:'overview',l:'Início',i:'⌂'},{p:'correct',l:'Pendências',i:'!'},{p:'analyze',l:'Análises',i:'▥'},{p:'more',l:'Mais',i:'☰'}];
  tabs.innerHTML=items.map(x=>`<button type="button" ${x.p==='more'?'data-mobile-more="1"':`data-page="${x.p}"`} data-mobile-icon="${x.i}">${x.l}</button>`).join('');
  tabs.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>window.navigate?.(b.dataset.page)));
  tabs.querySelector('[data-mobile-more]')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.add('open'));
  syncMobileTabs();
}

function syncMobileTabs(){
  if(!mobile())return;
  const active=document.querySelector('.section.active')?.id;
  document.querySelectorAll('.mobile-tabs [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===active));
  const title=document.querySelector('.topbar .brandtext strong');if(title)title.textContent=pageTitle(active);
}

function realTodayRuns(){
  const d=new Date(),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return (window.state?.runs||[]).filter(r=>{const x=new Date(r.date);const k=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;return k===key;});
}

function refreshGreeting(){
  const p=P();if(!p.full_name)return;
  const first=String(p.full_name).trim().split(/\s+/)[0],hr=new Date().getHours(),g=hr<12?'Bom dia':hr<18?'Boa tarde':'Boa noite';
  const el=document.getElementById('overviewGreeting');if(el)el.textContent=`${g}, ${first}.`;
}

function ensureMobileFocus(){
  if(!mobile()||role()==='auditor')return;
  const overview=document.getElementById('overview'),kpis=document.getElementById('overviewKpis');if(!overview||!kpis)return;
  let card=document.getElementById('mobileOperationalFocus');if(!card){card=document.createElement('div');card.id='mobileOperationalFocus';card.className='mobile-operational-focus';kpis.insertAdjacentElement('beforebegin',card);}
  const today=realTodayRuns(),completed=today.filter(r=>r.status==='completed').length,pending=(window.state?.actions||[]).filter(a=>a.status!=='done').length,late=(window.state?.actions||[]).filter(a=>a.status==='overdue').length;
  card.innerHTML=`<div class="mof-top"><div><span>HOJE NA OPERAÇÃO</span><strong>${completed?`${completed} checklist${completed===1?'':'s'} concluído${completed===1?'':'s'}`:'Acompanhe as prioridades do dia'}</strong></div><b>${late?`${late} atrasada${late===1?'':'s'}`:'Em dia'}</b></div><div class="mof-stats"><div><strong>${completed}</strong><span>Concluídos</span></div><div><strong>${pending}</strong><span>Pendências</span></div><div><strong>${late}</strong><span>Atrasadas</span></div></div><div class="mof-actions"><button type="button" data-go="execute">✓ Executar checklist</button><button type="button" data-go="correct" class="secondary">Ver pendências</button></div>`;
  card.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>window.navigate?.(b.dataset.go));
}

function ensureMobileRecentRuns(){
  if(!mobile())return;
  const sec=document.getElementById('execute');if(!sec)return;
  let box=document.getElementById('mobileRecentRuns');if(!box){box=document.createElement('div');box.id='mobileRecentRuns';box.className='mobile-native-list';sec.appendChild(box);}
  const rows=(window.state?.runs||[]).slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  box.innerHTML=`<div class="mnl-head"><div><span>HISTÓRICO RÁPIDO</span><strong>Últimas execuções</strong></div><small>${rows.length} recentes</small></div>${rows.length?rows.map(r=>{const t=(window.state?.templates||[]).find(x=>x.id===r.templateId);return `<div class="mnl-row"><div class="mnl-icon ${Number(r.compliance)>=90?'ok':Number(r.compliance)>=75?'warn':'bad'}">✓</div><div class="mnl-main"><strong>${esc(t?.name||'Checklist')}</strong><small>${new Date(r.date).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></div><div class="mnl-score"><strong>${r.status==='completed'?`${Math.round(Number(r.compliance)||0)}%`:'—'}</strong><small>${r.nc||0} NC</small></div></div>`;}).join(''):'<div class="mnl-empty">Ainda não há execuções registradas.</div>'}`;
}

function ensureMobileActions(){
  if(!mobile())return;
  const sec=document.getElementById('correct');if(!sec)return;
  let box=document.getElementById('mobileActionList');if(!box){box=document.createElement('div');box.id='mobileActionList';box.className='mobile-native-list';const panel=sec.querySelector('.panel');if(panel)panel.insertAdjacentElement('beforebegin',box);else sec.appendChild(box);}
  const rows=(window.state?.actions||[]).filter(a=>a.status!=='done').slice().sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,8);
  box.innerHTML=`<div class="mnl-head"><div><span>TRATATIVAS</span><strong>O que precisa de atenção</strong></div><small>${rows.length} exibidas</small></div>${rows.length?rows.map(a=>`<div class="mnl-row action"><div class="mnl-icon ${a.status==='overdue'?'bad':'warn'}">!</div><div class="mnl-main"><strong>${esc(a.title||'Pendência')}</strong><small>${esc(a.owner||'Sem responsável')} • ${new Date(a.due).toLocaleDateString('pt-BR')}</small></div><span class="mnl-pill ${a.status==='overdue'?'bad':'warn'}">${a.status==='overdue'?'Vencida':'Pendente'}</span></div>`).join(''):'<div class="mnl-empty">Nenhuma pendência aberta.</div>'}`;
}

function enhanceFileInputs(modal){
  modal.querySelectorAll('.answer input[type="file"]').forEach(input=>{
    if(input.dataset.mobileEnhanced)return;input.dataset.mobileEnhanced='1';input.classList.add('mobile-file-input');
    const wrap=document.createElement('label');wrap.className='mobile-evidence-button';wrap.innerHTML='<span>📷</span><div><strong>Adicionar evidência</strong><small>Usar câmera ou escolher uma foto</small></div>';
    input.insertAdjacentElement('beforebegin',wrap);wrap.appendChild(input);
    input.addEventListener('change',()=>{const s=wrap.querySelector('small');if(s)s.textContent=input.files?.[0]?.name||'Usar câmera ou escolher uma foto';wrap.classList.toggle('has-file',!!input.files?.length);});
  });
}

function enhanceRunner(){
  if(!mobile())return;
  const modal=document.querySelector('#runModal .modal');if(!modal||modal.dataset.mobileStepper==='1')return;
  const body=modal.querySelector('.modalbody'),answers=[...modal.querySelectorAll('.answer')],footer=modal.querySelector('.modalfooter'),finish=document.getElementById('finishBtn');if(!body||!answers.length||!footer||!finish)return;
  modal.dataset.mobileStepper='1';modal.classList.add('mobile-runner');
  enhanceFileInputs(modal);
  const progress=document.createElement('div');progress.className='mobile-run-progress';progress.innerHTML='<div class="mrp-copy"><span id="mobileRunStepLabel"></span><strong id="mobileRunStepTitle">Responda com atenção</strong></div><div class="mrp-track"><span id="mobileRunProgressBar"></span></div>';
  body.insertAdjacentElement('afterbegin',progress);
  answers.forEach((a,i)=>{a.classList.add('mobile-run-answer');a.dataset.step=String(i);});
  const cancel=footer.querySelector('.secondary');cancel?.classList.add('mobile-run-cancel');
  const prev=document.createElement('button');prev.type='button';prev.className='btn secondary mobile-run-prev';prev.textContent='← Voltar';
  const next=document.createElement('button');next.type='button';next.className='btn mobile-run-next';next.textContent='Próxima →';
  finish.textContent='Finalizar checklist';finish.classList.add('mobile-run-finish');footer.insertBefore(prev,finish);footer.insertBefore(next,finish);
  let step=0;
  function show(i){step=Math.max(0,Math.min(answers.length-1,i));answers.forEach((a,n)=>a.classList.toggle('mobile-step-active',n===step));const pct=Math.round((step+1)/answers.length*100);const l=document.getElementById('mobileRunStepLabel'),t=document.getElementById('mobileRunStepTitle'),bar=document.getElementById('mobileRunProgressBar');if(l)l.textContent=`Pergunta ${step+1} de ${answers.length}`;if(t)t.textContent=answers[step].querySelector('h4')?.textContent?.replace(/^\d+\.\s*/,'')||'Responda com atenção';if(bar)bar.style.width=`${pct}%`;prev.style.display=step?'':'none';next.style.display=step===answers.length-1?'none':'';finish.style.display=step===answers.length-1?'':'none';body.scrollTop=0;}
  prev.onclick=()=>show(step-1);next.onclick=()=>show(step+1);show(0);
  answers.forEach((a,i)=>a.querySelectorAll('.choice button').forEach(b=>b.addEventListener('click',()=>{if(i<answers.length-1){clearTimeout(runnerTimer);runnerTimer=setTimeout(()=>show(i+1),260);}})));
}

function wrapRunner(name){
  const old=window[name];if(typeof old!=='function'||old.__trielaFocusWrapped)return;
  const wrapped=function(){const out=old.apply(this,arguments);setTimeout(enhanceRunner,80);setTimeout(enhanceRunner,260);return out;};wrapped.__trielaFocusWrapped=true;window[name]=wrapped;
}

function refresh(){
  hideCommercial();configureMobileTabs();refreshGreeting();ensureMobileFocus();ensureMobileRecentRuns();ensureMobileActions();syncMobileTabs();wrapRunner('startRun');wrapRunner('startScheduledRun');enhanceRunner();
  const r=role();if(lastRole!==r){lastRole=r;configureMobileTabs();}
}

const oldNavigate=window.navigate;if(typeof oldNavigate==='function')window.navigate=function(page){const out=oldNavigate.apply(this,arguments);setTimeout(()=>{syncMobileTabs();refresh();},40);return out;};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{refresh();setTimeout(refresh,700);setTimeout(refresh,2200);});else{refresh();setTimeout(refresh,700);setTimeout(refresh,2200);}
setInterval(refresh,2500);window.addEventListener('resize',refresh);window.addEventListener('focus',()=>setTimeout(refresh,200));
})();
