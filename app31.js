/* Triela Checklists — tratamento de não conformidades V1 */
(function(){
'use strict';
const O=()=>window.TRIELA_OFFICIAL||{};
const DB=()=>O().supabase;
const P=()=>O().profile||{};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
const isManagement=()=>['admin','manager'].includes(P().role);
let ncs=[],plans=[],reviews=[],loading=false,filter='active';
const userName=id=>(window.state?.users||[]).find(u=>u.userId===id)?.name||'Não atribuído';
const storeName=id=>(window.state?.units||[]).find(u=>u.id===id)?.name||'Unidade';
const severityLabel=s=>({low:'Baixa',medium:'Média',high:'Alta',critical:'Crítica'}[s]||s||'—');
const statusLabel=s=>({open:'Aberta',in_action:'Em tratamento',resolved:'Resolvida',cancelled:'Cancelada'}[s]||s||'—');
const fmt=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
function modal(html){document.getElementById('ncTreatmentModal')?.remove();const b=document.createElement('div');b.id='ncTreatmentModal';b.className='nc-treatment-back';b.innerHTML=html;document.body.appendChild(b);return b}
window.closeNcTreatmentModal=()=>document.getElementById('ncTreatmentModal')?.remove();

async function load(){
 if(!isManagement()||!O().ready||!DB()||loading)return;loading=true;
 try{
  const [nq,pq,rq]=await Promise.all([
   DB().from('cp_nonconformities').select('*').eq('environment',window.state?.ui?.mode==='training'?'training':'production').order('opened_at',{ascending:false}).limit(500),
   DB().from('cp_action_plans').select('*').eq('environment',window.state?.ui?.mode==='training'?'training':'production').order('created_at',{ascending:false}).limit(1000),
   DB().from('cp_nonconformity_reviews').select('*').order('created_at',{ascending:false}).limit(1000)
  ]);
  const err=nq.error||pq.error||rq.error;if(err)throw err;ncs=nq.data||[];plans=pq.data||[];reviews=rq.data||[];render();
 }catch(e){console.error('Triela NC treatment',e);}
 finally{loading=false}
}
function actionFor(ncId){return plans.find(a=>a.nonconformity_id===ncId&&a.status!=='cancelled')||null}
function ensureRoot(){
 const sec=document.getElementById('correct');if(!sec||!isManagement())return null;
 let root=document.getElementById('ncTreatmentCenter');if(!root){root=document.createElement('div');root.id='ncTreatmentCenter';root.className='nc-treatment-center';const headline=sec.querySelector('.headline');if(headline)headline.insertAdjacentElement('afterend',root);else sec.prepend(root)}return root;
}
function matches(n){if(filter==='active')return ['open','in_action'].includes(n.status);if(filter==='resolved')return n.status==='resolved';if(filter==='continued')return Number(n.continuation_count||0)>0&&n.status!=='resolved';return true}
function render(){
 const root=ensureRoot();if(!root)return;
 const open=ncs.filter(n=>n.status==='open').length,treat=ncs.filter(n=>n.status==='in_action').length,continued=ncs.filter(n=>Number(n.continuation_count||0)>0&&n.status!=='resolved').length,resolved=ncs.filter(n=>n.status==='resolved').length;
 const rows=ncs.filter(matches);
 root.innerHTML=`<div class="nct-head"><div><div class="eyebrow">TRATAMENTO DE DESVIOS</div><h2>Não conformidades</h2><p>Encaminhe ao responsável, acompanhe a correção e valide se o problema foi realmente resolvido.</p></div><button class="btn secondary" onclick="refreshNcTreatment()">↻ Atualizar</button></div>
 <div class="nct-kpis"><div><span>Abertas</span><strong>${open}</strong></div><div><span>Em tratamento</span><strong>${treat}</strong></div><div><span>Continuam NC</span><strong>${continued}</strong></div><div><span>Resolvidas</span><strong>${resolved}</strong></div></div>
 <div class="nct-tabs"><button class="${filter==='active'?'active':''}" onclick="setNcTreatmentFilter('active')">Pendentes</button><button class="${filter==='continued'?'active':''}" onclick="setNcTreatmentFilter('continued')">Continuam NC</button><button class="${filter==='resolved'?'active':''}" onclick="setNcTreatmentFilter('resolved')">Resolvidas</button><button class="${filter==='all'?'active':''}" onclick="setNcTreatmentFilter('all')">Todas</button></div>
 <div class="nct-list">${rows.length?rows.map(rowHtml).join(''):'<div class="nct-empty">Nenhuma não conformidade nesta situação.</div>'}</div>`;
}
function rowHtml(n){
 const a=actionFor(n.id),responsible=n.responsible_user_id||a?.responsible_user_id,last=reviews.find(r=>r.nonconformity_id===n.id),continued=Number(n.continuation_count||0);
 return `<div class="nct-row ${esc(n.status)}"><div class="nct-main"><div class="nct-title"><span class="nct-severity ${esc(n.severity)}">${esc(severityLabel(n.severity))}</span><strong>${esc(n.title)}</strong></div><small>${esc(storeName(n.store_id))}${n.sector?` • ${esc(n.sector)}`:''} • aberta em ${esc(fmt(n.opened_at))}</small>${n.description?`<p>${esc(n.description)}</p>`:''}</div><div class="nct-owner"><span>Responsável</span><strong>${esc(userName(responsible))}</strong><small>${a?.due_at?`Prazo: ${esc(fmt(a.due_at))}`:'Sem prazo definido'}</small></div><div class="nct-state"><span class="nct-status ${esc(n.status)}">${esc(statusLabel(n.status))}</span>${continued?`<small class="nct-recurrence">Continua NC ${continued}x</small>`:''}${last?`<small>Última verificação: ${esc(fmt(last.created_at))}</small>`:''}</div><div class="nct-actions">${n.status!=='resolved'&&n.status!=='cancelled'?`<button onclick="openNcAssignment('${n.id}')">${responsible?'Alterar responsável':'Encaminhar'}</button><button class="verify" onclick="openNcVerification('${n.id}')">Verificar correção</button>`:''}<button onclick="openNcHistory('${n.id}')">Histórico</button></div></div>`;
}
window.setNcTreatmentFilter=f=>{filter=f;render()};window.refreshNcTreatment=()=>load();

window.openNcAssignment=function(id){
 const n=ncs.find(x=>x.id===id);if(!n)return;const a=actionFor(id),users=(window.state?.users||[]).filter(u=>u.active!==false&&u.userId);
 const current=n.responsible_user_id||a?.responsible_user_id||'';const due=a?.due_at?new Date(a.due_at):new Date(Date.now()+48*3600000);const local=new Date(due.getTime()-due.getTimezoneOffset()*60000).toISOString().slice(0,16);
 modal(`<div class="nc-treatment-modal"><div class="nctm-head"><div><div class="eyebrow">ENCAMINHAR NÃO CONFORMIDADE</div><h2>${esc(n.title)}</h2><p>Defina quem vai tratar o problema e até quando.</p></div><button onclick="closeNcTreatmentModal()">×</button></div><div class="nctm-body"><label><span>Responsável / encarregado</span><select id="nctResponsible" class="input"><option value="">Selecione...</option>${users.map(u=>`<option value="${u.userId}" ${u.userId===current?'selected':''}>${esc(u.name)}${u.sector?` — ${esc(u.sector)}`:''}</option>`).join('')}</select></label><div class="nctm-grid"><label><span>Setor</span><input id="nctSector" class="input" value="${esc(n.sector||'')}" placeholder="Ex.: FLV, Açougue, Depósito"></label><label><span>Prazo</span><input id="nctDue" type="datetime-local" class="input" value="${local}"></label></div><label><span>Orientação para correção</span><textarea id="nctNote" class="input" placeholder="Ex.: retirar produto, reorganizar área e avisar para nova conferência">${esc(n.treatment_notes||'')}</textarea></label><div class="nctm-actions"><button class="btn secondary" onclick="closeNcTreatmentModal()">Cancelar</button><button class="btn" id="nctAssignBtn" onclick="saveNcAssignment('${id}')">Encaminhar</button></div></div></div>`);
};
window.saveNcAssignment=async function(id){
 const responsible=document.getElementById('nctResponsible')?.value,sector=document.getElementById('nctSector')?.value.trim()||null,note=document.getElementById('nctNote')?.value.trim()||null,due=document.getElementById('nctDue')?.value,btn=document.getElementById('nctAssignBtn');if(!responsible)return notify('Selecione o responsável.');if(btn){btn.disabled=true;btn.textContent='Salvando...'}
 try{const {error}=await DB().rpc('cp_assign_nonconformity',{p_nonconformity_id:id,p_responsible_user_id:responsible,p_sector:sector,p_note:note,p_due_at:due?new Date(due).toISOString():null});if(error)throw error;closeNcTreatmentModal();notify('Não conformidade encaminhada para tratamento.');await load()}catch(e){notify(e.message||'Não foi possível encaminhar.');if(btn){btn.disabled=false;btn.textContent='Encaminhar'}}
};

window.openNcVerification=function(id){
 const n=ncs.find(x=>x.id===id);if(!n)return;const responsible=n.responsible_user_id||actionFor(id)?.responsible_user_id;
 modal(`<div class="nc-treatment-modal verify"><div class="nctm-head"><div><div class="eyebrow">VALIDAR CORREÇÃO</div><h2>${esc(n.title)}</h2><p>Confira o item no local e registre o resultado real.</p></div><button onclick="closeNcTreatmentModal()">×</button></div><div class="nctm-body"><div class="nct-verify-summary"><span>Responsável</span><strong>${esc(userName(responsible))}</strong><small>${esc(storeName(n.store_id))}${n.sector?` • ${esc(n.sector)}`:''}</small></div><label><span>Observação da conferência</span><textarea id="nctVerifyNote" class="input" placeholder="Ex.: conferido no setor, item reorganizado e dentro do padrão"></textarea></label><div class="nct-verify-buttons"><button class="resolved" onclick="submitNcVerification('${id}','resolved')"><b>✓</b><span><strong>Foi corrigido</strong><small>Encerrar a não conformidade como resolvida</small></span></button><button class="remains" onclick="submitNcVerification('${id}','remains_nonconforming')"><b>!</b><span><strong>Continua em não conformidade</strong><small>Manter aberta e registrar nova verificação</small></span></button></div></div></div>`);
};
window.submitNcVerification=async function(id,outcome){
 const note=document.getElementById('nctVerifyNote')?.value.trim()||null;const msg=outcome==='resolved'?'Confirmar que este item foi corrigido?':'Confirmar que o problema continua em não conformidade?';if(!confirm(msg))return;
 try{const {error}=await DB().rpc('cp_verify_nonconformity',{p_nonconformity_id:id,p_outcome:outcome,p_note:note});if(error)throw error;closeNcTreatmentModal();notify(outcome==='resolved'?'Não conformidade encerrada como corrigida.':'Registro salvo: continua em não conformidade.');await load()}catch(e){notify(e.message||'Não foi possível registrar a verificação.')}
};

window.openNcHistory=function(id){
 const n=ncs.find(x=>x.id===id);if(!n)return;const rs=reviews.filter(r=>r.nonconformity_id===id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 modal(`<div class="nc-treatment-modal history"><div class="nctm-head"><div><div class="eyebrow">HISTÓRICO DA NÃO CONFORMIDADE</div><h2>${esc(n.title)}</h2><p>${esc(statusLabel(n.status))} • ${esc(storeName(n.store_id))}</p></div><button onclick="closeNcTreatmentModal()">×</button></div><div class="nctm-body"><div class="nct-history-top"><div><span>Responsável atual</span><strong>${esc(userName(n.responsible_user_id||actionFor(id)?.responsible_user_id))}</strong></div><div><span>Continuidade</span><strong>${Number(n.continuation_count||0)}x continua NC</strong></div></div><div class="nct-history">${rs.length?rs.map(r=>`<div class="nct-history-row"><span class="dot ${r.outcome==='resolved'?'ok':'bad'}"></span><div><strong>${r.outcome==='resolved'?'Marcado como corrigido':'Permaneceu em não conformidade'}</strong><small>${esc(fmt(r.created_at))} • verificado por ${esc(userName(r.verified_by))}</small>${r.note?`<p>${esc(r.note)}</p>`:''}</div></div>`).join(''):'<div class="nct-empty">Ainda não houve verificação registrada.</div>'}</div></div></div>`);
};

function boot(){if(!isManagement())return;load();const oldNavigate=window.navigate;if(typeof oldNavigate==='function'&&!oldNavigate.__ncWrapped){const w=function(page){const r=oldNavigate.apply(this,arguments);if(page==='correct')setTimeout(load,80);return r};w.__ncWrapped=true;window.navigate=w;}try{DB()?.channel('triela-nc-treatment').on('postgres_changes',{event:'*',schema:'public',table:'cp_nonconformities'},()=>load()).on('postgres_changes',{event:'*',schema:'public',table:'cp_nonconformity_reviews'},()=>load()).subscribe()}catch(_){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(boot,900)});else setTimeout(boot,900);setInterval(()=>{if(isManagement()&&document.querySelector('#correct.section.active'))load()},15000);
})();
