/* Triela Checklists — SaaS V1: contas, planos, licenças e Super Admin */
(function(){
'use strict';
const O=()=>window.TRIELA_OFFICIAL||{};
const DB=()=>O().supabase;
const P=()=>O().profile;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const typeName=t=>t==='personal'?'Pessoal':'Empresa';
const statusName=s=>({active:'Ativa',trial:'Teste',trialing:'Teste',past_due:'Pagamento pendente',suspended:'Suspensa',cancelled:'Cancelada',expired:'Expirada',inactive:'Inativa'}[s]||s||'—');
const maskKey=k=>{k=String(k||'');return k.length>8?k.slice(0,11)+'••••'+k.slice(-4):k||'—'};
let entitlement=null,platformData=null,lastUser=null,busy=false;

function go(page,btn){
  try{if(typeof window.navigate==='function'){window.navigate(page);return}}catch(_){ }
  document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id===page));
  document.querySelectorAll('.navbtn[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  if(btn)btn.classList.add('active');
  document.getElementById('sidebar')?.classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderLicenseCard(){
  const settings=document.getElementById('settings');if(!settings||!entitlement)return;
  let card=document.getElementById('saasLicenseCard');
  if(!card){card=document.createElement('div');card.id='saasLicenseCard';card.className='panel saas-license-card';settings.appendChild(card)}
  const features=Object.values(entitlement.features||{}).filter(Boolean).length;
  card.innerHTML=`<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;position:relative;z-index:1"><div><div class="eyebrow" style="color:#8fa7d4">CONTA E LICENÇA</div><h2 style="margin:5px 0 4px">${esc(entitlement.account_name||'Triela')}</h2><p class="desc" style="margin:0">A licença é validada no servidor e fica separada da configuração operacional.</p></div><span class="saas-license-ok">● ${esc(statusName(entitlement.license_status))}</span></div><div class="saas-license-grid"><div class="saas-license-stat"><span>Tipo de conta</span><strong>${esc(typeName(entitlement.account_type))}</strong></div><div class="saas-license-stat"><span>Plano atual</span><strong>${esc(entitlement.plan_name||'Sem plano')}</strong></div><div class="saas-license-stat"><span>Recursos liberados</span><strong>${features}</strong></div><div class="saas-license-stat"><span>Licença</span><strong class="saas-license-key">${esc(maskKey(entitlement.license_key))}</strong></div></div>`;
}

function ensurePlatformNav(){
  if(!entitlement?.is_platform_admin)return;
  if(document.querySelector('.saas-platform-nav'))return;
  const settingsBtn=document.querySelector('.sidebar .navbtn[data-page="settings"]');if(!settingsBtn)return;
  const btn=document.createElement('button');btn.className='navbtn saas-platform-nav';btn.dataset.page='platformSaas';btn.innerHTML='<span class="navicon">◇</span><span class="navlabel">Plataforma SaaS</span><span class="navbadge" style="background:#6757ef">V1</span>';
  btn.addEventListener('click',()=>go('platformSaas',btn));settingsBtn.insertAdjacentElement('afterend',btn);
}

function ensurePlatformSection(){
  if(!entitlement?.is_platform_admin)return null;
  let section=document.getElementById('platformSaas');if(section)return section;
  section=document.createElement('section');section.className='section';section.id='platformSaas';
  section.innerHTML='<div class="saas-loading">Carregando administração da plataforma…</div>';
  document.querySelector('.layout main')?.appendChild(section);return section;
}

function licenseFor(accountId){return (platformData?.licenses||[]).find(l=>l.account_id===accountId&&l.is_current)}
function planFor(id){return (platformData?.plans||[]).find(p=>p.id===id)}

function renderPlatform(){
  const section=ensurePlatformSection();if(!section||!platformData)return;
  const accounts=platformData.accounts||[],plans=platformData.plans||[],licenses=platformData.licenses||[];
  const businesses=accounts.filter(a=>a.account_type==='business').length,personal=accounts.filter(a=>a.account_type==='personal').length;
  const activeLicenses=licenses.filter(l=>l.is_current&&['active','trial'].includes(l.status)).length;
  const publicPlans=plans.filter(p=>p.code!=='legacy_enterprise');
  section.innerHTML=`
  <div class="saas-platform-head"><div><div class="eyebrow">ADMINISTRAÇÃO DA PLATAFORMA</div><h1>Triela SaaS</h1><div class="sub">Contas pessoais, empresas, planos e licenças em uma única base.</div></div><span class="saas-badge">● Base SaaS V1 ativa</span></div>
  <div class="saas-kpis"><div class="saas-kpi"><span>Contas cadastradas</span><strong>${accounts.length}</strong></div><div class="saas-kpi"><span>Empresas</span><strong>${businesses}</strong></div><div class="saas-kpi"><span>Contas pessoais</span><strong>${personal}</strong></div><div class="saas-kpi"><span>Licenças ativas/teste</span><strong>${activeLicenses}</strong></div></div>
  <div class="saas-grid"><div class="saas-panel"><h2>Clientes e contas</h2><div class="saas-panel-sub">Cada conta possui isolamento próprio e uma licença controlada no servidor.</div><div class="saas-account-list">${accounts.length?accounts.map(a=>{const l=licenseFor(a.id),pl=planFor(l?.plan_id);return `<div class="saas-account-row"><div><strong>${esc(a.display_name)}</strong><small>${esc(a.id)}</small></div><div><span class="saas-type-pill ${esc(a.account_type)}">${esc(typeName(a.account_type))}</span></div><div><strong style="font-size:10px">${esc(pl?.name||'Sem plano')}</strong><small>${esc(maskKey(l?.license_key))}</small></div><div><span class="saas-status-pill ${esc(l?.status||a.status)}">${esc(statusName(l?.status||a.status))}</span></div></div>`}).join(''):'<div class="saas-loading">Nenhuma conta cadastrada.</div>'}</div></div>
  <div class="saas-panel"><h2>Planos preparados</h2><div class="saas-panel-sub">Preços continuam sem definição até a etapa comercial.</div><div class="saas-plan-list">${publicPlans.map(pl=>`<div class="saas-plan"><div class="saas-plan-top"><div><strong>${esc(pl.name)}</strong><small>${esc(pl.description||'')}</small></div><span class="saas-plan-code">${esc(pl.audience==='personal'?'PESSOAL':'EMPRESA')}</span></div></div>`).join('')}</div></div></div>
  <div class="saas-grid"><div class="saas-panel"><h2>Arquitetura ativa nesta etapa</h2><div class="saas-panel-sub">A operação atual foi preservada enquanto a camada comercial foi adicionada.</div><div class="saas-roadmap"><div class="saas-roadmap-item"><b>1</b><div><strong>Conta separada da organização</strong><small>A licença pertence à conta; lojas, usuários e checklists continuam na organização.</small></div></div><div class="saas-roadmap-item"><b>2</b><div><strong>Multiempresa preparada</strong><small>Contas diferentes não compartilham licença nem dados comerciais.</small></div></div><div class="saas-roadmap-item"><b>3</b><div><strong>Super Admin Triela</strong><small>Administração da plataforma separada do Administrador de cada empresa.</small></div></div><div class="saas-roadmap-item"><b>4</b><div><strong>Licença no servidor</strong><small>Copiar o APK não cria acesso comercial independente.</small></div></div></div></div>
  <div class="saas-panel"><h2>Próximos blocos</h2><div class="saas-panel-sub">Sequência da Etapa 1.</div><div class="saas-roadmap"><div class="saas-roadmap-item"><b>→</b><div><strong>Cadastro de nova conta</strong><small>Escolher Pessoal ou Empresa no onboarding.</small></div></div><div class="saas-roadmap-item"><b>→</b><div><strong>Troca de contexto</strong><small>Mesmo login poderá acessar contas autorizadas sem misturar dados.</small></div></div><div class="saas-roadmap-item"><b>→</b><div><strong>Limites por plano</strong><small>Usuários, unidades, armazenamento e recursos.</small></div></div><div class="saas-roadmap-item"><b>→</b><div><strong>Notificações Push</strong><small>Android receberá lembretes antes e depois do prazo.</small></div></div></div></div></div>`;
}

async function load(){
  const db=DB();const profile=P();if(!db||!profile||busy)return;
  const uid=profile.user_id||profile.id||profile.userId||profile.email;if(!uid)return;
  if(lastUser===uid&&entitlement)return;busy=true;
  try{
    const r=await db.rpc('cp_current_entitlement');
    if(r.error)throw r.error;entitlement=r.data||null;lastUser=uid;
    if(!entitlement)return;
    renderLicenseCard();ensurePlatformNav();ensurePlatformSection();
    if(entitlement.is_platform_admin){
      const [ar,lr,pr]=await Promise.all([
        db.from('cp_accounts').select('id,account_type,display_name,status,created_at').order('created_at',{ascending:true}),
        db.from('cp_licenses').select('id,account_id,plan_id,license_key,status,is_current,starts_at,trial_ends_at,expires_at').order('created_at',{ascending:false}),
        db.from('cp_plans').select('id,code,name,audience,description,limits,features,is_active,is_public,sort_order').order('sort_order',{ascending:true})
      ]);
      const error=ar.error||lr.error||pr.error;if(error)throw error;
      platformData={accounts:ar.data||[],licenses:lr.data||[],plans:pr.data||[]};renderPlatform();
    }
    window.TRIELA_SAAS_V1={entitlement,platformData,reload:()=>{lastUser=null;entitlement=null;platformData=null;load()}};
  }catch(err){console.error('Triela SaaS V1',err);const s=ensurePlatformSection();if(s)s.innerHTML='<div class="saas-error">Não foi possível carregar a camada SaaS agora. A operação principal continua disponível.</div>'}
  finally{busy=false}
}

function bootstrap(){
  if(P()&&DB())load();
  if(entitlement){renderLicenseCard();ensurePlatformNav();if(platformData)renderPlatform()}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap);else bootstrap();
setInterval(bootstrap,1800);setTimeout(bootstrap,500);setTimeout(bootstrap,2500);
})();
