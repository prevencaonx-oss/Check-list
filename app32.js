/* Triela Checklists — Minha Rotina V2 + correção pelo responsável */
(function(){
'use strict';
const O=()=>window.TRIELA_OFFICIAL||{};
const DB=()=>O().supabase;
const P=()=>O().profile||{};
const ST=()=>typeof state!=='undefined'?state:(window.state||{});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
const isOperational=()=>P().role==='auditor';
const isManagement=()=>['admin','manager'].includes(P().role);
const storeName=id=>(ST().units||[]).find(u=>u.id===id)?.name||'Unidade';
let myCorrections=[],myPlans=[],managementNcMap=new Map(),loading=false,booted=false;

function fmt(v){return v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}
function firstName(){return String(P().full_name||'').trim().split(/\s+/)[0]||'Você'}

function ensureRoutineSummary(){
  if(!isOperational())return;
  const hero=document.querySelector('#routine .routine-hero');if(!hero)return;
  let box=document.getElementById('routineDailySummaryV2');
  if(!box){box=document.createElement('div');box.id='routineDailySummaryV2';box.className='routine-daily-summary-v2';hero.insertAdjacentElement('beforebegin',box);}
  const done=Number(document.getElementById('routineDone')?.textContent||0),pending=Number(document.getElementById('routinePending')?.textContent||0),late=Number(document.getElementById('routineLate')?.textContent||0),next=document.getElementById('routineNextName')?.textContent||'Nenhuma atividade pendente',nextTime=document.getElementById('routineNextTime')?.textContent||'—';
  const now=new Date(),date=now.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
  box.innerHTML=`<div class="rdsv2-top"><div><span>MINHA ROTINA</span><strong>${esc(firstName())}, veja seu dia.</strong><small>${esc(date.charAt(0).toUpperCase()+date.slice(1))}</small></div><b class="${late?'late':'ok'}">${late?`${late} atrasada${late===1?'':'s'}`:'Tudo em dia'}</b></div><div class="rdsv2-stats"><div><strong>${pending}</strong><span>Pendentes</span></div><div><strong>${late}</strong><span>Atrasadas</span></div><div><strong>${done}</strong><span>Concluídas</span></div></div><div class="rdsv2-next"><div><span>PRÓXIMA</span><strong>${esc(next)}</strong><small>${esc(nextTime)}</small></div><button type="button" onclick="document.getElementById('routineStartBtn')?.click()" ${pending||late?'':'disabled'}>Iniciar →</button></div>`;
}

async function loadCorrections(){
  if(!O().ready||!DB()||loading)return;loading=true;
  try{
    if(isOperational()){
      const uid=P().user_id;
      const [nq,pq]=await Promise.all([
        DB().from('cp_nonconformities').select('id,store_id,title,description,severity,status,sector,treatment_notes,continuation_count,responsible_user_id,opened_at,correction_reported_at,correction_reported_by,correction_report_note').eq('responsible_user_id',uid).in('status',['open','in_action']).order('opened_at',{ascending:false}),
        DB().from('cp_action_plans').select('id,nonconformity_id,due_at,status,notes,responsible_user_id').eq('responsible_user_id',uid).in('status',['pending','in_progress']).order('due_at',{ascending:true})
      ]);
      if(nq.error)throw nq.error;if(pq.error)throw pq.error;myCorrections=nq.data||[];myPlans=pq.data||[];renderMyCorrections();ensureRoutineSummary();
    }
    if(isManagement()){
      const q=await DB().from('cp_nonconformities').select('id,correction_reported_at,correction_reported_by,correction_report_note,responsible_user_id,status').in('status',['open','in_action']).limit(500);
      if(q.error)throw q.error;managementNcMap=new Map((q.data||[]).map(x=>[x.id,x]));decorateManagementRows();
    }
  }catch(e){console.error('Triela correction flow',e);}finally{loading=false}
}
function planFor(id){return myPlans.find(p=>p.nonconformity_id===id)||null}
function severityLabel(s){return({low:'Baixa',medium:'Média',high:'Alta',critical:'Crítica'}[s]||s||'—')}

function renderMyCorrections(){
  if(!isOperational())return;
  const routine=document.getElementById('routine');if(!routine)return;
  let root=document.getElementById('myCorrectionsV2');
  if(!root){root=document.createElement('div');root.id='myCorrectionsV2';root.className='my-corrections-v2';const list=document.querySelector('#routine .routine-list-wrap');if(list)list.insertAdjacentElement('beforebegin',root);else routine.appendChild(root);}
  const open=myCorrections.filter(n=>!n.correction_reported_at),waiting=myCorrections.filter(n=>n.correction_reported_at);
  root.innerHTML=`<div class="mcv2-head"><div><span>MINHAS CORREÇÕES</span><strong>Itens encaminhados para você</strong><small>Corrija no setor e informe quando estiver pronto para conferência.</small></div><div class="mcv2-count"><b>${open.length}</b><span>para corrigir</span></div></div>${myCorrections.length?`<div class="mcv2-list">${myCorrections.map(correctionRow).join('')}</div>`:'<div class="mcv2-empty">Nenhuma correção atribuída a você agora.</div>'}`;
}
function correctionRow(n){
  const p=planFor(n.id),waiting=!!n.correction_reported_at,overdue=p?.due_at&&new Date(p.due_at)<new Date(),count=Number(n.continuation_count||0);
  return `<div class="mcv2-row ${waiting?'waiting':''} ${overdue&&!waiting?'overdue':''}"><div class="mcv2-flag ${esc(n.severity)}">!</div><div class="mcv2-main"><div class="mcv2-title"><strong>${esc(n.title)}</strong><span>${esc(severityLabel(n.severity))}</span></div><small>${esc(storeName(n.store_id))}${n.sector?` • ${esc(n.sector)}`:''}</small>${n.treatment_notes?`<p><b>Orientação:</b> ${esc(n.treatment_notes)}</p>`:''}${count?`<em>Já permaneceu não conforme ${count}x</em>`:''}</div><div class="mcv2-side">${p?.due_at?`<small class="${overdue&&!waiting?'late':''}">${overdue&&!waiting?'Prazo vencido':'Prazo'}: ${esc(fmt(p.due_at))}</small>`:''}${waiting?`<span class="mcv2-waiting">✓ Aguardando conferência</span><small>Informado em ${esc(fmt(n.correction_reported_at))}</small>`:`<button type="button" onclick="openCorrectionReport('${n.id}')">Informar que corrigi</button>`}</div></div>`;
}

function correctionModal(html){document.getElementById('correctionReportModal')?.remove();const b=document.createElement('div');b.id='correctionReportModal';b.className='correction-report-back';b.innerHTML=html;document.body.appendChild(b);return b}
window.closeCorrectionReport=()=>document.getElementById('correctionReportModal')?.remove();
window.openCorrectionReport=function(id){
  const n=myCorrections.find(x=>x.id===id);if(!n)return;
  correctionModal(`<div class="correction-report-modal"><div class="crm-head"><div><span>INFORMAR CORREÇÃO</span><h2>${esc(n.title)}</h2><p>Use esta opção somente depois de corrigir o problema no local.</p></div><button onclick="closeCorrectionReport()">×</button></div><div class="crm-body"><div class="crm-check"><b>✓</b><div><strong>Corrigi este item</strong><span>A gestão receberá a informação para conferir. A NC ainda não será encerrada.</span></div></div><label><span>O que foi feito?</span><textarea id="correctionReportNote" class="input" placeholder="Ex.: reorganizei a área, retirei os produtos irregulares e ajustei a identificação."></textarea></label><div class="crm-actions"><button class="btn secondary" onclick="closeCorrectionReport()">Cancelar</button><button class="btn" id="sendCorrectionReportBtn" onclick="submitCorrectionReport('${id}')">Enviar para conferência</button></div></div></div>`);
};
window.submitCorrectionReport=async function(id){
  const note=document.getElementById('correctionReportNote')?.value.trim()||null,btn=document.getElementById('sendCorrectionReportBtn');
  if(btn){btn.disabled=true;btn.textContent='Enviando...'}
  try{const {error}=await DB().rpc('cp_report_nonconformity_correction',{p_nonconformity_id:id,p_note:note});if(error)throw error;closeCorrectionReport();notify('Correção informada. Agora aguarda conferência da gestão.');await loadCorrections();}
  catch(e){notify(e.message||'Não foi possível informar a correção.');if(btn){btn.disabled=false;btn.textContent='Enviar para conferência'}}
};

function extractNcId(row){const b=row.querySelector('[onclick*="openNcVerification"]');if(!b)return null;const m=(b.getAttribute('onclick')||'').match(/openNcVerification\('([^']+)'\)/);return m?.[1]||null}
function decorateManagementRows(){
  if(!isManagement())return;
  document.querySelectorAll('#ncTreatmentCenter .nct-row').forEach(row=>{
    const id=extractNcId(row);if(!id)return;const n=managementNcMap.get(id);if(!n)return;
    row.classList.toggle('awaiting-validation',!!n.correction_reported_at);
    let badge=row.querySelector('.nct-awaiting-badge');
    if(n.correction_reported_at){
      if(!badge){badge=document.createElement('small');badge.className='nct-awaiting-badge';row.querySelector('.nct-state')?.prepend(badge);}
      badge.textContent='✓ Responsável informou correção';
      const verify=row.querySelector('[onclick*="openNcVerification"]');if(verify)verify.textContent='Validar correção';
    }else badge?.remove();
  });
  const waiting=[...managementNcMap.values()].filter(n=>n.correction_reported_at).length;
  const head=document.querySelector('#ncTreatmentCenter .nct-head');if(head){let chip=head.querySelector('.nct-waiting-summary');if(waiting){if(!chip){chip=document.createElement('div');chip.className='nct-waiting-summary';head.querySelector('div')?.appendChild(chip);}chip.textContent=`${waiting} aguardando validação`;}else chip?.remove();}
}

function wrapVerification(){
  const old=window.openNcVerification;if(typeof old!=='function'||old.__correctionV2)return;
  const w=function(id){const out=old.apply(this,arguments);setTimeout(()=>{const n=managementNcMap.get(id);if(!n?.correction_reported_at)return;const body=document.querySelector('#ncTreatmentModal .nctm-body');if(!body||body.querySelector('.nct-reported-box'))return;const box=document.createElement('div');box.className='nct-reported-box';box.innerHTML=`<div><span>RESPONSÁVEL INFORMOU CORREÇÃO</span><strong>${esc(fmt(n.correction_reported_at))}</strong></div>${n.correction_report_note?`<p>${esc(n.correction_report_note)}</p>`:'<p>Sem observação adicional.</p>'}`;body.prepend(box);},40);return out};w.__correctionV2=true;window.openNcVerification=w;
}

function operationalLanding(){
  if(!isOperational()||sessionStorage.getItem('trielaOperationalLandingV2'))return;
  const active=document.querySelector('.section.active')?.id;
  if(active==='overview'||active==='routine'){sessionStorage.setItem('trielaOperationalLandingV2','1');setTimeout(()=>window.navigate?.('routine'),80);}
}
function refresh(){ensureRoutineSummary();renderMyCorrections();decorateManagementRows();wrapVerification();operationalLanding()}
async function boot(){
  if(booted||!O().ready||!DB())return false;booted=true;wrapVerification();await loadCorrections();refresh();
  try{DB().channel('triela-correction-report-v2').on('postgres_changes',{event:'*',schema:'public',table:'cp_nonconformities'},()=>loadCorrections()).on('postgres_changes',{event:'*',schema:'public',table:'cp_action_plans'},()=>loadCorrections()).subscribe()}catch(_){ }
  return true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{let tries=0;const t=setInterval(async()=>{tries++;if(await boot()||tries>80)clearInterval(t)},250);});else{let tries=0;const t=setInterval(async()=>{tries++;if(await boot()||tries>80)clearInterval(t)},250);}
setInterval(()=>{if(O().ready){refresh();if(document.querySelector('#routine.section.active')||document.querySelector('#correct.section.active'))loadCorrections();}},12000);
window.addEventListener('focus',()=>{if(O().ready)setTimeout(loadCorrections,250)});
})();
