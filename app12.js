/* Triela Checklists — usuários oficiais, primeiro acesso e rotina operacional designada */
(function(){
  'use strict';
  const SUPABASE_URL='https://rxzphzzmmeiaisuidwye.supabase.co';
  const SUPABASE_KEY='sb_publishable_Sd8kX9RhVbt1iJIl6fLZeA_zvGyafTD';
  const extraByUser={};
  let schedules=[];
  let scheduleExecutions=[];
  let routineTab='today';
  let scheduleChannel=null;
  let initialized=false;

  const O=()=>window.TRIELA_OFFICIAL||{};
  const DB=()=>O().supabase;
  const P=()=>O().profile;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
  const roleOf=u=>(state.roles||[]).find(r=>r.id===u?.roleId);
  const isOperationalProfile=id=>roleOf({roleId:id})?.base==='collaborator';
  const isManagement=()=>['admin','manager'].includes(P()?.role);
  const fmtDate=v=>{if(!v)return '—';const [y,m,d]=String(v).slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:'—';};
  const fmtDateTime=v=>v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
  const localDateKey=d=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  const todayKey=()=>localDateKey(new Date());
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));

  function patchLoginForm(){
    const form=document.getElementById('officialLoginForm');
    if(!form||form.dataset.trielaFirstAccess==='1')return;
    form.dataset.trielaFirstAccess='1';
    const submit=form.querySelector('button[type="submit"]');
    if(submit&&!document.getElementById('officialFirstCodeWrap')){
      submit.insertAdjacentHTML('beforebegin',`<label id="officialFirstCodeWrap" class="hidden">Código de primeiro acesso<input id="officialFirstCode" autocomplete="one-time-code" placeholder="TLA-XXXXXXXX"><small class="first-code-help">Use o código único entregue pelo administrador. Ele será invalidado após o primeiro acesso.</small></label>`);
    }
    form.onsubmit=async e=>{
      e.preventDefault();
      const username=document.getElementById('officialUsername')?.value.trim().toLowerCase()||'';
      const password=document.getElementById('officialPassword')?.value||'';
      const first_access_code=document.getElementById('officialFirstCode')?.value.trim().toUpperCase()||'';
      const err=document.getElementById('officialLoginError');
      if(err)err.textContent='';
      form.querySelectorAll('input,button').forEach(x=>x.disabled=true);
      try{
        const res=await fetch(`${SUPABASE_URL}/functions/v1/cp-username-login`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({username,password,first_access_code})});
        const data=await res.json();
        if(data.requires_first_access_code&&!first_access_code){
          document.getElementById('officialFirstCodeWrap')?.classList.remove('hidden');
          document.getElementById('officialFirstCode')?.focus();
          throw new Error(data.error||'Informe o código de primeiro acesso.');
        }
        if(!res.ok||!data.access_token){
          if(data.requires_first_access_code)document.getElementById('officialFirstCodeWrap')?.classList.remove('hidden');
          throw new Error(data.error||'Usuário ou senha inválidos');
        }
        const client=DB();if(!client)throw new Error('Conexão com a nuvem ainda não está pronta.');
        const {error}=await client.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
        if(error)throw error;
        location.reload();
      }catch(error){if(err)err.textContent=error.message||'Não foi possível entrar.';}
      finally{form.querySelectorAll('input,button').forEach(x=>x.disabled=false);}
    };
  }

  const observer=new MutationObserver(patchLoginForm);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  patchLoginForm();

  async function callAdminUsers(body){
    const db=DB();if(!db)throw new Error('Nuvem indisponível.');
    const {data}=await db.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error('Sessão expirada.');
    const res=await fetch(`${SUPABASE_URL}/functions/v1/cp-admin-users`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
    const out=await res.json();if(!res.ok)throw new Error(out.error||'Falha ao salvar usuário.');return out;
  }

  async function loadUserExtras(){
    if(!O().ready||P()?.role!=='admin')return;
    const {data,error}=await DB().from('cp_profiles').select('user_id,birth_date,first_access_code_used_at,first_access_code_created_at,access_profile_id');
    if(error)return;
    (data||[]).forEach(x=>extraByUser[x.user_id]=x);
    (state.users||[]).forEach(u=>{const x=extraByUser[u.userId];if(x){u.birthDate=x.birth_date||'';u.firstAccessPending=Boolean(x.first_access_code_created_at&&!x.first_access_code_used_at);}});
    renderUsersV2();
  }

  function renderUsersV2(){
    if(!O().ready)return;
    const body=document.getElementById('usersTable');if(!body)return;
    const table=body.closest('table'),hr=table?.querySelector('thead tr');
    if(hr)hr.innerHTML='<th>Nome</th><th>Usuário</th><th>Função</th><th>Perfil</th><th>Nascimento</th><th>Loja(s)</th><th>1º acesso</th><th>Status</th><th></th>';
    body.innerHTML=(state.users||[]).map(u=>{
      const ex=extraByUser[u.userId]||{};
      return `<tr><td><strong>${esc(u.name)}</strong>${u.sector?`<small class="table-sub">${esc(u.sector)}</small>`:''}</td><td>${esc(u.username||'—')}</td><td>${esc(u.jobTitle||'—')}</td><td>${esc(u.role||'—')}</td><td>${fmtDate(u.birthDate||ex.birth_date)}</td><td>${esc(u.unit||'—')}</td><td><span class="status ${(u.firstAccessPending||(!ex.first_access_code_used_at&&ex.first_access_code_created_at))?'warn':'ok'}">${(u.firstAccessPending||(!ex.first_access_code_used_at&&ex.first_access_code_created_at))?'Pendente':'Concluído'}</span></td><td><span class="status ${u.active?'ok':'neutral'}">${u.active?'Ativo':'Inativo'}</span></td><td>${P()?.role==='admin'?`<button class="btn light" onclick="openOfficialUserEditor('${u.userId}')">Editar</button>`:''}</td></tr>`;
    }).join('')||'<tr><td colspan="9"><div class="empty">Nenhum usuário cadastrado.</div></td></tr>';
  }

  window.openOfficialUserEditor=async function(userId=''){
    if(P()?.role!=='admin')return notify('Apenas administradores podem gerenciar usuários.');
    const u=userId?(state.users||[]).find(x=>x.userId===userId):null;
    if(userId&&!extraByUser[userId]){
      const {data}=await DB().from('cp_profiles').select('user_id,birth_date,first_access_code_used_at,first_access_code_created_at').eq('user_id',userId).maybeSingle();if(data)extraByUser[userId]=data;
    }
    const ex=extraByUser[userId]||{};
    const roles=(state.roles||[]).filter(r=>r.active!==false).map(r=>`<option value="${r.id}" ${u?.roleId===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
    const units=(state.units||[]).filter(s=>s.active!==false).map(s=>`<label class="permission-check user-store-choice"><input type="checkbox" class="official-user-store" value="${s.id}" ${u?.unitIds?.includes(s.id)?'checked':''}><span>${esc(s.name)}</span></label>`).join('')||'<div class="structure-warning">Cadastre uma loja antes de criar um usuário operacional.</div>';
    document.getElementById('structureModal')?.remove();
    const back=document.createElement('div');back.id='structureModal';back.className='structure-modal-back';back.innerHTML=`<div class="structure-modal"><div class="structure-modal-head"><div><h2>${u?'Editar usuário':'Novo usuário'}</h2><p>Defina identidade, perfil, loja e credenciais. O código de primeiro acesso é gerado automaticamente.</p></div><button class="structure-close" onclick="closeStructureModal()">×</button></div><div class="structure-modal-body">
      <div class="field"><label>Nome do colaborador</label><input class="input" id="officialUserName" value="${esc(u?.name||'')}" placeholder="Nome completo"></div>
      <div class="formrow"><div class="field"><label>Usuário de login</label><input class="input" id="officialUserUsername" value="${esc(u?.username||'')}" placeholder="nome.sobrenome"></div><div class="field"><label>Data de nascimento</label><input class="input" id="officialUserBirth" type="date" max="${todayKey()}" value="${esc(u?.birthDate||ex.birth_date||'')}"></div></div>
      <div class="formrow"><div class="field"><label>Função / cargo</label><input class="input" id="officialUserJob" value="${esc(u?.jobTitle||'')}" placeholder="Ex.: Operador"></div><div class="field"><label>Tipo de perfil</label><select class="input" id="officialUserRole">${roles}</select></div></div>
      <div class="field"><label>Setor (opcional)</label><input class="input" id="officialUserSector" value="${esc(u?.sector||'')}" placeholder="Ex.: Frente de loja"></div>
      <div class="field"><label>Loja(s) designada(s)</label><div class="permission-grid" id="officialUserStores">${units}</div><small class="field-help" id="officialStoreRule">Perfil operacional: escolha exatamente uma loja. Gestor pode receber mais de uma.</small></div>
      <div class="field"><label>${u?'Nova senha (preencha somente para redefinir)':'Senha inicial'}</label><div class="password-wrap"><input class="input" id="officialUserPassword" type="password" minlength="8" placeholder="Mínimo 8 caracteres"><button type="button" class="password-eye" onclick="toggleOfficialPassword()">◉</button></div><small class="field-help">Ao criar o usuário, o sistema gera também um código único de primeiro acesso.</small></div>
      ${u?`<label class="official-active-check"><input type="checkbox" id="officialUserActive" ${u.active?'checked':''}> Usuário ativo</label><div class="user-security-row"><span>${ex.first_access_code_used_at?'Primeiro acesso já concluído':'Código de primeiro acesso pendente ou não gerado'}</span><button class="btn secondary" type="button" onclick="resetOfficialFirstCode('${u.userId}')">Gerar novo código</button></div>`:''}
    </div><div class="structure-modal-foot"><button class="btn secondary" onclick="closeStructureModal()">Cancelar</button><button class="btn" id="saveOfficialUserBtn" onclick="saveOfficialUser('${userId}')">Salvar usuário</button></div></div>`;
    document.body.appendChild(back);
    const roleSelect=document.getElementById('officialUserRole');
    roleSelect?.addEventListener('change',enforceUserStoreRule);enforceUserStoreRule();
  };

  window.toggleOfficialPassword=function(){const el=document.getElementById('officialUserPassword');if(el)el.type=el.type==='password'?'text':'password';};
  function enforceUserStoreRule(){
    const roleId=document.getElementById('officialUserRole')?.value,operational=isOperationalProfile(roleId),help=document.getElementById('officialStoreRule');
    if(help)help.textContent=operational?'Perfil operacional: escolha exatamente UMA loja. Ele verá somente as atividades designadas nessa loja.':'Gestor/Líder pode receber uma ou mais lojas conforme a responsabilidade.';
    document.querySelectorAll('.official-user-store').forEach(box=>{box.onchange=()=>{if(operational&&box.checked)document.querySelectorAll('.official-user-store').forEach(other=>{if(other!==box)other.checked=false;});};});
  }

  window.saveOfficialUser=async function(userId=''){
    const btn=document.getElementById('saveOfficialUserBtn');if(btn)btn.disabled=true;
    try{
      const full_name=document.getElementById('officialUserName')?.value.trim()||'',username=document.getElementById('officialUserUsername')?.value.trim().toLowerCase()||'',birth_date=document.getElementById('officialUserBirth')?.value||'',job_title=document.getElementById('officialUserJob')?.value.trim()||'',sector=document.getElementById('officialUserSector')?.value.trim()||'',access_profile_id=document.getElementById('officialUserRole')?.value||'',password=document.getElementById('officialUserPassword')?.value||'',store_ids=[...document.querySelectorAll('.official-user-store:checked')].map(x=>x.value),role=roleOf({roleId:access_profile_id});
      if(!full_name||!username||!birth_date||!access_profile_id)throw new Error('Preencha nome, usuário, data de nascimento e tipo de perfil.');
      if(!userId&&password.length<8)throw new Error('A senha inicial deve ter pelo menos 8 caracteres.');
      if(role?.base==='collaborator'&&store_ids.length!==1)throw new Error('O perfil operacional deve ficar vinculado a exatamente uma loja.');
      if(role?.base!=='admin'&&role?.base!=='collaborator'&&!store_ids.length)throw new Error('Selecione pelo menos uma loja.');
      const payload={action:userId?'update':'create',user_id:userId||undefined,full_name,username,birth_date,job_title,sector,access_profile_id,store_ids,is_active:userId?document.getElementById('officialUserActive')?.checked!==false:true};
      if(password)payload.password=password;
      const out=await callAdminUsers(payload);
      if(out.first_access_code){showCredentialCard({name:full_name,username,password:password||'(senha já definida)',code:out.first_access_code,isReset:Boolean(userId)});return;}
      closeStructureModal();notify(userId?'Usuário atualizado.':'Usuário criado.');setTimeout(()=>location.reload(),250);
    }catch(error){notify(error.message||'Falha ao salvar usuário.');if(btn)btn.disabled=false;}
  };

  window.resetOfficialFirstCode=async function(userId){
    try{const u=(state.users||[]).find(x=>x.userId===userId);const out=await callAdminUsers({action:'reset_first_access_code',user_id:userId});showCredentialCard({name:u?.name||'Usuário',username:u?.username||'',password:'Use a senha atual',code:out.first_access_code,isReset:true});}catch(error){notify(error.message||'Falha ao gerar código.');}
  };

  function showCredentialCard({name,username,password,code,isReset}){
    const modal=document.querySelector('#structureModal .structure-modal');if(!modal)return;
    modal.innerHTML=`<div class="structure-modal-head"><div><h2>${isReset?'Novo código gerado':'Usuário criado com sucesso'}</h2><p>Entregue estas informações somente ao colaborador correspondente.</p></div></div><div class="structure-modal-body"><div class="credential-success"><div class="credential-user"><strong>${esc(name)}</strong><span>Credenciais de acesso</span></div><div class="credential-grid"><div><span>Usuário</span><strong id="credUsername">${esc(username)}</strong></div><div><span>Senha</span><strong id="credPassword">${esc(password)}</strong></div><div class="credential-code"><span>Código de primeiro acesso</span><strong id="credCode">${esc(code)}</strong></div></div><div class="structure-warning">O código de primeiro acesso funciona uma única vez. Depois disso, o colaborador entra apenas com usuário e senha e poderá trocar sua própria senha em “Meu perfil”.</div></div></div><div class="structure-modal-foot"><button class="btn secondary" onclick="copyCredentialAccess()">Copiar dados</button><button class="btn" onclick="location.reload()">Concluir</button></div>`;
  }
  window.copyCredentialAccess=async function(){const txt=`Usuário: ${document.getElementById('credUsername')?.textContent||''}\nSenha: ${document.getElementById('credPassword')?.textContent||''}\nCódigo de primeiro acesso: ${document.getElementById('credCode')?.textContent||''}`;try{await navigator.clipboard.writeText(txt);notify('Dados de acesso copiados.');}catch{notify('Não foi possível copiar automaticamente.');}};

  const oldOpenRoleEditor=window.openRoleEditor;
  window.openRoleEditor=function(id){if(typeof oldOpenRoleEditor==='function')oldOpenRoleEditor(id);setTimeout(patchRoleEditor,0);};
  function patchRoleEditor(){
    const base=document.getElementById('roleBaseInput');if(!base)return;
    let note=document.getElementById('operationalProfileNotice');if(!note){note=document.createElement('div');note.id='operationalProfileNotice';note.className='structure-warning';document.getElementById('rolePermissionGrid')?.parentElement?.appendChild(note);}
    const apply=()=>{
      const operational=base.value==='collaborator';
      document.querySelectorAll('#rolePermissionGrid input').forEach(input=>{
        if(operational){const allowed=['routine','training','help'].includes(input.value);input.checked=allowed;input.disabled=!allowed;}else input.disabled=false;
      });
      if(note){note.style.display=operational?'block':'none';note.textContent='Perfil Operacional é restrito: não cria modelos, não usa o Construtor e não escolhe checklists livremente. Ele executa somente atividades designadas a ele.';}
    };
    base.onchange=apply;apply();
  }

  window.removeRole=async function(id){
    const r=(state.roles||[]).find(x=>x.id===id);if(!r)return;
    if(r.protected)return notify('O perfil Administrador é o perfil mestre. Ele pode excluir todos os demais perfis, mas não pode excluir a si próprio.');
    if(P()?.role!=='admin')return notify('Apenas o Administrador pode excluir perfis.');
    const linked=(state.users||[]).filter(u=>u.roleId===id);
    const msg=linked.length?`Excluir definitivamente o perfil “${r.name}”? ${linked.length} usuário(s) vinculados serão desativados até receberem outro perfil.`:`Excluir definitivamente o perfil “${r.name}”?`;
    if(!confirm(msg))return;
    try{
      if(linked.length){const {error:uerr}=await DB().from('cp_profiles').update({is_active:false,access_profile_id:null}).eq('access_profile_id',id);if(uerr)throw uerr;}
      const {error}=await DB().from('cp_access_profiles').delete().eq('id',id);if(error)throw error;
      notify('Perfil excluído.');setTimeout(()=>location.reload(),250);
    }catch(error){notify(error.message||'Não foi possível excluir o perfil.');}
  };

  function patchRoleCards(){document.querySelectorAll('#rolesAdminList .mini-action').forEach(b=>{if(b.textContent.trim()==='Arquivar')b.textContent='Excluir';});}

  async function loadAssignments(){
    if(!O().ready||!DB())return;
    const [s,e]=await Promise.all([
      DB().from('cp_inspection_schedules').select('*').eq('is_active',true).order('next_due_at',{ascending:true}),
      DB().from('cp_executions').select('id,schedule_id,status,completed_at,started_at,created_at,performed_by,store_id,template_id,environment').not('schedule_id','is',null).order('created_at',{ascending:false}).limit(2000)
    ]);
    if(!s.error)schedules=s.data||[];if(!e.error)scheduleExecutions=e.data||[];
    renderAssignedRoutine();renderAssignmentPanel();
  }

  function dueForSchedule(s){
    const now=new Date(),time=(s.due_time||'23:59:00').slice(0,5),[hh,mm]=time.split(':').map(Number);
    if(s.recurrence==='daily'){const d=new Date(now);d.setHours(hh||0,mm||0,0,0);return d;}
    if(s.recurrence==='weekly'){
      const days=(s.days_of_week||[]).map(Number);const targetDays=days.length?days:[new Date(s.next_due_at||s.created_at).getDay()];let best=null;
      for(let add=0;add<8;add++){const d=new Date(now);d.setDate(now.getDate()+add);d.setHours(hh||0,mm||0,0,0);if(targetDays.includes(d.getDay())){best=d;break;}}
      return best||new Date(s.next_due_at||s.created_at);
    }
    if(s.recurrence==='monthly'){
      const seed=new Date(s.next_due_at||s.created_at),day=seed.getDate();let d=new Date(now.getFullYear(),now.getMonth(),Math.min(day,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()),hh||0,mm||0);if(d<new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0)){d=new Date(now.getFullYear(),now.getMonth()+1,Math.min(day,new Date(now.getFullYear(),now.getMonth()+2,0).getDate()),hh||0,mm||0);}return d;
    }
    return new Date(s.next_due_at||s.created_at);
  }
  function completedInWindow(s){
    const runs=scheduleExecutions.filter(e=>e.schedule_id===s.id&&e.status==='completed'&&e.environment===(state.ui.mode==='training'?'training':'production'));
    if(!runs.length)return false;const now=new Date();
    if(s.recurrence==='daily')return runs.some(e=>localDateKey(e.completed_at||e.created_at)===todayKey());
    if(s.recurrence==='weekly'){const start=new Date(now);start.setHours(0,0,0,0);start.setDate(now.getDate()-now.getDay());return runs.some(e=>new Date(e.completed_at||e.created_at)>=start);}
    if(s.recurrence==='monthly')return runs.some(e=>{const d=new Date(e.completed_at||e.created_at);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();});
    return runs.length>0;
  }
  function scheduleItem(s){const due=dueForSchedule(s),done=completedInWindow(s),now=new Date(),dueToday=localDateKey(due)===todayKey(),overdue=!done&&due<now;return {...s,due,done,dueToday,overdue};}

  function renderAssignedRoutine(){
    if(!O().ready||P()?.role!=='auditor')return;
    const mine=schedules.filter(s=>s.assigned_user_id===P().user_id).map(scheduleItem),today=mine.filter(x=>x.dueToday||x.overdue),doneToday=today.filter(x=>x.done),pending=today.filter(x=>!x.done),late=pending.filter(x=>x.overdue),pct=today.length?Math.round(doneToday.length/today.length*100):0;
    const future=mine.filter(x=>!x.done&&!x.dueToday&&!x.overdue).sort((a,b)=>a.due-b.due),allPending=[...pending,...future].sort((a,b)=>a.due-b.due),next=allPending[0];
    const template=id=>(state.templates||[]).find(t=>t.id===id);
    if(next){const t=template(next.template_id);document.getElementById('routineNextTime').textContent=next.due.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});document.getElementById('routineNextName').textContent=t?.name||'Atividade designada';document.getElementById('routineNextMeta').textContent=`${(state.units||[]).find(u=>u.id===next.store_id)?.name||'Loja'} • ${t?.category||'Operação'}`;document.getElementById('routineQuestions').textContent=String(t?.questions?.length||0);document.getElementById('routineMinutes').textContent=String(t?.estimatedMinutes||10);const btn=document.getElementById('routineStartBtn');if(btn){btn.disabled=false;btn.textContent=next.overdue?'Iniciar atividade atrasada →':'Iniciar agora →';btn.onclick=()=>startRun(next.template_id);}}
    else{document.getElementById('routineNextTime').textContent='—';document.getElementById('routineNextName').textContent=mine.length?'Tudo concluído por agora':'Nenhuma atividade designada';document.getElementById('routineNextMeta').textContent=mine.length?'Sua rotina está em dia.':'Quando uma atividade for atribuída a você, ela aparecerá aqui.';document.getElementById('routineQuestions').textContent='0';document.getElementById('routineMinutes').textContent='0';const btn=document.getElementById('routineStartBtn');if(btn){btn.disabled=true;btn.textContent=mine.length?'Sem pendências':'Aguardando designação';}}
    const donut=document.getElementById('routineDonut');if(donut)donut.style.setProperty('--p',`${clamp(pct)}%`);const pEl=document.getElementById('routinePct');if(pEl)pEl.textContent=`${pct}%`;document.getElementById('routineDone').textContent=String(doneToday.length);document.getElementById('routinePending').textContent=String(pending.length);document.getElementById('routineLate').textContent=String(late.length);document.querySelectorAll('.navbtn[data-page="routine"] .navbadge').forEach(b=>b.textContent=String(pending.length));
    let rows=routineTab==='done'?mine.filter(x=>x.done):routineTab==='next'?future:today;
    const list=document.getElementById('routineList');if(list)list.innerHTML=rows.length?rows.sort((a,b)=>a.due-b.due).map(x=>{const t=template(x.template_id),status=x.done?'Concluída':x.overdue?'Atrasada':'Pendente';return `<div class="routine-assigned-row"><div class="activity-time">${x.due.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div><div class="routine-assigned-main"><strong>${esc(t?.name||'Atividade')}</strong><span>${esc((state.units||[]).find(u=>u.id===x.store_id)?.name||'Loja')} • ${esc(t?.category||'Operação')}</span></div><span class="activity-status ${x.done?'running':x.overdue?'late':'pending'}">● ${status}</span>${!x.done?`<button class="btn light" onclick="startRun('${x.template_id}')">Executar</button>`:''}</div>`;}).join(''):'<div class="routine-empty-official">Nenhuma atividade nesta lista.</div>';
    document.querySelectorAll('.routine-tabs button').forEach((b,i)=>b.classList.toggle('active',['today','next','done'][i]===routineTab));
  }
  window.setRoutineTab=function(tab){if(P()?.role==='auditor'){routineTab=tab;renderAssignedRoutine();return;}routineTab=tab;};

  function injectAssignButtons(){
    if(!O().ready||!isManagement())return;
    const cards=document.querySelectorAll('#executeCards .template');cards.forEach((card,i)=>{const t=(state.templates||[])[i];if(!t||card.querySelector('.assign-template-btn'))return;const b=document.createElement('button');b.className='btn secondary assign-template-btn';b.textContent='Designar atividade';b.onclick=()=>openAssignActivity(t.id);card.appendChild(b);});
  }

  function renderAssignmentPanel(){
    if(!O().ready||!isManagement())return;
    const execute=document.getElementById('execute');if(!execute)return;let panel=document.getElementById('officialAssignmentsPanel');if(!panel){panel=document.createElement('div');panel.id='officialAssignmentsPanel';panel.className='panel assignment-panel';const cards=document.getElementById('executeCards');cards?.insertAdjacentElement('afterend',panel);}
    const nameTemplate=id=>(state.templates||[]).find(t=>t.id===id)?.name||'Checklist';const nameStore=id=>(state.units||[]).find(u=>u.id===id)?.name||'Loja';const nameUser=id=>(state.users||[]).find(u=>u.userId===id)?.name||'Usuário';
    panel.innerHTML=`<div class="assignment-head"><div><h2>Atividades designadas</h2><p class="desc">O operacional executa somente o que estiver atribuído aqui.</p></div><button class="btn" onclick="openAssignActivity('')">+ Designar atividade</button></div><div class="assignment-list">${schedules.length?schedules.map(s=>`<div class="assignment-row"><div><strong>${esc(nameTemplate(s.template_id))}</strong><span>${esc(nameUser(s.assigned_user_id))} • ${esc(nameStore(s.store_id))}</span></div><div><span class="status ok">${s.recurrence==='daily'?'Diária':s.recurrence==='weekly'?'Semanal':s.recurrence==='monthly'?'Mensal':'Uma vez'}</span><small>${fmtDateTime(s.next_due_at||s.created_at)}</small></div><button class="mini-action danger-text" onclick="deactivateAssignment('${s.id}')">Encerrar</button></div>`).join(''):'<div class="structure-empty"><strong>Nenhuma atividade designada</strong><span>Escolha um checklist e atribua a um colaborador.</span></div>'}</div>`;
    injectAssignButtons();
  }

  window.openAssignActivity=function(templateId=''){
    if(!isManagement())return notify('Somente Administração/Gestão pode designar atividades.');
    const templates=(state.templates||[]),units=(state.units||[]).filter(u=>u.active!==false),users=(state.users||[]).filter(u=>u.active&&roleOf(u)?.base!=='admin');
    if(!templates.length)return notify('Crie um checklist antes de designar uma atividade.');if(!units.length)return notify('Cadastre uma loja antes de designar uma atividade.');if(!users.length)return notify('Cadastre um colaborador antes de designar uma atividade.');
    const date=todayKey(),now=new Date(Date.now()+60*60*1000),time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    document.getElementById('structureModal')?.remove();const back=document.createElement('div');back.id='structureModal';back.className='structure-modal-back';back.innerHTML=`<div class="structure-modal"><div class="structure-modal-head"><div><h2>Designar atividade</h2><p>Escolha o checklist, a loja, o responsável e quando ele deverá executar.</p></div><button class="structure-close" onclick="closeStructureModal()">×</button></div><div class="structure-modal-body"><div class="field"><label>Checklist</label><select class="input" id="assignTemplate">${templates.map(t=>`<option value="${t.id}" ${t.id===templateId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div><div class="formrow"><div class="field"><label>Loja</label><select class="input" id="assignStore">${units.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div><div class="field"><label>Colaborador</label><select class="input" id="assignUser"></select></div></div><div class="formrow"><div class="field"><label>Frequência</label><select class="input" id="assignRecurrence"><option value="on_demand">Uma vez</option><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></div><div class="field"><label>Data inicial / prazo</label><input class="input" type="date" id="assignDate" value="${date}"></div></div><div class="field"><label>Horário</label><input class="input" type="time" id="assignTime" value="${time}"></div><div class="structure-note"><strong>Regra operacional:</strong> o colaborador não recebe acesso ao Construtor. Esta designação aparecerá em “Minha rotina” e somente ele poderá executá-la.</div></div><div class="structure-modal-foot"><button class="btn secondary" onclick="closeStructureModal()">Cancelar</button><button class="btn" id="saveAssignmentBtn" onclick="saveAssignment()">Designar</button></div></div>`;document.body.appendChild(back);
    const refreshUsers=()=>{const storeId=document.getElementById('assignStore').value,sel=document.getElementById('assignUser'),eligible=users.filter(u=>(u.unitIds||[]).includes(storeId));sel.innerHTML=eligible.map(u=>`<option value="${u.userId}">${esc(u.name)} — ${esc(u.role)}</option>`).join('')||'<option value="">Nenhum usuário vinculado a esta loja</option>';};document.getElementById('assignStore').onchange=refreshUsers;refreshUsers();
  };

  window.saveAssignment=async function(){const btn=document.getElementById('saveAssignmentBtn');if(btn)btn.disabled=true;try{const template_id=document.getElementById('assignTemplate').value,store_id=document.getElementById('assignStore').value,assigned_user_id=document.getElementById('assignUser').value,recurrence=document.getElementById('assignRecurrence').value,date=document.getElementById('assignDate').value,time=document.getElementById('assignTime').value;if(!assigned_user_id)throw new Error('Selecione um colaborador vinculado à loja.');if(!date||!time)throw new Error('Informe data e horário.');const local=new Date(`${date}T${time}:00`),days_of_week=recurrence==='weekly'?[local.getDay()]:null;const {error}=await DB().from('cp_inspection_schedules').insert({organization_id:P().organization_id,store_id,template_id,recurrence,days_of_week,due_time:`${time}:00`,assigned_user_id,next_due_at:local.toISOString(),is_active:true});if(error)throw error;closeStructureModal();notify('Atividade designada. Ela já aparecerá na rotina do colaborador.');await loadAssignments();}catch(error){notify(error.message||'Falha ao designar atividade.');if(btn)btn.disabled=false;}};
  window.deactivateAssignment=async function(id){if(!confirm('Encerrar esta designação? O histórico de execuções será preservado.'))return;const {error}=await DB().from('cp_inspection_schedules').update({is_active:false}).eq('id',id);if(error)return notify(error.message);notify('Designação encerrada.');await loadAssignments();};

  function patchOperationalNavigation(){
    if(!O().ready)return;const operational=P()?.role==='auditor';
    if(operational){document.querySelectorAll('.mobile-tabs button').forEach(b=>b.style.display=b.dataset.page==='routine'?'':'none');document.querySelectorAll('.navbtn[data-page="execute"],.navbtn[data-page="models"],.navbtn[data-page="builder"],.navbtn[data-page="overview"],.navbtn[data-page="correct"],.navbtn[data-page="analyze"],.navbtn[data-page="users"],.navbtn[data-page="settings"]').forEach(b=>b.classList.add('hidden-by-role'));const active=document.querySelector('.section.active')?.id;if(!['routine','training','help'].includes(active))navigate('routine');}
  }

  const previousRender=window.render;
  window.render=function(){previousRender();if(O().ready){renderUsersV2();patchRoleCards();patchOperationalNavigation();renderAssignedRoutine();renderAssignmentPanel();injectAssignButtons();}};

  async function initializeV2(){
    if(initialized||!O().ready||!DB())return;initialized=true;patchLoginForm();await loadUserExtras();await loadAssignments();patchRoleCards();patchOperationalNavigation();
    window.addEventListener('focus',()=>{loadAssignments();loadUserExtras();});
    try{scheduleChannel=DB().channel('triela-assigned-activities').on('postgres_changes',{event:'*',schema:'public',table:'cp_inspection_schedules'},()=>loadAssignments()).subscribe();}catch{}
  }
  const timer=setInterval(()=>{patchLoginForm();if(O().ready){clearInterval(timer);initializeV2();}},250);
})();
