/* Triela Checklists — login sempre vazio, sem usuário/senha pré-preenchidos */
(function(){
  'use strict';

  function clearIfUntouched(el){
    if(!el||el.dataset.trielaUserEdited==='1')return;
    if(document.activeElement===el&&el.dataset.trielaUserInteracted==='1')return;
    if(el.value)el.value='';
  }

  function bindField(el){
    if(!el||el.dataset.trielaBlankBound==='1')return;
    el.dataset.trielaBlankBound='1';
    const prepare=()=>{
      if(el.dataset.trielaUserEdited!=='1'&&el.value)el.value='';
      el.dataset.trielaUserInteracted='1';
    };
    el.addEventListener('pointerdown',prepare,{passive:true});
    el.addEventListener('keydown',prepare);
    el.addEventListener('paste',()=>{el.dataset.trielaUserInteracted='1';el.dataset.trielaUserEdited='1';});
    el.addEventListener('input',()=>{
      if(el.dataset.trielaUserInteracted==='1')el.dataset.trielaUserEdited='1';
    });
  }

  function patchLogin(){
    const form=document.getElementById('officialLoginForm');
    const user=document.getElementById('officialUsername');
    const pass=document.getElementById('officialPassword');
    if(!form||!user||!pass)return false;

    form.setAttribute('autocomplete','off');
    user.setAttribute('autocomplete','off');
    user.setAttribute('autocapitalize','none');
    user.setAttribute('spellcheck','false');
    user.setAttribute('name','triela_login_usuario');
    pass.setAttribute('autocomplete','new-password');
    pass.setAttribute('name','triela_login_senha');

    bindField(user);bindField(pass);

    if(!form.querySelector('.triela-autofill-decoy')){
      const decoy=document.createElement('div');
      decoy.className='triela-autofill-decoy';
      decoy.setAttribute('aria-hidden','true');
      decoy.style.cssText='position:absolute!important;left:-10000px!important;top:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;';
      decoy.innerHTML='<input type="text" name="username" autocomplete="username" tabindex="-1"><input type="password" name="password" autocomplete="current-password" tabindex="-1">';
      form.prepend(decoy);
    }

    clearIfUntouched(user);clearIfUntouched(pass);
    return true;
  }

  function blankLoginSoon(){
    [0,60,180,450,900,1600].forEach(ms=>setTimeout(()=>{
      if(!patchLogin())return;
      clearIfUntouched(document.getElementById('officialUsername'));
      clearIfUntouched(document.getElementById('officialPassword'));
    },ms));
  }

  window.addEventListener('pageshow',blankLoginSoon);
  document.addEventListener('DOMContentLoaded',blankLoginSoon);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(patchLogin,40);});

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const ok=patchLogin();
    if(ok&&tries>8)clearInterval(timer);
    if(tries>30)clearInterval(timer);
  },150);

  blankLoginSoon();
})();
