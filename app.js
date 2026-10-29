'use strict';
function createSiteSounds(){
  let enabled=true,context=null,voices=[];
  try{enabled=localStorage.getItem('player-one-sound-enabled')!=='0';}catch{}
  // Each note is [frequency, duration, offset], in seconds.
  const effects={
    click:[[523.251,.05,0]],
    open:[[523.251,.055,0],[659.255,.06,.07]],
    close:[[659.255,.055,0],[523.251,.06,.07]],
    success:[[659.255,.05,0],[783.991,.05,.07],[1046.502,.065,.14]],
    error:[[196,.065,0],[130.813,.075,.085]],
    intro:[[659.255,.085,0],[783.991,.085,.11],[1046.502,.16,.22]]
  };
  function stop(){
    voices.forEach(({oscillator,gain})=>{
      oscillator.onended=null;
      try{oscillator.stop();}catch{}
      try{oscillator.disconnect();gain.disconnect();}catch{}
    });
    voices=[];
  }
  function unlock(){
    if(!enabled)return null;
    try{
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)return null;
      if(!context||context.state==='closed')context=new AudioContext();
      if(context.state!=='running'){
        const current=context;
        current.resume().catch(()=>{if(current.state!=='running')stop();});
      }
      return context;
    }catch{stop();return null;}
  }
  function play(name){
    if(!enabled||!effects[name])return;
    const audio=unlock();
    if(!audio)return;
    stop();
    try{
      const now=audio.currentTime+.01;
      const volume=name==='intro'?.035:.025;
      effects[name].forEach(([frequency,duration,offset])=>{
        const oscillator=audio.createOscillator(),gain=audio.createGain();
        const voice={oscillator,gain};
        voices.push(voice);
        const time=now+offset;
        oscillator.type='square';
        oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(0,time);
        gain.gain.linearRampToValueAtTime(volume,time+.005);
        gain.gain.setValueAtTime(volume,time+duration-.025);
        gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.onended=()=>{
          oscillator.disconnect();gain.disconnect();
          voices=voices.filter(active=>active!==voice);
        };
        oscillator.start(time);
        oscillator.stop(time+duration);
      });
      return true;
    }catch{stop();return false;}
  }
  function setEnabled(value){
    enabled=value;
    if(!enabled)stop();
    try{localStorage.setItem('player-one-sound-enabled',enabled?'1':'0');}catch{}
  }
  return {play,stop,unlock,setEnabled,isEnabled:()=>enabled};
}
function initMobileMenu(sounds){
  const menu=document.querySelector('.menu-toggle');
  const panel=document.querySelector('#mobile-nav-dialog');
  const close=panel?.querySelector('.mobile-menu-close');
  if(!menu||!panel||!close||typeof panel.showModal!=='function')return;
  const mobile=window.matchMedia('(max-width: 991px)');
  let previousOverflow='',closeSound=true,returnFocus=true;
  function restorePage(){
    if(panel.open||menu.getAttribute('aria-expanded')!=='true')return;
    document.body.style.overflow=previousOverflow;
    menu.setAttribute('aria-expanded','false');
    if(returnFocus){
      const target=mobile.matches?menu:document.querySelector('.brand');
      target?.focus({preventScroll:true});
    }
    if(closeSound)sounds.play('close');
  }
  function closeMenu(playSound=true,focus=true){
    if(!panel.open)return;
    closeSound=playSound;
    returnFocus=focus;
    panel.close();
    restorePage();
  }
  menu.addEventListener('click',()=>{
    if(!mobile.matches||panel.open)return;
    previousOverflow=document.body.style.overflow;
    closeSound=true;
    returnFocus=true;
    try{panel.showModal();}catch{
      document.documentElement.classList.remove('mobile-nav-ready');
      return;
    }
    document.body.style.overflow='hidden';
    menu.setAttribute('aria-expanded','true');
    close.focus({preventScroll:true});
    sounds.play('open');
  });
  close.addEventListener('click',()=>closeMenu());
  panel.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const lastControl=panel.querySelector('[data-sound-toggle]');
    if(event.shiftKey&&document.activeElement===close){
      event.preventDefault();
      lastControl?.focus();
    }else if(!event.shiftKey&&document.activeElement===lastControl){
      event.preventDefault();
      close.focus();
    }
  });
  panel.addEventListener('cancel',event=>{event.preventDefault();closeMenu();});
  panel.addEventListener('close',restorePage);
  panel.addEventListener('click',event=>{
    if(event.target!==panel)return;
    const box=panel.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeMenu();
  });
  panel.querySelectorAll('a[href]').forEach(link=>link.addEventListener('click',event=>{
    if(event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    closeMenu(false,false);
  }));
  mobile.addEventListener('change',()=>{if(!mobile.matches)closeMenu(false);});
  document.documentElement.classList.add('mobile-nav-ready');
}
function initSiteIntro(sounds){
  const root=document.documentElement;
  if(!root?.classList.contains('intro-pending'))return;
  const intro=document.querySelector('#site-intro');
  const start=intro?.querySelector('.site-intro-start');
  const skip=intro?.querySelector('.site-intro-skip');
  if(!intro||!start||!skip||typeof intro.showModal!=='function'){
    root.classList.remove('intro-pending');
    clearTimeout(window.playerOneIntroFallback);
    return;
  }
  const previousOverflow=document.body.style.overflow;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let started=false,finished=false,startTimer,exitTimer;
  function restorePage(){
    if(finished)return;
    finished=true;
    clearTimeout(startTimer);
    clearTimeout(exitTimer);
    sounds.stop();
    root.classList.remove('intro-pending');
    document.body.style.overflow=previousOverflow;
    document.querySelector('#main')?.focus({preventScroll:true});
  }
  function finish(){
    if(finished)return;
    if(intro.open)intro.close();
    restorePage();
  }
  start.addEventListener('click',()=>{
    if(started||finished)return;
    started=true;
    start.disabled=true;
    intro.classList.add('is-starting');
    sounds.play('intro');
    startTimer=setTimeout(()=>{
      if(reducedMotion){finish();return;}
      intro.classList.add('is-leaving');
      exitTimer=setTimeout(finish,200);
    },reducedMotion?600:400);
  });
  skip.addEventListener('click',finish);
  intro.addEventListener('cancel',event=>{event.preventDefault();finish();});
  intro.addEventListener('close',restorePage);
  try{
    intro.showModal();
    document.body.style.overflow='hidden';
    root.classList.remove('intro-pending');
    clearTimeout(window.playerOneIntroFallback);
    try{sessionStorage.setItem('player-one-intro-seen','1');}catch{}
  }catch{finish();clearTimeout(window.playerOneIntroFallback);}
}
function validateContact(values){
  const errors={};
  if(!values.name.trim())errors.name='Подскажите, как к вам обращаться.';
  const email=values.email.trim();
  if(!email)errors.email='Укажите почту для ответа.';
  else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))errors.email='Проверьте адрес: например, you@example.com.';
  if(!values.message.trim())errors.message='Расскажите немного об идее.';
  else if(values.message.trim().length<10)errors.message='Добавьте немного деталей — хотя бы 10 символов.';
  return errors;
}
if(typeof module!=='undefined')module.exports={validateContact};
if(typeof document!=='undefined'){
  const sounds=createSiteSounds();
  const soundButtons=[...document.querySelectorAll('[data-sound-toggle]')];
  function updateSoundControls(){
    const enabled=sounds.isEnabled();
    soundButtons.forEach(button=>{
      button.setAttribute('aria-pressed',String(enabled));
      button.title=enabled?'Выключить звуковые эффекты':'Включить звуковые эффекты';
      button.querySelector('.sound-label').textContent=enabled?'Звук: Вкл.':'Звук: Выкл.';
    });
    document.querySelector('.site-intro-start')?.setAttribute('aria-label',enabled?'Войти на сайт со звуком':'Войти на сайт');
  }
  updateSoundControls();
  soundButtons.forEach(button=>{
    button.hidden=false;
    button.addEventListener('click',()=>{
      sounds.setEnabled(!sounds.isEnabled());
      updateSoundControls();
      if(sounds.isEnabled())sounds.play('click');
    });
  });
  initSiteIntro(sounds);
  document.querySelectorAll('a[href]').forEach(link=>link.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download'))return;
    const played=sounds.play('click');
    if(played&&link.closest('.header, .mobile-menu-nav')&&(!link.target||link.target==='_self')){
      event.preventDefault();
      const destination=link.href;
      setTimeout(()=>window.location.assign(destination),100);
    }
  }));
  initMobileMenu(sounds);
  document.querySelector('.back-top')?.addEventListener('click',()=>{
    window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    document.querySelector('.brand')?.focus({preventScroll:true});
    sounds.play('click');
  });
  document.querySelector('.desk-toggle')?.addEventListener('click',event=>{
    const button=event.currentTarget;
    const idle=button.getAttribute('aria-pressed')!=='true';
    button.setAttribute('aria-pressed',String(idle));
    document.querySelector('.workstation').classList.toggle('is-idle',idle);
    button.querySelector('.desk-toggle-label').textContent=idle?'Вернуться к работе':'Пауза на кофе';
    sounds.play(idle?'close':'open');
  });

  const filters=[...document.querySelectorAll('[data-filter]')];
  const entries=[...document.querySelectorAll('[data-category]')];
  filters.forEach(button=>button.addEventListener('click',()=>{
    if(button.getAttribute('aria-pressed')==='true')return;
    filters.forEach(filter=>filter.setAttribute('aria-pressed',String(filter===button)));
    let count=0;
    entries.forEach(entry=>{
      entry.hidden=button.dataset.filter!=='all'&&entry.dataset.category!==button.dataset.filter;
      if(!entry.hidden)count++;
    });
    document.querySelector('.result-count').textContent=count===1?'Показан 1 проект':`Показано ${count} проекта`;
    sounds.play('click');
  }));

  const details={
    field:{name:'Поле',category:'01 / ВЕБ-ДИЗАЙН / АВТОРСКИЙ КОНЦЕПТ',intro:'Город — с новой стороны. Концепт независимого журнала о повседневных открытиях: знакомый маршрут становится новой историей.',task:'Дать небольшому онлайн-журналу собственный голос. Сделать длинные тексты удобными для чтения, а первый экран — узнаваемым.',approach:'Редакционная сетка, крупное название и сдержанная палитра. Пиксельный пейзаж становится продолжением темы: внимательный взгляд на простое.'},
    rhythm:{name:'Ритм',category:'02 / ИНТЕРФЕЙСЫ / АВТОРСКИЙ КОНЦЕПТ',intro:'Меньше шума. Больше музыки. Эскиз плеера, в котором всё начинается с одного трека и одной выразительной обложки.',task:'Свести основной сценарий к ясному экрану прослушивания. Оставить под рукой управление, прогресс и название — без визуальной суеты.',approach:'Контрастный тёмный интерфейс, заметная обложка и компактная панель воспроизведения. Пиксельная графика добавляет характер, не мешая основному сценарию.'},
    places:{name:'Точка',category:'03 / АЙДЕНТИКА / АВТОРСКИЙ КОНЦЕПТ',intro:'Маленькие места. Большие открытия. Визуальная система для личной карты городских находок и неспешных маршрутов.',task:'Создать простой знак и графический язык, которые одинаково хорошо живут в карте, на небольшом экране и в печати.',approach:'Модульный пиксельный знак работает как метка, паттерн и иллюстрация. Сетка связывает карту и типографику; маршрут остаётся самым заметным элементом.'}
  };
  const dialog=document.querySelector('#project-dialog');
  let lastProjectTrigger=null;
  let previousOverflow='';
  document.querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.project,project=details[id];
    if(!project||!dialog)return;
    lastProjectTrigger=button;
    const source=document.querySelector(`[data-project="${id}"] .project-art`);
    const content=document.querySelector('#dialog-content');
    content.innerHTML=`<h2 class="dialog-title" id="dialog-title" data-od-id="detail-title">${project.name}</h2><p class="dialog-intro">${project.intro}</p><div class="dialog-visual" data-od-id="detail-art"></div><div class="dialog-details"><div data-od-id="detail-task"><h3 data-od-id="detail-task-title">Задача</h3><p>${project.task}</p></div><div data-od-id="detail-approach"><h3 data-od-id="detail-approach-title">Решение</h3><p>${project.approach}</p></div></div><p class="dialog-note">Самостоятельный вымышленный концепт. Типографика, графика и визуальная система созданы для этого портфолио.</p>`;
    if(source){
      const visual=source.cloneNode(true);
      visual.setAttribute('data-od-id',`detail-${id}-visual`);
      content.querySelector('.dialog-visual').append(visual);
    }
    document.querySelector('#dialog-label').textContent=project.category;
    previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.showModal();
    dialog.scrollTop=0;
    sounds.play('open');
  }));
  document.querySelector('.dialog-close')?.addEventListener('click',()=>dialog.close());
  dialog?.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const box=dialog.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
  });
  dialog?.addEventListener('close',()=>{
    document.body.style.overflow=previousOverflow;
    lastProjectTrigger?.focus({preventScroll:true});
    sounds.play('close');
  });

  document.querySelector('.copy-button')?.addEventListener('click',async()=>{
    sounds.unlock();
    const address='hello@example.com';
    const status=document.querySelector('.copy-status');
    let copied=false;
    try{if(navigator.clipboard){await navigator.clipboard.writeText(address);copied=true;}}catch{}
    if(!copied){
      const temporary=document.createElement('textarea');
      temporary.value=address;temporary.style.position='fixed';temporary.style.top='-200px';
      temporary.setAttribute('aria-hidden','true');document.body.append(temporary);temporary.select();
      try{copied=document.execCommand('copy');}catch{}
      temporary.remove();document.querySelector('.copy-button').focus({preventScroll:true});
    }
    status.textContent=copied?'Пример адреса скопирован.':'Скопируйте адрес: hello@example.com';
    sounds.play(copied?'success':'error');
  });

  const form=document.querySelector('#contact-form');
  let draftText='';
  if(form){
    const fields=['name','email','message'];
    form.querySelectorAll('input, textarea, button[type=submit]').forEach(control=>{control.disabled=false;});
    function read(){return Object.fromEntries(fields.map(key=>[key,form.elements[key].value.trim()]));}
    function errorFor(key,message){
      const input=form.elements[key],error=document.querySelector(`#${key}-error`);
      input.setAttribute('aria-invalid',String(Boolean(message)));
      error.hidden=!message;error.textContent=message||'';
    }
    fields.forEach(key=>form.elements[key].addEventListener('input',()=>{
      if(form.elements[key].getAttribute('aria-invalid')==='true')errorFor(key,validateContact(read())[key]);
    }));
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const values=read(),errors=validateContact(values);
      if(values.email&&!form.elements.email.validity.valid)errors.email='Проверьте адрес: например, you@example.com.';
      fields.forEach(key=>errorFor(key,errors[key]));
      if(Object.keys(errors).length){form.elements[Object.keys(errors)[0]].focus();sounds.play('error');return;}
      draftText=`Идея для PLAYER ONE\n\nОт: ${values.name}\nПочта: ${values.email}\n\n${values.message}\n\nЭто локальный черновик. Сообщение не отправлено.`;
      document.querySelector('#draft-preview').textContent=`${values.name} · ${values.email}\n\n${values.message}`;
      form.hidden=true;document.querySelector('#draft-result').hidden=false;
      document.querySelector('#draft-title').focus({preventScroll:true});
      sounds.play('success');
    });
    document.querySelector('#edit-draft').addEventListener('click',()=>{
      document.querySelector('#draft-result').hidden=true;form.hidden=false;form.elements.message.focus({preventScroll:true});
      sounds.play('click');
    });
    document.querySelector('#download-draft').addEventListener('click',()=>{
      const blob=new Blob(['\uFEFF'+draftText],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=url;link.download='player-one-message.txt';
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      sounds.play('success');
    });
  }
}
