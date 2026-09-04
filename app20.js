/* Triela Checklists — execução por seções para checklists extensos */
(function(){
  'use strict';
  const O=()=>window.TRIELA_OFFICIAL||{};
  const DB=()=>O().supabase;
  let sectionsById=new Map();
  let itemsById=new Map();
  let initialized=false;

  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function injectStyle(){
    if(document.getElementById('trielaSectionExecutionStyle'))return;
    const s=document.createElement('style');
    s.id='trielaSectionExecutionStyle';
    s.textContent=`
      .triela-exec-progress{position:sticky;top:0;z-index:4;background:#fff;border-bottom:1px solid #e8edf4;padding:10px 0 12px;margin-bottom:8px}
      .triela-exec-progress-top{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:12px;color:#5f6f84;margin-bottom:7px}
      .triela-exec-progress-top strong{color:#0b1f3a}.triela-exec-progress-bar{height:7px;background:#edf1f7;border-radius:999px;overflow:hidden}.triela-exec-progress-bar span{display:block;height:100%;width:0;background:linear-gradient(90deg,#5b4de8,#24c7b5);border-radius:999px;transition:width .2s ease}
      .triela-exec-section{margin:22px 0 10px;padding:14px 16px;border-radius:14px;background:linear-gradient(135deg,#0b2348,#26346f);color:#fff;box-shadow:0 8px 20px rgba(11,35,72,.12)}
      .triela-exec-section small{display:block;font-size:10px;font-weight:900;letter-spacing:.1em;color:#b9c8ff;text-transform:uppercase;margin-bottom:4px}.triela-exec-section strong{display:block;font-size:17px}.triela-exec-section span{display:block;margin-top:4px;font-size:11px;color:#d7e1f6}
      #answersBody .answer{scroll-margin-top:85px}
      @media(max-width:720px){.triela-exec-section{margin-top:16px;padding:12px 13px}.triela-exec-section strong{font-size:15px}.triela-exec-progress{top:-1px}}
    `;
    document.head.appendChild(s);
  }

  async function loadStructure(){
    if(!O().ready||!DB())return false;
    const [sq,iq]=await Promise.all([
      DB().from('cp_template_sections').select('id,template_id,title,description,sort_order').is('archived_at',null),
      DB().from('cp_template_items').select('id,template_id,section_id,sort_order,allows_na,requires_photo_on_no').is('archived_at',null)
    ]);
    if(sq.error||iq.error)return false;
    sectionsById=new Map((sq.data||[]).map(x=>[x.id,x]));
    itemsById=new Map((iq.data||[]).map(x=>[x.id,x]));
    normalizeTemplates();
    return true;
  }

  function normalizeTemplates(){
    (state.templates||[]).forEach(t=>{
      (t.questions||[]).forEach(q=>{
        const meta=itemsById.get(q.id);const sec=sectionsById.get(q.backendSectionId||meta?.section_id);
        q.sectionTitle=sec?.title||'Geral';q.sectionDescription=sec?.description||'';q.sectionOrder=Number(sec?.sort_order||999);q.itemOrder=Number(meta?.sort_order||999);q.allowsNa=meta?.allows_na===true;q.requiresPhotoOnNo=meta?.requires_photo_on_no===true;
      });
      t.questions.sort((a,b)=>(a.sectionOrder-b.sectionOrder)||(a.itemOrder-b.itemOrder)||String(a.title).localeCompare(String(b.title),'pt-BR'));
    });
  }

  function answeredCount(t){
    let done=0;
    for(const q of t.questions||[]){
      const choice=document.querySelector(`[data-q='${CSS.escape(q.id)}'].selected`);
      const input=document.querySelector(`[data-input-q='${CSS.escape(q.id)}']`);
      if(choice||(input&&String(input.value||'').trim()!==''))done++;
    }
    return done;
  }

  function updateProgress(t){
    const root=document.getElementById('trielaExecProgress');if(!root)return;
    const total=t.questions?.length||0,done=answeredCount(t),pct=total?Math.round(done/total*100):0;
    const label=root.querySelector('[data-progress-label]'),bar=root.querySelector('[data-progress-bar]');
    if(label)label.textContent=`${done} de ${total} respondidas`;
    if(bar)bar.style.width=pct+'%';
  }

  function decorateExecution(templateId){
    normalizeTemplates();injectStyle();
    const t=(state.templates||[]).find(x=>x.id===templateId),body=document.getElementById('answersBody');if(!t||!body)return;
    body.querySelectorAll('.triela-exec-section,.triela-exec-progress').forEach(x=>x.remove());
    const progress=document.createElement('div');progress.className='triela-exec-progress';progress.id='trielaExecProgress';progress.innerHTML=`<div class="triela-exec-progress-top"><strong>Progresso do checklist</strong><span data-progress-label>0 de ${t.questions.length} respondidas</span></div><div class="triela-exec-progress-bar"><span data-progress-bar></span></div>`;body.prepend(progress);
    const answers=[...body.querySelectorAll('.answer')];
    let lastSection='';
    t.questions.forEach((q,i)=>{
      const answer=answers[i];if(!answer)return;
      const section=q.sectionTitle||'Geral';
      if(section!==lastSection){
        const sec=sectionsById.get(q.backendSectionId)||{};
        const sectionQuestions=t.questions.filter(x=>(x.sectionTitle||'Geral')===section).length;
        const head=document.createElement('div');head.className='triela-exec-section';head.innerHTML=`<small>Seção ${q.sectionOrder<999?q.sectionOrder:''}</small><strong>${esc(section)}</strong><span>${esc(sec.description||'')}${sec.description?' · ':''}${sectionQuestions} itens</span>`;
        answer.before(head);lastSection=section;
      }
    });
    body.addEventListener('click',()=>setTimeout(()=>updateProgress(t),0),{passive:true});
    body.addEventListener('input',()=>updateProgress(t),{passive:true});
    body.addEventListener('change',()=>updateProgress(t),{passive:true});
    updateProgress(t);
  }

  function wrapExecutions(){
    if(window.__trielaSectionsWrapped)return;window.__trielaSectionsWrapped=true;
    const direct=window.startRun;
    if(typeof direct==='function')window.startRun=function(templateId){const r=direct.apply(this,arguments);setTimeout(()=>decorateExecution(templateId),0);return r;};
    const scheduled=window.startScheduledRun;
    if(typeof scheduled==='function')window.startScheduledRun=function(templateId){const r=scheduled.apply(this,arguments);setTimeout(()=>decorateExecution(templateId),0);return r;};
  }

  async function boot(){
    if(initialized||!O().ready||!DB())return false;initialized=true;
    injectStyle();await loadStructure();wrapExecutions();
    return true;
  }
  if(!boot()){
    let tries=0;const timer=setInterval(async()=>{tries++;if(await boot()||tries>50)clearInterval(timer);},250);
  }
  window.addEventListener('focus',()=>{if(O().ready)setTimeout(()=>loadStructure(),500);});
})();
