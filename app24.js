/* Triela Checklists — bloqueio reforçado contra autofill no login */
(function(){
  'use strict';

  const ID_USER='officialUsername';
  const ID_PASS='officialPassword';

  function field(id){return document.getElementById(id)}

  function forceBlank(el){
    if(!el||el.dataset.trielaManualTyped==='1')return;
    try{
      el.value='';
      el.setAttribute('value','');
    }catch(_){ }
  }

  function armForManualTyping(el){
    if(!el)return;
    forceBlank(el);
    el.readOnly=false;
    el.removeAttribute('readonly');
    [0,40,120,250].forEach(ms=>setTimeout(()=>forceBlank(el),ms));
  }

  function harden(el,isPassword){
    if(!el)return;
    el.setAttribute('autocomplete',isPassword?'new-password':'off');
    el.setAttribute('autocapitalize','none');
    el.setAttribute('spellcheck','false');
    el.setAttribute('name',`triela_${isPassword?'secret':'account'}_${Math.random().toString(36).slice(2)}`);

    if(el.dataset.trielaHardAutofill==='1')return;
    el.dataset.trielaHardAutofill='1';
    el.dataset.trielaManualTyped='0';
    el.readOnly=true;
    el.setAttribute('readonly','readonly');
    forceBlank(el);

    el.addEventListener('pointerdown',()=>armForManualTyping(el),true);
    el.addEventListener('touchstart',()=>armForManualTyping(el),{capture:true,passive:true});
    el.addEventListener('focus',()=>{
      armForManualTyping(el);
      setTimeout(()=>forceBlank(el),300);
    },true);

    el.addEventListener('keydown',()=>{
      el.dataset.trielaManualTyped='1';
      el.readOnly=false;
      el.removeAttribute('readonly');
    },true);

    el.addEventListener('beforeinput',e=>{
      const t=String(e.inputType||'');
      if(t==='insertText'||t==='insertCompositionText'||t==='insertFromPaste'){
        el.dataset.trielaManualTyped='1';
        el.readOnly=false;
        el.removeAttribute('readonly');
      }
    },true);

    el.addEventListener('paste',()=>{
      el.dataset.trielaManualTyped='1';
      el.readOnly=false;
      el.removeAttribute('readonly');
    },true);
  }

  function patch(){
    const form=document.getElementById('officialLoginForm');
    const user=field(ID_USER),pass=field(ID_PASS);
    if(!form||!user||!pass)return false;

    form.setAttribute('autocomplete','off');
    form.setAttribute('data-lpignore','true');
    form.setAttribute('data-1p-ignore','true');
    harden(user,false);
    harden(pass,true);

    if(user.dataset.trielaManualTyped!=='1')forceBlank(user);
    if(pass.dataset.trielaManualTyped!=='1')forceBlank(pass);
    return true;
  }

  function resetLoginFields(){
    const user=field(ID_USER),pass=field(ID_PASS);
    [user,pass].forEach(el=>{
      if(!el)return;
      el.dataset.trielaManualTyped='0';
      el.readOnly=true;
      el.setAttribute('readonly','readonly');
      forceBlank(el);
    });
  }

  function watchAutofill(){
    let ticks=0;
    const timer=setInterval(()=>{
      ticks++;
      if(patch()){
        const user=field(ID_USER),pass=field(ID_PASS);
        if(user?.dataset.trielaManualTyped!=='1')forceBlank(user);
        if(pass?.dataset.trielaManualTyped!=='1')forceBlank(pass);
      }
      if(ticks>=60)clearInterval(timer);
    },100);
  }

  window.addEventListener('pageshow',()=>{resetLoginFields();watchAutofill();});
  window.addEventListener('focus',()=>{setTimeout(()=>{resetLoginFields();watchAutofill();},20);});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(()=>{resetLoginFields();watchAutofill();},20);
  });
  document.addEventListener('DOMContentLoaded',watchAutofill);

  watchAutofill();
})();
