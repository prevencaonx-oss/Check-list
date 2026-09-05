/* Triela Checklists — PWA instalável no Android */
(function(){
  'use strict';
  let deferredPrompt=null;
  const addHead=()=>{
    if(!document.querySelector('link[rel="manifest"]')){const l=document.createElement('link');l.rel='manifest';l.href='manifest.webmanifest';document.head.appendChild(l);}
    [['theme-color','#071f40'],['mobile-web-app-capable','yes'],['apple-mobile-web-app-capable','yes'],['apple-mobile-web-app-status-bar-style','black-translucent'],['apple-mobile-web-app-title','Triela']].forEach(([name,content])=>{if(!document.querySelector(`meta[name="${name}"]`)){const m=document.createElement('meta');m.name=name;m.content=content;document.head.appendChild(m);}});
    if(!document.querySelector('link[rel="apple-touch-icon"]')){const i=document.createElement('link');i.rel='apple-touch-icon';i.href='icon-192.svg';document.head.appendChild(i);}
  };
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  function ensureInstallButton(){
    if(isStandalone()||document.getElementById('trielaInstallBtn'))return;
    const btn=document.createElement('button');btn.id='trielaInstallBtn';btn.className='iconbtn triela-install-btn';btn.type='button';btn.title='Instalar Triela Checklists';btn.setAttribute('aria-label','Instalar aplicativo');btn.innerHTML='<span style="font-size:16px">⇩</span><span class="install-label">Instalar app</span>';
    btn.onclick=async()=>{
      if(deferredPrompt){deferredPrompt.prompt();const choice=await deferredPrompt.userChoice;deferredPrompt=null;if(choice?.outcome==='accepted')btn.remove();return;}
      const msg=/Android/i.test(navigator.userAgent)?'No Chrome, toque no menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.':'Use a opção “Instalar aplicativo” do seu navegador.';
      if(typeof toast==='function')toast(msg);else alert(msg);
    };
    const actions=document.querySelector('.top-actions');if(actions)actions.prepend(btn);
    if(!document.getElementById('trielaPwaStyle')){const s=document.createElement('style');s.id='trielaPwaStyle';s.textContent=`.triela-install-btn{display:flex!important;align-items:center;gap:6px;width:auto!important;padding:0 12px!important;white-space:nowrap}.install-label{font-size:11px;font-weight:800}@media(max-width:760px){.triela-install-btn{position:fixed;right:14px;bottom:76px;z-index:1200;height:46px!important;border-radius:23px!important;background:#6551f3!important;color:#fff!important;border-color:#6551f3!important;box-shadow:0 12px 30px rgba(55,48,163,.3)}}@media(display-mode:standalone){.triela-install-btn{display:none!important}}`;document.head.appendChild(s);}
  }
  addHead();
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{scope:'/Check-list/'}).catch(()=>{}));}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;ensureInstallButton();});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;document.getElementById('trielaInstallBtn')?.remove();if(typeof toast==='function')toast('Triela Checklists instalado com sucesso.');});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(ensureInstallButton,500));
  setTimeout(ensureInstallButton,1600);
})();
