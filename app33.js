/* Triela Checklists — dashboard mobile, relatórios e notificações operacionais */
(function(){
'use strict';
const O=()=>window.TRIELA_OFFICIAL||{};
const DB=()=>O().supabase;
const P=()=>O().profile||{};
const ST=()=>typeof state!=='undefined'?state:(window.state||{});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const notify=msg=>typeof toast==='function'?toast(msg):alert(msg);
const isManagement=()=>['admin','manager'].includes(P().role);
const mobile=()=>window.matchMedia('(max-width:760px)').matches||document.documentElement.classList.contains('triela-native-android')||/TrielaAndroid\//i.test(navigator.userAgent);
const userName=id=>(ST().users||[]).find(u=>u.userId===id)?.name||'Usuário';
const storeName=id=>(ST().units||[]).find(u=>u.id===id)?.name||'Unidade';
const templateName=id=>(ST().templates||[]).find(t=>t.id===id)?.name||'Checklist';
let notifications=[],dashboardNc=[],reportData=null,reportLoading=false,booted=false,notifBusy=false;

function fmt(v){return v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}
function dateKey(d){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function localIsoDate(d){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function avg(arr){return arr.length?arr.reduce((s,v)=>s+Number(v||0),0)/arr.length:0}
function severityLabel(s){return({low:'Baixa',medium:'Média',high:'Alta',critical:'Crítica'}[s]||s||'—')}
function notifIcon(t){return t==='action_overdue'?'!':t==='action_due_soon'?'◷':t==='nc_waiting_validation'?'✓':t==='nc_assigned'?'!':'•'}
function notifClass(t){return t==='action_overdue'?'bad':t==='action_due_soon'?'warn':t==='nc_waiting_validation'?'ok':'purple'}

function ensureNotificationButton(){
 const bar=document.querySelector('.topbar');if(!bar)return null;
 let b=document.getElementById('operationalNotificationBtn');if(!b){b=document.createElement('button');b.id='operationalNotificationBtn';b.className='operational-notification-btn';b.type='button';b.innerHTML='<span class="onb-icon">◔</span><b id="operationalNotificationBadge"></b>';b.onclick=()=>openOperationalNotifications();bar.appendChild(b);}return b;
}
function ensureNotificationDrawer(){
 let root=document.getElementById('operationalNotificationDrawer');if(root)return root;
 root=document.createElement('div');root.id='operationalNotificationDrawer';root.className='operational-notification-drawer hidden';
 root.innerHTML='<div class="ond-backdrop" onclick="closeOperationalNotifications()"></div><aside class="ond-panel"><div class="ond-head"><div><span>CENTRAL DE ALERTAS</span><h2>Notificações</h2></div><button onclick="closeOperationalNotifications()">×</button></div><div class="ond-toolbar"><small id="ondUnreadText">0 não lidas</small><button onclick="markAllOperationalNotificationsRead()">Marcar todas como lidas</button></div><div class="ond-list" id="operationalNotificationList"></div></aside>';
 document.body.appendChild(root);return root;
}
window.openOperationalNotifications=function(){ensureNotificationDrawer().classList.remove('hidden');renderNotifications()};
window.closeOperationalNotifications=function(){document.getElementById('operationalNotificationDrawer')?.classList.add('hidden')};
function renderNotifications(){
 ensureNotificationButton();const unread=notifications.filter(n=>!n.read_at).length,badge=document.getElementById('operationalNotificationBadge');if(badge){badge.textContent=unread>99?'99+':String(unread);badge.style.display=unread?'':'none'}
 const txt=document.getElementById('ondUnreadText');if(txt)txt.textContent=`${unread} não lida${unread===1?'':'s'}`;
 const list=document.getElementById('operationalNotificationList');if(!list)return;
 list.innerHTML=notifications.length?notifications.map(n=>`<button type="button" class="ond-row ${n.read_at?'read':'unread'}" onclick="openOperationalNotification('${n.id}')"><span class="ond-ico ${notifClass(n.notification_type)}">${notifIcon(n.notification_type)}</span><span class="ond-copy"><strong>${esc(n.title)}</strong><small>${esc(n.message||'')}</small><em>${esc(fmt(n.created_at))}</em></span>${n.read_at?'':'<i></i>'}</button>`).join(''):'<div class="ond-empty">Nenhum alerta operacional por enquanto.</div>';
}
async function maybeNativeAlert(){
 const latest=notifications.find(n=>!n.read_at);if(!latest)return;const key=`trielaOperationalNotifSeen:${P().user_id||''}`,prev=localStorage.getItem(key);
 if(!prev){localStorage.setItem(key,latest.id);return}if(prev===latest.id)return;
 localStorage.setItem(key,latest.id);if(Date.now()-new Date(latest.created_at).getTime()>5*60*1000)return;
 try{if(window.TrielaAndroid?.showNotificationNow)window.TrielaAndroid.showNotificationNow(latest.title,latest.message||'');else if('Notification'in window&&Notification.permission==='granted')new Notification(latest.title,{body:latest.message||''});}catch(_){ }
}
async function loadNotifications(refreshServer=true){
 if(!O().ready||!DB()||notifBusy)return;notifBusy=true;
 try{
  if(refreshServer){const r=await DB().rpc('cp_refresh_my_operational_notifications');if(r.error)console.warn(r.error);}
  const [nq,ncq]=await Promise.all([
   DB().from('cp_notifications').select('*').eq('environment','production').order('created_at',{ascending:false}).limit(100),
   isManagement()?DB().from('cp_nonconformities').select('id,status,severity,correction_reported_at,last_verified_at,opened_at').eq('environment','production').in('status',['open','in_action']).limit(1000):Promise.resolve({data:[],error:null})
  ]);
  if(nq.error)throw nq.error;notifications=nq.data||[];dashboardNc=ncq.data||[];ensureNotificationDrawer();renderNotifications();renderMobileDashboardV3();maybeNativeAlert();
 }catch(e){console.error('Triela operational notifications',e);}finally{notifBusy=false}
}
window.markAllOperationalNotificationsRead=async function(){
 try{const {error}=await DB().from('cp_notifications').update({read_at:new Date().toISOString()}).is('read_at',null);if(error)throw error;notifications=notifications.map(n=>({...n,read_at:n.read_at||new Date().toISOString()}));renderNotifications();}catch(e){notify(e.message||'Não foi possível marcar as notificações.')}
};
window.openOperationalNotification=async function(id){
 const n=notifications.find(x=>x.id===id);if(!n)return;
 if(!n.read_at){await DB().from('cp_notifications').update({read_at:new Date().toISOString()}).eq('id',id);n.read_at=new Date().toISOString();renderNotifications();}
 closeOperationalNotifications();if(n.entity_type==='nonconformity'||n.entity_type==='action_plan')window.navigate?.('correct');else if(n.entity_type==='schedule')window.navigate?.('routine');else window.navigate?.(P().role==='auditor'?'routine':'overview');
};

function renderMobileDashboardV3(){
 if(!mobile()||!isManagement())return;
 const overview=document.getElementById('overview');if(!overview)return;let box=document.getElementById('mobileDashboardV3');
 if(!box){box=document.createElement('div');box.id='mobileDashboardV3';box.className='mobile-dashboard-v3';const target=document.getElementById('overviewKpis');if(target)target.insertAdjacentElement('afterend',box);else overview.appendChild(box);}
 const runs=(ST().runs||[]).filter(r=>r.status==='completed'),today=dateKey(new Date()),todayRuns=runs.filter(r=>dateKey(r.date)===today),last7=runs.filter(r=>new Date(r.date)>=new Date(Date.now()-7*86400000)),comp=Math.round(avg(last7.map(r=>r.compliance))),open=dashboardNc.length,waiting=dashboardNc.filter(n=>n.correction_reported_at&&(!n.last_verified_at||new Date(n.correction_reported_at)>new Date(n.last_verified_at))).length,critical=dashboardNc.filter(n=>['critical','high'].includes(n.severity)).length;
 box.innerHTML=`<div class="mdv3-head"><div><span>RESUMO RÁPIDO</span><strong>Operação agora</strong></div><button onclick="openOperationalNotifications()">Alertas ${notifications.filter(n=>!n.read_at).length?`(${notifications.filter(n=>!n.read_at).length})`:''}</button></div><div class="mdv3-grid"><div><b>${todayRuns.length}</b><span>Feitos hoje</span></div><div><b>${comp}%</b><span>Conformidade 7d</span></div><div><b>${open}</b><span>NC abertas</span></div><div><b>${waiting}</b><span>Aguard. validação</span></div></div>${critical?`<div class="mdv3-alert">⚠ ${critical} não conformidade${critical===1?'':'s'} de alta criticidade aberta${critical===1?'':'s'}.</div>`:'<div class="mdv3-ok">✓ Nenhuma NC de alta criticidade aberta.</div>'}`;
}

function ensureReportPanel(){
 if(!isManagement())return null;const sec=document.getElementById('analyze');if(!sec)return null;let root=document.getElementById('operationalReportV3');if(root)return root;
 const end=new Date(),start=new Date(Date.now()-29*86400000),units=(ST().units||[]).filter(u=>u.active!==false);
 root=document.createElement('div');root.id='operationalReportV3';root.className='operational-report-v3';root.innerHTML=`<div class="orv3-head"><div><span>RELATÓRIO OPERACIONAL</span><h2>Visão detalhada do período</h2><p>Execuções, conformidade, não conformidades, ações e desempenho por responsável.</p></div><div class="orv3-actions"><button class="btn secondary" onclick="printOperationalReport()">Imprimir</button><button class="btn" onclick="exportOperationalExcel()">Exportar Excel</button></div></div><div class="orv3-filters"><label><span>De</span><input class="input" type="date" id="orv3Start" value="${localIsoDate(start)}"></label><label><span>Até</span><input class="input" type="date" id="orv3End" value="${localIsoDate(end)}"></label><label><span>Unidade</span><select class="input" id="orv3Unit"><option value="">Todas as unidades</option>${units.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></label><button class="btn" onclick="loadOperationalReport()">Aplicar</button></div><div id="orv3Body"><div class="orv3-loading">Carregando relatório…</div></div>`;
 const head=sec.querySelector('.analysis-head');if(head)head.insertAdjacentElement('afterend',root);else sec.prepend(root);return root;
}
function reportRange(){
 const s=document.getElementById('orv3Start')?.value,e=document.getElementById('orv3End')?.value,u=document.getElementById('orv3Unit')?.value||'';if(!s||!e)throw new Error('Informe o período.');const start=new Date(`${s}T00:00:00`),end=new Date(`${e}T23:59:59`);if(start>end)throw new Error('A data inicial não pode ser maior que a final.');return{start,end,unit:u,startText:s,endText:e};
}
window.loadOperationalReport=async function(){
 if(!isManagement()||reportLoading)return;ensureReportPanel();reportLoading=true;const body=document.getElementById('orv3Body');if(body)body.innerHTML='<div class="orv3-loading">Atualizando relatório…</div>';
 try{
  const range=reportRange(),db=DB();let eq=db.from('cp_executions').select('id,store_id,template_id,performed_by,started_at,completed_at,status,score,created_at').eq('environment','production').gte('created_at',range.start.toISOString()).lte('created_at',range.end.toISOString()).order('created_at',{ascending:false}).limit(5000);let nq=db.from('cp_nonconformities').select('id,store_id,execution_id,title,severity,status,opened_at,resolved_at,responsible_user_id,continuation_count,correction_reported_at').eq('environment','production').gte('opened_at',range.start.toISOString()).lte('opened_at',range.end.toISOString()).order('opened_at',{ascending:false}).limit(5000);let aq=db.from('cp_action_plans').select('id,store_id,nonconformity_id,action_text,responsible_user_id,due_at,status,created_at,completed_at').eq('environment','production').gte('created_at',range.start.toISOString()).lte('created_at',range.end.toISOString()).order('created_at',{ascending:false}).limit(5000);if(range.unit){eq=eq.eq('store_id',range.unit);nq=nq.eq('store_id',range.unit);aq=aq.eq('store_id',range.unit)}
  const [er,nr,ar]=await Promise.all([eq,nq,aq]);const err=er.error||nr.error||ar.error;if(err)throw err;reportData={range,executions:er.data||[],ncs:nr.data||[],actions:ar.data||[]};renderOperationalReport();
 }catch(e){if(body)body.innerHTML=`<div class="orv3-error">${esc(e.message||'Não foi possível carregar o relatório.')}</div>`;}finally{reportLoading=false}
};
function renderOperationalReport(){
 const body=document.getElementById('orv3Body');if(!body||!reportData)return;const {executions,ncs,actions}=reportData,done=executions.filter(e=>e.status==='completed'),scores=done.filter(e=>e.score!=null).map(e=>Number(e.score)),resolved=ncs.filter(n=>n.status==='resolved'),critical=ncs.filter(n=>['critical','high'].includes(n.severity)),overdue=actions.filter(a=>a.status!=='completed'&&a.status!=='cancelled'&&new Date(a.due_at)<new Date()),resolutionHours=resolved.filter(n=>n.resolved_at).map(n=>(new Date(n.resolved_at)-new Date(n.opened_at))/3600000),executionRate=executions.length?Math.round(done.length/executions.length*100):100,resolutionRate=ncs.length?Math.round(resolved.length/ncs.length*100):100;
 const tplMap={};done.forEach(e=>{const k=e.template_id;tplMap[k]=tplMap[k]||{name:templateName(k),count:0,scores:[]};tplMap[k].count++;if(e.score!=null)tplMap[k].scores.push(Number(e.score))});const topTpl=Object.values(tplMap).sort((a,b)=>b.count-a.count).slice(0,5);
 const ncMap={};ncs.forEach(n=>{const k=n.title||'Não conformidade';ncMap[k]=ncMap[k]||{name:k,count:0,critical:0};ncMap[k].count++;if(['critical','high'].includes(n.severity))ncMap[k].critical++});const topNc=Object.values(ncMap).sort((a,b)=>b.count-a.count).slice(0,5);
 const userMap={};done.forEach(e=>{const k=e.performed_by||'none';userMap[k]=userMap[k]||{name:userName(k),count:0,scores:[]};userMap[k].count++;if(e.score!=null)userMap[k].scores.push(Number(e.score))});const topUsers=Object.values(userMap).sort((a,b)=>b.count-a.count).slice(0,6);
 body.innerHTML=`<div class="orv3-kpis"><div><span>Execução</span><strong>${executionRate}%</strong><small>${done.length} de ${executions.length}</small></div><div><span>Conformidade</span><strong>${scores.length?avg(scores).toFixed(1).replace('.',','):'—'}${scores.length?'%':''}</strong><small>média do período</small></div><div><span>Não conformidades</span><strong>${ncs.length}</strong><small>${critical.length} alta/crítica</small></div><div><span>Resolução de NC</span><strong>${resolutionRate}%</strong><small>${resolved.length} resolvidas</small></div><div><span>Ações vencidas</span><strong>${overdue.length}</strong><small>fora do prazo</small></div><div><span>Tempo médio</span><strong>${resolutionHours.length?(avg(resolutionHours)/24).toFixed(1).replace('.',','):'—'}</strong><small>${resolutionHours.length?'dias para resolver':'sem dados'}</small></div></div><div class="orv3-columns"><div class="orv3-card"><h3>Checklists mais executados</h3>${topTpl.length?topTpl.map((x,i)=>`<div class="orv3-rank"><b>${i+1}</b><span><strong>${esc(x.name)}</strong><small>${x.count} execuções • ${x.scores.length?`${Math.round(avg(x.scores))}% conformidade`:'sem nota'}</small></span></div>`).join(''):'<div class="orv3-empty">Sem execuções no período.</div>'}</div><div class="orv3-card"><h3>Não conformidades mais recorrentes</h3>${topNc.length?topNc.map((x,i)=>`<div class="orv3-rank nc"><b>${i+1}</b><span><strong>${esc(x.name)}</strong><small>${x.count} ocorrência${x.count===1?'':'s'}${x.critical?` • ${x.critical} alta/crítica`:''}</small></span></div>`).join(''):'<div class="orv3-empty">Nenhuma NC no período.</div>'}</div><div class="orv3-card"><h3>Execuções por colaborador</h3>${topUsers.length?topUsers.map((x,i)=>`<div class="orv3-rank user"><b>${i+1}</b><span><strong>${esc(x.name)}</strong><small>${x.count} execuções • ${x.scores.length?`${Math.round(avg(x.scores))}% média`:'sem nota'}</small></span></div>`).join(''):'<div class="orv3-empty">Sem dados de colaboradores.</div>'}</div></div>`;
}
async function ensureXlsx(){if(window.XLSX)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o módulo de Excel.'));document.head.appendChild(s);});}
window.exportOperationalExcel=async function(){
 if(!reportData){await window.loadOperationalReport();if(!reportData)return}try{await ensureXlsx();const {executions,ncs,actions,range}=reportData,done=executions.filter(e=>e.status==='completed'),scores=done.filter(e=>e.score!=null).map(e=>Number(e.score)),resolved=ncs.filter(n=>n.status==='resolved'),overdue=actions.filter(a=>a.status!=='completed'&&a.status!=='cancelled'&&new Date(a.due_at)<new Date());const summary=[{Indicador:'Período',Valor:`${range.startText} a ${range.endText}`},{Indicador:'Execuções',Valor:executions.length},{Indicador:'Concluídas',Valor:done.length},{Indicador:'Taxa de execução',Valor:executions.length?`${Math.round(done.length/executions.length*100)}%`:'100%'},{Indicador:'Conformidade média',Valor:scores.length?`${avg(scores).toFixed(1)}%`:'—'},{Indicador:'Não conformidades',Valor:ncs.length},{Indicador:'NC resolvidas',Valor:resolved.length},{Indicador:'Ações vencidas',Valor:overdue.length}];const execRows=executions.map(e=>({'Data':fmt(e.completed_at||e.created_at),'Unidade':storeName(e.store_id),'Checklist':templateName(e.template_id),'Responsável':userName(e.performed_by),'Status':e.status,'Conformidade %':e.score??''}));const ncRows=ncs.map(n=>({'Aberta em':fmt(n.opened_at),'Unidade':storeName(n.store_id),'Não conformidade':n.title,'Criticidade':severityLabel(n.severity),'Status':n.status,'Responsável':userName(n.responsible_user_id),'Reincidência':Number(n.continuation_count||0),'Resolvida em':n.resolved_at?fmt(n.resolved_at):''}));const actionRows=actions.map(a=>({'Criada em':fmt(a.created_at),'Unidade':storeName(a.store_id),'Ação':a.action_text,'Responsável':userName(a.responsible_user_id),'Prazo':fmt(a.due_at),'Status':a.status,'Concluída em':a.completed_at?fmt(a.completed_at):''}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary),'Resumo');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(execRows),'Execucoes');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ncRows),'Nao conformidades');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(actionRows),'Planos de acao');XLSX.writeFile(wb,`Triela_Relatorio_${range.startText}_${range.endText}.xlsx`);notify('Relatório Excel gerado.');}catch(e){notify(e.message||'Não foi possível gerar o Excel.')}
};
window.printOperationalReport=function(){
 if(!reportData)return notify('Carregue o relatório antes de imprimir.');const {range}=reportData,content=document.getElementById('orv3Body')?.innerHTML||'',w=window.open('','_blank');if(!w)return notify('O navegador bloqueou a janela de impressão.');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório Triela</title><style>body{font-family:Arial,sans-serif;color:#102442;padding:24px}h1{margin:0 0 4px}.meta{color:#64748b;margin-bottom:18px}.orv3-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.orv3-kpis>div,.orv3-card{border:1px solid #dfe6ef;border-radius:10px;padding:12px}.orv3-kpis span,.orv3-kpis small,.orv3-rank small{display:block;color:#66758a;font-size:11px}.orv3-kpis strong{font-size:22px}.orv3-columns{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px}.orv3-rank{display:flex;gap:9px;padding:8px 0;border-bottom:1px solid #edf1f5}.orv3-rank>b{width:24px;height:24px;border-radius:7px;background:#eef1ff;display:grid;place-items:center}.orv3-rank strong{display:block;font-size:12px}@media print{body{padding:0}}</style></head><body><h1>Triela Checklists</h1><div class="meta">Relatório operacional • ${range.startText} a ${range.endText}</div>${content}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
};

function refreshUi(){ensureNotificationButton();ensureNotificationDrawer();renderNotifications();renderMobileDashboardV3();ensureReportPanel();}
async function boot(){
 if(booted||!O().ready||!DB())return false;booted=true;refreshUi();await loadNotifications(true);if(isManagement()){ensureReportPanel();setTimeout(()=>window.loadOperationalReport(),150)}
 try{DB().channel('triela-operational-notifications').on('postgres_changes',{event:'*',schema:'public',table:'cp_notifications'},()=>loadNotifications(false)).subscribe()}catch(_){ }
 return true;
}
function startBoot(){let tries=0;const t=setInterval(async()=>{tries++;if(await boot()||tries>80)clearInterval(t)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startBoot);else startBoot();
setInterval(()=>{if(O().ready){refreshUi();loadNotifications(true)}},60000);
window.addEventListener('focus',()=>{if(O().ready)setTimeout(()=>loadNotifications(true),250)});
window.addEventListener('resize',()=>setTimeout(refreshUi,80));
})();
