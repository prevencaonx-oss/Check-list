/* Triela Checklists — semântica operacional + onboarding real de primeiro acesso por perfil */
(function(){
  'use strict';
  const VERSION='guided-onboarding-2026-09-04-v1';
  const O=()=>window.TRIELA_OFFICIAL||{};
  const DB=()=>O().supabase;
  const P=()=>O().profile;
  const actualRole=()=>P()?.role==='admin'?'admin':P()?.role==='manager'?'manager':'collaborator';
  const roleNames={admin:'Administrador',manager:'Gestor/Líder',collaborator:'Operacional/Colaborador'};
  const defaults={admin:['overview','execute','correct','analyze','models','builder','training','help','users','settings'],manager:['overview','execute','correct','analyze','training','help'],collaborator:['routine','training','help']};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let currentRole='admin',currentIndex=0,currentSteps=[],currentTarget=null,manualMode=false,waitTimer=null,active=false;

  const guides={
    admin:[
      {page:'overview',focus:'.overview-greeting',cat:'Início',title:'Conheça sua área de Administração',text:'O Administrador organiza toda a plataforma: estrutura, usuários, checklists, distribuição das atividades, correções e análises.',bullets:['Você pode cadastrar lojas e perfis.','Pode criar usuários e definir onde cada um trabalha.','Pode criar e distribuir os controles da operação.'],result:'Você controla a configuração e a governança do sistema.'},
      {perm:'overview',page:'overview',focus:'#overviewKpis',cat:'Visão geral',title:'Comece pelos indicadores principais',text:'A Visão Geral resume a saúde da operação antes de você entrar nos detalhes.',bullets:['Conformidade mostra a qualidade das respostas.','Concluídos e atrasados mostram cumprimento da rotina.','Não conformidades abertas mostram problemas ainda sem encerramento.'],result:'Você identifica rapidamente o que precisa de atenção.'},
      {perm:'overview',page:'overview',focus:'#overviewUnit',cat:'Visão geral',title:'Filtre por loja',text:'Use o filtro de unidade para separar resultado geral de problemas locais.',bullets:['Todas as unidades mostra o consolidado.','Uma loja específica mostra apenas aquele recorte.','Usuários sem acesso à loja não enxergam os dados dela.'],result:'A análise respeita a estrutura e as permissões da empresa.'},
      {perm:'execute',page:'execute',focus:'#executeCards',cat:'Controles',title:'Gerencie os checklists da operação',text:'Aqui você vê os controles criados e decide como eles chegarão aos usuários.',bullets:['Checklist é o formulário criado pela gestão.','O Operacional não cria checklist.','Você pode direcionar uma atividade para uma pessoa ou deixar o controle aberto para uma loja.'],result:'A gestão cria; o Operacional apenas responde o que foi liberado.'},
      {perm:'execute',page:'execute',focus:'#officialAssignmentsPanel',cat:'Distribuição',title:'Designar para um usuário específico',text:'Use a designação quando uma atividade precisa ter um responsável definido.',bullets:['Escolha checklist, loja e colaborador.','Defina frequência, data e horário.','A atividade entra na Minha Rotina somente daquele usuário.'],result:'A tarefa passa a ter dono, prazo e acompanhamento.'},
      {perm:'execute',page:'execute',focus:'#openChecklistManagementPanel',cat:'Distribuição',title:'Abrir um controle para toda a loja',text:'Use esta opção quando qualquer Operacional daquela unidade puder responder o controle.',bullets:['Escolha o checklist e a loja.','Não precisa indicar uma pessoa específica.','Ele aparece como disponível para os Operacionais autorizados naquela loja.','Não vira pendência pessoal de todos.'],result:'Você cria controles sob demanda sem obrigar uma pessoa específica.'},
      {perm:'models',page:'models',focus:'#modelCards',cat:'Modelos',title:'Use modelos como ponto de partida',text:'A biblioteca acelera a implantação de novos controles sem limitar a personalização.',bullets:['Use um modelo quando ele fizer sentido.','Adapte perguntas e regras.','Padronize controles entre unidades.'],result:'Você ganha velocidade sem perder flexibilidade.'},
      {perm:'builder',page:'builder',focus:'#builder .formcard',cat:'Construtor',title:'Crie o checklist',text:'No Construtor você define nome, categoria, descrição e depois monta as perguntas.',bullets:['Use nomes claros.','Escolha o tipo correto de resposta.','Defina criticidade e geração de ação quando necessário.'],result:'O checklist vira um controle operacional estruturado.'},
      {perm:'users',page:'users',focus:'#usersTable',cat:'Equipe e acessos',title:'Cadastre usuários com acesso individual',text:'Cada pessoa entra com sua própria conta e recebe o acesso compatível com função e loja.',bullets:['Cadastre nome, usuário, nascimento e função.','Defina perfil e loja permitida.','Todo usuário novo recebe senha inicial e código individual de primeiro acesso.'],result:'Você mantém identidade, rastreabilidade e segurança por usuário.'},
      {perm:'settings',page:'settings',focus:'#rolesAdminList',cat:'Perfis',title:'Controle o que cada perfil pode fazer',text:'Perfis definem quais telas e ações estarão disponíveis para cada função.',bullets:['Administrativo: gestão conforme permissões.','Gestão: acompanhamento e distribuição conforme permissões.','Operacional: responde atividades liberadas; não cria checklists.'],result:'Cada função recebe somente o necessário para trabalhar.'},
      {perm:'settings',page:'settings',focus:'#unitsAdminList',cat:'Lojas',title:'Organize a empresa por unidade',text:'Lojas ligam usuários, atividades, execuções e indicadores ao local correto.',bullets:['Cadastre as unidades ativas.','Vincule usuários às lojas permitidas.','O banco bloqueia acesso a lojas não autorizadas.'],result:'A plataforma pode crescer sem misturar dados entre unidades.'},
      {perm:'correct',page:'correct',focus:'#actionsTable',cat:'Não conformidades',title:'Acompanhe problemas até a correção',text:'Respostas não conformes podem gerar ocorrências e planos de ação.',bullets:['Veja origem, responsável, prazo e status.','Priorize críticos e atrasados.','Valide a correção antes de encerrar.'],result:'O problema não termina no registro; ele precisa ser tratado.'},
      {perm:'analyze',page:'analyze',focus:'.analysis-main',cat:'Análises',title:'Transforme respostas em decisão',text:'As análises mostram tendências, categorias de desvio e reincidências.',bullets:['Compare períodos.','Procure problemas frequentes.','Use criticidade + frequência para priorizar.'],result:'A gestão atua sobre causas e padrões, não só casos isolados.'},
      {perm:'training',page:'training',focus:'#training .headline',cat:'Treinamento',title:'Treine sem afetar a operação real',text:'O modo Treinamento permite aprender o processo sem contaminar indicadores oficiais.',bullets:['Treinamento fica separado da operação real.','Use antes de liberar usuários novos.','O ambiente atual aparece claramente no topo.'],result:'A equipe aprende sem gerar dados falsos.'},
      {perm:'help',page:'help',focus:'#help .helpgrid',cat:'Ajuda',title:'O Centro de Ajuda fica disponível depois',text:'Este tutorial aparece automaticamente apenas no primeiro acesso ao perfil. Depois disso, ele não abre sozinho novamente.',bullets:['O usuário pode rever o tutorial manualmente no Centro de Ajuda.','Trocar de perfil pode apresentar uma única vez o tutorial do novo perfil.'],result:'O primeiro acesso ensina; a ajuda fica disponível para consulta futura.'},
      {page:'overview',focus:'.profile',cat:'Conta',title:'Meu perfil e senha',text:'O cartão do usuário abre as opções pessoais da conta.',bullets:['O próprio usuário pode trocar a senha.','A senha atual nunca é exibida.','Também é aqui que a sessão pode ser encerrada.'],result:'Cada pessoa mantém sua própria credencial de acesso.'}
    ],
    manager:[
      {page:'overview',focus:'.overview-greeting',cat:'Início',title:'Conheça seu painel de Gestão',text:'O Gestor/Líder acompanha a operação das lojas liberadas para ele e distribui atividades conforme suas permissões.',bullets:['Você só enxerga as unidades autorizadas.','O tutorial mostra somente as funções liberadas para seu perfil.'],result:'Você começa sabendo exatamente qual é o seu alcance.'},
      {perm:'overview',page:'overview',focus:'#overviewKpis',cat:'Visão geral',title:'Leia as prioridades do dia',text:'Use indicadores, atrasos e não conformidades para organizar a gestão.',bullets:['Veja conformidade e execução.','Observe itens atrasados.','Use o filtro para mudar de loja.'],result:'Você direciona a equipe para o que mais importa.'},
      {perm:'execute',page:'execute',focus:'#executeCards',cat:'Controles',title:'Acompanhe os controles disponíveis',text:'Na área de controles você acompanha os checklists liberados para as unidades sob sua responsabilidade.',bullets:['O Gestor pode distribuir controles quando tiver permissão.','O Operacional apenas responde os controles que chegam até ele.'],result:'A gestão organiza o trabalho; a operação responde.'},
      {perm:'execute',page:'execute',focus:'#officialAssignmentsPanel',cat:'Distribuição',title:'Direcione uma atividade para alguém',text:'Use a designação quando uma tarefa precisa ter responsável, frequência e prazo.',bullets:['Escolha uma loja sob sua gestão.','Escolha o usuário vinculado à loja.','Defina quando a atividade deve ser respondida.'],result:'A responsabilidade fica clara e mensurável.'},
      {perm:'execute',page:'execute',focus:'#openChecklistManagementPanel',cat:'Distribuição',title:'Deixe um controle aberto para a loja',text:'Quando qualquer Operacional da loja puder responder, abra o checklist para aquela unidade.',bullets:['Não escolha responsável.','O controle fica disponível sob demanda.','Ele não conta como pendência individual de todos.'],result:'A equipe ganha autonomia sem perder o limite da loja.'},
      {perm:'correct',page:'correct',focus:'#actionsTable',cat:'Tratativas',title:'Gerencie não conformidades e ações',text:'Acompanhe problemas abertos, responsáveis e prazos até o encerramento.',bullets:['Priorize atrasados e críticos.','Cobre o responsável.','Valide a solução.'],result:'A gestão fecha o ciclo do problema.'},
      {perm:'analyze',page:'analyze',focus:'.analysis-main',cat:'Análises',title:'Use dados para encontrar padrões',text:'Analise tendência, reincidência e concentração de desvios nas lojas sob sua responsabilidade.',bullets:['Compare períodos.','Observe problemas repetidos.','Direcione ações para causas recorrentes.'],result:'Você melhora a operação usando evidência.'},
      {perm:'training',page:'training',focus:'#training .headline',cat:'Treinamento',title:'Use o ambiente de treinamento',text:'Treine processos sem alterar os números oficiais.',bullets:['Dados de treinamento ficam separados.','Confira sempre o ambiente ativo antes de trabalhar.'],result:'Você reduz erro de aprendizagem na operação real.'},
      {perm:'help',page:'help',focus:'#help .helpgrid',cat:'Ajuda',title:'Ajuda após o primeiro acesso',text:'Este onboarding automático acontece uma única vez para este perfil.',bullets:['Depois, você pode reabrir o tutorial manualmente no Centro de Ajuda.','Ele não ficará aparecendo em todo login.'],result:'O sistema ensina sem interromper o trabalho diariamente.'},
      {page:'overview',focus:'.profile',cat:'Conta',title:'Gerencie sua própria conta',text:'No Meu perfil você pode trocar sua senha e sair do sistema.',bullets:['Sua senha é pessoal.','O Administrador pode redefinir acesso, mas não vê sua senha atual.'],result:'Seu acesso permanece individual e seguro.'}
    ],
    collaborator:[
      {page:'routine',focus:'.routine-hero',cat:'Início',title:'Sua tela principal é Minha Rotina',text:'Seu perfil Operacional não cria checklists. Você recebe controles preparados pela gestão e apenas responde o que estiver designado ou liberado para sua loja.',bullets:['Você não acessa o Construtor.','Você não cria modelos.','Você não escolhe controles de outras lojas.'],result:'Seu trabalho fica simples: abrir a atividade, responder e finalizar.'},
      {page:'routine',focus:'.routine-hero',cat:'Atividade designada',title:'Quando a tarefa for sua, ela aparece em destaque',text:'Atividades designadas têm um responsável específico e podem possuir data, horário e frequência.',bullets:['Leia o nome da atividade e o prazo.','Clique em Responder atividade.','Quando concluir, o progresso do dia é atualizado.'],result:'A gestão consegue saber se a atividade foi respondida no prazo.'},
      {page:'routine',focus:'#openChecklistRoutinePanel',cat:'Controle aberto',title:'Alguns controles podem ficar abertos para sua loja',text:'Um controle aberto não pertence a uma pessoa específica. Qualquer Operacional autorizado naquela loja pode respondê-lo quando necessário.',bullets:['Ele aparece separado das suas pendências pessoais.','Clique em Responder agora quando precisar utilizá-lo.','Você nunca verá controles abertos de outra loja.'],result:'Você tem autonomia para responder controles sob demanda sem assumir tarefas de outra unidade.'},
      {page:'routine',focus:'#routineList',cat:'Agenda',title:'Entenda sua lista do dia',text:'A lista organiza o que está pendente, atrasado ou concluído.',bullets:['Hoje: atividades com vencimento atual ou atraso.','Próximas: o que virá depois.','Concluídas: o que você já respondeu.'],result:'Você sabe o que fazer primeiro e o que já terminou.'},
      {page:'routine',focus:'.routine-progress-card',cat:'Progresso',title:'Acompanhe seu progresso',text:'O círculo mostra a porcentagem real das atividades pessoais concluídas no dia.',bullets:['Concluídos: atividades finalizadas.','Pendentes: ainda precisam ser respondidas.','Atrasados: passaram do prazo.','Controles abertos não viram pendência pessoal automaticamente.'],result:'Seu progresso acompanha somente responsabilidades reais.'},
      {page:'routine',focus:'.routine-tip',cat:'Como responder',title:'Responda com atenção e registre evidências',text:'Ao abrir uma atividade, leia cada pergunta e responda conforme a situação encontrada.',bullets:['Use a opção de resposta solicitada.','Quando a pergunta exigir foto/evidência, registre no momento da atividade.','Uma resposta não conforme pode gerar uma tratativa para a gestão.'],result:'Suas respostas viram histórico e ajudam a empresa a corrigir problemas.'},
      {perm:'training',page:'training',focus:'#training .headline',cat:'Treinamento',title:'Pratique no modo Treinamento',text:'O treinamento existe para você aprender a responder os controles antes de trabalhar na operação real.',bullets:['Treinamento não altera indicadores oficiais.','Confira no topo se você está em Treinamento ou Operação real.'],result:'Você pode aprender o fluxo com segurança.'},
      {perm:'help',page:'help',focus:'#help .helpgrid',cat:'Ajuda',title:'Se tiver dúvida, use o Centro de Ajuda',text:'Este tutorial automático aparece somente no primeiro acesso deste perfil.',bullets:['Depois ele não abrirá sozinho novamente.','Você poderá rever manualmente no Centro de Ajuda quando quiser.'],result:'O tutorial ensina uma vez e a ajuda continua disponível.'},
      {page:'routine',focus:'.profile',cat:'Conta',title:'Troque sua senha quando quiser',text:'No cartão do seu perfil você pode trocar sua própria senha e encerrar a sessão.',bullets:['Sua conta é individual.','Não compartilhe sua senha ou código de primeiro acesso.'],result:'Seu acesso permanece pessoal e rastreável.'}
    ]
  };

  function permissionsFor(r){
    const profile=(state.roles||[]).find(x=>x.id===P()?.access_profile_id);
    return new Set(profile?.permissions?.length?profile.permissions:(defaults[r]||[]));
  }
  function buildSteps(r){const perms=permissionsFor(r);return (guides[r]||[]).filter(s=>!s.perm||perms.has(s.perm));}

  function injectStyle(){
    if(document.getElementById('trielaFirstOnboardingStyle'))return;
    const s=document.createElement('style');s.id='trielaFirstOnboardingStyle';s.textContent=`
      .triela-onboarding-target{outline:4px solid #6d5dfc!important;outline-offset:5px!important;box-shadow:0 0 0 10px rgba(109,93,252,.14),0 12px 35px rgba(22,34,65,.18)!important;border-radius:12px!important;transition:outline .2s,box-shadow .2s}
      .triela-first-coach{position:fixed;z-index:10020;top:92px;right:22px;width:min(430px,calc(100vw - 44px));max-height:calc(100vh - 116px);overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 24px 70px rgba(5,22,48,.28);padding:0;color:#0b1f3a}
      .triela-first-coach.left{right:auto;left:22px}.triela-coach-top{padding:18px 20px 14px;background:linear-gradient(135deg,#0b2348,#252c70);color:#fff;border-radius:20px 20px 0 0}.triela-coach-kicker{font-size:10px;font-weight:900;letter-spacing:.12em;color:#b9c8ff}.triela-coach-top h2{margin:5px 0 4px;font-size:19px}.triela-coach-top p{margin:0;color:#d7e1f6;font-size:12px}.triela-coach-progress{height:5px;background:#e8edf5}.triela-coach-progress span{display:block;height:100%;background:#6d5dfc;transition:width .25s}.triela-coach-body{padding:18px 20px}.triela-coach-cat{font-size:10px;font-weight:900;letter-spacing:.1em;color:#6958e8;text-transform:uppercase}.triela-coach-body h3{font-size:21px;line-height:1.2;margin:6px 0 9px}.triela-coach-body>p{font-size:13px;line-height:1.55;color:#526178;margin:0 0 14px}.triela-coach-how{background:#f6f8fc;border:1px solid #e7ebf2;border-radius:14px;padding:13px 14px}.triela-coach-how strong,.triela-coach-result strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px}.triela-coach-how ul{padding-left:18px;margin:0}.triela-coach-how li{font-size:12px;color:#394960;line-height:1.45;margin:5px 0}.triela-coach-result{margin-top:12px;padding:12px 14px;border-radius:14px;background:#eafaf5;color:#126b58;font-size:12px;line-height:1.45}.triela-coach-footer{display:flex;align-items:center;gap:8px;padding:14px 20px 18px;border-top:1px solid #edf0f4}.triela-coach-step{font-size:11px;color:#7b8798;margin-right:auto}.triela-coach-btn{border:0;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}.triela-coach-btn.secondary{background:#eef2f7;color:#30415a}.triela-coach-btn.primary{background:#5b4de8;color:#fff}.triela-coach-skip{border:0;background:transparent;color:#738096;font-size:11px;cursor:pointer;padding:7px 0;margin-top:12px}
      @media(max-width:760px){.triela-first-coach,.triela-first-coach.left{top:auto;left:10px;right:10px;bottom:10px;width:auto;max-height:64vh}.triela-onboarding-target{outline-width:3px!important}}
    `;document.head.appendChild(s);
  }

  function clearTarget(){if(currentTarget){currentTarget.classList.remove('triela-onboarding-target');currentTarget=null;}}
  function placeCoach(target){const coach=document.getElementById('trielaFirstCoach');if(!coach)return;coach.classList.remove('left');if(target&&window.innerWidth>760){const r=target.getBoundingClientRect();if(r.left+r.width/2>window.innerWidth/2)coach.classList.add('left');}}
  function focusTarget(selector){
    clearTarget();if(!selector)return;
    setTimeout(()=>{const el=document.querySelector(selector);if(!el)return;currentTarget=el;el.classList.add('triela-onboarding-target');try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch{}setTimeout(()=>placeCoach(el),120);},120);
  }

  function openPage(page){if(page&&typeof navigate==='function')try{navigate(page);}catch{} }
  function renderCoach(){
    injectStyle();if(!currentSteps.length)return;
    const step=currentSteps[currentIndex];openPage(step.page);
    let coach=document.getElementById('trielaFirstCoach');if(!coach){coach=document.createElement('div');coach.id='trielaFirstCoach';coach.className='triela-first-coach';document.body.appendChild(coach);}
    const pct=Math.round((currentIndex+1)/currentSteps.length*100);
    coach.innerHTML=`<div class="triela-coach-top"><div class="triela-coach-kicker">${manualMode?'TUTORIAL SOB DEMANDA':'PRIMEIRO ACESSO'} • ${esc(roleNames[currentRole])}</div><h2>Conheça suas funções</h2><p>O sistema está mostrando apenas o que pertence a este perfil.</p></div><div class="triela-coach-progress"><span style="width:${pct}%"></span></div><div class="triela-coach-body"><div class="triela-coach-cat">${esc(step.cat||'Tutorial')}</div><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p>${step.bullets?.length?`<div class="triela-coach-how"><strong>Como funciona</strong><ul>${step.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}${step.result?`<div class="triela-coach-result"><strong>O que acontece depois</strong>${esc(step.result)}</div>`:''}<button class="triela-coach-skip" onclick="finishTutorial(true)">${manualMode?'Fechar tutorial':'Pular tutorial de primeiro acesso'}</button></div><div class="triela-coach-footer"><span class="triela-coach-step">Passo ${currentIndex+1} de ${currentSteps.length}</span>${currentIndex?'<button class="triela-coach-btn secondary" onclick="tutorialPrev()">Voltar</button>':''}<button class="triela-coach-btn primary" onclick="tutorialNext()">${currentIndex===currentSteps.length-1?'Concluir':'Próximo'}</button></div>`;
    active=true;focusTarget(step.focus);setTimeout(()=>patchOperationalCopy(),80);
  }

  async function loadFreshProfile(){
    if(!DB()||!P()?.user_id)return P();
    const {data}=await DB().from('cp_profiles').select('user_id,access_profile_id,onboarding_completed_profile_id,onboarding_completed_at,onboarding_version').eq('user_id',P().user_id).maybeSingle();
    if(data)Object.assign(P(),data);return P();
  }

  window.showTutorial=async function(force=false,requested=null){
    clearTimeout(waitTimer);
    if(window.TRIELA_OFFICIAL&&!O().ready){waitTimer=setTimeout(()=>showTutorial(force,requested),650);return;}
    const real=actualRole();
    if(!force){
      const p=await loadFreshProfile();
      if(!p?.access_profile_id)return;
      if(p.onboarding_completed_profile_id===p.access_profile_id)return;
      currentRole=real;manualMode=false;
    }else{
      currentRole=(real==='admin'&&requested&&guides[requested])?requested:real;manualMode=true;
    }
    currentSteps=buildSteps(currentRole);currentIndex=0;if(currentSteps.length)renderCoach();
  };
  window.changeTutorialRole=function(r){if(actualRole()!=='admin'||!manualMode||!guides[r])return;currentRole=r;currentSteps=buildSteps(r);currentIndex=0;renderCoach();};
  window.tutorialNext=function(){if(!active)return;if(currentIndex<currentSteps.length-1){currentIndex++;renderCoach();}else finishTutorial(true);};
  window.tutorialPrev=function(){if(!active)return;if(currentIndex>0){currentIndex--;renderCoach();}};
  window.finishTutorial=async function(markComplete=true){
    clearTarget();document.getElementById('trielaFirstCoach')?.remove();active=false;
    if(markComplete&&!manualMode&&DB()&&P()?.user_id&&P()?.access_profile_id){
      const now=new Date().toISOString();
      const {error}=await DB().from('cp_profiles').update({onboarding_completed_profile_id:P().access_profile_id,onboarding_completed_at:now,onboarding_version:VERSION}).eq('user_id',P().user_id);
      if(!error){P().onboarding_completed_profile_id=P().access_profile_id;P().onboarding_completed_at=now;P().onboarding_version=VERSION;}
    }
    if(typeof applyRoleView==='function')try{applyRoleView();}catch{}
    if(typeof toast==='function')toast(manualMode?'Tutorial fechado.':'Tutorial de primeiro acesso concluído. Você pode revê-lo no Centro de Ajuda.');
  };

  function previewOperational(){return actualRole()==='collaborator'||(actualRole()==='admin'&&document.getElementById('previewRole')?.value==='collaborator');}
  function patchOperationalCopy(){
    if(!previewOperational())return;
    const hero=document.querySelector('.routine-hero');
    const start=document.getElementById('routineStartBtn')||hero?.querySelector('.routine-start');
    const hasOfficialOperational=actualRole()==='collaborator';
    if(hero){
      const note=hero.querySelector('.routine-note');if(note)note.textContent='Seu perfil Operacional não cria checklists. Você responde apenas atividades designadas para você ou controles liberados para sua loja.';
      const h1=hero.querySelector('h1');const meta=hero.querySelector('.meta');
      if(!hasOfficialOperational&&h1&&/Nenhuma atividade programada|Nenhuma atividade criada/i.test(h1.textContent||'')){h1.textContent='Nenhuma atividade disponível';if(meta)meta.textContent='Quando uma atividade for designada ou liberada para a loja, ela aparecerá aqui.';}
    }
    if(start){
      const txt=start.textContent||'';
      if(/Criar primeiro checklist/i.test(txt)){start.textContent='Aguardando atividade';start.disabled=true;start.onclick=null;}
      else if(/Executar checklist aberto/i.test(txt))start.textContent='Responder controle aberto →';
      else if(/Iniciar atividade atrasada/i.test(txt))start.textContent='Responder atividade atrasada →';
      else if(/Iniciar atividade|Iniciar agora/i.test(txt))start.textContent='Responder atividade →';
    }
    document.querySelectorAll('#routine .routine-assigned-row .btn,#routine .open-routine-card .btn,#routine .routine-row .btn').forEach(b=>{if(/Executar|Iniciar/i.test(b.textContent||''))b.textContent='Responder';});
    document.querySelectorAll('#routine .empty span').forEach(el=>{if(/cadastradas e programadas/i.test(el.textContent||''))el.textContent='As atividades aparecerão aqui quando forem designadas para você ou liberadas para sua loja.';});
  }

  const previousRender=window.render;
  if(typeof previousRender==='function')window.render=function(){previousRender();setTimeout(patchOperationalCopy,0);};
  document.addEventListener('click',()=>setTimeout(patchOperationalCopy,60),true);
  document.addEventListener('change',e=>{if(e.target?.id==='previewRole'||e.target?.closest?.('#modeSwitch'))setTimeout(patchOperationalCopy,80);},true);
  window.addEventListener('focus',()=>setTimeout(patchOperationalCopy,80));
  [50,350,1000,2200].forEach(ms=>setTimeout(patchOperationalCopy,ms));
})();
