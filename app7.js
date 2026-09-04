/* Instalação limpa — remove dados de demonstração e evita números fictícios */
(function(){
  const RESET_KEY='trielaCleanReset20260904v1';
  const cleanState={templates:[],runs:[],actions:[],users:[],trainingRuns:[],trainingActions:[],ui:{mode:'real',previewRole:'admin',tutorialDone:false,tutorialDoneByRole:{},dashboard:{overviewPeriod:'7d',overviewUnit:'Todas as unidades',analysisPeriod:'30d',analysisUnit:'Todas as unidades',analysisCategory:'Todas as categorias',analysisCriticality:'Todas as criticidades'}}};
  if(!localStorage.getItem(RESET_KEY)){
    localStorage.removeItem('trielaV3');
    localStorage.removeItem('trielaV4');
    state=JSON.parse(JSON.stringify(cleanState));
    localStorage.setItem('trielaV4',JSON.stringify(state));
    localStorage.setItem(RESET_KEY,'1');
  }
  state.templates=state.templates||[];state.runs=state.runs||[];state.actions=state.actions||[];state.users=state.users||[];state.trainingRuns=state.trainingRuns||[];state.trainingActions=state.trainingActions||[];state.ui=state.ui||cleanState.ui;

  const liveOverview=renderOverview;
  const liveAnalysis=renderAnalysis;
  const liveRoutine=renderRoutine;
  const liveModels=renderModels;
  const liveUsers=renderUsers;

  metrics=function(){
    const completed=state.runs.filter(r=>r.status==='completed'),all=state.runs.filter(r=>r.status!=='canceled'),pending=state.actions.filter(a=>a.status!=='done'),overdue=state.actions.filter(a=>a.status==='overdue');
    const execution=all.length?completed.length/all.length*100:0;
    const compliance=completed.length?avg(completed.map(r=>r.compliance)):0;
    const correction=state.actions.length?state.actions.filter(a=>a.status==='done').length/state.actions.length*100:0;
    const punctuality=pending.length?(pending.length-overdue.length)/pending.length*100:0;
    const score=(all.length||state.actions.length)?execution*.30+compliance*.35+correction*.20+punctuality*.15:0;
    return{completed,all,pending,overdue,execution,compliance,correction,punctuality,score,nc:completed.reduce((s,r)=>s+(r.nc||0),0)};
  };

  function emptyBox(title,text,buttonText,page){return `<div class="empty" style="padding:34px 18px"><strong style="display:block;font-size:15px;color:var(--navy);margin-bottom:7px">${title}</strong><span style="display:block;margin-bottom:${buttonText?'16':'0'}px">${text}</span>${buttonText?`<button class="btn" onclick="navigate('${page}')">${buttonText}</button>`:''}</div>`;}
  function hasOperationalData(){return state.runs.length||state.actions.length;}

  renderOverview=function(){
    if(hasOperationalData()) return liveOverview();
    const now=new Date(),hr=now.getHours(),greet=hr<12?'Bom dia':hr<18?'Boa tarde':'Boa noite';
    const g=document.getElementById('overviewGreeting'),d=document.getElementById('overviewDate');if(g)g.textContent=`${greet}.`;if(d)d.textContent='Ambiente limpo e pronto para começar a operação.';
    const sel=document.getElementById('overviewUnit');if(sel)sel.innerHTML='<option>Todas as unidades</option>';
    const box=document.getElementById('overviewKpis');if(box)box.innerHTML=[['Conformidade geral','—','Sem execuções'],['Checklists concluídos','0','Nenhuma execução'],['Execuções atrasadas','0','Nenhum atraso'],['Não conformidades','0','Nenhuma ocorrência']].map((x,i)=>`<div class="ov-kpi"><div class="ov-kpi-top"><div class="ov-icon ${['purple','teal','amber','red'][i]}">${['↗','✓','◷','△'][i]}</div></div><div class="ov-main"><strong>${x[1]}</strong></div><div class="ov-label">${x[0]}</div><div class="ov-sub" style="margin-top:6px">${x[2]}</div><div class="ov-progress ${['purple','teal','amber','red'][i]}"><span style="width:0%"></span></div></div>`).join('');
    const chart=document.getElementById('complianceChart');if(chart)chart.innerHTML=emptyBox('Ainda não há histórico','O gráfico começará a ser preenchido automaticamente após as primeiras execuções.');
    const ps=document.getElementById('pulseScore');if(ps)ps.textContent='—';const ph=document.getElementById('pulseHealth');if(ph)ph.textContent='Sem dados';
    const pm=document.getElementById('pulseMetrics');if(pm)pm.innerHTML=[['Execução no prazo','—'],['Conformidade','—'],['Ações resolvidas','—']].map(x=>`<div class="pulse-row"><div class="pulse-top"><span>${x[0]}</span><strong>${x[1]}</strong></div><div class="pulse-track"><span style="width:0%"></span></div></div>`).join('');
    const ol=document.getElementById('originList');if(ol)ol.innerHTML='<div class="analysis-empty">Nenhum desvio registrado.</div>';
    const rl=document.getElementById('recurrenceList');if(rl)rl.innerHTML='<div class="analysis-empty">Nenhuma reincidência registrada.</div>';
    const al=document.getElementById('activityList');if(al)al.innerHTML=state.templates.length?state.templates.slice(0,4).map(t=>`<div class="activity-row" tabindex="0" role="button" onclick="startRun('${t.id}')"><div class="activity-time">—</div><div><div class="activity-title">${t.name}</div><div class="activity-unit">Sem agendamento definido</div></div><span class="activity-status pending">● Disponível</span></div>`).join(''):emptyBox('Nenhuma atividade criada','Crie seu primeiro checklist para começar a montar a operação.','Criar checklist','builder');
  };

  renderAnalysis=function(){
    if(state.runs.some(r=>r.status==='completed')) return liveAnalysis();
    const k=document.getElementById('analysisPremiumKpis');if(k)k.innerHTML=[['Execuções realizadas','0'],['Conformidade média','—'],['Tempo médio de resolução','—'],['Desvios reincidentes','0']].map(x=>`<div class="analysis-kpi"><div class="ak-label">${x[0]}</div><div class="ak-value">${x[1]}</div><div class="ak-trend">Aguardando dados reais</div></div>`).join('');
    const ev=document.getElementById('analysisEvolution');if(ev)ev.innerHTML=emptyBox('Sem histórico para analisar','A evolução aparecerá depois que os checklists começarem a ser executados.');
    const cat=document.getElementById('analysisCategories');if(cat)cat.innerHTML='<div class="analysis-empty">Nenhuma não conformidade registrada.</div>';
    const top=document.getElementById('analysisTopIssues');if(top)top.innerHTML='<div class="analysis-empty">Nenhum item reprovado registrado.</div>';
    const rec=document.getElementById('analysisRecurrences');if(rec)rec.innerHTML='<div class="analysis-empty">Nenhuma reincidência registrada.</div>';
  };

  renderRoutine=function(){
    if(!state.templates.length){
      const hero=document.querySelector('.routine-hero');if(hero)hero.innerHTML=`<div class="mini">PRÓXIMA ATIVIDADE</div><h1>Nenhuma atividade programada</h1><div class="meta">O ambiente está limpo e pronto para configuração.</div><div class="routine-note">Crie checklists e defina responsáveis e horários para que a rotina apareça aqui.</div><button class="routine-start" onclick="navigate('builder')">Criar primeiro checklist →</button>`;
      const list=document.getElementById('routineList');if(list)list.innerHTML=emptyBox('Sua rotina está vazia','As atividades aparecerão aqui quando forem cadastradas e programadas.');
      const pct=document.getElementById('routinePct');if(pct)pct.textContent='0%';['routineDone','routinePending','routineLate'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='0'});return;
    }
    const today=new Date().toDateString(),done=state.runs.filter(r=>r.status==='completed'&&new Date(r.date).toDateString()===today).length,total=state.templates.length,pct=total?Math.round(done/total*100):0;
    const first=state.templates[0],hero=document.querySelector('.routine-hero');if(hero)hero.innerHTML=`<div class="mini">PRÓXIMA ATIVIDADE</div><h1>${first.name}</h1><div class="meta">Sem horário definido</div><div class="routine-facts"><span>▣ ${first.questions.length} perguntas</span></div><div class="routine-note">Checklist disponível para execução.</div><button class="routine-start" onclick="startRun('${first.id}')">Iniciar agora →</button>`;
    const list=document.getElementById('routineList');if(list)list.innerHTML=state.templates.map(t=>`<div class="routine-row"><div class="routine-row-icon">▣</div><div><strong>${t.name}</strong><small>${t.category||'Geral'} • ${t.questions.length} perguntas</small></div><div class="routine-row-time">—</div><button class="btn secondary" onclick="startRun('${t.id}')">Executar</button></div>`).join('');
    const p=document.getElementById('routinePct');if(p)p.textContent=pct+'%';const rd=document.getElementById('routineDone');if(rd)rd.textContent=done;const rp=document.getElementById('routinePending');if(rp)rp.textContent=Math.max(0,total-done);const rl=document.getElementById('routineLate');if(rl)rl.textContent='0';
  };

  renderModels=function(){if(state.templates.length)return liveModels();const el=document.getElementById('modelCards');if(el)el.innerHTML=emptyBox('Nenhum modelo cadastrado','A biblioteca está limpa. Crie um checklist do zero para começar.','Criar checklist','builder');};
  renderUsers=function(){if(state.users.length)return liveUsers();const el=document.getElementById('usersTable');if(el)el.innerHTML='<tr><td colspan="7"><div class="empty">Nenhum usuário cadastrado ainda.</div></td></tr>';};

  function genericIdentity(){const prof=document.querySelector('.profile strong');if(prof)prof.textContent='Administrador';const small=document.querySelector('.profile small');if(small)small.innerHTML=`Administrador · <span id="profileEnvironment">${state.ui.mode==='training'?'Modo treinamento':'Operação real'}</span>`;}
  const baseRender=render;render=function(){baseRender();genericIdentity();};

  document.addEventListener('click',()=>{if(!hasOperationalData())setTimeout(()=>{renderOverview();renderAnalysis();},0)},true);
  document.addEventListener('change',()=>{if(!hasOperationalData())setTimeout(()=>{renderOverview();renderAnalysis();},0)},true);
  render();
})();
