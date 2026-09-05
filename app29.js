/* Triela Checklists — SaaS V1.2: painel comercial de licenças */
(function(){
'use strict';
const SUPABASE_URL='https://rxzphzzmmeiaisuidwye.supabase.co';
const SUPABASE_KEY='sb_publishable_Sd8kX9RhVbt1iJIl6fLZeA_zvGyafTD';
const O=()=>window.TRIELA_OFFICIAL||{};
const S=()=>window.TRIELA_SAAS_V1||{};
const DB=()=>O().supabase;
const E=()=>S().entitlement||null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
let consoleData=null,loading=false,lastLoad=0;
const statusLabel=s=>({trial:'Teste',active:'Ativa',past_due:'Pagamento pendente',suspended:'Suspensa',cancelled:'Cancelada',expired:'Expirada'}[s]||s||'—');
const typeLabel=t=>t==='personal'?'Pessoal':'Empresa';
const fmtDate=v=>v?new Date(v).toLocaleDateString('pt-BR'):'Sem vencimento';
const maskKey=k=>{k=String(k||'');return k.length>12?k.slice(0,11)+'••••'+k.slice(-4):k||'—'};
function isPlatform(){return E()?.is_platform_admin===true}
function modal(html){document.getElementById('trielaCommercialModal')?.remove();const b=document.createElement('div');b.id='trielaCommercialModal';b.className='triela-commercial-back';b.innerHTML=html;document.body.appendChild(b);return b}
window.closeTrielaCommercialModal=()=>document.getElementById('trielaCommercialModal')?.remove();

async function loadConsole(force=false){
  if(!isPlatform()||!DB()||loading)return;
  if(!force&&consoleData&&Date.now()-lastLoad<12000){renderConsole();return;}
  loading=true;
  try{
    const db=DB();
    const [aq,lq,pq,iq]=await Promise.all([
      db.from('cp_accounts').select('id,account_type,display_name,status,owner_user_id,created_at').order('created_at',{ascending:false}),
      db.from('cp_licenses').select('id,account_id,plan_id,license_key,status,is_current,starts_at,trial_ends_at,expires_at,created_at').eq('is_current',true).order('created_at',{ascending:false}),
      db.from('cp_plans').select('id,code,name,audience,description,is_active').eq('is_active',true).order('sort_order',{ascending:true}),
      db.from('cp_license_invites').select('id,account_id,license_id,invite_code_hint,recipient_name,recipient_contact,status,expires_at,redeemed_at,created_at').order('created_at',{ascending:false})
    ]);
    const err=aq.error||lq.error||pq.error||iq.error;if(err)throw err;
    consoleData={accounts:aq.data||[],licenses:lq.data||[],plans:pq.data||[],invites:iq.data||[]};lastLoad=Date.now();renderConsole();
  }catch(err){console.error(err);const el=document.getElementById('commercialLicenseConsole');if(el)el.innerHTML='<div class="saas-error">Não foi possível carregar o painel comercial agora.</div>'}
  finally{loading=false}
}
function planById(id){return consoleData?.plans.find(x=>x.id===id)}
function licenseByAccount(id){return consoleData?.licenses.find(x=>x.account_id===id)}
function latestInvite(id){return consoleData?.invites.find(x=>x.account_id===id)}
function pendingInvite(id){return consoleData?.invites.find(x=>x.account_id===id&&x.status==='pending'&&new Date(x.expires_at)>new Date())}
function ensureConsole(){
  if(!isPlatform())return null;const section=document.getElementById('platformSaas');if(!section)return null;
  let root=document.getElementById('commercialLicenseConsole');
  if(!root){root=document.createElement('div');root.id='commercialLicenseConsole';root.className='commercial-license-console';const firstGrid=section.querySelector('.saas-grid');if(firstGrid)section.insertBefore(root,firstGrid);else section.appendChild(root)}
  return root;
}
function renderConsole(){
  const root=ensureConsole();if(!root||!consoleData)return;
  const accounts=consoleData.accounts.filter(a=>licenseByAccount(a.id));
  const commercial=accounts.filter(a=>planById(licenseByAccount(a.id)?.plan_id)?.code!=='legacy_enterprise');
  const active=commercial.filter(a=>['active','trial'].includes(licenseByAccount(a.id)?.status)).length;
  const pending=commercial.filter(a=>!a.owner_user_id&&pendingInvite(a.id)).length;
  root.innerHTML=`<div class="commercial-head"><div><div class="eyebrow">COMERCIAL E LICENÇAS</div><h2>Painel de clientes</h2><p>Libere uma conta para outra pessoa ou empresa e controle o acesso sem misturar os dados.</p></div><button class="btn commercial-new" onclick="openCommercialLicenseModal()">+ Liberar nova licença</button></div>
  <div class="commercial-kpis"><div><span>Clientes comerciais</span><strong>${commercial.length}</strong></div><div><span>Licenças ativas/teste</span><strong>${active}</strong></div><div><span>Aguardando ativação</span><strong>${pending}</strong></div><div><span>Contas ativadas</span><strong>${commercial.filter(a=>a.owner_user_id).length}</strong></div></div>
  <div class="commercial-list">${accounts.length?accounts.map(a=>licenseRow(a)).join(''):'<div class="commercial-empty">Nenhuma licença cadastrada ainda.</div>'}</div>`;
}
function licenseRow(a){
  const l=licenseByAccount(a.id),p=planById(l?.plan_id),inv=latestInvite(a.id),legacy=p?.code==='legacy_enterprise';
  const until=l?.status==='trial'?l.trial_ends_at:l?.expires_at;
  const inviteState=a.owner_user_id?'Ativada':inv?.status==='pending'&&new Date(inv.expires_at)>new Date()?'Convite pendente':inv?.status==='redeemed'?'Ativada':'Sem convite válido';
  return `<div class="commercial-row ${legacy?'legacy':''}"><div class="commercial-main"><div class="commercial-avatar ${esc(a.account_type)}">${a.account_type==='personal'?'●':'◆'}</div><div><strong>${esc(a.display_name)}</strong><small>${esc(typeLabel(a.account_type))} • ${esc(p?.name||'Sem plano')}</small><small class="license-small">${esc(maskKey(l?.license_key))}</small></div></div><div class="commercial-meta"><span class="commercial-status ${esc(l?.status)}">${esc(statusLabel(l?.status))}</span><small>Validade: ${esc(fmtDate(until))}</small></div><div class="commercial-meta"><strong class="activation-state ${a.owner_user_id?'done':'pending'}">${esc(inviteState)}</strong><small>${!a.owner_user_id&&inv?.invite_code_hint?`Código ••••${esc(inv.invite_code_hint)}`:(a.owner_user_id?'Proprietário cadastrado':'')}</small></div><div class="commercial-actions">${legacy?'<span class="commercial-protected">Interna / protegida</span>':actionButtons(a,l,p)}</div></div>`;
}
function actionButtons(a,l,p){
  const act=a.owner_user_id?'':`<button onclick="regenerateCommercialInvite('${a.id}')">Novo convite</button>`;
  const state=l.status==='suspended'?`<button onclick="commercialLicenseAction('${l.id}','reactivate')">Reativar</button>`:`<button onclick="commercialLicenseAction('${l.id}','suspend')">Suspender</button>`;
  return `${act}<button onclick="openRenewLicense('${l.id}')">Renovar</button><button onclick="openChangePlan('${l.id}','${a.account_type}','${p?.code||''}')">Plano</button>${state}<button class="danger" onclick="commercialLicenseAction('${l.id}','cancel')">Cancelar</button>`;
}

window.openCommercialLicenseModal=function(){
  if(!consoleData)return loadConsole(true).then(()=>window.openCommercialLicenseModal());
  const plans=consoleData.plans.filter(p=>p.code!=='legacy_enterprise');
  modal(`<div class="triela-commercial-modal"><div class="tcm-head"><div><div class="eyebrow">NOVA LICENÇA</div><h2>Liberar acesso para um cliente</h2><p>A conta nasce isolada e o cliente recebe um código para criar o próprio usuário e senha.</p></div><button onclick="closeTrielaCommercialModal()">×</button></div><div class="tcm-body"><div class="commercial-form-grid"><label><span>Tipo de uso</span><select id="clType" class="input" onchange="filterCommercialPlans()"><option value="personal">Pessoal</option><option value="business" selected>Empresa</option></select></label><label><span>Plano</span><select id="clPlan" class="input">${plans.map(p=>`<option data-audience="${esc(p.audience)}" value="${esc(p.code)}">${esc(p.name)}</option>`).join('')}</select></label><label class="wide"><span>Nome da pessoa / empresa</span><input id="clName" class="input" placeholder="Ex.: Empresa ABC" maxlength="90"></label><label><span>Responsável</span><input id="clRecipient" class="input" placeholder="Nome de quem receberá"></label><label><span>Contato (opcional)</span><input id="clContact" class="input" placeholder="WhatsApp ou e-mail"></label><label><span>Situação inicial</span><select id="clStatus" class="input"><option value="trial">Teste</option><option value="active">Ativa</option></select></label><label><span>Validade</span><select id="clDays" class="input"><option value="7">7 dias</option><option value="15">15 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option><option value="180">180 dias</option><option value="365">1 ano</option></select></label></div><div class="commercial-note">O código de ativação fica válido por 14 dias. Se o cliente não ativar, você pode gerar um novo código.</div><div class="tcm-actions"><button class="btn secondary" onclick="closeTrielaCommercialModal()">Cancelar</button><button class="btn" id="issueCommercialBtn" onclick="issueCommercialLicense()">Gerar licença e convite</button></div></div></div>`);
  filterCommercialPlans();setTimeout(()=>document.getElementById('clName')?.focus(),60);
};
window.filterCommercialPlans=function(){
  const type=document.getElementById('clType')?.value,sel=document.getElementById('clPlan');if(!sel)return;let first=null;[...sel.options].forEach(o=>{const ok=o.dataset.audience==='both'||o.dataset.audience===type;o.hidden=!ok;o.disabled=!ok;if(ok&&!first)first=o});if(sel.selectedOptions[0]?.disabled&&first)sel.value=first.value;
};
window.issueCommercialLicense=async function(){
  const db=DB(),btn=document.getElementById('issueCommercialBtn');if(!db)return;
  const account_type=document.getElementById('clType')?.value,display_name=document.getElementById('clName')?.value.trim(),plan_code=document.getElementById('clPlan')?.value,license_status=document.getElementById('clStatus')?.value,duration_days=Number(document.getElementById('clDays')?.value||30),recipient_name=document.getElementById('clRecipient')?.value.trim()||null,recipient_contact=document.getElementById('clContact')?.value.trim()||null;
  if(!display_name)return notify('Informe o nome da pessoa ou empresa.');if(!plan_code)return notify('Selecione o plano.');
  if(btn){btn.disabled=true;btn.textContent='Gerando licença…'}
  try{const {data,error}=await db.rpc('cp_platform_issue_license',{p_account_type:account_type,p_display_name:display_name,p_plan_code:plan_code,p_license_status:license_status,p_duration_days:duration_days,p_recipient_name:recipient_name,p_recipient_contact:recipient_contact});if(error)throw error;showCommercialSuccess(data);await loadConsole(true)}catch(err){notify(err.message||'Não foi possível gerar a licença.');if(btn){btn.disabled=false;btn.textContent='Gerar licença e convite'}}
};
function activationMessage(d){return `Sua licença Triela Checklists foi liberada.\n\nCliente: ${d.account_name}\nLicença: ${d.license_key}\nCódigo de ativação: ${d.activation_code}\n\nAcesse: https://prevencaonx-oss.github.io/Check-list/?activate=1\nToque em “Ativar minha licença” e crie seu usuário e senha.`}
function showCommercialSuccess(d){
  const root=document.querySelector('#trielaCommercialModal .triela-commercial-modal');if(!root)return;
  root.innerHTML=`<div class="tcm-head success"><div><div class="eyebrow">LICENÇA LIBERADA</div><h2>Pronto para enviar ao cliente</h2><p>O código abaixo é exibido agora. Depois, por segurança, o painel mostrará apenas os últimos caracteres.</p></div><button onclick="closeTrielaCommercialModal()">×</button></div><div class="tcm-body"><div class="license-success-card"><span>LICENÇA</span><strong>${esc(d.license_key)}</strong><span>CÓDIGO DE ATIVAÇÃO</span><b id="commercialActivationCode">${esc(d.activation_code)}</b><small>Convite válido até ${esc(fmtDate(d.invite_expires_at))}</small></div><div class="share-preview">${esc(activationMessage(d)).replace(/\n/g,'<br>')}</div><div class="tcm-actions share"><button class="btn secondary" onclick="copyCommercialText('${esc(String(d.activation_code).replace(/'/g,"\\'"))}')">Copiar código</button><button class="btn" id="copyCommercialInviteBtn">Copiar convite completo</button></div></div>`;
  document.getElementById('copyCommercialInviteBtn').onclick=()=>copyCommercialText(activationMessage(d));
}
window.copyCommercialText=async function(text){try{await navigator.clipboard.writeText(text);notify('Copiado.')}catch(_){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();notify('Copiado.')}};
window.regenerateCommercialInvite=async function(accountId){
  const db=DB();if(!db)return;if(!confirm('Gerar um novo código? O convite anterior deixará de funcionar.'))return;
  try{const {data,error}=await db.rpc('cp_platform_regenerate_license_invite',{p_account_id:accountId,p_recipient_name:null,p_recipient_contact:null});if(error)throw error;const account=consoleData.accounts.find(a=>a.id===accountId);showCommercialSuccess({...data,account_name:account?.display_name||'Cliente',license_key:licenseByAccount(accountId)?.license_key||''});await loadConsole(true)}catch(err){notify(err.message||'Não foi possível gerar o novo convite.')}
};
window.openRenewLicense=function(id){modal(`<div class="triela-commercial-modal compact"><div class="tcm-head"><div><div class="eyebrow">RENOVAR</div><h2>Adicionar validade</h2></div><button onclick="closeTrielaCommercialModal()">×</button></div><div class="tcm-body"><label class="tcm-single"><span>Período</span><select id="renewDays" class="input"><option value="30">30 dias</option><option value="90">90 dias</option><option value="180">180 dias</option><option value="365">1 ano</option></select></label><div class="tcm-actions"><button class="btn secondary" onclick="closeTrielaCommercialModal()">Cancelar</button><button class="btn" onclick="commercialLicenseAction('${id}','renew',Number(document.getElementById('renewDays').value))">Renovar</button></div></div></div>`)};
window.openChangePlan=function(id,type,current){
  const plans=(consoleData?.plans||[]).filter(p=>p.code!=='legacy_enterprise'&&(p.audience==='both'||p.audience===type));
  modal(`<div class="triela-commercial-modal compact"><div class="tcm-head"><div><div class="eyebrow">ALTERAR PLANO</div><h2>Plano da licença</h2></div><button onclick="closeTrielaCommercialModal()">×</button></div><div class="tcm-body"><label class="tcm-single"><span>Novo plano</span><select id="changePlanCode" class="input">${plans.map(p=>`<option value="${esc(p.code)}" ${p.code===current?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="tcm-actions"><button class="btn secondary" onclick="closeTrielaCommercialModal()">Cancelar</button><button class="btn" onclick="commercialLicenseAction('${id}','change_plan',null,document.getElementById('changePlanCode').value)">Salvar plano</button></div></div></div>`)};
window.commercialLicenseAction=async function(id,action,days=null,planCode=null){
  const destructive=['suspend','cancel'].includes(action);if(destructive&&!confirm(action==='cancel'?'Cancelar esta licença? O cliente perderá o acesso comercial.':'Suspender temporariamente esta licença?'))return;
  const db=DB();if(!db)return;try{const {error}=await db.rpc('cp_platform_manage_license',{p_license_id:id,p_action:action,p_days:days,p_plan_code:planCode});if(error)throw error;closeTrielaCommercialModal();await loadConsole(true);notify({renew:'Licença renovada.',suspend:'Licença suspensa.',reactivate:'Licença reativada.',cancel:'Licença cancelada.',change_plan:'Plano atualizado.'}[action]||'Licença atualizada.')}catch(err){notify(err.message||'Não foi possível atualizar a licença.')}
};

/* Ativação pelo próprio cliente na tela de login */
function ensureLicenseActivationView(){
  const shell=document.getElementById('officialAuthShell'),login=document.getElementById('officialLoginView');if(!shell||!login)return;
  let trigger=document.getElementById('showLicenseActivationBtn');
  if(!trigger){trigger=document.createElement('button');trigger.id='showLicenseActivationBtn';trigger.type='button';trigger.className='official-auth-link commercial-activate-link';trigger.textContent='Ativar minha licença Triela';const adminBtn=document.getElementById('showActivationBtn');if(adminBtn)adminBtn.insertAdjacentElement('beforebegin',trigger);else login.appendChild(trigger);trigger.onclick=()=>showLicenseActivation(true)}
  if(!document.getElementById('officialLicenseActivationView')){
    const v=document.createElement('div');v.id='officialLicenseActivationView';v.className='hidden';v.innerHTML=`<div class="official-auth-kicker">ATIVAÇÃO DE LICENÇA</div><h1>Ativar minha Triela</h1><p>Use o código enviado pela Triela e crie seu acesso. Sua conta ficará separada das outras empresas.</p><form id="officialLicenseActivationForm" class="official-auth-form"><label>Código de ativação<input id="licenseActivationCode" autocomplete="one-time-code" required placeholder="TRIELA-ATV-XXXXXXXXXXXXXXXX"></label><label>Nome completo<input id="licenseActivationName" autocomplete="name" required placeholder="Seu nome"></label><label>Crie seu usuário<input id="licenseActivationUsername" autocomplete="username" required placeholder="seu.usuario"></label><label>Crie sua senha<div class="password-wrap"><input id="licenseActivationPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="Mínimo 8 caracteres"><button type="button" class="password-eye" data-commercial-eye>◉</button></div></label><label>Confirme a senha<input id="licenseActivationConfirm" type="password" minlength="8" autocomplete="new-password" required placeholder="Repita a senha"></label><button class="official-auth-button" id="licenseActivationSubmit" type="submit">Ativar licença</button><div class="official-auth-error" id="licenseActivationError"></div></form><button class="official-auth-link" type="button" id="backFromLicenseActivation">← Voltar ao login</button>`;login.insertAdjacentElement('afterend',v);v.querySelector('[data-commercial-eye]').onclick=()=>{const i=document.getElementById('licenseActivationPassword');if(i)i.type=i.type==='password'?'text':'password'};v.querySelector('#backFromLicenseActivation').onclick=()=>showLicenseActivation(false);v.querySelector('#officialLicenseActivationForm').onsubmit=activateCommercialLicense;
  }
}
function showLicenseActivation(show){ensureLicenseActivationView();document.getElementById('officialLoginView')?.classList.toggle('hidden',show);document.getElementById('officialActivationView')?.classList.add('hidden');document.getElementById('officialLicenseActivationView')?.classList.toggle('hidden',!show);if(show)setTimeout(()=>document.getElementById('licenseActivationCode')?.focus(),50)}
window.showLicenseActivation=showLicenseActivation;
async function activateCommercialLicense(e){
  e.preventDefault();const btn=document.getElementById('licenseActivationSubmit'),error=document.getElementById('licenseActivationError');if(error)error.textContent='';const code=document.getElementById('licenseActivationCode').value.trim().toUpperCase(),full_name=document.getElementById('licenseActivationName').value.trim(),username=document.getElementById('licenseActivationUsername').value.trim().toLowerCase(),password=document.getElementById('licenseActivationPassword').value,confirmPass=document.getElementById('licenseActivationConfirm').value;if(password!==confirmPass){if(error)error.textContent='As senhas não conferem.';return}if(btn){btn.disabled=true;btn.textContent='Ativando…'}
  try{const res=await fetch(`${SUPABASE_URL}/functions/v1/cp-license-activate`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({activation_code:code,full_name,username,password})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível ativar a licença.');showLicenseActivation(false);const u=document.getElementById('officialUsername');if(u)u.value=username;notify(`Licença ativada para ${data.account_name}. Agora entre com seu usuário e senha.`);setTimeout(()=>document.getElementById('officialPassword')?.focus(),100)}catch(err){if(error)error.textContent=err.message||'Falha na ativação.'}finally{if(btn){btn.disabled=false;btn.textContent='Ativar licença'}}
}

function bootstrap(){
  ensureLicenseActivationView();
  if(isPlatform()){ensureConsole();loadConsole();const old=document.querySelector('#platformSaas .saas-new-account');if(old&&!old.dataset.relabelled){old.dataset.relabelled='1';old.textContent='+ Criar conta para mim'}}
  const params=new URLSearchParams(location.search);if(params.get('activate')==='1'&&!document.body.classList.contains('commercial-auto-opened')){document.body.classList.add('commercial-auto-opened');setTimeout(()=>showLicenseActivation(true),400)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap);else bootstrap();
const obs=new MutationObserver(()=>bootstrap());obs.observe(document.documentElement,{childList:true,subtree:true});
setInterval(bootstrap,2200);
})();
