/* Triela Checklists — hotfix: rotina operacional estável após o primeiro acesso */
(function(){
  'use strict';

  function ensureRoutineHeroStructure(){
    const hero=document.querySelector('.routine-hero');
    if(!hero)return;
    const required=['routineNextTime','routineNextName','routineNextMeta','routineQuestions','routineMinutes','routineStartBtn'];
    if(required.every(id=>document.getElementById(id)))return;

    hero.innerHTML=`
      <div class="mini">PRÓXIMA ATIVIDADE</div>
      <div class="routine-time">◷ <strong id="routineNextTime">—</strong></div>
      <h1 id="routineNextName">Nenhuma atividade disponível</h1>
      <div class="meta" id="routineNextMeta">Aguardando atividade designada ou controle liberado para sua loja.</div>
      <div class="routine-facts">
        <span>▣ <b id="routineQuestions">0</b> perguntas</span>
        <span>◷ cerca de <b id="routineMinutes">0</b> min</span>
      </div>
      <div class="routine-note">Seu perfil Operacional não cria checklists. Você responde somente atividades designadas para você ou controles liberados para sua loja.</div>
      <button class="routine-start" id="routineStartBtn" disabled>Aguardando atividade</button>`;
  }

  /* app7 pode substituir todo o conteúdo do hero quando ainda não existem modelos.
     Restauramos os IDs usados pela rotina oficial antes que app16 preencha os dados. */
  const previousRoutine=window.renderRoutine;
  if(typeof previousRoutine==='function'){
    window.renderRoutine=function(){
      let result;
      try{result=previousRoutine.apply(this,arguments);}
      finally{ensureRoutineHeroStructure();}
      return result;
    };
  }

  const previousRender=window.render;
  if(typeof previousRender==='function'){
    window.render=function(){
      ensureRoutineHeroStructure();
      let result;
      try{result=previousRender.apply(this,arguments);}
      finally{ensureRoutineHeroStructure();}
      return result;
    };
  }

  /* Se algum módulo antigo reconstruir a tela fora de render(), corrige no próximo ciclo
     sem MutationObserver e sem loop pesado. */
  function stabilize(){
    ensureRoutineHeroStructure();
    setTimeout(ensureRoutineHeroStructure,0);
    setTimeout(ensureRoutineHeroStructure,120);
  }

  function friendlyLoginError(){
    const el=document.getElementById('officialLoginError');
    if(!el)return;
    const text=el.textContent||'';
    if(/Cannot set properties of null|Cannot read properties of null|textContent/i.test(text)){
      el.textContent='Não foi possível concluir a abertura da sua área. Atualize a página e tente novamente.';
    }
  }

  window.addEventListener('error',()=>setTimeout(friendlyLoginError,0));
  document.addEventListener('DOMContentLoaded',stabilize);
  document.addEventListener('click',()=>setTimeout(ensureRoutineHeroStructure,0),true);
  window.addEventListener('focus',()=>setTimeout(ensureRoutineHeroStructure,0));

  /* Concluir o onboarding deve apenas registrar a conclusão e permanecer na sessão. */
  const previousFinish=window.finishTutorial;
  if(typeof previousFinish==='function'){
    window.finishTutorial=async function(){
      const official=window.TRIELA_OFFICIAL;
      let sessionBefore=null;
      try{sessionBefore=(await official?.supabase?.auth?.getSession?.())?.data?.session||null;}catch(_){ }
      try{
        return await previousFinish.apply(this,arguments);
      }finally{
        ensureRoutineHeroStructure();
        /* Não executamos signOut, reload ou troca de credencial aqui. Se a sessão já existia,
           o usuário continua na mesma sessão e na área correspondente ao perfil. */
        if(sessionBefore&&official?.profile){
          setTimeout(()=>{
            try{
              document.body.classList.remove('official-locked');
              document.getElementById('officialAuthShell')?.classList.add('hidden');
              if(typeof applyRoleView==='function')applyRoleView();
              if(typeof navigate==='function'&&official.profile.role==='auditor')navigate('routine');
              ensureRoutineHeroStructure();
            }catch(_){ }
          },0);
        }
      }
    };
  }

  stabilize();
  let attempts=0;
  const startup=setInterval(()=>{
    attempts++;
    stabilize();
    friendlyLoginError();
    if(window.TRIELA_OFFICIAL?.ready||attempts>=30)clearInterval(startup);
  },250);
})();
