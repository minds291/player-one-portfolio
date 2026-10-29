const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const bootstrap=fs.readFileSync('index.html','utf8').match(/<script>(.*?)<\/script>/s)[1];
const checks=[];
function fixture(options={}){
  const classes=new Set(),listeners={},timers=new Map(),notes=[];
  const saved=options.saved||new Map();
  let clock=0,nextTimer=0,soundCount=0,closedSounds=0;
  const classList={contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)};
  const start={disabled:false,attrs:{},setAttribute(key,value){this.attrs[key]=value;},addEventListener(type,handler){listeners['start-'+type]=handler;}};
  const skip={addEventListener(type,handler){listeners['skip-'+type]=handler;}};
  const main={focus(){document.activeElement=this;}};
  const intro={open:false,classList,
    querySelector(selector){return selector==='.site-intro-start'?start:skip;},
    addEventListener(type,handler){listeners[type]=handler;},
    showModal(){if(options.showError)throw Error('Dialog unavailable');this.open=true;document.activeElement=start;},
    close(){this.open=false;listeners.close?.();}
  };
  if(options.noDialog)intro.showModal=undefined;
  const document={documentElement:{classList},activeElement:null,body:{style:{overflow:'auto'}},
    querySelector(selector){return selector==='#site-intro'?intro:selector==='#main'?main:selector==='.site-intro-start'?start:null;},
    querySelectorAll(){return [];},addEventListener(){}
  };
  const storage={getItem(key){if(options.storageError)throw Error('Storage blocked');return saved.get(key)||null;},
    setItem(key,value){if(options.storageError)throw Error('Storage blocked');saved.set(key,value);}
  };
  class AudioContext{
    constructor(){if(options.audioError)throw Error('Audio unavailable');soundCount++;this.currentTime=0;this.destination={};this.state='suspended';}
    resume(){if(options.resumeError)return Promise.reject(Error('Audio blocked'));this.state='running';return Promise.resolve();}
    close(){closedSounds++;return Promise.resolve();}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createOscillator(){const note={frequency:{value:0},connect(){},disconnect(){this.disconnected=true;},start(time){this.begin=time;},stop(time){if(time===undefined)this.cancelled=true;else this.end=time;}};notes.push(note);return note;}
  }
  const window={matchMedia:()=>({matches:!!options.reduced}),AudioContext:options.noAudio?undefined:AudioContext};
  const context=vm.createContext({document,window,sessionStorage:storage,localStorage:{getItem(){return options.muted?'0':null;},setItem(){}},
    setTimeout(callback,delay){const id=++nextTimer;timers.set(id,{callback,time:clock+delay});return id;},
    clearTimeout(id){timers.delete(id);}
  });
  function advance(ms){const end=clock+ms;while(true){const entry=[...timers].sort((a,b)=>a[1].time-b[1].time)[0];if(!entry||entry[1].time>end)break;clock=entry[1].time;timers.delete(entry[0]);entry[1].callback();}clock=end;}
  vm.runInContext(bootstrap,context);
  if(options.scriptMissing){advance(3000);}else{
    if(options.scriptLate)advance(3000);
    vm.runInContext(app,context);
  }
  return {intro,start,main,document,saved,classes,notes,advance,
    clickStart:()=>listeners['start-click']?.(),skip:()=>listeners['skip-click']?.(),
    escape(){let prevented=false;listeners.cancel?.({preventDefault(){prevented=true;}});return prevented;},
    soundCount:()=>soundCount,closedSounds:()=>closedSounds,timers
  };
}
function restored(test){assert(!test.intro.open);assert.equal(test.document.body.style.overflow,'auto');assert.equal(test.document.activeElement,test.main);assert(!test.classes.has('intro-pending'));assert.equal(test.timers.size,0);}
async function run(){
  let test=fixture();
  assert(test.intro.open);assert.equal(test.document.activeElement,test.start);assert.equal(test.document.body.style.overflow,'hidden');assert.equal(test.saved.get('player-one-intro-seen'),'1');assert.equal(test.soundCount(),0);
  test.advance(10000);assert(test.intro.open);checks.push('First visit opens a modal, focuses START, waits silently and records the visit');
  test.clickStart();test.clickStart();assert(test.start.disabled);assert.equal(test.soundCount(),1);
  assert.deepEqual(test.notes.map(note=>note.frequency.value),[659.255,783.991,1046.502]);assert(test.notes.every(note=>note.type==='square'));
  test.advance(400);assert(test.intro.open);assert(test.classes.has('is-leaving'));test.advance(200);restored(test);assert.equal(test.closedSounds(),0);assert(test.notes.every(note=>note.disconnected));checks.push('START plays three square-wave notes once and restores the page after 600 ms without closing the shared context');
  const saved=test.saved;
  for(let i=0;i<4;i++){test=fixture({saved});assert(!test.intro.open);assert.equal(test.timers.size,0);assert.equal(test.soundCount(),0);}
  checks.push('Reloads and navigation sharing sessionStorage bypass the intro');
  test=fixture();assert(test.intro.open);test.skip();restored(test);assert.equal(test.soundCount(),0);checks.push('A fresh tab shows the intro; skip closes it without sound');
  test=fixture();assert(test.escape());restored(test);assert.equal(test.soundCount(),0);checks.push('Escape prevents native cancellation and restores focus without sound');
  test=fixture();test.clickStart();test.advance(100);test.skip();restored(test);assert(test.notes.every(note=>note.cancelled&&note.disconnected));test.advance(1000);checks.push('Skip during playback stops audio and cancels pending transitions');
  test=fixture({muted:true});assert.equal(test.start.attrs['aria-label'],'Войти на сайт');test.clickStart();test.advance(600);restored(test);assert.equal(test.soundCount(),0);checks.push('Muted START retains the 600 ms transition and has an accurate accessible label');
  test=fixture({reduced:true});test.clickStart();test.advance(400);assert(!test.classes.has('is-leaving'));test.advance(200);restored(test);checks.push('Reduced motion closes at 600 ms without a fade');
  test=fixture({storageError:true});assert(test.intro.open);test.skip();restored(test);checks.push('Unavailable sessionStorage does not prevent entry');
  for(const options of [{noAudio:true},{audioError:true},{resumeError:true}]){
    test=fixture(options);test.clickStart();await Promise.resolve();test.advance(600);restored(test);
  }
  checks.push('Missing, throwing or blocked Web Audio does not delay entry');
  for(const options of [{noDialog:true},{showError:true},{scriptMissing:true},{scriptLate:true}]){
    test=fixture(options);assert(!test.intro.open);assert(!test.classes.has('intro-pending'));assert(!test.saved.has('player-one-intro-seen'));assert.equal(test.document.body.style.overflow,'auto');assert.equal(test.timers.size,0);
  }
  checks.push('Unsupported dialog, initialization failure and missing or late JS release the page');
  for(const file of ['index.html','projects.html','about.html','contact.html']){
    const html=fs.readFileSync(file,'utf8');if(file==='index.html'){assert(html.includes('id="site-intro"'));assert(!html.includes('id="site-intro" open'));assert(html.includes('aria-label="Войти на сайт со звуком"'));}else{assert(!html.includes('id="site-intro"'));assert(!html.includes('intro-pending'));}
  }
  checks.push('Only the home page includes the closed, labelled intro dialog');
  process.stdout.write(JSON.stringify({passed:checks.length,checks},null,2)+'\n');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
