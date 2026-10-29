const fs=require('fs'),vm=require('vm'),assert=require('assert');
const nodes=new Map(),checks=[];
function node(name){
 const attrs={},events={},classes=new Set();
 return {name,attrs,events,dataset:{},style:{},hidden:false,textContent:'',value:'',validity:{valid:true},children:[],
  classList:{toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c);},contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c)},
  setAttribute(k,v){attrs[k]=v;},getAttribute:k=>attrs[k]??null,hasAttribute:k=>k in attrs,
  addEventListener(k,f){(events[k]??=[]).push(f);},
  fire(k,extra={}){return (events[k]||[]).map(f=>f({currentTarget:this,target:this,preventDefault(){},...extra}));},
  click(){return this.fire('click');},focus(){this.focused=true;document.activeElement=this;},
  querySelector(s){return this.children.find(n=>n.name===s||(s==='[data-sound-toggle]'&&n.hasAttribute('data-sound-toggle')));},
  querySelectorAll(s){return this.children.filter(n=>s==='a[href]'?n.hasAttribute('href'):n.name===s);},
  append(child){this.children.push(child);},remove(){this.removed=true;},select(){this.selected=true;},
  cloneNode(){return node('clone');}
 };
}
function add(selector,n=node(selector)){nodes.set(selector,n);return n;}
const menu=add('.menu-toggle');menu.setAttribute('aria-expanded','false');menu.children.push(node('span'));
const brand=add('.brand'),back=add('.back-top');
const mobilePanel=add('#mobile-nav-dialog'),mobileClose=node('.mobile-menu-close'),mobileLink=node('mobile-link');
mobileLink.setAttribute('href','projects.html');mobilePanel.children.push(mobileClose,mobileLink);
mobilePanel.showModal=function(){this.open=true;};mobilePanel.close=function(){this.open=false;this.fire('close');};
mobilePanel.getBoundingClientRect=()=>({left:24,top:0,right:380,bottom:800});
const mobileViewport=node('mobile-viewport');mobileViewport.matches=true;
const desk=add('.desk-toggle');desk.setAttribute('aria-pressed','false');desk.children.push(node('.desk-toggle-label'));
const workstation=add('.workstation');
const filters=['all','web','ui','identity'].map(id=>{const n=node(id);n.dataset.filter=id;return n;});
const entries=['web','ui','identity'].map(id=>{const n=node(id);n.dataset.category=id;return n;});
add('.result-count');
const trigger=node('project-button');trigger.dataset.project='field';
const source=add('[data-project="field"] .project-art');
const dialog=add('#project-dialog');dialog.showModal=function(){this.open=true;};dialog.close=function(){this.open=false;this.fire('close');};
const dialogContent=add('#dialog-content');dialogContent.children.push(node('.dialog-visual'));
add('#dialog-label');const close=add('.dialog-close');
const copy=add('.copy-button');add('.copy-status');
const form=add('#contact-form');form.elements={};
for(const key of ['name','email','message']){form.elements[key]=node(key);add('#'+key+'-error');}
const result=add('#draft-result');result.hidden=true;add('#draft-title');add('#draft-preview');
const download=add('#download-draft'),edit=add('#edit-draft');
const body=node('body');body.style.overflow='';
const soundButtons=[node('header-sound'),node('intro-sound'),node('mobile-sound')];soundButtons.forEach(button=>{button.setAttribute('data-sound-toggle','');button.children.push(node('.sound-label'));});mobilePanel.children.push(soundButtons[2]);
const introStart=add('.site-intro-start'),navigationLink=node('navigation-link');navigationLink.setAttribute('href','projects.html');
navigationLink.href='projects.html';navigationLink.closest=()=>true;mobileLink.href='projects.html';mobileLink.closest=()=>true;
const soundNotes=[],savedSound=new Map();let audioContexts=0;
class AudioContext{
 constructor(){audioContexts++;this.state='running';this.currentTime=0;this.destination={};}
 resume(){return Promise.resolve();}
 createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 createOscillator(){const note={frequency:{value:0},connect(){},disconnect(){},start(){},stop(){}};soundNotes.push(note);return note;}
}
const created=[];
const document={body,documentElement:node('root'),activeElement:null,querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s==='[data-filter]'?filters:s==='[data-category]'?entries:s==='[data-project]'?[trigger]:s==='[data-sound-toggle]'?soundButtons:s==='a[href]'?[navigationLink,mobileLink]:[],addEventListener(){},createElement(tag){const n=node(tag);created.push(n);return n;},execCommand(){return true;}};
const window={AudioContext,location:{assign(url){this.url=url;}},scrollTo(options){this.scroll=options;},matchMedia(query){return query==='(max-width: 991px)'?mobileViewport:{matches:false};}};
let clipboard='',navigationTimers=[];
const context={document,window,localStorage:{getItem:key=>savedSound.get(key)||null,setItem:(key,value)=>savedSound.set(key,value)},navigator:{clipboard:{async writeText(text){clipboard=text;}}},Blob,URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},setTimeout(f,delay){if(delay===100)navigationTimers.push(f);else f();}};
vm.runInNewContext(fs.readFileSync('app.js','utf8'),context,{filename:'app.js'});
function checkSound(before,kind){
 const notes=soundNotes.slice(before).map(note=>note.frequency.value);
 assert.equal(notes.length,kind==='silent'?0:kind==='click'?1:kind==='success'?3:2);
 if(kind==='open'||kind==='success')assert(notes.at(-1)>notes[0]);
 if(kind==='close')assert(notes.at(-1)<notes[0]);
 if(kind==='error')assert(notes.every(frequency=>frequency<250));
}
function heard(action,kind){const before=soundNotes.length;action();checkSound(before,kind);}
async function run(){
 assert.equal(audioContexts,0);assert(soundButtons.every(button=>!button.hidden&&button.getAttribute('aria-pressed')==='true'));checks.push('Sound controls initialize enabled without playing audio');
 assert(document.documentElement.classList.contains('mobile-nav-ready'));
 heard(()=>menu.click(),'open');assert.equal(menu.getAttribute('aria-expanded'),'true');assert(mobilePanel.open);assert.equal(body.style.overflow,'hidden');assert.equal(document.activeElement,mobileClose);
 let wrapped=false;mobilePanel.fire('keydown',{key:'Tab',shiftKey:true,preventDefault(){wrapped=true;}});assert(wrapped);assert.equal(document.activeElement,soundButtons[2]);
 wrapped=false;mobilePanel.fire('keydown',{key:'Tab',preventDefault(){wrapped=true;}});assert(wrapped);assert.equal(document.activeElement,mobileClose);checks.push('Tab and Shift+Tab wrap between the first and last mobile controls');
 heard(()=>menu.click(),'silent');heard(()=>mobileClose.click(),'close');assert.equal(menu.getAttribute('aria-expanded'),'false');assert(!mobilePanel.open);assert.equal(body.style.overflow,'');assert.equal(document.activeElement,menu);checks.push('Mobile dialog locks scroll, focuses close and restores focus with one sound per action');
 body.style.overflow='auto';menu.click();let cancelled=false;
 heard(()=>mobilePanel.fire('cancel',{preventDefault(){cancelled=true;}}),'close');assert(cancelled);assert(!mobilePanel.open);assert.equal(body.style.overflow,'auto');body.style.overflow='';checks.push('Escape cancels the modal and restores the prior overflow value');
 menu.click();heard(()=>mobilePanel.fire('click',{clientX:80,clientY:400}),'silent');assert(mobilePanel.open);
 heard(()=>mobilePanel.fire('click',{clientX:12,clientY:400}),'close');assert(!mobilePanel.open);checks.push('Backdrop closes the menu while clicks inside its bounds leave it open');
 menu.click();heard(()=>mobileLink.fire('click',{ctrlKey:true}),'silent');assert(mobilePanel.open);
 heard(()=>mobileLink.click(),'click');assert(!mobilePanel.open);assert.equal(body.style.overflow,'');assert.equal(navigationTimers.length,1);navigationTimers.shift()();assert.equal(window.location.url,'projects.html');checks.push('Mobile navigation uses one click sound and preserves modified clicks');
 menu.click();mobileViewport.matches=false;heard(()=>mobileViewport.fire('change'),'silent');assert(!mobilePanel.open);assert.equal(document.activeElement,brand);assert.equal(body.style.overflow,'');heard(()=>menu.click(),'silent');mobileViewport.matches=true;mobileViewport.fire('change');checks.push('Desktop breakpoint closes the modal silently, restores scroll and focuses the brand');
 const showMobile=mobilePanel.showModal;mobilePanel.showModal=()=>{throw Error('Dialog unavailable');};heard(()=>menu.click(),'silent');assert(!document.documentElement.classList.contains('mobile-nav-ready'));assert.equal(body.style.overflow,'');assert.equal(menu.getAttribute('aria-expanded'),'false');mobilePanel.showModal=showMobile;checks.push('A failed modal opening restores ordinary navigation instead of hiding every route');
 heard(()=>desk.click(),'close');assert(workstation.classList.contains('is-idle'));assert.equal(desk.getAttribute('aria-pressed'),'true');heard(()=>desk.click(),'open');assert(!workstation.classList.contains('is-idle'));checks.push('Workstation switch updates its state and uses on/off sounds');
 heard(()=>filters[2].click(),'click');assert(entries[0].hidden&&!entries[1].hidden&&entries[2].hidden);assert.equal(nodes.get('.result-count').textContent,'Показан 1 проект');heard(()=>filters[2].click(),'silent');heard(()=>filters[0].click(),'click');assert(entries.every(x=>!x.hidden));checks.push('Category filtering sounds only when selection changes');
 heard(()=>trigger.click(),'open');assert(dialog.open);assert.equal(body.style.overflow,'hidden');assert(dialogContent.innerHTML.includes('Поле'));assert.equal(dialogContent.querySelector('.dialog-visual').children.length,1);heard(()=>close.click(),'close');assert(!dialog.open);assert(trigger.focused);assert.equal(body.style.overflow,'');checks.push('Project detail opens, closes and returns focus with one effect per action');
 heard(()=>form.fire('submit'),'error');assert.equal(form.elements.name.getAttribute('aria-invalid'),'true');assert(form.elements.name.focused);assert(!form.hidden);checks.push('Invalid contact submission shows errors with one error signal');
 form.elements.name.value='Анна';form.elements.email.value='anna@example.com';form.elements.message.value='Нужен сайт для личного проекта.';
 heard(()=>form.fire('submit'),'success');assert(form.hidden&&!result.hidden);assert(nodes.get('#draft-preview').textContent.includes('anna@example.com'));assert(nodes.get('#draft-title').focused);checks.push('Valid contact submission creates a local draft with a success signal');
 heard(()=>download.click(),'success');assert(created.some(n=>n.download==='player-one-message.txt'));checks.push('Draft download creates a text file without a second click sound');
 heard(()=>edit.click(),'click');assert(!form.hidden&&result.hidden);assert.equal(form.elements.message.value,'Нужен сайт для личного проекта.');checks.push('Editing retains all message values');
 heard(()=>back.click(),'click');assert.equal(window.scroll.top,0);assert(brand.focused);checks.push('Back-to-top control returns keyboard focus');
 let before=soundNotes.length;const pending=copy.click();checkSound(before,'silent');await Promise.all(pending);checkSound(before,'success');assert.equal(clipboard,'hello@example.com');assert.equal(nodes.get('.copy-status').textContent,'Пример адреса скопирован.');checks.push('Email copy stays silent until its success result');
 context.navigator.clipboard.writeText=async()=>{throw Error('Clipboard blocked');};document.execCommand=()=>false;
 before=soundNotes.length;await Promise.all(copy.click());checkSound(before,'error');assert.equal(nodes.get('.copy-status').textContent,'Скопируйте адрес: hello@example.com');checks.push('Failed clipboard operations produce only an error signal');
 let prevented=false;window.location.url=null;heard(()=>navigationLink.fire('click',{preventDefault(){prevented=true;}}),'click');assert(prevented);assert.equal(window.location.url,null);assert.equal(navigationTimers.length,1);navigationTimers.shift()();assert.equal(window.location.url,'projects.html');heard(()=>navigationLink.fire('click',{ctrlKey:true}),'silent');checks.push('Header navigation plays before navigating and preserves modified clicks');
 heard(()=>soundButtons[0].click(),'silent');assert(soundButtons.every(button=>button.getAttribute('aria-pressed')==='false'&&button.querySelector('.sound-label').textContent==='Звук: Выкл.'));assert.equal(savedSound.get('player-one-sound-enabled'),'0');assert.equal(introStart.getAttribute('aria-label'),'Войти на сайт');prevented=false;heard(()=>navigationLink.fire('click',{preventDefault(){prevented=true;}}),'silent');assert(!prevented);heard(()=>menu.click(),'silent');assert(mobilePanel.open);heard(()=>mobileClose.click(),'silent');checks.push('Mute synchronizes controls and allows immediate navigation');
 heard(()=>soundButtons[2].click(),'click');assert(soundButtons.every(button=>button.getAttribute('aria-pressed')==='true'));assert.equal(savedSound.get('player-one-sound-enabled'),'1');assert.equal(introStart.getAttribute('aria-label'),'Войти на сайт со звуком');checks.push('Re-enabling sound from the mobile panel synchronizes controls and plays one quiet click');
 let resolveCopy;context.navigator.clipboard.writeText=()=>new Promise(resolve=>{resolveCopy=resolve;});before=soundNotes.length;const lateCopy=copy.click();soundButtons[0].click();resolveCopy();await Promise.all(lateCopy);checkSound(before,'silent');checks.push('Muting during async copy suppresses its later success sound');
 assert.equal(audioContexts,1);checks.push('All UI actions reuse one AudioContext');
 fs.writeFileSync('assets/interaction-results.json',JSON.stringify({passed:checks.length,checks},null,2));
}
run().catch(error=>{fs.writeFileSync('assets/interaction-results.json',JSON.stringify({error:error.message,stack:error.stack},null,2));console.error(error);process.exitCode=1;});
