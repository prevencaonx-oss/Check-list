/* Triela Checklists — checklists designados + checklists abertos por loja */
(function(){
  'use strict';
  const O=()=>window.TRIELA_OFFICIAL||{};
  const DB=()=>O().supabase;
  const P=()=>O().profile;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
  const localDateKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  const todayKey=()=>localDateKey(new Date());
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  const isManagement=()=>['admin','manager'].includes(P()?.role);
  const isOperational=()=>P()?.role==='auditor';
  let openAccess=[],assignedSchedules=[],scheduledExecutions=[],routineTab='today',channel=null,initialized=false;
  let activeScheduleId=null;
  const originalStartRun=window.startRun;

  function addStyle(){if(document.getElementById('trielaOpenChecklistStyle'))return;const s=document.createElement('style');s.id='trielaOpenChecklistStyle';s.textContent=`
    .open-checklist-panel{margin-top:16px}.open-checklist-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}.open-checklist-head h2{margin:0}.open-checklist-list{display:grid;gap:10px}.open-checklist-row{display:flex;gap:14px;align-items:center;justify-content:space-between;padding:14px;border:1px solid #e4eaf2;border-radius:14px;background:#fff}.open-checklist-main{min-width:0}.open-checklist-main strong{display:block;color:#0b1f3a}.open-checklist-main span{display:block;margin-top:4px;font-size:12px;color:#718096}.open-checklist-badge{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;background:#e8fbf6;color:#087c68;font-size:11px;font-weight:800;white-space:nowrap}.open-routine-panel{margin-top:16px;padding:18px;border:1px solid #dce8f5;border-radius:16px;background:#f8fbff}.open-routine-panel h2{margin:0}.open-routine-panel .desc{margin:4px 0 14px}.open-routine-card{display:flex;align-items:center;gap:12px;justify-content:space-between;background:#fff;border:1px solid #e3eaf2;border-radius:14px;padding:14px;margin-top:9px}.open-routine-card .info{min-width:0}.open-routine-card .info strong{display:block}.open-routine-card .info span{display:block;font-size:12px;color:#718096;margin-top:4px}.open-type-choice{display:grid;grid-template-columns:1fr 1fr;gap:10px}.open-type-choice label{border:1px solid #dce4ee;border-radius:12px;padding:12px;cursor:pointer}.open-type-choice label:has(input:checked){border-color:#6558e8;background:#f2f0ff}.assign-template-btn.open-store-action{margin-left:6px}@media(max-width:720px){.open-checklist-row,.open-routine-card{align-items:flex-start;flex-direction:column}.open-type-choice{grid-template-columns:1fr}}
  `;document.head.appendChild(s);}

  function nameTemplate(id){return (state.templates||[]).find(t=>t.id===id)?.name||'Checklist';}
  function nameStore(id){return (state.units||[]).find(u=>u.id===id)?.name||'Loja';}
  function nameUser(id){return (state.users||[]).find(u=>u.userId===id)?.name||'Usuário';}

  async function loadData(){
    if(!O().ready||!DB())return;
    const [a,s,e]=await Promise.all([
      DB().from('cp_template_store_access').select('*').eq('is_active',true).order('created_at',{ascending:true}),
      DB().from('cp_inspection_schedules').select('*').eq('is_active',true).order('next_due_at',{ascending:true}),
      DB().from('cp_executions').select('id,schedule_id,status,completed_at,started_at,created_at,performed_by,store_id,template_id,environment').not('schedule_id','is',null).order('created_at',{ascending:false}).limit(2000)
    ]);
    if(!a.error)openAccess=a.data||[];if(!s.error)assignedSchedules=s.data||[];if(!e.error)scheduledExecutions=e.data||[];
    renderAll();
  }

  function dueForSchedule(s){
    const now=new Date(),time=(s.due_time||'23:59:00').slice(0,5),[hh,mm]=time.split(':').map(Number);
    if(s.recurrence==='daily'){const d=new Date(now);d.setHours(hh||0,mm||0,0,0);return d;}
    if(s.recurrence==='weekly'){
      const days=(s.days_of_week||[]).map(Number),targets=days.length?days:[new Date(s.next_due_at||s.created_at).getDay()];
      for(let add=0;add<8;add++){const d=new Date(now);d.setDate(now.getDate()+add);d.setHours(hh||0,mm||0,0,0);if(targets.includes(d.getDay()))return d;}
    }
    if(s.recurrence==='monthly'){
      const seed=new Date(s.next_due_at||s.created_at),day=seed.getDate();let d=new Date(now.getFullYear(),now.getMonth(),Math.min(day,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()),hh||0,mm||0);if(d<new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0))d=new Date(now.getFullYear(),now.getMonth()+1,Math.min(day,new Date(now.getFullYear(),now.getMonth()+2,0).getDate()),hh||0,mm||0);return d;
    }
    return new Date(s.next_due_at||s.created_at);
  }
  function completedInWindow(s){
    const env=state.ui?.mode==='training'?'training':'production',runs=scheduledExecutions.filter(e=>e.schedule_id===s.id&&e.status==='completed'&&e.environment===env);if(!runs.length)return false;const now=new Date();
    if(s.recurrence==='daily')return runs.some(e=>localDateKey(e.completed_at||e.created_at)===todayKey());
    if(s.recurrence==='weekly'){const start=new Date(now);start.setHours(0,0,0,0);start.setDate(now.getDate()-now.getDay());return runs.some(e=>new Date(e.completed_at||e.created_at)>=start);}
    if(s.recurrence==='monthly')return runs.some(e=>{const d=new Date(e.completed_at||e.created_at);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();});
    return runs.length>0;
  }
  function item(s){const due=dueForSchedule(s),done=completedInWindow(s),dueToday=localDateKey(due)===todayKey(),overdue=!done&&due<new Date();return {...s,due,done,dueToday,overdue};}

  function renderOperationalRoutine(){
    if(!isOperational())return;
    const mine=assignedSchedules.filter(s=>s.assigned_user_id===P().user_id).map(item),today=mine.filter(x=>x.dueToday||x.overdue),done=today.filter(x=>x.done),pending=today.filter(x=>!x.done),late=pending.filter(x=>x.overdue),future=mine.filter(x=>!x.done&&!x.dueToday&&!x.overdue).sort((a,b)=>a.due-b.due),pct=today.length?Math.round(done.length/today.length*100):0;
    const openRows=openAccess.filter(a=>(state.units||[]).some(u=>u.id===a.store_id&&u.active!==false));
    const next=[...pending,...future].sort((a,b)=>a.due-b.due)[0];const firstOpen=openRows.find(a=>(state.templates||[]).some(t=>t.id===a.template_id));
    if(next){const t=(state.templates||[]).find(x=>x.id===next.template_id);document.getElementById('routineNextTime').textContent=next.due.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});document.getElementById('routineNextName').textContent=t?.name||'Atividade designada';document.getElementById('routineNextMeta').textContent=`${nameStore(next.store_id)} • Designada para você`;document.getElementById('routineQuestions').textContent=String(t?.questions?.length||0);document.getElementById('routineMinutes').textContent=String(t?.estimatedMinutes||10);const b=document.getElementById('routineStartBtn');if(b){b.disabled=false;b.textContent=next.overdue?'Iniciar atividade atrasada →':'Iniciar atividade →';b.onclick=()=>startScheduledRun(next.template_id,next.id,next.store_id);}}
    else if(firstOpen){const t=(state.templates||[]).find(x=>x.id===firstOpen.template_id);document.getElementById('routineNextTime').textContent='Livre';document.getElementById('routineNextName').textContent=t?.name||'Checklist aberto';document.getElementById('routineNextMeta').textContent=`${nameStore(firstOpen.store_id)} • Aberto para qualquer operacional da loja`;document.getElementById('routineQuestions').textContent=String(t?.questions?.length||0);document.getElementById('routineMinutes').textContent=String(t?.estimatedMinutes||10);const b=document.getElementById('routineStartBtn');if(b){b.disabled=false;b.textContent='Executar checklist aberto →';b.onclick=()=>startRun(firstOpen.template_id);}}
    else{document.getElementById('routineNextTime').textContent='—';document.getElementById('routineNextName').textContent=mine.length?'Tudo concluído por agora':'Nenhuma atividade disponível';document.getElementById('routineNextMeta').textContent=mine.length?'Sua rotina pessoal está em dia.':'Quando houver uma atividade ou checklist aberto, ele aparecerá aqui.';document.getElementById('routineQuestions').textContent='0';document.getElementById('routineMinutes').textContent='0';const b=document.getElementById('routineStartBtn');if(b){b.disabled=true;b.textContent='Sem atividades';}}
    const donut=document.getElementById('routineDonut');if(donut)donut.style.setProperty('--p',`${clamp(pct)}%`);const pe=document.getElementById('routinePct');if(pe)pe.textContent=`${pct}%`;const de=document.getElementById('routineDone');if(de)de.textContent=String(done.length);const pp=document.getElementById('routinePending');if(pp)pp.textContent=String(pending.length);const le=document.getElementById('routineLate');if(le)le.textContent=String(late.length);document.querySelectorAll('.navbtn[data-page="routine"] .navbadge').forEach(b=>{b.textContent=String(pending.length);b.style.display=pending.length?'':'none';});
    let rows=routineTab==='done'?mine.filter(x=>x.done):routineTab==='next'?future:today;const list=document.getElementById('routineList');if(list)list.innerHTML=rows.length?rows.sort((a,b)=>a.due-b.due).map(x=>{const t=(state.templates||[]).find(v=>v.id===x.template_id),status=x.done?'Concluída':x.overdue?'Atrasada':'Pendente';return `<div class="routine-assigned-row"><div class="activity-time">${x.due.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div><div class="routine-assigned-main"><strong>${esc(t?.name||'Atividade')}</strong><span>${esc(nameStore(x.store_id))} • Designada para você</span></div><span class="activity-status ${x.done?'running':x.overdue?'late':'pending'}">● ${status}</span>${!x.done?`<button class="btn light" onclick="startScheduledRun('${x.template_id}','${x.id}','${x.store_id}')">Executar</button>`:''}</div>`;}).join(''):'<div class="routine-empty-official">Nenhuma atividade nesta lista.</div>';
    document.querySelectorAll('.routine-tabs button').forEach((b,i)=>b.classList.toggle('active',['today','next','done'][i]===routineTab));
    renderOpenRoutine(openRows);
  }

  function renderOpenRoutine(rows){
    const wrap=document.querySelector('#routine .routine-list-wrap');if(!wrap)return;let panel=document.getElementById('openChecklistRoutinePanel');if(!panel){panel=document.createElement('div');panel.id='openChecklistRoutinePanel';panel.className='open-routine-panel';wrap.insertAdjacentElement('afterend',panel);}panel.innerHTML=`<div class="open-checklist-head"><div><h2>Checklists abertos da sua loja</h2><p class="desc">Controles disponíveis para qualquer operacional autorizado. Eles não contam como pendência pessoal.</p></div><span class="open-checklist-badge">${rows.length} disponível${rows.length===1?'':'eis'}</span></div>${rows.length?rows.map(a=>{const t=(state.templates||[]).find(x=>x.id===a.template_id);return `<div class="open-routine-card"><div class="info"><strong>${esc(t?.name||'Checklist')}</strong><span>${esc(nameStore(a.store_id))} • ${esc(t?.category||'Operação')} • execução sob demanda</span></div><button class="btn light" onclick="startRun('${a.template_id}')">Executar agora</button></div>`;}).join(''):'<div class="routine-empty-official">Nenhum checklist aberto para sua loja.</div>'}`;
  }
  window.setRoutineTab=function(tab){routineTab=tab;if(isOperational())renderOperationalRoutine();};

  function renderManagement(){
    if(!isManagement())return;const execute=document.getElementById('execute');if(!execute)return;
    let panel=document.getElementById('openChecklistManagementPanel');if(!panel){panel=document.createElement('div');panel.id='openChecklistManagementPanel';panel.className='panel open-checklist-panel';const assigned=document.getElementById('officialAssignmentsPanel');(assigned||document.getElementById('executeCards'))?.insertAdjacentElement('afterend',panel);}
    panel.innerHTML=`<div class="open-checklist-head"><div><h2>Checklists abertos por loja</h2><p class="desc">Disponibilize controles que qualquer operacional daquela loja poderá executar quando necessário.</p></div><button class="btn" onclick="openOpenChecklistModal('')">+ Abrir checklist para loja</button></div><div class="open-checklist-list">${openAccess.length?openAccess.map(a=>`<div class="open-checklist-row"><div class="open-checklist-main"><strong>${esc(nameTemplate(a.template_id))}</strong><span>${esc(nameStore(a.store_id))} • qualquer operacional autorizado da loja</span></div><div style="display:flex;gap:8px;align-items:center"><span class="open-checklist-badge">● Aberto</span><button class="mini-action danger-text" onclick="closeOpenChecklist('${a.id}')">Fechar acesso</button></div></div>`).join(''):'<div class="structure-empty"><strong>Nenhum checklist aberto</strong><span>Use esta opção para deixar um checklist disponível sem designar uma pessoa específica.</span></div>'}</div>`;
    document.querySelectorAll('#executeCards .template').forEach((card,i)=>{const t=(state.templates||[])[i];if(!t||card.querySelector('.open-store-action'))return;const b=document.createElement('button');b.className='btn secondary assign-template-btn open-store-action';b.textContent='Abrir para loja';b.onclick=()=>openOpenChecklistModal(t.id);card.appendChild(b);});
    document.querySelectorAll('#executeCards .assign-template-btn:not(.open-store-action)').forEach(b=>{if(b.textContent.trim()==='Designar atividade')b.textContent='Designar para usuário';});
  }

  window.openOpenChecklistModal=function(templateId=''){
    if(!isManagement())return notify('Somente Administração/Gestão pode disponibilizar checklists.');const templates=state.templates||[],units=(state.units||[]).filter(u=>u.active!==false);if(!templates.length)return notify('Crie um checklist primeiro.');if(!units.length)return notify('Cadastre uma loja primeiro.');document.getElementById('structureModal')?.remove();const back=document.createElement('div');back.id='structureModal';back.className='structure-modal-back';back.innerHTML=`<div class="structure-modal"><div class="structure-modal-head"><div><h2>Abrir checklist para uma loja</h2><p>Qualquer usuário operacional autorizado na unidade escolhida poderá executar este checklist.</p></div><button class="structure-close" onclick="closeStructureModal()">×</button></div><div class="structure-modal-body"><div class="field"><label>Checklist</label><select class="input" id="openChecklistTemplate">${templates.map(t=>`<option value="${t.id}" ${t.id===templateId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Loja / unidade</label><select class="input" id="openChecklistStore">${units.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div><div class="structure-note"><strong>Como funciona:</strong> este checklist não será uma pendência individual. Ele aparecerá como “Checklist aberto” para os operacionais desta loja e poderá ser executado sob demanda. Usuários de outras lojas não terão acesso.</div></div><div class="structure-modal-foot"><button class="btn secondary" onclick="closeStructureModal()">Cancelar</button><button class="btn" id="saveOpenChecklistBtn" onclick="saveOpenChecklist()">Disponibilizar</button></div></div>`;document.body.appendChild(back);
  };
  window.saveOpenChecklist=async function(){const btn=document.getElementById('saveOpenChecklistBtn');if(btn)btn.disabled=true;try{const template_id=document.getElementById('openChecklistTemplate')?.value,store_id=document.getElementById('openChecklistStore')?.value;if(!template_id||!store_id)throw new Error('Selecione checklist e loja.');const existing=openAccess.find(a=>a.template_id===template_id&&a.store_id===store_id);let q;if(existing)q=await DB().from('cp_template_store_access').update({is_active:true,access_mode:'open',updated_at:new Date().toISOString()}).eq('id',existing.id);else q=await DB().from('cp_template_store_access').insert({organization_id:P().organization_id,template_id,store_id,access_mode:'open',is_active:true,created_by:P().user_id});if(q.error)throw q.error;closeStructureModal();notify('Checklist aberto para a loja.');await loadData();}catch(e){notify(e.message||'Não foi possível disponibilizar o checklist.');if(btn)btn.disabled=false;}};
  window.closeOpenChecklist=async function(id){if(!confirm('Fechar este checklist para a loja? As execuções já realizadas serão preservadas.'))return;const {error}=await DB().from('cp_template_store_access').update({is_active:false,updated_at:new Date().toISOString()}).eq('id',id);if(error)return notify(error.message);notify('Acesso aberto encerrado.');await loadData();};

  window.startScheduledRun=function(templateId,scheduleId,storeId){activeScheduleId=scheduleId;if(typeof originalStartRun!=='function')return notify('Execução indisponível.');originalStartRun(templateId);setTimeout(()=>{const s=document.getElementById('officialRunStore');if(s){s.value=storeId;if(s.tagName==='SELECT')s.disabled=true;}},0);};
  window.startRun=function(templateId){activeScheduleId=null;if(typeof originalStartRun==='function')return originalStartRun(templateId);};

  window.finishRun=async function(t,answers){
    const db=DB(),p=P(),btn=document.getElementById('finishBtn');if(btn){btn.disabled=true;btn.textContent='Salvando na nuvem...';}
    try{
      for(const q of t.questions){const el=document.querySelector(`[data-input-q='${q.id}']`);if(el){const val=el.type==='file'?(el.files?.[0]?.name||''):el.value;let ok=true;if(q.type==='number'&&q.critical==='critical'&&val!==''&&Math.abs(Number(val))>10)ok=false;if(q.type==='score'&&val!==''&&Number(val)<7)ok=false;answers[q.id]={value:val,ok};}}
      const missing=t.questions.filter(q=>q.required!==false&&(answers[q.id]?.value===undefined||answers[q.id]?.value===''));if(missing.length)throw new Error(`Responda todas as perguntas obrigatórias. Faltam ${missing.length}.`);
      const list=t.questions.map(q=>({qid:q.id,ok:answers[q.id]?.ok!==false,label:answers[q.id]?.value??''})),bad=list.filter(a=>!a.ok),compliance=t.questions.length?Math.round((t.questions.length-bad.length)/t.questions.length*100):100,store_id=document.getElementById('officialRunStore')?.value,environment=state.ui?.mode==='training'?'training':'production',now=new Date().toISOString();if(!store_id)throw new Error('Loja da execução não identificada.');
      const payload={organization_id:p.organization_id,store_id,template_id:t.id,environment,status:'completed',started_at:now,completed_at:now,performed_by:p.user_id,score:compliance,...(activeScheduleId?{schedule_id:activeScheduleId}:{})};const {data:execution,error:eError}=await db.from('cp_executions').insert(payload).select().single();if(eError)throw eError;
      const rows=t.questions.map(q=>{const a=answers[q.id]||{},row={organization_id:p.organization_id,execution_id:execution.id,item_id:q.id,is_na:false,is_compliant:a.ok!==false,notes:null,responded_by:p.user_id};if(q.type==='number'||q.type==='score')row.value_number=a.value===''?null:Number(a.value);else row.value_text=String(a.value??'');return row;});const {data:savedResponses,error:rError}=await db.from('cp_responses').insert(rows).select('id,item_id');if(rError)throw rError;
      if(bad.length){const responseIdByItem=Object.fromEntries((savedResponses||[]).map(r=>[r.item_id,r.id]));const ncRows=bad.map(a=>{const q=t.questions.find(x=>x.id===a.qid);return {organization_id:p.organization_id,store_id,execution_id:execution.id,response_id:responseIdByItem[a.qid]||null,item_id:a.qid,environment,title:q?.title||'Não conformidade',description:`Resposta: ${a.label||'—'}`,severity:q?.critical||'medium',status:'open',opened_by:p.user_id,opened_at:now};});const {data:savedNc,error:nError}=await db.from('cp_nonconformities').insert(ncRows).select('*');if(nError)throw nError;const actionRows=(savedNc||[]).filter(n=>t.questions.find(q=>q.id===n.item_id)?.action!==false).map(n=>({organization_id:p.organization_id,store_id,nonconformity_id:n.id,environment,action_text:`Corrigir: ${n.title}`,responsible_user_id:null,due_at:new Date(Date.now()+48*3600000).toISOString(),status:'pending',created_by:p.user_id}));if(actionRows.length){const aq=await db.from('cp_action_plans').insert(actionRows);if(aq.error)throw aq.error;}}
      if(typeof closeModal==='function')closeModal();activeScheduleId=null;notify(environment==='training'?`Treinamento salvo: ${compliance}% · ${bad.length} NC simuladas.`:`Checklist salvo: ${compliance}% de conformidade${bad.length?` · ${bad.length} NC`:''}.`);await loadData();window.dispatchEvent(new Event('focus'));
    }catch(e){notify(e.message||'Não foi possível salvar o checklist.');if(btn){btn.disabled=false;btn.textContent='Finalizar checklist';}}
  };

  function renderAll(){addStyle();renderManagement();renderOperationalRoutine();}
  const previousRender=window.render;window.render=function(){previousRender();if(O().ready)setTimeout(renderAll,0);};
  async function init(){if(initialized||!O().ready||!DB())return;initialized=true;addStyle();await loadData();window.addEventListener('focus',()=>setTimeout(loadData,80));try{channel=DB().channel('triela-open-checklists').on('postgres_changes',{event:'*',schema:'public',table:'cp_template_store_access'},()=>setTimeout(loadData,40)).on('postgres_changes',{event:'*',schema:'public',table:'cp_inspection_schedules'},()=>setTimeout(loadData,40)).on('postgres_changes',{event:'*',schema:'public',table:'cp_executions'},()=>setTimeout(loadData,80)).subscribe();}catch{}}
  const timer=setInterval(()=>{if(O().ready){clearInterval(timer);init();}},300);
})();
