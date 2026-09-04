/* Ajustes de perfil operacional e indicadores circulares dinâmicos */
(function(){
  function clampPct(value){
    const n=Number(value);
    return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;
  }

  function updatePulseRing(){
    const ring=document.querySelector('.pulse-ring');
    if(!ring)return;
    const scoreText=(document.getElementById('pulseScore')?.textContent||'0').replace(',','.');
    const score=clampPct(parseFloat(scoreText));
    ring.style.setProperty('--p',score+'%');
    ring.setAttribute('aria-label',`Pulso operacional ${Math.round(score)} de 100`);
  }

  function todayCompletedCount(){
    const today=new Date().toDateString();
    return (state.runs||[]).filter(r=>r.status==='completed'&&new Date(r.date).toDateString()===today).length;
  }

  function updateRoutineRingAndBadge(){
    const donut=document.getElementById('routineDonut');
    const pctText=(document.getElementById('routinePct')?.textContent||'0').replace('%','').replace(',','.');
    const pct=clampPct(parseFloat(pctText));
    if(donut){
      donut.style.setProperty('--p',pct+'%');
      donut.setAttribute('aria-label',`Progresso do dia ${Math.round(pct)}%`);
    }

    const total=(state.templates||[]).length;
    const done=Math.min(total,todayCompletedCount());
    const pending=Math.max(0,total-done);
    document.querySelectorAll('.navbtn[data-page="routine"] .navbadge').forEach(b=>b.textContent=String(pending));
  }

  const previousOverview=renderOverview;
  renderOverview=function(){
    previousOverview();
    updatePulseRing();
  };

  const previousRoutine=renderRoutine;
  renderRoutine=function(){
    previousRoutine();
    updateRoutineRingAndBadge();
  };

  const previousApplyRoleView=applyRoleView;
  applyRoleView=function(){
    previousApplyRoleView();
    const role=state.ui.previewRole||'admin';
    document.querySelectorAll('.navbtn[data-page="routine"]').forEach(btn=>{
      btn.classList.toggle('hidden-by-role',role!=='collaborator');
    });
    const active=document.querySelector('.section.active')?.id;
    if(active==='routine'&&role!=='collaborator')navigate('overview');
  };

  /* Minha Rotina também sai dos tours de perfis de gestão. */
  if(typeof tutorials!=='undefined'){
    if(Array.isArray(tutorials.admin))tutorials.admin=tutorials.admin.filter(step=>step.page!=='routine');
    if(Array.isArray(tutorials.manager))tutorials.manager=tutorials.manager.filter(step=>step.page!=='routine');
  }

  /* Reaplica as regras após o carregamento dos módulos anteriores. */
  render();
  applyRoleView();
  updatePulseRing();
  updateRoutineRingAndBadge();
})();
