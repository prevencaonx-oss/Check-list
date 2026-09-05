/* Triela Checklists — SaaS V1.1: onboarding, troca de conta e lembretes Android */
(function(){
'use strict';
const O=()=>window.TRIELA_OFFICIAL||{};
const DB=()=>O().supabase;
const P=()=>O().profile;
const SAAS=()=>window.TRIELA_SAAS_V1||{};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
let accounts=[],prefs=null,lastAccountId=null,loading=false,reminderTimer=null;

function entitlement(){return SAAS().entitlement||null}
function currentAccount(){const e=entitlement();return accounts.find(a=>a.account_id===e?.account_id)||accounts.find(a=>a.is_current)||null}
function isNativeAndroid(){return !!window.TrielaAndroid||document.documentElement.classList.contains('triela-native-android')||/TrielaAndroid\//i.test(navigator.userAgent)}
function accountIcon(t){return t==='personal'?'●':'◆'}
function accountType(t){return t==='personal'?'Pessoal':'Empresa'}

function accountNameDefault(type){
  const p=P();const first=String(p?.full_name||'Minha').trim().split(/\s+/)[0]||'Minha';
  return type==='personal'?`${first} — Pessoal`:'';
}

async function loadAccounts(){
  const db=DB();if(!db)return [];
  const {data,error}=await db.rpc('cp_list_my_accounts');
  if(error)throw error;accounts=Array.isArray(data)?data:[];return accounts;
}

function ensureAccountChip(){
  const e=entitlement();if(!e)return;
  let chip=document.getElementById('trielaAccountChip');
  if(!chip){
    chip=document.createElement('button');chip.id='trielaAccountChip';chip.type='button';chip.className='triela-account-chip';chip.onclick=()=>window.openTrielaAccountSwitcher();
    const profile=document.querySelector('.sidebar .profile');if(profile)profile.insertAdjacentElement('beforebegin',chip);
    else document.querySelector('.sidebar')?.appendChild(chip);
  }
  chip.innerHTML=`<span class="tac-icon ${esc(e.account_type||'business')}">${accountIcon(e.account_type)}</span><span class="tac-copy"><small>${esc(accountType(e.account_type))}</small><strong>${esc(e.account_name||'Triela')}</strong></span><span class="tac-arrow">⌄</span>`;
}

function updatePlatformCreateButton(){
  if(!entitlement()?.is_platform_admin)return;
  const head=document.querySelector('#platformSaas .saas-platform-head');if(!head||head.querySelector('.saas-new-account'))return;
  const btn=document.createElement('button');btn.className='btn saas-new-account';btn.textContent='+ Nova conta';btn.onclick=()=>window.openTrielaOnboarding();
  const badge=head.querySelector('.saas-badge');if(badge)badge.insertAdjacentElement('beforebegin',btn);else head.appendChild(btn);
}

function applyPersonalMode(){
  const e=entitlement();if(!e)return;
  const personal=e.account_type==='personal';document.body.classList.toggle('triela-personal-mode',personal);
  if(personal){
    const strong=document.querySelector('.brandtext strong'),span=document.querySelector('.brandtext span');if(strong)strong.textContent='Minha Rotina';if(span)span.textContent='Checklists e organização do dia a dia';
    const routine=document.querySelector('.sidebar .navbtn[data-page="routine"]');if(routine)routine.classList.remove('hidden-by-role');
    ['users','training'].forEach(page=>document.querySelectorAll(`.sidebar .navbtn[data-page="${page}"]`).forEach(b=>b.classList.add('triela-personal-hidden')));
    const structure=document.getElementById('structureAdminArea');if(structure)structure.classList.add('triela-personal-hidden');
    document.querySelector('.role-preview')?.classList.add('triela-personal-hidden');
  }else{
    const strong=document.querySelector('.brandtext strong'),span=document.querySelector('.brandtext span');if(strong&&strong.textContent==='Minha Rotina')strong.textContent='Gestão Operacional';if(span&&span.textContent==='Checklists e organização do dia a dia')span.textContent='Plataforma universal de checklists';
    document.querySelectorAll('.triela-personal-hidden').forEach(x=>x.classList.remove('triela-personal-hidden'));
  }
}

function modal(html){
  document.getElementById('trielaSaasModal')?.remove();const back=document.createElement('div');back.id='trielaSaasModal';back.className='triela-saas-modal-back';back.innerHTML=html;document.body.appendChild(back);return back;
}
window.closeTrielaSaasModal=()=>document.getElementById('trielaSaasModal')?.remove();

window.openTrielaAccountSwitcher=async function(){
  try{await loadAccounts();}catch(err){return notify(err.message||'Não foi possível carregar suas contas.');}
  const e=entitlement();
  modal(`<div class="triela-saas-modal account-switch-modal"><div class="tsm-head"><div><div class="eyebrow">CONTA ATIVA</div><h2>Escolha onde deseja trabalhar</h2><p>O mesmo login pode acessar contas autorizadas sem misturar os dados.</p></div><button class="tsm-close" onclick="closeTrielaSaasModal()">×</button></div><div class="tsm-body"><div class="account-switch-list">${accounts.map(a=>`<button class="account-switch-row ${a.account_id===e?.account_id?'active':''}" onclick="switchTrielaAccount('${a.account_id}')"><span class="as-icon ${esc(a.account_type)}">${accountIcon(a.account_type)}</span><span class="as-main"><strong>${esc(a.display_name)}</strong><small>${esc(accountType(a.account_type))} • ${esc(a.plan_name||'Sem plano')}</small></span><span class="as-status">${a.account_id===e?.account_id?'ATUAL':'ENTRAR'}</span></button>`).join('')||'<div class="saas-loading">Nenhuma conta encontrada.</div>'}</div><button class="account-create-link" onclick="openTrielaOnboarding()">＋ Criar outra conta Triela</button></div></div>`);
};

window.switchTrielaAccount=async function(accountId){
  const db=DB();if(!db)return;const row=accounts.find(a=>a.account_id===accountId);if(row?.is_current||accountId===entitlement()?.account_id)return window.closeTrielaSaasModal();
  try{
    const {error}=await db.rpc('cp_switch_account',{p_account_id:accountId});if(error)throw error;
    localStorage.setItem('trielaAccountMessage',`Conta alterada para ${row?.display_name||'Triela'}.`);location.reload();
  }catch(err){notify(err.message||'Não foi possível trocar de conta.');}
};

window.openTrielaOnboarding=function(){
  modal(`<div class="triela-saas-modal onboarding-modal"><div class="tsm-head"><div><div class="eyebrow">NOVO ESPAÇO TRIELA</div><h2>Como você deseja usar a Triela?</h2><p>O motor de checklists é o mesmo. A experiência muda conforme o tipo de uso.</p></div><button class="tsm-close" onclick="closeTrielaSaasModal()">×</button></div><div class="tsm-body"><div class="onboarding-choice"><button onclick="chooseTrielaAccountType('personal')"><span class="oc-icon personal">●</span><strong>Para mim</strong><small>Rotina pessoal, casa, estudos, academia, veículo, compromissos e organização do dia.</small><b>Uso pessoal →</b></button><button onclick="chooseTrielaAccountType('business')"><span class="oc-icon business">◆</span><strong>Na minha empresa</strong><small>Equipe, unidades, checklists operacionais, auditorias, não conformidades, indicadores e gestão.</small><b>Uso empresarial →</b></button></div></div></div>`);
};

window.chooseTrielaAccountType=function(type){
  const personal=type==='personal',name=accountNameDefault(type);
  const root=document.querySelector('#trielaSaasModal .triela-saas-modal');if(!root)return;
  root.innerHTML=`<div class="tsm-head"><div><div class="eyebrow">${personal?'CONTA PESSOAL':'CONTA EMPRESARIAL'}</div><h2>${personal?'Crie seu espaço pessoal':'Cadastre a empresa'}</h2><p>${personal?'Você terá uma experiência simplificada para organizar suas próprias rotinas.':'Esta conta terá dados, usuários e licença separados das demais empresas.'}</p></div><button class="tsm-close" onclick="closeTrielaSaasModal()">×</button></div><div class="tsm-body"><div class="onboarding-selected"><span class="oc-icon ${personal?'personal':'business'}">${accountIcon(type)}</span><div><strong>${personal?'Triela Pessoal':'Triela Empresas'}</strong><small>${personal?'1 usuário • espaço pessoal • lembretes':'estrutura multiusuário • unidades • gestão'}</small></div></div><label class="tsm-field"><span>${personal?'Nome do seu espaço':'Nome da empresa'}</span><input id="trielaNewAccountName" value="${esc(name)}" placeholder="${personal?'Ex.: André — Pessoal':'Ex.: Empresa ABC'}" maxlength="90"></label><div class="onboarding-note">A nova conta começa com licença de teste enquanto a cobrança comercial ainda está em preparação.</div><div class="tsm-actions"><button class="btn secondary" onclick="openTrielaOnboarding()">Voltar</button><button class="btn" id="createTrielaAccountBtn" onclick="createTrielaAccount('${type}')">Criar e entrar</button></div></div>`;
  setTimeout(()=>document.getElementById('trielaNewAccountName')?.focus(),50);
};

window.createTrielaAccount=async function(type){
  const db=DB(),name=document.getElementById('trielaNewAccountName')?.value.trim(),btn=document.getElementById('createTrielaAccountBtn');if(!db)return;if(!name||name.length<2)return notify('Informe um nome para a conta.');
  if(btn){btn.disabled=true;btn.textContent='Criando conta…';}
  try{
    const {data,error}=await db.rpc('cp_create_account',{p_account_type:type,p_display_name:name});if(error)throw error;
    localStorage.setItem('trielaAccountMessage',`${type==='personal'?'Conta pessoal':'Conta empresarial'} criada com sucesso.`);location.reload();
  }catch(err){notify(err.message||'Não foi possível criar a conta.');if(btn){btn.disabled=false;btn.textContent='Criar e entrar';}}
};

async function loadPreferences(){
  const db=DB(),e=entitlement(),p=P();if(!db||!e?.account_id||!p?.user_id)return null;
  const {data,error}=await db.from('cp_notification_preferences').select('*').eq('user_id',p.user_id).eq('account_id',e.account_id).maybeSingle();if(error)throw error;
  prefs=data||{user_id:p.user_id,account_id:e.account_id,enabled:true,remind_before_minutes:15,remind_at_due:true,remind_overdue:true,escalation_enabled:true};return prefs;
}

function ensureNotificationCard(){
  const settings=document.getElementById('settings'),e=entitlement();if(!settings||!e)return;
  let card=document.getElementById('trielaNotificationCard');if(!card){card=document.createElement('div');card.id='trielaNotificationCard';card.className='panel triela-notification-card';const license=document.getElementById('saasLicenseCard');if(license)license.insertAdjacentElement('afterend',card);else settings.appendChild(card)}
  const p=prefs||{enabled:true,remind_before_minutes:15,remind_at_due:true,remind_overdue:true,escalation_enabled:true};
  card.innerHTML=`<div class="tn-head"><div><div class="eyebrow">LEMBRETES E NOTIFICAÇÕES</div><h2>Avise antes do checklist vencer</h2><p class="desc">No APK Android, os lembretes podem ser programados no aparelho mesmo com a Triela fechada.</p></div><span class="tn-device ${isNativeAndroid()?'native':'web'}">${isNativeAndroid()?'● Android conectado':'Web/PWA'}</span></div><div class="tn-grid"><label class="tn-toggle"><input type="checkbox" id="tnEnabled" ${p.enabled!==false?'checked':''}><span><strong>Notificações ativas</strong><small>Receber lembretes das atividades designadas para você.</small></span></label><label class="tn-field"><span>Avisar antes</span><select id="tnBefore" class="input">${[5,10,15,30,60,120].map(v=>`<option value="${v}" ${Number(p.remind_before_minutes)===v?'selected':''}>${v<60?v+' minutos':v/60+' hora'+(v>60?'s':'')}</option>`).join('')}</select></label><label class="tn-toggle"><input type="checkbox" id="tnAtDue" ${p.remind_at_due!==false?'checked':''}><span><strong>No horário</strong><small>Reforçar quando chegar o horário programado.</small></span></label><label class="tn-toggle"><input type="checkbox" id="tnOverdue" ${p.remind_overdue!==false?'checked':''}><span><strong>Se atrasar</strong><small>Enviar novo aviso depois do prazo.</small></span></label></div><div class="tn-actions"><button class="btn secondary" onclick="testTrielaNotification()">Testar notificação</button><button class="btn" onclick="saveTrielaNotificationPreferences()">Salvar lembretes</button></div><div class="tn-foot" id="tnFoot">${isNativeAndroid()?'O Android será sincronizado com as próximas atividades desta conta.':'No navegador, notificações futuras dependem do aplicativo permanecer ativo. O APK Android possui agendamento local.'}</div>`;
}

window.saveTrielaNotificationPreferences=async function(){
  const db=DB(),e=entitlement(),p=P();if(!db||!e?.account_id||!p?.user_id)return;
  const row={user_id:p.user_id,account_id:e.account_id,enabled:document.getElementById('tnEnabled')?.checked!==false,remind_before_minutes:Number(document.getElementById('tnBefore')?.value||15),remind_at_due:document.getElementById('tnAtDue')?.checked!==false,remind_overdue:document.getElementById('tnOverdue')?.checked!==false,escalation_enabled:true,updated_at:new Date().toISOString()};
  const {data,error}=await db.from('cp_notification_preferences').upsert(row,{onConflict:'user_id,account_id'}).select().single();if(error)return notify(error.message||'Não foi possível salvar os lembretes.');prefs=data;ensureNotificationCard();await syncReminders();notify('Preferências de notificação salvas.');
};

async function showWebNotification(title,body){
  try{
    if(!('Notification' in window))throw new Error('Este navegador não suporta notificações.');
    let perm=Notification.permission;if(perm==='default')perm=await Notification.requestPermission();if(perm!=='granted')throw new Error('Permissão de notificação não concedida.');
    if(navigator.serviceWorker){const reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body,icon:'./icon-192.svg',badge:'./icon-192.svg',tag:'triela-test'});}else new Notification(title,{body});
    return true;
  }catch(err){notify(err.message||'Não foi possível mostrar a notificação.');return false;}
}

window.testTrielaNotification=async function(){
  const title='Triela Checklists',body='Teste concluído. Seus lembretes estão preparados.';
  try{
    if(window.TrielaAndroid?.showNotificationNow){window.TrielaAndroid.showNotificationNow('triela-test',title,body);notify('Notificação de teste enviada ao Android.');return;}
  }catch(_){ }
  await showWebNotification(title,body);
};

function parseTime(v){const [h,m]=String(v||'09:00').split(':').map(Number);return [Number.isFinite(h)?h:9,Number.isFinite(m)?m:0]}
function dayKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function startOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
function occurrenceDates(s,horizonDays=35){
  if(!s||s.recurrence==='on_demand')return [];
  const now=new Date(),end=new Date(now);end.setDate(end.getDate()+horizonDays);const [hh,mm]=parseTime(s.due_time||s.start_time||'09:00'),validFrom=s.valid_from?new Date(s.valid_from+'T00:00:00'):startOfDay(new Date(s.created_at||now)),validUntil=s.valid_until?new Date(s.valid_until+'T23:59:59'):end,limit=validUntil<end?validUntil:end,out=[];
  const anchor=s.next_due_at?new Date(s.next_due_at):validFrom;const monthlyDay=anchor.getDate();
  for(let d=startOfDay(now);d<=limit;d.setDate(d.getDate()+1)){
    const cur=new Date(d);if(cur<startOfDay(validFrom))continue;let ok=false;
    if(s.recurrence==='daily')ok=true;
    else if(s.recurrence==='weekly')ok=(s.days_of_week||[]).map(Number).includes(cur.getDay());
    else if(s.recurrence==='biweekly'){
      const days=(s.days_of_week||[]).map(Number);if(!days.length||days.includes(cur.getDay())){const diff=Math.floor((startOfDay(cur)-startOfDay(anchor))/(7*86400000));ok=Math.abs(diff)%2===0;}
    } else if(s.recurrence==='monthly')ok=cur.getDate()===Math.min(monthlyDay,new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate());
    if(ok){cur.setHours(hh,mm,0,0);if(cur>now&&cur<=limit)out.push(new Date(cur));}
  }
  return out.slice(0,40);
}

async function getMySchedules(){
  const db=DB(),uid=P()?.user_id;if(!db||!uid)return [];
  const [sq,aq]=await Promise.all([db.from('cp_inspection_schedules').select('*').eq('is_active',true),db.from('cp_schedule_assignees').select('schedule_id,user_id').eq('user_id',uid)]);
  if(sq.error)throw sq.error;const mineIds=new Set((aq.data||[]).map(x=>x.schedule_id));return (sq.data||[]).filter(s=>s.assigned_user_id===uid||mineIds.has(s.id));
}

function templateName(id){return (state.templates||[]).find(t=>t.id===id)?.name||'Checklist programado'}
function clearNativeReminders(){
  if(!window.TrielaAndroid?.cancelNotification)return;let old=[];try{old=JSON.parse(localStorage.getItem('trielaNativeReminderKeys')||'[]')}catch(_){ }old.forEach(k=>{try{window.TrielaAndroid.cancelNotification(k)}catch(_){}});localStorage.removeItem('trielaNativeReminderKeys');
}

async function syncReminders(){
  if(!prefs||prefs.enabled===false)return clearNativeReminders();let schedules=[];try{schedules=await getMySchedules()}catch(err){console.warn('Triela reminders',err);return}
  const before=Math.max(0,Number(prefs.remind_before_minutes)||15),nativeKeys=[],webTimers=[];clearNativeReminders();if(reminderTimer){clearTimeout(reminderTimer);reminderTimer=null;}
  for(const s of schedules){for(const due of occurrenceDates(s)){const name=templateName(s.template_id),base=`${s.id}-${due.getTime()}`;const events=[];if(before>0)events.push({key:base+'-before',at:new Date(due.getTime()-before*60000),title:'Checklist chegando',body:`${name} começa em ${before} minuto${before===1?'':'s'}.`});if(prefs.remind_at_due!==false)events.push({key:base+'-due',at:due,title:'Hora do checklist',body:`Está na hora de realizar: ${name}.`});if(prefs.remind_overdue!==false){const late=Math.max(5,Number(s.grace_minutes)||15);events.push({key:base+'-late',at:new Date(due.getTime()+late*60000),title:'Checklist pendente',body:`${name} ainda pode estar pendente. Confira sua rotina.`});}
    for(const ev of events){if(ev.at<=new Date())continue;if(window.TrielaAndroid?.scheduleNotification){try{window.TrielaAndroid.scheduleNotification(ev.key,ev.at.getTime(),ev.title,ev.body);nativeKeys.push(ev.key);}catch(_){}}else{const ms=ev.at-Date.now();if(ms>0&&ms<=6*3600000)webTimers.push(setTimeout(()=>showWebNotification(ev.title,ev.body),ms));}}
  }}
  if(nativeKeys.length)localStorage.setItem('trielaNativeReminderKeys',JSON.stringify(nativeKeys.slice(0,120)));
  const foot=document.getElementById('tnFoot');if(foot&&isNativeAndroid())foot.textContent=`Android sincronizado: ${nativeKeys.length} lembrete${nativeKeys.length===1?'':'s'} programado${nativeKeys.length===1?'':'s'} para as próximas atividades.`;
}

async function boot(){
  if(loading||!DB()||!P()||!entitlement())return;loading=true;
  try{
    const e=entitlement();if(lastAccountId!==e.account_id){lastAccountId=e.account_id;await loadAccounts();prefs=await loadPreferences();}
    ensureAccountChip();applyPersonalMode();ensureNotificationCard();updatePlatformCreateButton();
    if(isNativeAndroid())await syncReminders();
    const msg=localStorage.getItem('trielaAccountMessage');if(msg){localStorage.removeItem('trielaAccountMessage');setTimeout(()=>notify(msg),250)}
    window.TRIELA_SAAS_CONTEXT={accounts,prefs,reload:()=>{lastAccountId=null;boot()},syncReminders};
  }catch(err){console.error('Triela SaaS context',err)}finally{loading=false}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700));else setTimeout(boot,700);
setInterval(()=>{ensureAccountChip();applyPersonalMode();ensureNotificationCard();updatePlatformCreateButton();if(!loading&&!accounts.length)boot();},2200);
window.addEventListener('focus',()=>setTimeout(boot,400));
})();
