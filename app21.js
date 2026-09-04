/* Triela Checklists — programação avançada + múltiplos usuários aptos */
(function(){
  'use strict';
  const O=()=>window.TRIELA_OFFICIAL||{};
  const DB=()=>O().supabase;
  const P=()=>O().profile;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
  const isManagement=()=>['admin','manager'].includes(P()?.role);
  const isOperational=()=>P()?.role==='auditor';
  const roleOf=u=>(state.roles||[]).find(r=>r.id===u?.roleId);
  const localDateKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  const todayKey=()=>localDateKey(new Date());
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  const nameTemplate=id=>(state.templates||[]).find(t=>t.id===id)?.name||'Checklist';
  const nameStore=id=>(state.units||[]).find(u=>u.id===id)?.name||'Loja';
  const nameUser=id=>(state.users||[]).find(u=>u.userId===id)?.name||'Usuário';
  let schedules=[],assignees=[],executions=[],initialized=false,channel=null,routineTab='today';

  function addStyle(){
    if(document.getElementById('trielaAdvancedScheduleStyle'))return;
    const s=document.createElement('style');s.id='trielaAdvancedScheduleStyle';s.textContent=`
      .sched-user-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:210px;overflow:auto;padding:4px}
      .sched-user{display:flex;gap:9px;align-items:center;border:1px solid #dfe7f1;border-radius:12px;padding:10px 11px;background:#fff;cursor:pointer}
      .sched-user:has(input:checked){border-color:#6558e8;background:#f4f2ff}.sched-user input{accent-color:#5b4de8}
      .sched-user span{display:block;font-size:12px;color:#0b1f3a}.sched-user small{display:block;color:#7b8798;font-size:10px;margin-top:2px}
      .sched-days{display:flex;gap:6px;flex-wrap:wrap}.sched-day{display:flex;align-items:center;justify-content:center;width:42px;height:38px;border:1px solid #dfe7f1;border-radius:10px;background:#fff;font-size:11px;font-weight:800;cursor:pointer}
      .sched-day:has(input:checked){border-color:#6558e8;background:#5b4de8;color:#fff}.sched-day input{display:none}
      .schedule-mode-banner{border:1px solid #d9e5f4;background:#f7fbff;border-radius:14px;padding:13px 14px;margin-bottom:14px;display:flex;justify-content:space-between;gap:12px;align-items:center}
      .schedule-mode-banner strong{display:block;color:#0b1f3a;font-size:12px}.schedule-mode-banner span{display:block;color:#64748b;font-size:11px;margin-top:3px}
      .assignment-row-v2{display:grid;grid-template-columns:minmax(220px,1fr) minmax(220px,.9fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid #e4eaf2;border-radius:14px;background:#fff;margin-top:9px}
      .assignment-row-v2 strong{display:block}.assignment-row-v2 span,.assignment-row-v2 small{display:block;color:#6b7a90;font-size:11px;margin-top:4px}
      .schedule-window{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.schedule-chip{display:inline-flex!important;padding:5px 8px;border-radius:999px;background:#eef4fb;color:#29415f!important;font-size:10px!important;font-weight:800}
      .routine-assigned-row.multi-ready{border-left:3px solid #5b4de8}.routine-assigned-main em{display:block;font-size:10px;color:#6d5ce8;font-style:normal;font-weight:800;margin-top:4px}
      @media(max-width:760px){.sched-user-grid{grid-template-columns:1fr}.assignment-row-v2{grid-template-columns:1fr}.schedule-mode-banner{align-items:flex-start;flex-direction:column}}
    `;document.head.appendChild(s);
  }

  function assigneeIds(scheduleId){
    const ids=assignees.filter(a=>a.schedule_id===scheduleId).map(a=>a.user_id);
    const s=schedules.find(x=>x.id===scheduleId);
    if(s?.assigned_user_id&&!ids.includes(s.assigned_user_id))ids.push(s.assigned_user_id);
    return ids;
  }
  function eligibleForMe(s){return assigneeIds(s.id).includes(P()?.user_id);}
  function recurrenceLabel(r){return ({on_demand:'Uma vez',daily:'Diária',weekly:'Dias da semana',biweekly:'Quinzenal',monthly:'Mensal'})[r]||r||'Programada';}
  function formatTime(v){return v?String(v).slice(0,5):'—';}
  function parseLocal(date,time='00:00'){return new Date(`${date}T${String(time).slice(0,5)}:00`);}
  function endOfWindow(due,grace){const d=new Date(due);d.setMinutes(d.getMinutes()+Number(grace||0));return d;}
  function daysText(days){const n=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];return (days||[]).map(x=>n[Number(x)]).filter(Boolean).join(', ');}

  function periodStart(s,now=new Date()){
    if(s.recurrence==='daily'){const d=new Date(now);d.setHours(0,0,0,0);return d;}
    if(s.recurrence==='weekly'){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-d.getDay());return d;}
    if(s.recurrence==='biweekly'){
      const anchor=new Date(`${s.valid_from||localDateKey(new Date(s.next_due_at||s.created_at))}T00:00:00`);
      const diff=Math.max(0,Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate())-anchor)/86400000));
      const block=Math.floor(diff/14)*14;const d=new Date(anchor);d.setDate(anchor.getDate()+block);return d;
    }
    if(s.recurrence==='monthly'){return new Date(now.getFullYear(),now.getMonth(),1);}
    return new Date(0);
  }
  function completedInWindow(s){
    const rows=executions.filter(e=>e.schedule_id===s.id&&e.status==='completed'&&e.environment===(state.ui?.mode==='training'?'training':'production'));
    if(!rows.length)return false;
    if(s.recurrence==='on_demand')return true;
    const start=periodStart(s);
    let end;
    if(s.recurrence==='daily'){end=new Date(start);end.setDate(end.getDate()+1);}
    else if(s.recurrence==='weekly'){end=new Date(start);end.setDate(end.getDate()+7);}
    else if(s.recurrence==='biweekly'){end=new Date(start);end.setDate(end.getDate()+14);}
    else if(s.recurrence==='monthly'){end=new Date(start.getFullYear(),start.getMonth()+1,1);}
    else end=new Date(8640000000000000);
    return rows.some(e=>{const d=new Date(e.completed_at||e.created_at);return d>=start&&d<end;});
  }

  function dueFor(s){
    const now=new Date(),dueTime=formatTime(s.due_time||'23:59'),from=s.valid_from||localDateKey(new Date(s.next_due_at||s.created_at||now));
    if(s.recurrence==='on_demand')return parseLocal(from,dueTime);
    if(s.recurrence==='daily'){
      const date=localDateKey(now)<from?from:localDateKey(now);return parseLocal(date,dueTime);
    }
    if(s.recurrence==='weekly'){
      const wanted=(s.days_of_week||[]).map(Number),base=new Date(Math.max(new Date(from+'T00:00:00').getTime(),new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()));
      for(let i=0;i<14;i++){const d=new Date(base);d.setDate(base.getDate()+i);if(!wanted.length||wanted.includes(d.getDay()))return parseLocal(localDateKey(d),dueTime);}
    }
    if(s.recurrence==='biweekly'){
      const anchor=new Date(from+'T00:00:00');let d=new Date(anchor);
      while(d<new Date(now.getFullYear(),now.getMonth(),now.getDate()))d.setDate(d.getDate()+14);
      return parseLocal(localDateKey(d),dueTime);
    }
    if(s.recurrence==='monthly'){
      const anchor=new Date(from+'T00:00:00'),day=anchor.getDate();
      let d=new Date(now.getFullYear(),now.getMonth(),Math.min(day,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()));
      if(d<new Date(now.getFullYear(),now.getMonth(),now.getDate()))d=new Date(now.getFullYear(),now.getMonth()+1,Math.min(day,new Date(now.getFullYear(),now.getMonth()+2,0).getDate()));
      return parseLocal(localDateKey(d),dueTime);
    }
    return new Date(s.next_due_at||now);
  }
  function releaseFor(s,due){
    const start=formatTime(s.start_time||s.due_time||'00:00');
    return parseLocal(localDateKey(due),start);
  }
  function item(s){
    const due=dueFor(s),release=releaseFor(s,due),done=completedInWindow(s),now=new Date(),validUntil=s.valid_until?new Date(`${s.valid_until}T23:59:59`):null;
    const expired=validUntil&&now>validUntil,overdue=!done&&!expired&&now>endOfWindow(due,s.grace_minutes),available=!done&&!expired&&now>=release;
    return {...s,due,release,done,expired,overdue,available,dueToday:localDateKey(due)===todayKey()};
  }

  async function load(){
    if(!O().ready||!DB())return;
    const [sq,aq,eq]=await Promise.all([
      DB().from('cp_inspection_schedules').select('*').eq('is_active',true).order('next_due_at',{ascending:true}),
      DB().from('cp_schedule_assignees').select('*'),
      DB().from('cp_executions').select('id,schedule_id,status,completed_at,started_at,created_at,performed_by,store_id,template_id,environment').not('schedule_id','is',null).order('created_at',{ascending:false}).limit(2000)
    ]);
    if(!sq.error)schedules=sq.data||[];if(!aq.error)assignees=aq.data||[];if(!eq.error)executions=eq.data||[];
    setTimeout(renderAll,40);
  }

  function renderAll(){if(isManagement())renderManagement();if(isOperational())renderRoutine();}
  function renderManagement(){
    const panel=document.getElementById('officialAssignmentsPanel');if(!panel)return;
    const rows=schedules.map(s=>{
      const ids=assigneeIds(s.id),names=ids.map(nameUser),days=s.recurrence==='weekly'?daysText(s.days_of_week):'',window=`${formatTime(s.start_time||s.due_time)}–${formatTime(s.due_time)}`;
      return `<div class="assignment-row-v2"><div><strong>${esc(nameTemplate(s.template_id))}</strong><span>${esc(nameStore(s.store_id))}</span><span>${ids.length?`${ids.length} apto${ids.length===1?'':'s'}: ${esc(names.join(', '))}`:'Sem usuários aptos'}</span></div><div><strong>${esc(recurrenceLabel(s.recurrence))}${days?` · ${esc(days)}`:''}</strong><div class="schedule-window"><span class="schedule-chip">Janela ${window}</span>${s.grace_minutes?`<span class="schedule-chip">+ ${s.grace_minutes} min tolerância</span>`:''}${s.valid_until?`<span class="schedule-chip">até ${new Date(s.valid_until+'T00:00:00').toLocaleDateString('pt-BR')}</span>`:''}</div></div><button class="mini-action danger-text" onclick="deactivateAssignment('${s.id}')">Encerrar</button></div>`;
    }).join('');
    panel.innerHTML=`<div class="assignment-head"><div><h2>Programações e responsáveis aptos</h2><p class="desc">Uma atividade pode ficar disponível para vários usuários. Quem concluir primeiro registra a execução e encerra aquela ocorrência para os demais.</p></div><button class="btn" onclick="openAssignActivity('')">+ Programar atividade</button></div><div class="assignment-list">${rows||'<div class="structure-empty"><strong>Nenhuma programação ativa</strong><span>Defina checklist, loja, usuários aptos, frequência, horário e prazo.</span></div>'}</div>`;
    document.querySelectorAll('#executeCards .assign-template-btn:not(.open-store-action)').forEach(b=>{b.textContent='Programar atividade';});
  }

  function operationalRows(){
    const mine=schedules.filter(eligibleForMe).map(item).filter(x=>!x.expired);
    return mine;
  }
  function renderRoutine(){
    const mine=operationalRows(),today=mine.filter(x=>x.dueToday||x.overdue),done=today.filter(x=>x.done),pending=today.filter(x=>!x.done),late=pending.filter(x=>x.overdue),future=mine.filter(x=>!x.done&&!x.dueToday&&!x.overdue).sort((a,b)=>a.due-b.due),pct=today.length?Math.round(done.length/today.length*100):0;
    const next=[...pending,...future].sort((a,b)=>a.due-b.due)[0];
    const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    if(next){
      const t=(state.templates||[]).find(x=>x.id===next.template_id),count=assigneeIds(next.id).length;
      setText('routineNextTime',next.available?(next.overdue?'Atrasada':next.due.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})):`Libera ${next.release.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`);
      setText('routineNextName',t?.name||'Atividade programada');
      setText('routineNextMeta',`${nameStore(next.store_id)} • Você está apto a responder${count>1?` com mais ${count-1} pessoa(s)`:''}`);
      setText('routineQuestions',String(t?.questions?.length||0));setText('routineMinutes',String(t?.estimatedMinutes||10));
      const b=document.getElementById('routineStartBtn');if(b){b.disabled=!next.available&&!next.overdue;b.textContent=next.overdue?'Responder atividade atrasada →':next.available?'Responder atividade →':`Disponível às ${formatTime(next.start_time||next.due_time)}`;b.onclick=()=>{if(next.available||next.overdue)window.startScheduledRun?.(next.template_id,next.id,next.store_id);};}
    }
    const donut=document.getElementById('routineDonut');if(donut)donut.style.setProperty('--p',`${clamp(pct)}%`);
    setText('routinePct',`${pct}%`);setText('routineDone',String(done.length));setText('routinePending',String(pending.length));setText('routineLate',String(late.length));
    document.querySelectorAll('.navbtn[data-page="routine"] .navbadge').forEach(b=>{b.textContent=String(pending.length);b.style.display=pending.length?'':'none';});
    let rows=routineTab==='done'?mine.filter(x=>x.done):routineTab==='next'?future:today;
    const list=document.getElementById('routineList');if(list)list.innerHTML=rows.length?rows.sort((a,b)=>a.due-b.due).map(x=>{
      const t=(state.templates||[]).find(v=>v.id===x.template_id),status=x.done?'Concluída':x.overdue?'Atrasada':x.available?'Pendente':'Programada';
      const exec=executions.find(e=>e.schedule_id===x.id&&e.status==='completed'&&completedInWindow(x));
      const who=exec?.performed_by?nameUser(exec.performed_by):'';
      return `<div class="routine-assigned-row multi-ready"><div class="activity-time">${formatTime(x.start_time||x.due_time)}<small style="display:block">até ${formatTime(x.due_time)}</small></div><div class="routine-assigned-main"><strong>${esc(t?.name||'Atividade')}</strong><span>${esc(nameStore(x.store_id))} • ${esc(recurrenceLabel(x.recurrence))}</span><em>${x.done?`Feita por ${esc(who||'usuário apto')}`:'Você está entre os usuários aptos para responder'}</em></div><span class="activity-status ${x.done?'running':x.overdue?'late':'pending'}">● ${status}</span>${!x.done?`<button class="btn light" ${(!x.available&&!x.overdue)?'disabled':''} onclick="${(x.available||x.overdue)?`startScheduledRun('${x.template_id}','${x.id}','${x.store_id}')`:''}">${x.overdue?'Responder atrasada':x.available?'Responder':'Aguardar'}</button>`:''}</div>`;
    }).join(''):'<div class="routine-empty-official">Nenhuma atividade nesta lista.</div>';
    document.querySelectorAll('.routine-tabs button').forEach((b,i)=>b.classList.toggle('active',['today','next','done'][i]===routineTab));
  }
  window.setRoutineTab=function(tab){routineTab=tab;if(isOperational())renderRoutine();};

  function eligibleUsers(storeId){
    return (state.users||[]).filter(u=>u.active&&(u.unitIds||[]).includes(storeId)&&roleOf(u)?.base!=='admin');
  }
  function updateEligibleUsers(){
    const storeId=document.getElementById('assignStore')?.value,box=document.getElementById('assignUsers');
    if(!box)return;const users=eligibleUsers(storeId);
    box.innerHTML=users.length?users.map(u=>`<label class="sched-user"><input type="checkbox" class="assign-user-check" value="${u.userId}"><div><span>${esc(u.name)}</span><small>${esc(u.role||'Operacional')} · ${esc(u.jobTitle||u.sector||'')}</small></div></label>`).join(''):'<div class="structure-warning">Nenhum usuário apto está vinculado a esta loja.</div>';
    const count=document.getElementById('assignUserCount');if(count)count.textContent=`${users.length} usuário(s) disponível(is) nesta loja`;
  }
  function toggleWeekDays(){
    const rec=document.getElementById('assignRecurrence')?.value,wrap=document.getElementById('assignDaysWrap');if(wrap)wrap.classList.toggle('hidden',rec!=='weekly');
    const end=document.getElementById('assignEndWrap');if(end)end.classList.toggle('hidden',rec==='on_demand');
  }
  window.selectWeekdays=function(){
    const wanted=new Set(['1','2','3','4','5']);document.querySelectorAll('.assign-day-check').forEach(x=>x.checked=wanted.has(x.value));
  };

  window.openAssignActivity=function(templateId=''){
    if(!isManagement())return notify('Somente Administração/Gestão pode programar atividades.');
    const templates=state.templates||[],units=(state.units||[]).filter(u=>u.active!==false);
    if(!templates.length)return notify('Crie um checklist antes de programar.');if(!units.length)return notify('Cadastre uma loja antes de programar.');
    const now=new Date(),start=new Date(now.getTime()+30*60000),due=new Date(now.getTime()+90*60000),date=todayKey(),fmt=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    document.getElementById('structureModal')?.remove();
    const back=document.createElement('div');back.id='structureModal';back.className='structure-modal-back';back.innerHTML=`<div class="structure-modal"><div class="structure-modal-head"><div><h2>Programar atividade</h2><p>Defina quando deve ser feita, quem está apto a responder e qual é o prazo.</p></div><button class="structure-close" onclick="closeStructureModal()">×</button></div><div class="structure-modal-body">
      <div class="field"><label>Checklist</label><select class="input" id="assignTemplate">${templates.map(t=>`<option value="${t.id}" ${t.id===templateId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Loja / unidade</label><select class="input" id="assignStore">${units.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field"><div style="display:flex;justify-content:space-between;gap:10px;align-items:end"><label>Usuários aptos a responder</label><small id="assignUserCount"></small></div><div class="sched-user-grid" id="assignUsers"></div><small class="field-help">Marque uma ou várias pessoas. A atividade aparece para todos os selecionados; quem concluir primeiro registra a ocorrência.</small></div>
      <div class="formrow"><div class="field"><label>Frequência</label><select class="input" id="assignRecurrence"><option value="on_demand">Uma vez</option><option value="daily">Todos os dias</option><option value="weekly">Dias específicos da semana</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option></select></div><div class="field"><label>Data de início</label><input class="input" type="date" id="assignDate" value="${date}"></div></div>
      <div class="field hidden" id="assignDaysWrap"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><label>Dias da semana</label><button type="button" class="mini-action" onclick="selectWeekdays()">Seg–Sex</button></div><div class="sched-days">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d,i)=>`<label class="sched-day"><input type="checkbox" class="assign-day-check" value="${i}">${d}</label>`).join('')}</div></div>
      <div class="formrow"><div class="field"><label>Liberar para resposta a partir de</label><input class="input" type="time" id="assignStartTime" value="${fmt(start)}"></div><div class="field"><label>Horário limite</label><input class="input" type="time" id="assignTime" value="${fmt(due)}"></div></div>
      <div class="formrow"><div class="field"><label>Tolerância após o prazo</label><select class="input" id="assignGrace"><option value="0">Sem tolerância</option><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option></select></div><div class="field hidden" id="assignEndWrap"><label>Encerrar programação em (opcional)</label><input class="input" type="date" id="assignEnd"></div></div>
      <div class="structure-note"><strong>Como funciona:</strong> todos os usuários marcados ficam aptos a responder dentro da janela definida. Quando um deles concluir, o sistema registra <strong>quem fez e em qual horário</strong>, e aquela ocorrência deixa de ficar pendente para os demais.</div>
    </div><div class="structure-modal-foot"><button class="btn secondary" onclick="closeStructureModal()">Cancelar</button><button class="btn" id="saveAssignmentBtn" onclick="saveAssignment()">Salvar programação</button></div></div>`;
    document.body.appendChild(back);
    document.getElementById('assignStore').onchange=updateEligibleUsers;document.getElementById('assignRecurrence').onchange=toggleWeekDays;updateEligibleUsers();toggleWeekDays();
  };

  window.saveAssignment=async function(){
    const btn=document.getElementById('saveAssignmentBtn');if(btn)btn.disabled=true;
    let created=null;
    try{
      const template_id=document.getElementById('assignTemplate')?.value,store_id=document.getElementById('assignStore')?.value,recurrence=document.getElementById('assignRecurrence')?.value||'on_demand',date=document.getElementById('assignDate')?.value,start_time=document.getElementById('assignStartTime')?.value,due_time=document.getElementById('assignTime')?.value,grace_minutes=Number(document.getElementById('assignGrace')?.value||0),valid_until=document.getElementById('assignEnd')?.value||null,user_ids=[...document.querySelectorAll('.assign-user-check:checked')].map(x=>x.value),days_of_week=recurrence==='weekly'?[...document.querySelectorAll('.assign-day-check:checked')].map(x=>Number(x.value)):null;
      if(!user_ids.length)throw new Error('Selecione pelo menos um usuário apto a responder.');
      if(!date||!start_time||!due_time)throw new Error('Informe data inicial, horário de liberação e horário limite.');
      if(recurrence==='weekly'&&!days_of_week.length)throw new Error('Escolha pelo menos um dia da semana.');
      if(valid_until&&valid_until<date)throw new Error('A data final não pode ser anterior à data inicial.');
      const start=parseLocal(date,start_time),due=parseLocal(date,due_time);let deadline=Math.round((due-start)/60000);if(deadline<0)deadline+=1440;if(deadline===0)throw new Error('O horário limite deve ser diferente do horário de liberação.');
      const payload={organization_id:P().organization_id,store_id,template_id,recurrence,days_of_week,due_time:`${due_time}:00`,assigned_user_id:user_ids[0],next_due_at:due.toISOString(),is_active:true,assignment_mode:user_ids.length>1?'group':'users',start_time:`${start_time}:00`,grace_minutes,valid_from:date,valid_until,deadline_minutes:deadline};
      const q=await DB().from('cp_inspection_schedules').insert(payload).select().single();if(q.error)throw q.error;created=q.data;
      const rows=user_ids.map(user_id=>({organization_id:P().organization_id,schedule_id:created.id,user_id}));const aq=await DB().from('cp_schedule_assignees').insert(rows);if(aq.error)throw aq.error;
      document.getElementById('structureModal')?.remove();notify(user_ids.length>1?`Programação salva para ${user_ids.length} usuários aptos.`:'Programação salva.');await load();
    }catch(e){
      if(created?.id)await DB().from('cp_inspection_schedules').delete().eq('id',created.id);
      notify(e.message||'Não foi possível salvar a programação.');if(btn)btn.disabled=false;
    }
  };

  const oldOpenStore=window.openOpenChecklistModal;
  if(typeof oldOpenStore==='function'){
    window.openOpenChecklistModal=function(templateId=''){
      const r=oldOpenStore.apply(this,arguments);
      setTimeout(()=>{const body=document.querySelector('#structureModal .structure-modal-body');if(body&&!body.querySelector('.schedule-mode-banner')){const b=document.createElement('div');b.className='schedule-mode-banner';b.innerHTML=`<div><strong>Quer definir horário, prazo ou vários usuários aptos?</strong><span>Use a programação quando o checklist tiver uma rotina obrigatória.</span></div><button type="button" class="btn secondary">Programar atividade</button>`;b.querySelector('button').onclick=()=>{document.getElementById('structureModal')?.remove();window.openAssignActivity(templateId);};body.prepend(b);}},0);
      return r;
    };
  }

  const oldNavigate=window.navigate;
  if(typeof oldNavigate==='function')window.navigate=function(page){const r=oldNavigate.apply(this,arguments);setTimeout(()=>{if(page==='routine'&&isOperational())renderRoutine();if(page==='execute'&&isManagement())renderManagement();},80);return r;};
  const oldRenderRoutine=window.renderRoutine;
  if(typeof oldRenderRoutine==='function')window.renderRoutine=function(){const r=oldRenderRoutine.apply(this,arguments);setTimeout(()=>{if(isOperational())renderRoutine();},60);return r;};

  async function boot(){
    if(initialized||!O().ready||!DB())return false;initialized=true;addStyle();await load();
    try{
      channel=DB().channel('triela-advanced-schedules')
        .on('postgres_changes',{event:'*',schema:'public',table:'cp_inspection_schedules'},()=>load())
        .on('postgres_changes',{event:'*',schema:'public',table:'cp_schedule_assignees'},()=>load())
        .on('postgres_changes',{event:'*',schema:'public',table:'cp_executions'},()=>load())
        .subscribe();
    }catch{}
    setTimeout(renderAll,600);return true;
  }
  if(!boot()){let tries=0;const timer=setInterval(async()=>{tries++;if(await boot()||tries>60)clearInterval(timer);},250);}
  window.addEventListener('focus',()=>{if(O().ready)setTimeout(load,300);});
})();