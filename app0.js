/* Triela Checklists — guardião de estabilidade para observadores DOM */
(function(){
  'use strict';
  if(window.__TRIELA_OBSERVER_GUARD__) return;
  window.__TRIELA_OBSERVER_GUARD__=true;
  const NativeObserver=window.MutationObserver;
  if(!NativeObserver) return;
  const registry=[];
  window.__TRIELA_OBSERVERS__=registry;
  function SafeObserver(callback){
    const observer=new NativeObserver((records,instance)=>{
      try{ callback(records,instance); }catch(err){ console.error('Triela observer error',err); }
    });
    registry.push(observer);
    return observer;
  }
  SafeObserver.prototype=NativeObserver.prototype;
  try{Object.setPrototypeOf(SafeObserver,NativeObserver);}catch(_){ }
  window.MutationObserver=SafeObserver;
  /* Os módulos atuais usam observadores apenas durante o bootstrap. Depois disso,
     eles são desativados para evitar tempestades de mutação e travamento da UI. */
  setTimeout(()=>{
    registry.forEach(observer=>{try{observer.disconnect();}catch(_){}});
    window.__TRIELA_OBSERVERS_DISABLED__=true;
  },0);
})();
