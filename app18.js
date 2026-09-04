/* Triela Checklists — exclusão segura de usuários da equipe */
(function(){
  'use strict';
  const SUPABASE_URL='https://rxzphzzmmeiaisuidwye.supabase.co';
  const SUPABASE_KEY='sb_publishable_Sd8kX9RhVbt1iJIl6fLZeA_zvGyafTD';
  const O=()=>window.TRIELA_OFFICIAL||{};
  const DB=()=>O().supabase;
  const P=()=>O().profile;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
  const fmtDate=v=>{if(!v)return '—';const [y,m,d]=String(v).slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:'—';};
  let extras=new Map(),deletedIds=new Set(),ready=false;

  function roleLabel(u){
    const role=(state.roles||[]).find(r=>r.id===u.roleId);
    if(role?.name)return role.name;
    return ({admin:'Administrador',manager:'Gestor/Líder',auditor:'Operacional',viewer:'Consulta'})[u.role]||u.role||'Usuário';
  }

  async function loadTeamState(){
    if(!O().ready||P()?.role!=='admin'||!DB())return;
    const {data,error}=await DB().from('cp_profiles').select('user_id,birth_date,first_access_code_created_at,first_access_code_used_at,triela_deleted_at,access_profile_id');
    if(error)return;
    extras=new Map((data||[]).map(x=>[x.user_id,x]));
    deletedIds=new Set((data||[]).filter(x=>x.triela_deleted_at).map(x=>x.user_id));
    state.users=(state.users||[]).filter(u=>!deletedIds.has(u.userId));
    ready=true;
    renderTeamTable();
  }

  function renderTeamTable(){
    if(!ready||P()?.role!=='admin')return;
    const body=document.getElementById('usersTable');if(!body)return;
    const table=body.closest('table'),head=table?.querySelector('thead tr');
    if(head)head.innerHTML='<th>Nome</th><th>Usuário</th><th>Função</th><th>Perfil</th><th>Nascimento</th><th>Loja(s)</th><th>1º acesso</th><th>Status</th><th>Ações</th>';
    const me=P()?.user_id;
    const users=(state.users||[]).filter(u=>!deletedIds.has(u.userId));
    body.innerHTML=users.length?users.map(u=>{
      const ex=extras.get(u.userId)||{};
      const pending=Boolean(ex.first_access_code_created_at&&!ex.first_access_code_used_at);
      const self=u.userId===me;
      return `<tr>
        <td><strong>${esc(u.name)}</strong>${u.sector?`<small class="table-sub">${esc(u.sector)}</small>`:''}</td>
        <td>${esc(u.username||'—')}</td>
        <td>${esc(u.jobTitle||'—')}</td>
        <td>${esc(roleLabel(u))}</td>
        <td>${fmtDate(u.birthDate||ex.birth_date)}</td>
        <td>${esc(u.unit||'—')}</td>
        <td><span class="status ${pending?'warn':'ok'}">${pending?'Pendente':'Concluído'}</span></td>
        <td><span class="status ${u.active?'ok':'neutral'}">${u.active?'Ativo':'Inativo'}</span></td>
        <td><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn light" onclick="openOfficialUserEditor('${u.userId}')">Editar</button>${self?'<span class="status neutral">Sua conta</span>':`<button class="btn light" style="color:#c62828;border-color:#ffd1d1;background:#fff7f7" onclick="deleteOfficialUser('${u.userId}','${esc(u.name).replace(/'/g,'&#39;')}')">Excluir</button>`}</div></td>
      </tr>`;
    }).join(''):'<tr><td colspan="9"><div class="empty">Nenhum usuário cadastrado.</div></td></tr>';
  }

  window.deleteOfficialUser=async function(userId,name){
    if(P()?.role!=='admin')return notify('Apenas administradores podem excluir usuários.');
    if(userId===P()?.user_id)return notify('Você não pode excluir a própria conta enquanto está usando ela.');
    const text=`Excluir “${name}” da equipe?\n\nO acesso será bloqueado e o usuário desaparecerá da lista. Execuções e históricos antigos serão preservados.`;
    if(!confirm(text))return;
    try{
      const db=DB();const {data}=await db.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error('Sua sessão expirou. Entre novamente.');
      const res=await fetch(`${SUPABASE_URL}/functions/v1/cp-delete-user`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({user_id:userId})});
      let out={};try{out=await res.json();}catch{}
      if(!res.ok)throw new Error(out.error||'Não foi possível excluir o usuário.');
      deletedIds.add(userId);state.users=(state.users||[]).filter(u=>u.userId!==userId);renderTeamTable();
      notify('Usuário excluído da equipe. O histórico operacional foi preservado.');
      setTimeout(()=>loadTeamState(),350);
    }catch(error){notify(error.message||'Não foi possível excluir o usuário.');}
  };

  const previousRender=window.render;
  window.render=function(){previousRender();setTimeout(renderTeamTable,0);};

  function boot(){
    if(O().ready&&P()?.role==='admin'){
      loadTeamState();
      setTimeout(loadTeamState,900);
      return true;
    }
    return false;
  }
  if(!boot()){
    let tries=0;const t=setInterval(()=>{tries++;if(boot()||tries>40)clearInterval(t);},250);
  }
  window.addEventListener('focus',()=>{if(O().ready&&P()?.role==='admin')setTimeout(loadTeamState,450);});
})();
