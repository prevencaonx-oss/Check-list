/* Triela Checklists — PWA instalável no Android */
(function(){
  'use strict';
  let deferredPrompt=null;
  const android=/Android/i.test(navigator.userAgent);
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;

  function addHead(){
    if(!document.querySelector('link[rel="manifest"]')){const l=document.createElement('link');l.rel='manifest';l.href='./manifest.webmanifest';document.head.appendChild(l);}
    [['theme-color','#071f40'],['mobile-web-app-capable','yes'],['apple-mobile-web-app-capable','yes'],['apple-mobile-web-app-status-bar-style','black-translucent'],['apple-mobile-web-app-title','Triela']].forEach(([name,content])=>{if(!document.querySelector(`meta[name="${name}"]`)){const m=document.createElement('meta');m.name=name;m.content=content;document.head.appendChild(m);}});
    if(!document.querySelector('link[rel="apple-touch-icon"]')){const i=document.createElement('link');i.rel='apple-touch-icon';i.href='./icon-192.svg';document.head.appendChild(i);}
  }

  function addStyle(){
    if(document.getElementById('trielaPwaStyle'))return;
    const s=document.createElement('style');s.id='trielaPwaStyle';s.textContent=`
      .triela-install-btn{display:flex!important;align-items:center;justify-content:center;gap:7px;width:auto!important;min-width:112px;padding:0 13px!important;white-space:nowrap;font-weight:800}
      .triela-install-btn .install-label{font-size:11px;font-weight:800}
      .triela-install-btn.pwa-floating{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:5000;height:46px!important;border-radius:23px!important;background:#6551f3!important;color:#fff!important;border:1px solid #6551f3!important;box-shadow:0 14px 34px rgba(45,35,150,.34)}
      @media(max-width:760px){.top-actions .triela-install-btn{position:fixed;right:14px;bottom:74px;z-index:4200;height:46px!important;border-radius:23px!important;background:#6551f3!important;color:#fff!important;border-color:#6551f3!important;box-shadow:0 12px 30px rgba(55,48,163,.3)}}
      @media(display-mode:standalone){.triela-install-btn{display:none!important}}
    `;document.head.appendChild(s);
  }

  function message(){
    const msg=android?'No Chrome, toque no menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.':'Use a opção “Instalar aplicativo” do seu navegador.';
    if(typeof toast==='function')toast(msg);else alert(msg);
  }

  function ensureInstallButton(){
    if(isStandalone()||(!android&&!deferredPrompt))return;
    addStyle();
    let btn=document.getElementById('trielaInstallBtn');
    if(!btn){
      btn=document.createElement('button');btn.id='trielaInstallBtn';btn.className='iconbtn triela-install-btn';btn.type='button';btn.title='Instalar Triela Checklists';btn.setAttribute('aria-label','Instalar aplicativo');btn.innerHTML='<span style="font-size:16px">⇩</span><span class="install-label">Instalar app</span>';
      btn.onclick=async()=>{
        if(deferredPrompt){deferredPrompt.prompt();const choice=await deferredPrompt.userChoice;deferredPrompt=null;if(choice?.outcome==='accepted')btn.remove();return;}
        message();
      };
    }
    const actions=document.querySelector('.top-actions');
    if(actions){btn.classList.remove('pwa-floating');if(btn.parentElement!==actions)actions.prepend(btn);}
    else{btn.classList.add('pwa-floating');if(!btn.isConnected)document.body.appendChild(btn);}
  }

  addHead();addStyle();
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'/Check-list/'}).catch(()=>{}));}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;ensureInstallButton();});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;document.getElementById('trielaInstallBtn')?.remove();if(typeof toast==='function')toast('Triela Checklists instalado com sucesso.');});
  const observer=new MutationObserver(()=>ensureInstallButton());observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(ensureInstallButton,350));
  setTimeout(ensureInstallButton,1200);
})();
