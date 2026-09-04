/* Administração configurável: perfis, permissões e lojas/unidades */
(function(){
  const DEFAULT_PERMISSIONS=['overview','execute','correct','analyze','models','builder','training','help','users','settings'];
  const permissionLabels={overview:'Visão geral',routine:'Minha rotina',execute:'Checklists',correct:'Não conformidades',analyze:'Análises',models:'Modelos',builder:'Construtor',training:'Treinamento',help:'Centro de Ajuda',users:'Equipe e acessos',settings:'Configurações'};
  const baseLabels={admin:'Administrador',manager:'Gestão',collaborator:'Operacional'};

  state.roles=Array.isArray(state.roles)?state.roles:[];
  state.units=Array.isArray(state.units)?state.units:[];
  if(!state.roles.length){
    state.roles=[
      {id:'role-admin',name:'Administrador',base:'admin',permissions:[...DEFAULT_PERMISSIONS],active:true,protected:true},
      {id:'role-manager',name:'Gestor/Líder',base:'manager',permissions:['overview','execute','correct','analyze','training','help'],active:true,protected:false},
      {id:'role-collaborator',name:'Colaborador/Operacional',base:'collaborator',permissions:['routine','execute','training','help'],active:true,protected:false}
    ];
    localStorage.setItem('trielaV4',JSON.stringify(state));
  }

  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function slug(){return Math.random().toString(36).slice(2,9);}
  function linkedRole(role){return (state.users||[]).some(u=>u.role===role.name||u.roleId===role.id);}
  function linkedUnit(unit){return (state.users||[]).some(u=>u.unit===unit.name||u.unitId===unit.id)||(state.runs||[]).some(r=>r.unit===unit.name||r.unitId===unit.id)||(state.actions||[]).some(a=>a.unit===unit.name||a.unitId===unit.id);}
  function activeCount(arr){return arr.filter(x=>x.active!==false).length;}

  function ensureAdminArea(){
    const settings=document.getElementById('settings');if(!settings)return;
    let area=document.getElementById('structureAdminArea');
    if(!area){
      area=document.createElement('div');area.id='structureAdminArea';area.className='structure-admin';
      const firstGrid=settings.querySelector('.grid2');if(firstGrid)settings.insertBefore(area,firstGrid);else settings.appendChild(area);
    }
    area.innerHTML=`
      <div class="structure-summary">
        <div class="structure-stat"><span>Perfis ativos</span><strong>${activeCount(state.roles)}</strong><small>permissões configuráveis</small></div>
        <div class="structure-stat"><span>Lojas / unidades ativas</span><strong>${activeCount(state.units)}</strong><small>${state.units.length?'estrutura cadastrada':'nenhuma loja cadastrada'}</small></div>
      </div>
      <div class="structure-grid">
        <div class="panel structure-panel">
          <div class="structure-head"><div><h2>Perfis e permissões</h2><p class="desc">Crie funções próprias e determine o nível de acesso de cada uma.</p></div><button class="btn" type="button" onclick="openRoleEditor()">+ Adicionar perfil</button></div>
          <div class="structure-list" id="rolesAdminList"></div>
        </div>
        <div class="panel structure-panel">
          <div class="structure-head"><div><h2>Lojas / unidades</h2><p class="desc">Cadastre a estrutura da empresa e vincule usuários e dados à unidade correta.</p></div><button class="btn" type="button" onclick="openUnitEditor()">+ Adicionar loja</button></div>
          <div class="structure-list" id="unitsAdminList"></div>
        </div>
      </div>
      <div class="structure-note"><strong>Proteção de histórico:</strong> se um perfil ou loja já estiver vinculado a usuários, execuções ou ocorrências, o sistema arquiva em vez de excluir definitivamente.</div>`;
    renderRoleList();renderUnitList();
  }

  function renderRoleList(){
    const el=document.getElementById('rolesAdminList');if(!el)return;
    el.innerHTML=state.roles.map(role=>{
      const perms=(role.permissions||[]).map(p=>permissionLabels[p]||p).slice(0,4),more=Math.max(0,(role.permissions||[]).length-perms.length),used=linkedRole(role);
      return `<div class="structure-row ${role.active===false?'archived':''}">
        <div class="structure-row-main"><div class="structure-avatar role">${esc(role.name).slice(0,1).toUpperCase()}</div><div><strong>${esc(role.name)}</strong><small>${baseLabels[role.base]||'Personalizado'} • ${perms.map(esc).join(', ')}${more?` +${more}`:''}</small></div></div>
        <div class="structure-row-meta"><span class="status ${role.active===false?'neutral':'ok'}">${role.active===false?'Arquivado':'Ativo'}</span>${role.protected?'<span class="protected-pill">Protegido</span>':''}</div>
        <div class="structure-actions"><button class="mini-action" onclick="openRoleEditor('${role.id}')">Editar</button>${!role.protected?`<button class="mini-action" onclick="toggleRole('${role.id}')">${role.active===false?'Ativar':'Desativar'}</button><button class="mini-action danger-text" onclick="removeRole('${role.id}')">${used?'Arquivar':'Excluir'}</button>`:''}</div>
      </div>`;
    }).join('');
  }

  function renderUnitList(){
    const el=document.getElementById('unitsAdminList');if(!el)return;
    if(!state.units.length){el.innerHTML='<div class="structure-empty"><strong>Nenhuma loja cadastrada</strong><span>Adicione a primeira unidade para começar a organizar usuários, checklists e relatórios.</span><button class="btn light" onclick="openUnitEditor()">Cadastrar primeira loja</button></div>';return;}
    el.innerHTML=state.units.map(unit=>{
      const used=linkedUnit(unit),detail=[unit.code,unit.city,unit.region].filter(Boolean).join(' • ')||'Sem informações adicionais';
      return `<div class="structure-row ${unit.active===false?'archived':''}">
        <div class="structure-row-main"><div class="structure-avatar unit">⌂</div><div><strong>${esc(unit.name)}</strong><small>${esc(detail)}</small></div></div>
        <div class="structure-row-meta"><span class="status ${unit.active===false?'neutral':'ok'}">${unit.active===false?'Arquivada':'Ativa'}</span>${used?'<span class="linked-pill">Com histórico</span>':''}</div>
        <div class="structure-actions"><button class="mini-action" onclick="openUnitEditor('${unit.id}')">Editar</button><button class="mini-action" onclick="toggleUnit('${unit.id}')">${unit.active===false?'Ativar':'Desativar'}</button><button class="mini-action danger-text" onclick="removeUnit('${unit.id}')">${used?'Arquivar':'Excluir'}</button></div>
      </div>`;
    }).join('');
  }

  function modalShell(title,subtitle,body,saveLabel,saveAction){
    document.getElementById('structureModal')?.remove();
    const back=document.createElement('div');back.id='structureModal';back.className='structure-modal-back';back.innerHTML=`<div class="structure-modal"><div class="structure-modal-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="structure-close" onclick="closeStructureModal()">×</button></div><div class="structure-modal-body">${body}</div><div class="structure-modal-foot"><button class="btn secondary" onclick="closeStructureModal()">Cancelar</button><button class="btn" onclick="${saveAction}">${saveLabel}</button></div></div>`;document.body.appendChild(back);
  }

  window.closeStructureModal=function(){document.getElementById('structureModal')?.remove();};
  window.openRoleEditor=function(id){
    const role=id?state.roles.find(r=>r.id===id):null,selected=new Set(role?.permissions||['routine','execute','help']);
    const checks=Object.entries(permissionLabels).map(([key,label])=>`<label class="permission-check"><input type="checkbox" value="${key}" ${selected.has(key)?'checked':''}><span>${label}</span></label>`).join('');
    modalShell(role?'Editar perfil':'Novo perfil','Defina a experiência base e exatamente quais áreas esse perfil poderá acessar.',`
      <div class="field"><label>Nome do perfil</label><input class="input" id="roleNameInput" value="${esc(role?.name||'')}" placeholder="Ex.: Supervisor Regional"></div>
      <div class="field"><label>Tipo de experiência</label><select class="input" id="roleBaseInput"><option value="collaborator" ${role?.base==='collaborator'?'selected':''}>Operacional</option><option value="manager" ${role?.base==='manager'?'selected':''}>Gestão</option><option value="admin" ${role?.base==='admin'?'selected':''}>Administrativa</option></select></div>
      <div class="field"><label>Permissões</label><div class="permission-grid" id="rolePermissionGrid">${checks}</div></div>
      ${role?.protected?'<div class="structure-warning">O perfil Administrador é protegido. Você pode ajustar permissões, mas não pode excluí-lo nem desativá-lo.</div>':''}`,'Salvar perfil',`saveRoleEditor('${id||''}')`);
  };

  window.saveRoleEditor=function(id){
    const name=document.getElementById('roleNameInput')?.value.trim();if(!name)return toast('Informe o nome do perfil.');
    const duplicate=state.roles.some(r=>r.id!==id&&r.name.toLowerCase()===name.toLowerCase());if(duplicate)return toast('Já existe um perfil com esse nome.');
    const permissions=[...document.querySelectorAll('#rolePermissionGrid input:checked')].map(x=>x.value);if(!permissions.length)return toast('Selecione pelo menos uma permissão.');
    const base=document.getElementById('roleBaseInput').value;
    if(id){const role=state.roles.find(r=>r.id===id);if(role){role.name=name;role.base=base;role.permissions=permissions;}}
    else state.roles.push({id:'role-'+slug(),name,base,permissions,active:true,protected:false});
    save();closeStructureModal();ensureAdminArea();toast(id?'Perfil atualizado.':'Perfil criado.');
  };

  window.toggleRole=function(id){const role=state.roles.find(r=>r.id===id);if(!role||role.protected)return;if(role.active!==false&&linkedRole(role)){if(!confirm('Este perfil possui usuários vinculados. Deseja arquivá-lo? Os históricos serão preservados.'))return;}role.active=role.active===false;save();ensureAdminArea();toast(role.active?'Perfil ativado.':'Perfil arquivado.');};
  window.removeRole=function(id){const role=state.roles.find(r=>r.id===id);if(!role||role.protected)return;if(linkedRole(role)){role.active=false;save();ensureAdminArea();return toast('Perfil arquivado porque possui usuários vinculados.');}if(!confirm(`Excluir definitivamente o perfil “${role.name}”?`))return;state.roles=state.roles.filter(r=>r.id!==id);save();ensureAdminArea();toast('Perfil excluído.');};

  window.openUnitEditor=function(id){
    const unit=id?state.units.find(u=>u.id===id):null;
    modalShell(unit?'Editar loja / unidade':'Nova loja / unidade','Cadastre a unidade que será usada em usuários, checklists, filtros e relatórios.',`
      <div class="field"><label>Nome da loja / unidade</label><input class="input" id="unitNameInput" value="${esc(unit?.name||'')}" placeholder="Ex.: Loja Matriz"></div>
      <div class="formrow"><div class="field"><label>Código interno</label><input class="input" id="unitCodeInput" value="${esc(unit?.code||'')}" placeholder="Ex.: LJ-001"></div><div class="field"><label>Cidade</label><input class="input" id="unitCityInput" value="${esc(unit?.city||'')}" placeholder="Cidade"></div></div>
      <div class="field"><label>Regional / grupo (opcional)</label><input class="input" id="unitRegionInput" value="${esc(unit?.region||'')}" placeholder="Ex.: Regional Norte"></div>`,'Salvar unidade',`saveUnitEditor('${id||''}')`);
  };

  window.saveUnitEditor=function(id){
    const name=document.getElementById('unitNameInput')?.value.trim();if(!name)return toast('Informe o nome da loja/unidade.');
    if(state.units.some(u=>u.id!==id&&u.name.toLowerCase()===name.toLowerCase()))return toast('Já existe uma unidade com esse nome.');
    const data={name,code:document.getElementById('unitCodeInput')?.value.trim()||'',city:document.getElementById('unitCityInput')?.value.trim()||'',region:document.getElementById('unitRegionInput')?.value.trim()||''};
    if(id){const unit=state.units.find(u=>u.id===id);if(unit)Object.assign(unit,data);}else state.units.push({id:'unit-'+slug(),...data,active:true});
    save();closeStructureModal();ensureAdminArea();refreshUnitSelectors();toast(id?'Unidade atualizada.':'Unidade cadastrada.');
  };
  window.toggleUnit=function(id){const unit=state.units.find(u=>u.id===id);if(!unit)return;if(unit.active!==false&&linkedUnit(unit)){if(!confirm('Esta unidade possui dados vinculados. Deseja arquivá-la? O histórico continuará disponível nos relatórios.'))return;}unit.active=unit.active===false;save();ensureAdminArea();refreshUnitSelectors();toast(unit.active?'Unidade ativada.':'Unidade arquivada.');};
  window.removeUnit=function(id){const unit=state.units.find(u=>u.id===id);if(!unit)return;if(linkedUnit(unit)){unit.active=false;save();ensureAdminArea();refreshUnitSelectors();return toast('Unidade arquivada para preservar o histórico.');}if(!confirm(`Excluir definitivamente a unidade “${unit.name}”?`))return;state.units=state.units.filter(u=>u.id!==id);save();ensureAdminArea();refreshUnitSelectors();toast('Unidade excluída.');};

  function refreshUnitSelectors(){
    const active=state.units.filter(u=>u.active!==false),sel=document.getElementById('overviewUnit');if(!sel)return;
    const current=sel.value;sel.innerHTML='<option>Todas as unidades</option>'+active.map(u=>`<option>${esc(u.name)}</option>`).join('');if([...sel.options].some(o=>o.value===current))sel.value=current;
  }

  const baseRender=window.render;
  window.render=function(){baseRender();ensureAdminArea();refreshUnitSelectors();};
  ensureAdminArea();refreshUnitSelectors();
})();
