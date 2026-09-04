/* Triela Checklists — modo oficial: Supabase Auth, nuvem, usuários, lojas e RLS por unidade */
(function(){
  'use strict';
  const SUPABASE_URL='https://rxzphzzmmeiaisuidwye.supabase.co';
  const SUPABASE_KEY='sb_publishable_Sd8kX9RhVbt1iJIl6fLZeA_zvGyafTD';
  const APP_NAME='Triela Checklists';
  let sb=null,currentUser=null,currentProfile=null,currentAccessProfile=null,realtimeChannel=null,reloadTimer=null,loadingBackend=false;
  const official={ready:false,profile:null,user:null,supabase:null};
  window.TRIELA_OFFICIAL=official;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mapBaseToUi=b=>b==='admin'?'admin':b==='manager'?'manager':'collaborator';
  const mapUiToBackend=b=>b==='admin'?'admin':b==='manager'?'manager':'auditor';
  const roleLabel=p=>p?.name||({admin:'Administrador',manager:'Gestor/Líder',auditor:'Colaborador/Operacional',viewer:'Consulta'}[currentProfile?.role]||'Usuário');
  const activeUnits=()=> (state.units||[]).filter(u=>u.active!==false);
  const activeRoles=()=> (state.roles||[]).filter(r=>r.active!==false);
  function notify(msg){ if(typeof toast==='function')toast(msg); else alert(msg); }
  function authHeaders(token){return {apikey:SUPABASE_KEY,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})};}

  async function loadSdk(){
    if(window.supabase?.createClient)return;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o módulo de nuvem.'));document.head.appendChild(s);
    });
  }

  function ensureAuthShell(){
    let root=document.getElementById('officialAuthShell');
    if(root)return root;
    root=document.createElement('div');root.id='officialAuthShell';root.className='official-auth-shell';root.innerHTML=`
      <div class="official-auth-card">
        <div class="official-auth-brand"><div class="official-auth-logo">T</div><div><strong>TRIELA</strong><span>CHECKLISTS</span></div></div>
        <div id="officialLoginView">
          <div class="official-auth-kicker">ACESSO OFICIAL</div><h1>Entrar no sistema</h1><p>Use o usuário e a senha cadastrados pelo administrador.</p>
          <form id="officialLoginForm" class="official-auth-form">
            <label>Usuário<input id="officialUsername" autocomplete="username" required placeholder="seu.usuario"></label>
            <label>Senha<div class="password-wrap"><input id="officialPassword" type="password" autocomplete="current-password" required placeholder="Sua senha"><button type="button" class="password-eye" data-toggle-password="officialPassword">◉</button></div></label>
            <button class="official-auth-button" type="submit">Entrar</button>
            <div class="official-auth-error" id="officialLoginError"></div>
          </form>
          <button class="official-auth-link" type="button" id="showActivationBtn">Primeiro acesso do administrador</button>
        </div>
        <div id="officialActivationView" class="hidden">
          <div class="official-auth-kicker">ATIVAÇÃO INICIAL</div><h1>Ativar administrador</h1><p>Defina agora seu usuário e sua senha oficial. O código de ativação é usado uma única vez.</p>
          <form id="officialActivationForm" class="official-auth-form">
            <label>Nome completo<input id="activationName" required placeholder="Nome do administrador"></label>
            <label>Usuário<input id="activationUsername" required autocomplete="username" placeholder="andre.lima"></label>
            <label>Senha<div class="password-wrap"><input id="activationPassword" type="password" minlength="8" required autocomplete="new-password" placeholder="Mínimo 8 caracteres"><button type="button" class="password-eye" data-toggle-password="activationPassword">◉</button></div></label>
            <label>Código de ativação<input id="activationCode" required autocomplete="one-time-code" placeholder="TRIELA-XXXXXXXX"></label>
            <button class="official-auth-button" type="submit">Ativar e entrar</button>
            <div class="official-auth-error" id="officialActivationError"></div>
          </form>
          <button class="official-auth-link" type="button" id="backToLoginBtn">← Voltar ao login</button>
        </div>
        <div class="official-auth-foot"><span class="official-online-dot"></span> Dados protegidos no Supabase · acesso por loja</div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click',e=>{const b=e.target.closest('[data-toggle-password]');if(b){const input=document.getElementById(b.dataset.togglePassword);if(input)input.type=input.type==='password'?'text':'password';}});
    document.getElementById('showActivationBtn').onclick=()=>switchAuthView('activation');
    document.getElementById('backToLoginBtn').onclick=()=>switchAuthView('login');
    document.getElementById('officialLoginForm').onsubmit=handleLogin;
    document.getElementById('officialActivationForm').onsubmit=handleActivation;
    return root;
  }
  function switchAuthView(view){document.getElementById('officialLoginView')?.classList.toggle('hidden',view!=='login');document.getElementById('officialActivationView')?.classList.toggle('hidden',view!=='activation');}
  function lockApp(){document.body.classList.add('official-locked');ensureAuthShell().classList.remove('hidden');}
  function unlockApp(){document.body.classList.remove('official-locked');document.getElementById('officialAuthShell')?.classList.add('hidden');}
  function setAuthError(id,msg){const el=document.getElementById(id);if(el)el.textContent=msg||'';}
  function setBusy(form,busy){form?.querySelectorAll('button,input').forEach(x=>x.disabled=busy);}

  async function handleLogin(e){
    e.preventDefault();const form=e.currentTarget;setBusy(form,true);setAuthError('officialLoginError','');
    try{
      const username=document.getElementById('officialUsername').value.trim().toLowerCase(),password=document.getElementById('officialPassword').value;
      const res=await fetch(`${SUPABASE_URL}/functions/v1/cp-username-login`,{method:'POST',headers:authHeaders(),body:JSON.stringify({username,password})});const data=await res.json();
      if(!res.ok||!data.access_token)throw new Error(data.error||'Usuário ou senha inválidos');
      const {error}=await sb.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});if(error)throw error;
      await loadOfficialData(true);unlockApp();notify('Acesso realizado com sucesso.');
    }catch(err){setAuthError('officialLoginError',err.message||'Não foi possível entrar.');}
    finally{setBusy(form,false);}
  }

  async function handleActivation(e){
    e.preventDefault();const form=e.currentTarget;setBusy(form,true);setAuthError('officialActivationError','');
    try{
      const full_name=document.getElementById('activationName').value.trim();
      const username=document.getElementById('activationUsername').value.trim().toLowerCase();
      const password=document.getElementById('activationPassword').value;
      const code=document.getElementById('activationCode').value.trim().toUpperCase();
      if(!/^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$/.test(username))throw new Error('Use um usuário com 3 a 40 caracteres: letras, números, ponto, _ ou -.');
      if(password.length<8)throw new Error('A senha deve ter pelo menos 8 caracteres.');
      const email=`${username}@checkprevencao.invalid`;
      const res=await fetch(`${SUPABASE_URL}/functions/v1/cp-bootstrap-admin`,{method:'POST',headers:authHeaders(),body:JSON.stringify({code,email,password,full_name})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível ativar o administrador.');
      const {data:login,error:loginError}=await sb.auth.signInWithPassword({email,password});if(loginError||!login.session)throw new Error(loginError?.message||'Administrador criado, mas o login não foi concluído.');
      currentUser=login.user;
      const {data:adminRole}=await sb.from('cp_access_profiles').select('id').eq('base_role','admin').eq('is_active',true).order('is_protected',{ascending:false}).limit(1).maybeSingle();
      const {error:profileUpdateError}=await sb.from('cp_profiles').update({username,access_profile_id:adminRole?.id||null,password_changed_at:new Date().toISOString(),must_change_password:false}).eq('user_id',currentUser.id);if(profileUpdateError)throw profileUpdateError;
      await sb.from('cp_profiles').update({is_active:false}).neq('user_id',currentUser.id);
      await loadOfficialData(true);unlockApp();notify('Administrador oficial ativado. Agora o sistema está pronto para cadastro.');
    }catch(err){setAuthError('officialActivationError',err.message||'Falha na ativação.');}
    finally{setBusy(form,false);}
  }

  async function ensureSession(){
    const {data}=await sb.auth.getSession();if(!data.session)return false;
    const {data:userData,error}=await sb.auth.getUser();if(error||!userData.user)return false;currentUser=userData.user;return true;
  }

  function makeTemplateState(templates,sections,items){
    const itemsByTemplate={};items.forEach(i=>(itemsByTemplate[i.template_id]??=[]).push(i));
    return templates.map(t=>({
      id:t.id,name:t.name,category:t.area||'Geral',description:t.description||'',estimatedMinutes:t.estimated_minutes||10,frequency:t.frequency,
      questions:(itemsByTemplate[t.id]||[]).filter(i=>!i.archived_at).sort((a,b)=>a.sort_order-b.sort_order).map(i=>({id:i.id,title:i.title,type:i.ui_type||({yes_no:'conform',text:'text',number:'number',photo:'photo',signature:'text'}[i.input_type]||'text'),critical:i.severity||'medium',action:i.generate_action_on_fail!==false,required:i.is_required!==false,backendSectionId:i.section_id,instructions:i.instructions||''}))
    }));
  }

  function mapBackendToState({profiles,userStores,accessProfiles,stores,templates,sections,items,executions,responses,ncs,actions}){
    const storeMap=Object.fromEntries(stores.map(s=>[s.id,s]));
    const roleMap=Object.fromEntries(accessProfiles.map(r=>[r.id,r]));
    state.roles=accessProfiles.map(r=>({id:r.id,name:r.name,base:mapBaseToUi(r.base_role),permissions:Array.isArray(r.permissions)?r.permissions:[],active:r.is_active!==false,protected:r.is_protected===true}));
    state.units=stores.map(s=>({id:s.id,name:s.name,code:s.code||'',city:s.city||'',region:s.region||'',address:s.address||'',active:s.is_active!==false,archivedAt:s.archived_at||null}));
    state.templates=makeTemplateState(templates,sections,items);
    const responseByExec={};responses.forEach(r=>(responseByExec[r.execution_id]??=[]).push(r));
    const ncByExec={};ncs.forEach(n=>(ncByExec[n.execution_id]??=[]).push(n));
    const convertRun=e=>({id:e.id,templateId:e.template_id,date:e.completed_at||e.started_at||e.created_at,status:e.status==='completed'?'completed':'in_progress',compliance:e.score==null?0:Math.round(Number(e.score)),nc:(ncByExec[e.id]||[]).length,answers:(responseByExec[e.id]||[]).map(r=>({qid:r.item_id,ok:r.is_compliant!==false,label:r.value_text??r.value_number??(r.value_boolean==null?'':String(r.value_boolean))})),mode:e.environment==='training'?'training':'real',userId:e.performed_by,unitId:e.store_id,unit:storeMap[e.store_id]?.name||'Unidade'});
    state.runs=executions.filter(e=>e.environment==='production').map(convertRun);
    state.trainingRuns=executions.filter(e=>e.environment==='training').map(convertRun);
    const ncMap=Object.fromEntries(ncs.map(n=>[n.id,n]));
    const convertAction=a=>({id:a.id,title:a.action_text,origin:ncMap[a.nonconformity_id]?.title||'Não conformidade',owner:a.responsible_user_id?(profiles.find(p=>p.user_id===a.responsible_user_id)?.full_name||'Responsável'):'Não atribuído',due:a.due_at,status:a.status==='completed'?'done':(new Date(a.due_at)<new Date()?'overdue':'pending'),mode:a.environment==='training'?'training':'real',unitId:a.store_id,unit:storeMap[a.store_id]?.name||'Unidade',backendNcId:a.nonconformity_id});
    state.actions=actions.filter(a=>a.environment==='production').map(convertAction);
    state.trainingActions=actions.filter(a=>a.environment==='training').map(convertAction);
    const storesByUser={};userStores.forEach(x=>(storesByUser[x.user_id]??=[]).push(x.store_id));
    state.users=profiles.map(p=>{
      const role=roleMap[p.access_profile_id];const ids=storesByUser[p.user_id]||[];const userRuns=executions.filter(e=>e.performed_by===p.user_id&&e.environment==='production'&&e.status==='completed');
      return {userId:p.user_id,name:p.full_name,username:p.username||'',role:role?.name||p.role,roleId:p.access_profile_id,unit:ids.map(id=>storeMap[id]?.name).filter(Boolean).join(', ')||(p.role==='admin'?'Todas as lojas':'Sem loja'),unitIds:ids,jobTitle:p.job_title||'',sector:p.sector||'',runs:userRuns.length,compliance:userRuns.length?Math.round(userRuns.reduce((s,r)=>s+Number(r.score||0),0)/userRuns.length):0,active:p.is_active!==false,trainingStatus:'Liberado',tutorialDone:true};
    });
    state.ui=state.ui||{};state.ui.mode=state.ui.mode||'real';
    const myRole=roleMap[currentProfile.access_profile_id];currentAccessProfile=myRole||{name:roleLabel(null),base_role:currentProfile.role,permissions:defaultPermissions(currentProfile.role)};
    if(currentProfile.role!=='admin')state.ui.previewRole=mapBaseToUi(currentAccessProfile.base_role);
    localStorage.setItem('trielaV4',JSON.stringify(state));
  }
  function defaultPermissions(role){return role==='admin'?['overview','execute','correct','analyze','models','builder','training','help','users','settings']:role==='manager'?['overview','execute','correct','analyze','training','help']:['routine','execute','training','help'];}

  async function loadOfficialData(showErrors=false){
    if(loadingBackend)return;loadingBackend=true;
    try{
      const {data:u}=await sb.auth.getUser();if(!u.user)throw new Error('Sessão encerrada.');currentUser=u.user;
      const {data:profile,error:profileError}=await sb.from('cp_profiles').select('*').eq('user_id',currentUser.id).single();if(profileError||!profile?.is_active)throw new Error('Seu acesso está inativo ou não foi configurado.');currentProfile=profile;
      const [rolesQ,storesQ,templatesQ,sectionsQ,itemsQ,execQ,ncQ,actionsQ,profilesQ,userStoresQ]=await Promise.all([
        sb.from('cp_access_profiles').select('*').order('created_at'),
        sb.from('cp_stores').select('*').order('name'),
        sb.from('cp_checklist_templates').select('*').eq('is_active',true).is('archived_at',null).order('created_at'),
        sb.from('cp_template_sections').select('*').is('archived_at',null).order('sort_order'),
        sb.from('cp_template_items').select('*').is('archived_at',null).order('sort_order'),
        sb.from('cp_executions').select('*').order('created_at',{ascending:false}).limit(1000),
        sb.from('cp_nonconformities').select('*').order('opened_at',{ascending:false}).limit(2000),
        sb.from('cp_action_plans').select('*').order('created_at',{ascending:false}).limit(2000),
        sb.from('cp_profiles').select('*').order('full_name'),
        sb.from('cp_user_stores').select('*')
      ]);
      for(const q of [rolesQ,storesQ,templatesQ,sectionsQ,itemsQ,execQ,ncQ,actionsQ,profilesQ,userStoresQ])if(q.error)throw q.error;
      const execIds=(execQ.data||[]).map(x=>x.id);let responses=[];if(execIds.length){const rq=await sb.from('cp_responses').select('*').in('execution_id',execIds);if(rq.error)throw rq.error;responses=rq.data||[];}
      mapBackendToState({profiles:profilesQ.data||[],userStores:userStoresQ.data||[],accessProfiles:rolesQ.data||[],stores:storesQ.data||[],templates:templatesQ.data||[],sections:sectionsQ.data||[],items:itemsQ.data||[],executions:execQ.data||[],responses,ncs:ncQ.data||[],actions:actionsQ.data||[]});
      official.ready=true;official.profile=currentProfile;official.user=currentUser;official.supabase=sb;
      render();applyOfficialIdentityAndPermissions();renderOfficialUsers();markOnline();subscribeRealtime();
    }catch(err){if(showErrors)notify(err.message||'Falha ao carregar os dados da nuvem.');throw err;}
    finally{loadingBackend=false;}
  }

  function markOnline(){const chip=document.getElementById('cloudChip');if(chip){chip.textContent='● Online · Nuvem ativa';chip.classList.add('official-cloud');}}
  function scheduleReload(){clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>loadOfficialData(false).catch(()=>{}),700);}
  function subscribeRealtime(){
    if(!sb||!currentUser)return;if(realtimeChannel)sb.removeChannel(realtimeChannel);
    realtimeChannel=sb.channel('triela-official-live');
    ['cp_profiles','cp_stores','cp_access_profiles','cp_user_stores','cp_checklist_templates','cp_template_sections','cp_template_items','cp_executions','cp_responses','cp_nonconformities','cp_action_plans'].forEach(table=>realtimeChannel.on('postgres_changes',{event:'*',schema:'public',table},scheduleReload));
    realtimeChannel.subscribe();
  }

  function permissionsForCurrentView(){
    if(!currentProfile)return [];
    if(currentProfile.role==='admin'){
      const preview=state.ui.previewRole||'admin';if(preview==='admin')return currentAccessProfile?.permissions||defaultPermissions('admin');
      const r=(state.roles||[]).find(x=>x.base===preview&&x.active!==false);return r?.permissions||defaultPermissions(preview==='manager'?'manager':'auditor');
    }
    return currentAccessProfile?.permissions||defaultPermissions(currentProfile.role);
  }
  function applyOfficialIdentityAndPermissions(){
    if(!currentProfile)return;let allowed=[...new Set(permissionsForCurrentView())];const viewBase=currentProfile.role==='admin'?(state.ui.previewRole||'admin'):mapBaseToUi(currentAccessProfile?.base_role||currentProfile.role);
    if(viewBase!=='collaborator')allowed=allowed.filter(x=>x!=='routine');
    document.querySelectorAll('.navbtn[data-page]').forEach(b=>b.classList.toggle('hidden-by-role',!allowed.includes(b.dataset.page)));
    const active=document.querySelector('.section.active')?.id;if(active&&!allowed.includes(active))navigate(allowed.includes('overview')?'overview':allowed[0]||'help');
    const prof=document.querySelector('.profile');if(prof){prof.classList.add('official-profile');prof.setAttribute('role','button');prof.setAttribute('tabindex','0');prof.title='Abrir meu perfil';const strong=prof.querySelector('strong');if(strong)strong.textContent=currentProfile.full_name;const small=prof.querySelector('small');if(small)small.innerHTML=`${esc(roleLabel(currentAccessProfile))} · <span id="profileEnvironment">${state.ui.mode==='training'?'Modo treinamento':'Operação real'}</span>`;}
    const rolePreview=document.querySelector('.role-preview');if(rolePreview)rolePreview.style.display=currentProfile.role==='admin'?'flex':'none';
    const sel=document.getElementById('previewRole');if(sel&&currentProfile.role!=='admin')sel.value=mapBaseToUi(currentAccessProfile?.base_role||currentProfile.role);
    document.querySelectorAll('.navgroup').forEach(g=>{let n=g.nextElementSibling,visible=false;while(n&&!n.classList.contains('navgroup')&&!n.classList.contains('sidebar-powered')&&!n.classList.contains('profile')){if(n.classList.contains('navbtn')&&!n.classList.contains('hidden-by-role'))visible=true;n=n.nextElementSibling;}g.style.display=visible?'':'none';});
    const unitSel=document.getElementById('overviewUnit');if(unitSel&&currentProfile.role!=='admin'&&activeUnits().length===1){unitSel.value=activeUnits()[0].name;unitSel.disabled=true;}else if(unitSel)unitSel.disabled=false;
  }
  const legacyApplyRoleView=window.applyRoleView;
  window.applyRoleView=function(){if(!official.ready){if(typeof legacyApplyRoleView==='function')legacyApplyRoleView();return;}applyOfficialIdentityAndPermissions();};
  window.setPreviewRole=function(role){if(official.ready&&currentProfile?.role!=='admin')return;state.ui.previewRole=role;localStorage.setItem('trielaV4',JSON.stringify(state));applyOfficialIdentityAndPermissions();navigate(role==='collaborator'?'routine':'overview');notify(role==='admin'?'Visualização: Administrador':role==='manager'?'Visualização: Gestor/Líder':'Visualização: Colaborador');};

  function renderOfficialUsers(){
    if(!official.ready)return;const body=document.getElementById('usersTable');if(!body)return;const table=body.closest('table');const hr=table?.querySelector('thead tr');if(hr)hr.innerHTML='<th>Nome</th><th>Usuário</th><th>Função</th><th>Perfil</th><th>Loja(s)</th><th>Status</th><th></th>';
    body.innerHTML=(state.users||[]).map(u=>`<tr><td><strong>${esc(u.name)}</strong>${u.sector?`<small class="table-sub">${esc(u.sector)}</small>`:''}</td><td>${esc(u.username||'—')}</td><td>${esc(u.jobTitle||'—')}</td><td>${esc(u.role||'—')}</td><td>${esc(u.unit||'—')}</td><td><span class="status ${u.active?'ok':'neutral'}">${u.active?'Ativo':'Inativo'}</span></td><td>${currentProfile.role==='admin'?`<button class="btn light" onclick="openOfficialUserEditor('${u.userId}')">Editar</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7"><div class="empty">Nenhum usuário cadastrado.</div></td></tr>';
  }
  const legacyRenderUsers=window.renderUsers;
  window.renderUsers=function(){if(official.ready)return renderOfficialUsers();if(typeof legacyRenderUsers==='function')return legacyRenderUsers();};
  window.addDemoUser=function(){if(!official.ready)return notify('Aguarde a conexão com a nuvem.');openOfficialUserEditor('');};

  window.openOfficialUserEditor=function(userId=''){
    if(currentProfile?.role!=='admin')return notify('Apenas administradores podem gerenciar usuários.');
    const u=userId?(state.users||[]).find(x=>x.userId===userId):null;const roles=activeRoles();const units=activeUnits();
    const roleOptions=roles.map(r=>`<option value="${r.id}" ${u?.roleId===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
    const unitChecks=units.map(s=>`<label class="permission-check"><input type="checkbox" class="official-user-store" value="${s.id}" ${u?.unitIds?.includes(s.id)?'checked':''}><span>${esc(s.name)}</span></label>`).join('')||'<div class="structure-warning">Cadastre uma loja antes de criar um usuário operacional.</div>';
    document.getElementById('structureModal')?.remove();const back=document.createElement('div');back.id='structureModal';back.className='structure-modal-back';back.innerHTML=`<div class="structure-modal"><div class="structure-modal-head"><div><h2>${u?'Editar usuário':'Novo usuário'}</h2><p>O usuário terá acesso somente às lojas marcadas abaixo.</p></div><button class="structure-close" onclick="closeStructureModal()">×</button></div><div class="structure-modal-body">
      <div class="field"><label>Nome do colaborador</label><input class="input" id="officialUserName" value="${esc(u?.name||'')}" placeholder="Nome completo"></div>
      <div class="formrow"><div class="field"><label>Usuário de login</label><input class="input" id="officialUserUsername" value="${esc(u?.username||'')}" placeholder="nome.sobrenome"></div><div class="field"><label>Função / cargo</label><input class="input" id="officialUserJob" value="${esc(u?.jobTitle||'')}" placeholder="Ex.: Operador"></div></div>
      <div class="formrow"><div class="field"><label>Setor</label><input class="input" id="officialUserSector" value="${esc(u?.sector||'')}" placeholder="Ex.: Frente de loja"></div><div class="field"><label>Perfil de acesso</label><select class="input" id="officialUserRole">${roleOptions}</select></div></div>
      <div class="field"><label>Loja(s) permitida(s)</label><div class="permission-grid">${unitChecks}</div><small class="field-help">Colaborador comum deve ficar vinculado somente à loja onde trabalha. Gestores podem receber mais de uma quando necessário.</small></div>
      <div class="field"><label>${u?'Nova senha (deixe em branco para manter)':'Senha inicial'}</label><input class="input" id="officialUserPassword" type="password" minlength="8" placeholder="Mínimo 8 caracteres"></div>
      ${u?`<label class="official-active-check"><input type="checkbox" id="officialUserActive" ${u.active?'checked':''}> Usuário ativo</label>`:''}
    </div><div class="structure-modal-foot"><button class="btn secondary" onclick="closeStructureModal()">Cancelar</button><button class="btn" id="saveOfficialUserBtn" onclick="saveOfficialUser('${userId}')">Salvar usuário</button></div></div>`;document.body.appendChild(back);
  };

  async function callAdminUsers(body){const {data}=await sb.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error('Sessão expirada.');const res=await fetch(`${SUPABASE_URL}/functions/v1/cp-admin-users`,{method:'POST',headers:authHeaders(token),body:JSON.stringify(body)});const out=await res.json();if(!res.ok)throw new Error(out.error||'Falha ao salvar usuário.');return out;}
  window.saveOfficialUser=async function(userId=''){
    const btn=document.getElementById('saveOfficialUserBtn');if(btn)btn.disabled=true;
    try{
      const full_name=document.getElementById('officialUserName').value.trim(),username=document.getElementById('officialUserUsername').value.trim().toLowerCase(),job_title=document.getElementById('officialUserJob').value.trim(),sector=document.getElementById('officialUserSector').value.trim(),access_profile_id=document.getElementById('officialUserRole').value,password=document.getElementById('officialUserPassword').value,store_ids=[...document.querySelectorAll('.official-user-store:checked')].map(x=>x.value),roleObj=state.roles.find(r=>r.id===access_profile_id),role=mapUiToBackend(roleObj?.base||'collaborator');
      if(!full_name||!username)throw new Error('Informe nome e usuário.');if(!userId&&password.length<8)throw new Error('A senha inicial deve ter pelo menos 8 caracteres.');if(role!=='admin'&&!store_ids.length)throw new Error('Selecione pelo menos uma loja para este usuário.');
      const payload=userId?{action:'update',user_id:userId,full_name,username,job_title,role,store_ids,is_active:document.getElementById('officialUserActive')?.checked!==false}:{action:'create',full_name,username,password,job_title,role,store_ids};if(userId&&password)payload.password=password;
      const out=await callAdminUsers(payload);const targetId=userId||out.user_id;
      const {error}=await sb.from('cp_profiles').update({access_profile_id,sector:sector||null}).eq('user_id',targetId);if(error)throw error;
      closeStructureModal();await loadOfficialData(false);notify(userId?'Usuário atualizado.':'Usuário criado e pronto para login.');
    }catch(err){notify(err.message||'Falha ao salvar usuário.');}finally{if(btn)btn.disabled=false;}
  };

  window.saveUnitEditor=async function(id=''){
    if(currentProfile?.role!=='admin')return notify('Apenas administradores podem gerenciar lojas.');
    try{const name=document.getElementById('unitNameInput')?.value.trim();if(!name)throw new Error('Informe o nome da loja/unidade.');const data={name,code:document.getElementById('unitCodeInput')?.value.trim()||null,city:document.getElementById('unitCityInput')?.value.trim()||null,region:document.getElementById('unitRegionInput')?.value.trim()||null};let q;if(id)q=await sb.from('cp_stores').update(data).eq('id',id);else q=await sb.from('cp_stores').insert({...data,organization_id:currentProfile.organization_id,is_active:true});if(q.error)throw q.error;closeStructureModal();await loadOfficialData(false);notify(id?'Unidade atualizada.':'Unidade cadastrada.');}catch(err){notify(err.message||'Falha ao salvar unidade.');}
  };
  window.toggleUnit=async function(id){const u=state.units.find(x=>x.id===id);if(!u)return;const active=u.active===false;const {error}=await sb.from('cp_stores').update({is_active:active,archived_at:active?null:new Date().toISOString()}).eq('id',id);if(error)return notify(error.message);await loadOfficialData(false);notify(active?'Unidade ativada.':'Unidade arquivada.');};
  window.removeUnit=async function(id){const u=state.units.find(x=>x.id===id);if(!u)return;const hasHistory=(state.runs||[]).some(r=>r.unitId===id)||(state.actions||[]).some(a=>a.unitId===id);if(hasHistory){await sb.from('cp_stores').update({is_active:false,archived_at:new Date().toISOString()}).eq('id',id);notify('Unidade arquivada para preservar o histórico.');}else{if(!confirm(`Excluir definitivamente a unidade “${u.name}”?`))return;const {error}=await sb.from('cp_stores').delete().eq('id',id);if(error)return notify(error.message);notify('Unidade excluída.');}await loadOfficialData(false);};

  window.saveRoleEditor=async function(id=''){
    if(currentProfile?.role!=='admin')return notify('Apenas administradores podem gerenciar perfis.');
    try{const name=document.getElementById('roleNameInput')?.value.trim(),base=document.getElementById('roleBaseInput')?.value,permissions=[...document.querySelectorAll('#rolePermissionGrid input:checked')].map(x=>x.value);if(!name)throw new Error('Informe o nome do perfil.');if(!permissions.length)throw new Error('Selecione pelo menos uma permissão.');const payload={name,base_role:mapUiToBackend(base),permissions};let q;if(id)q=await sb.from('cp_access_profiles').update(payload).eq('id',id);else q=await sb.from('cp_access_profiles').insert({...payload,organization_id:currentProfile.organization_id,is_active:true,is_protected:false});if(q.error)throw q.error;closeStructureModal();await loadOfficialData(false);notify(id?'Perfil atualizado.':'Perfil criado.');}catch(err){notify(err.message||'Falha ao salvar perfil.');}
  };
  window.toggleRole=async function(id){const r=state.roles.find(x=>x.id===id);if(!r||r.protected)return;const {error}=await sb.from('cp_access_profiles').update({is_active:r.active===false}).eq('id',id);if(error)return notify(error.message);await loadOfficialData(false);};
  window.removeRole=async function(id){const r=state.roles.find(x=>x.id===id);if(!r||r.protected)return;const used=(state.users||[]).some(u=>u.roleId===id);if(used){await sb.from('cp_access_profiles').update({is_active:false}).eq('id',id);notify('Perfil arquivado porque possui usuários vinculados.');}else{if(!confirm(`Excluir definitivamente o perfil “${r.name}”?`))return;const {error}=await sb.from('cp_access_profiles').delete().eq('id',id);if(error)return notify(error.message);notify('Perfil excluído.');}await loadOfficialData(false);};

  window.createTemplate=async function(){
    try{const name=document.getElementById('tplName').value.trim(),area=document.getElementById('tplCategory').value.trim()||'Geral',description=document.getElementById('tplDescription').value.trim();if(!name)throw new Error('Informe o nome do checklist.');const {data:t,error}=await sb.from('cp_checklist_templates').insert({organization_id:currentProfile.organization_id,name,area,description:description||null,frequency:'on_demand',estimated_minutes:10,is_active:true,created_by:currentUser.id}).select().single();if(error)throw error;const {error:se}=await sb.from('cp_template_sections').insert({organization_id:currentProfile.organization_id,template_id:t.id,title:'Geral',description:null,sort_order:1});if(se)throw se;document.getElementById('tplName').value='';document.getElementById('tplCategory').value='';document.getElementById('tplDescription').value='';await loadOfficialData(false);notify('Checklist criado. Agora adicione as perguntas.');}catch(err){notify(err.message||'Falha ao criar checklist.');}
  };
  window.addQuestion=async function(){
    try{const templateId=document.getElementById('builderTemplate').value,title=document.getElementById('qTitle').value.trim(),uiType=document.getElementById('qType').value,severity=document.getElementById('qCritical').value,generate=document.getElementById('qRule').value==='action';if(!templateId||!title)throw new Error('Selecione o checklist e digite a pergunta.');let {data:section,error:secErr}=await sb.from('cp_template_sections').select('*').eq('template_id',templateId).is('archived_at',null).order('sort_order').limit(1).maybeSingle();if(secErr)throw secErr;if(!section){const ins=await sb.from('cp_template_sections').insert({organization_id:currentProfile.organization_id,template_id:templateId,title:'Geral',sort_order:1}).select().single();if(ins.error)throw ins.error;section=ins.data;}const existing=(state.templates.find(t=>t.id===templateId)?.questions||[]).length;const input_type=uiType==='yesno'||uiType==='conform'?'yes_no':uiType==='score'?'number':uiType;const {error}=await sb.from('cp_template_items').insert({organization_id:currentProfile.organization_id,template_id:templateId,section_id:section.id,title,input_type,is_required:true,allows_na:false,requires_photo_on_no:false,severity,sort_order:existing+1,ui_type:uiType,generate_action_on_fail:generate});if(error)throw error;document.getElementById('qTitle').value='';await loadOfficialData(false);notify('Pergunta adicionada.');}catch(err){notify(err.message||'Falha ao adicionar pergunta.');}
  };
  window.removeQuestion=async function(tid,qid){if(!confirm('Arquivar esta pergunta?'))return;const {error}=await sb.from('cp_template_items').update({archived_at:new Date().toISOString()}).eq('id',qid);if(error)return notify(error.message);await loadOfficialData(false);notify('Pergunta arquivada.');};
  window.duplicateTemplate=async function(tid){
    try{const src=state.templates.find(t=>t.id===tid);if(!src)throw new Error('Checklist não encontrado.');const {data:t,error}=await sb.from('cp_checklist_templates').insert({organization_id:currentProfile.organization_id,name:src.name+' — Cópia',area:src.category,description:src.description||null,frequency:src.frequency||'on_demand',estimated_minutes:src.estimatedMinutes||10,is_active:true,created_by:currentUser.id}).select().single();if(error)throw error;const {data:s,error:se}=await sb.from('cp_template_sections').insert({organization_id:currentProfile.organization_id,template_id:t.id,title:'Geral',sort_order:1}).select().single();if(se)throw se;if(src.questions.length){const rows=src.questions.map((q,i)=>({organization_id:currentProfile.organization_id,template_id:t.id,section_id:s.id,title:q.title,input_type:q.type==='yesno'||q.type==='conform'?'yes_no':q.type==='score'?'number':q.type,is_required:q.required!==false,allows_na:false,requires_photo_on_no:false,severity:q.critical||'medium',sort_order:i+1,ui_type:q.type,generate_action_on_fail:q.action!==false}));const iq=await sb.from('cp_template_items').insert(rows);if(iq.error)throw iq.error;}await loadOfficialData(false);notify('Modelo duplicado.');}catch(err){notify(err.message||'Falha ao duplicar checklist.');}
  };

  window.startRun=function(tid){
    if(!official.ready)return notify('Aguarde a conexão com a nuvem.');const t=state.templates.find(x=>x.id===tid);if(!t)return;const units=activeUnits();if(!units.length)return notify(currentProfile.role==='admin'?'Cadastre uma loja antes de executar checklists.':'Você não possui uma loja liberada para execução.');let answers={};const defaultStore=units[0].id;const storePicker=units.length>1?`<div class="field official-run-store"><label>Loja da execução</label><select class="input" id="officialRunStore">${units.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>`:`<input type="hidden" id="officialRunStore" value="${defaultStore}">`;
    const root=document.getElementById('modalRoot');root.innerHTML=`<div class="modalback" id="runModal"><div class="modal"><div class="modalhead"><div><div class="eyebrow">${state.ui.mode==='training'?'Treinamento':'Execução oficial'}</div><h2 style="margin:4px 0;color:var(--navy)">${esc(t.name)}</h2><div class="sub">${esc(t.category)} · ${t.questions.length} perguntas ${state.ui.mode==='training'?'· NÃO AFETA INDICADORES OFICIAIS':''}</div></div><button class="iconbtn" onclick="closeModal()">×</button></div><div class="modalbody">${storePicker}<div id="answersBody"></div></div><div class="modalfooter"><button class="btn secondary" onclick="closeModal()">Cancelar</button><button class="btn" id="finishBtn">Finalizar checklist</button></div></div></div>`;
    document.getElementById('answersBody').innerHTML=t.questions.map((q,i)=>renderQuestion(q,i)).join('');t.questions.forEach(q=>{if(q.type==='yesno'||q.type==='conform')document.querySelectorAll(`[data-q='${q.id}']`).forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll(`[data-q='${q.id}']`).forEach(x=>x.classList.remove('selected','good','bad'));b.classList.add('selected',b.dataset.ok==='true'?'good':'bad');answers[q.id]={value:b.dataset.value,ok:b.dataset.ok==='true'};}))});document.getElementById('finishBtn').onclick=()=>finishRun(t,answers);
  };

  window.finishRun=async function(t,answers){
    const btn=document.getElementById('finishBtn');if(btn){btn.disabled=true;btn.textContent='Salvando na nuvem...';}
    try{
      for(const q of t.questions){const el=document.querySelector(`[data-input-q='${q.id}']`);if(el){let val=el.type==='file'?(el.files?.[0]?.name||''):el.value;let ok=true;if(q.type==='number'&&q.critical==='critical'&&val!==''&&Math.abs(Number(val))>10)ok=false;if(q.type==='score'&&val!==''&&Number(val)<7)ok=false;answers[q.id]={value:val,ok};}}
      const missing=t.questions.filter(q=>q.required!==false&&(answers[q.id]?.value===undefined||answers[q.id]?.value===''));if(missing.length)throw new Error(`Responda todas as perguntas obrigatórias. Faltam ${missing.length}.`);
      const list=t.questions.map(q=>({qid:q.id,ok:answers[q.id]?.ok!==false,label:answers[q.id]?.value??''})),bad=list.filter(a=>!a.ok),compliance=t.questions.length?Math.round((t.questions.length-bad.length)/t.questions.length*100):100,store_id=document.getElementById('officialRunStore').value,environment=state.ui.mode==='training'?'training':'production',now=new Date().toISOString();
      const {data:execution,error:eError}=await sb.from('cp_executions').insert({organization_id:currentProfile.organization_id,store_id,template_id:t.id,environment,status:'completed',started_at:now,completed_at:now,performed_by:currentUser.id,score:compliance}).select().single();if(eError)throw eError;
      const rows=t.questions.map(q=>{const a=answers[q.id]||{};const row={organization_id:currentProfile.organization_id,execution_id:execution.id,item_id:q.id,is_na:false,is_compliant:a.ok!==false,notes:null,responded_by:currentUser.id};if(q.type==='number'||q.type==='score')row.value_number=a.value===''?null:Number(a.value);else row.value_text=String(a.value??'');return row;});
      const {data:savedResponses,error:rError}=await sb.from('cp_responses').insert(rows).select('id,item_id');if(rError)throw rError;
      if(bad.length){const responseIdByItem=Object.fromEntries((savedResponses||[]).map(r=>[r.item_id,r.id]));const ncRows=bad.map(a=>{const q=t.questions.find(x=>x.id===a.qid);return {organization_id:currentProfile.organization_id,store_id,execution_id:execution.id,response_id:responseIdByItem[a.qid]||null,item_id:a.qid,environment,title:q?.title||'Não conformidade',description:`Resposta: ${a.label||'—'}`,severity:q?.critical||'medium',status:'open',opened_by:currentUser.id,opened_at:now};});const {data:savedNc,error:nError}=await sb.from('cp_nonconformities').insert(ncRows).select('*');if(nError)throw nError;const actionRows=(savedNc||[]).filter(n=>t.questions.find(q=>q.id===n.item_id)?.action!==false).map(n=>({organization_id:currentProfile.organization_id,store_id,nonconformity_id:n.id,environment,action_text:`Corrigir: ${n.title}`,responsible_user_id:null,due_at:new Date(Date.now()+48*3600000).toISOString(),status:'pending',created_by:currentUser.id}));if(actionRows.length){const aq=await sb.from('cp_action_plans').insert(actionRows);if(aq.error)throw aq.error;}}
      closeModal();await loadOfficialData(false);notify(environment==='training'?`Treinamento salvo na nuvem: ${compliance}% · ${bad.length} NC simuladas.`:`Checklist salvo na nuvem: ${compliance}% de conformidade${bad.length?` · ${bad.length} NC`:''}.`);
    }catch(err){notify(err.message||'Não foi possível salvar o checklist.');if(btn){btn.disabled=false;btn.textContent='Finalizar checklist';}}
  };

  window.completeAction=async function(aid){const a=[...(state.actions||[]),...(state.trainingActions||[])].find(x=>x.id===aid);if(!a)return;const {error}=await sb.from('cp_action_plans').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',aid);if(error)return notify(error.message);await loadOfficialData(false);notify('Plano de ação concluído.');};

  function openMyProfile(){
    if(!currentProfile)return;document.getElementById('structureModal')?.remove();const back=document.createElement('div');back.id='structureModal';back.className='structure-modal-back';back.innerHTML=`<div class="structure-modal profile-modal"><div class="structure-modal-head"><div><h2>Meu perfil</h2><p>${esc(currentProfile.username||'')} · ${esc(roleLabel(currentAccessProfile))}</p></div><button class="structure-close" onclick="closeStructureModal()">×</button></div><div class="structure-modal-body"><div class="profile-summary-card"><div class="profile-big-avatar">${esc(currentProfile.full_name).slice(0,1).toUpperCase()}</div><div><strong>${esc(currentProfile.full_name)}</strong><span>${esc(currentProfile.job_title||'Usuário do sistema')}</span></div></div><div class="field"><label>Nova senha</label><input class="input" id="myNewPassword" type="password" minlength="8" placeholder="Mínimo 8 caracteres"></div><div class="field"><label>Confirmar nova senha</label><input class="input" id="myConfirmPassword" type="password" minlength="8" placeholder="Repita a nova senha"></div><div class="structure-warning">Sua senha atual nunca é exibida. O administrador também não consegue vê-la; ele apenas pode redefinir uma nova senha.</div></div><div class="structure-modal-foot profile-foot"><button class="btn danger" onclick="officialLogout()">Sair do sistema</button><div><button class="btn secondary" onclick="closeStructureModal()">Cancelar</button><button class="btn" onclick="changeMyPassword()">Trocar senha</button></div></div></div>`;document.body.appendChild(back);
  }
  window.changeMyPassword=async function(){const p=document.getElementById('myNewPassword').value,c=document.getElementById('myConfirmPassword').value;if(p.length<8)return notify('A nova senha deve ter pelo menos 8 caracteres.');if(p!==c)return notify('As senhas não conferem.');const {error}=await sb.auth.updateUser({password:p});if(error)return notify(error.message);await sb.from('cp_profiles').update({password_changed_at:new Date().toISOString(),must_change_password:false}).eq('user_id',currentUser.id);closeStructureModal();notify('Senha alterada com sucesso.');};
  window.officialLogout=async function(){try{await sb.auth.signOut();}catch{}currentUser=null;currentProfile=null;currentAccessProfile=null;official.ready=false;closeStructureModal();lockApp();switchAuthView('login');};
  document.addEventListener('click',e=>{if(official.ready&&e.target.closest('.profile'))openMyProfile();});
  document.addEventListener('keydown',e=>{if(official.ready&&(e.key==='Enter'||e.key===' ')&&e.target.closest('.profile')){e.preventDefault();openMyProfile();}});

  const baseRender=window.render;
  window.render=function(){baseRender();if(official.ready){applyOfficialIdentityAndPermissions();renderOfficialUsers();markOnline();}};

  async function initOfficial(){
    lockApp();try{await loadSdk();sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'triela-official-auth'}});official.supabase=sb;const has=await ensureSession();if(has){await loadOfficialData(false);unlockApp();}else{switchAuthView('login');}}
    catch(err){setAuthError('officialLoginError',err.message||'Falha ao conectar ao banco de dados.');switchAuthView('login');}
    window.addEventListener('focus',()=>{if(official.ready)scheduleReload();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&official.ready)scheduleReload();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initOfficial);else setTimeout(initOfficial,0);
})();
