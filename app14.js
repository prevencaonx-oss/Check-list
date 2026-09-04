/* Triela Checklists — hotfix estável de usuários, primeiro acesso e exclusão de perfis */
(function(){
  'use strict';
  const SUPABASE_URL='https://rxzphzzmmeiaisuidwye.supabase.co';
  const SUPABASE_KEY='sb_publishable_Sd8kX9RhVbt1iJIl6fLZeA_zvGyafTD';
  const O=()=>window.TRIELA_OFFICIAL||{};
  const DB=()=>O().supabase;
  const P=()=>O().profile;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
  const roleById=id=>(state.roles||[]).find(r=>r.id===id);

  async function callAdmin(body){
    const db=DB(); if(!db) throw new Error('A conexão com a nuvem ainda não está pronta.');
    const {data}=await db.auth.getSession();
    const token=data.session?.access_token;
    if(!token) throw new Error('Sua sessão expirou. Entre novamente.');
    const res=await fetch(`${SUPABASE_URL}/functions/v1/cp-admin-users`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify(body)
    });
    let out={}; try{out=await res.json();}catch{}
    if(!res.ok) throw new Error(out.error||`Não foi possível concluir a operação (${res.status}).`);
    return out;
  }

  function formError(message=''){
    const modal=document.querySelector('#structureModal .structure-modal-body');
    if(!modal) return;
    let el=document.getElementById('officialUserFormError');
    if(!el){el=document.createElement('div');el.id='officialUserFormError';el.className='official-form-error';modal.prepend(el);}
    el.textContent=message;
    el.classList.toggle('hidden',!message);
  }

  function credentialsModal({name,username,password,code,title='Usuário criado com sucesso',subtitle='Entregue estas credenciais somente ao usuário.'}){
    let root=document.getElementById('structureModal');
    if(!root){root=document.createElement('div');root.id='structureModal';document.body.appendChild(root);}
    root.className='structure-modal-back';
    root.innerHTML=`<div class="structure-modal credential-modal-v3">
      <div class="structure-modal-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div></div>
      <div class="structure-modal-body"><div class="credential-success-v3">
        <div class="credential-person"><span class="credential-avatar">${esc(name).slice(0,1).toUpperCase()}</span><div><strong>${esc(name)}</strong><small>Primeiro acesso obrigatório</small></div></div>
        <div class="credential-line"><span>Usuário</span><strong id="credentialUserValue">${esc(username)}</strong><button type="button" onclick="copyTrielaCredential('credentialUserValue')">Copiar</button></div>
        <div class="credential-line"><span>Senha inicial</span><strong id="credentialPasswordValue">${esc(password)}</strong><button type="button" onclick="copyTrielaCredential('credentialPasswordValue')">Copiar</button></div>
        <div class="credential-line credential-code-v3"><span>Código de primeiro acesso</span><strong id="credentialCodeValue">${esc(code)}</strong><button type="button" onclick="copyTrielaCredential('credentialCodeValue')">Copiar</button></div>
        <div class="credential-rule"><strong>Importante:</strong> todo usuário novo recebe um código individual e de uso único, inclusive Operacional, Gestor e Administrador adicional.</div>
      </div></div>
      <div class="structure-modal-foot"><button class="btn" type="button" onclick="finishTrielaCredential()">Concluir</button></div>
    </div>`;
  }

  window.copyTrielaCredential=async function(id){
    const value=document.getElementById(id)?.textContent||'';
    try{await navigator.clipboard.writeText(value);notify('Copiado.');}catch{notify(value);}
  };
  window.finishTrielaCredential=function(){document.getElementById('structureModal')?.remove();setTimeout(()=>location.reload(),120);};

  window.saveOfficialUser=async function(userId=''){
    if(P()?.role!=='admin') return notify('Apenas administradores podem gerenciar usuários.');
    const btn=document.getElementById('saveOfficialUserBtn'); if(btn)btn.disabled=true; formError('');
    try{
      const full_name=document.getElementById('officialUserName')?.value.trim()||'';
      const username=document.getElementById('officialUserUsername')?.value.trim().toLowerCase()||'';
      const birth_date=document.getElementById('officialUserBirth')?.value||'';
      const job_title=document.getElementById('officialUserJob')?.value.trim()||'';
      const sector=document.getElementById('officialUserSector')?.value.trim()||'';
      const access_profile_id=document.getElementById('officialUserRole')?.value||'';
      const password=document.getElementById('officialUserPassword')?.value||'';
      const store_ids=[...document.querySelectorAll('.official-user-store:checked')].map(x=>x.value);
      const role=roleById(access_profile_id);
      if(!full_name)throw new Error('Informe o nome completo do colaborador.');
      if(!username)throw new Error('Informe o usuário de login.');
      if(!/^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$/.test(username))throw new Error('O usuário deve ter de 3 a 40 caracteres, sem espaços. Use letras, números, ponto, _ ou -.');
      if(!birth_date)throw new Error('Informe a data de nascimento.');
      if(!access_profile_id||!role)throw new Error('Selecione o tipo de perfil.');
      if(!userId&&password.length<8)throw new Error('A senha inicial deve ter pelo menos 8 caracteres.');
      if(role.base==='collaborator'&&store_ids.length!==1)throw new Error('Perfil operacional: selecione exatamente UMA loja.');
      if(role.base==='manager'&&!store_ids.length)throw new Error('Gestor/Líder: selecione pelo menos uma loja.');
      const payload={action:userId?'update':'create',...(userId?{user_id:userId}:{}),full_name,username,birth_date,job_title,sector,access_profile_id,store_ids,...(userId?{is_active:document.getElementById('officialUserActive')?.checked!==false}:{})};
      if(password)payload.password=password;
      const out=await callAdmin(payload);
      if(!userId){
        if(!out.first_access_code)throw new Error('Usuário criado sem retorno do código. Abra o usuário e gere um novo código.');
        credentialsModal({name:full_name,username,password,code:out.first_access_code});
        return;
      }
      if(password&&out.first_access_code){credentialsModal({name:full_name,username,password,code:out.first_access_code,title:'Senha e código redefinidos',subtitle:'Use estas novas credenciais no próximo acesso.'});return;}
      document.getElementById('structureModal')?.remove();notify('Usuário atualizado com sucesso.');setTimeout(()=>location.reload(),120);
    }catch(error){formError(error.message||'Não foi possível salvar o usuário.');notify(error.message||'Não foi possível salvar o usuário.');if(btn)btn.disabled=false;}
  };

  window.resetOfficialFirstCode=async function(userId){
    if(P()?.role!=='admin')return notify('Apenas administradores podem gerar código.');
    try{
      const u=(state.users||[]).find(x=>x.userId===userId);
      const out=await callAdmin({action:'reset_first_access_code',user_id:userId});
      if(!out.first_access_code)throw new Error('O servidor não retornou o novo código.');
      credentialsModal({name:u?.name||'Usuário',username:u?.username||'',password:'Senha atual do usuário',code:out.first_access_code,title:'Novo código de primeiro acesso',subtitle:'O código anterior foi invalidado.'});
    }catch(error){notify(error.message||'Não foi possível gerar o código.');}
  };

  window.removeRole=async function(id){
    if(P()?.role!=='admin')return notify('Apenas administradores podem excluir perfis.');
    const role=roleById(id);if(!role)return notify('Perfil não encontrado.');
    if(role.protected||role.base==='admin')return notify('O perfil Administrador principal é protegido.');
    const linked=(state.users||[]).filter(u=>u.roleId===id);
    const text=linked.length?`Excluir definitivamente o perfil “${role.name}”? ${linked.length} usuário(s) vinculado(s) serão desativados e o histórico será preservado.`:`Excluir definitivamente o perfil “${role.name}”?`;
    if(!confirm(text))return;
    try{
      const out=await callAdmin({action:'delete_access_profile',access_profile_id:id});
      notify(out.deactivated_users?`Perfil excluído. ${out.deactivated_users} usuário(s) foram desativados.`:'Perfil excluído com sucesso.');
      setTimeout(()=>location.reload(),120);
    }catch(error){notify(error.message||'Não foi possível excluir o perfil.');}
  };

  function patchLabelsOnce(){
    const input=document.getElementById('officialFirstCode');if(input)input.placeholder='TRIELA-XXXXXXXXXX';
    const help=document.querySelector('#officialFirstCodeWrap .first-code-help');if(help&&help.textContent.indexOf('TRIELA-')<0)help.textContent='Todo usuário novo recebe um código individual de primeiro acesso. Use o código TRIELA-... entregue pelo administrador.';
    document.querySelectorAll('#rolesAdminList .danger-text').forEach(btn=>{if(!btn.closest('.structure-row')?.querySelector('.protected-pill')&&btn.textContent!=='Excluir')btn.textContent='Excluir';});
  }
  patchLabelsOnce();
  setTimeout(patchLabelsOnce,300);
  setTimeout(patchLabelsOnce,1200);
})();
