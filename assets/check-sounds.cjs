const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'),checks=[];
function fixture(options={}){
  const saved=options.saved||new Map(),contexts=[],notes=[],gains=[];
  const storage={getItem(key){if(options.storageError)throw Error('Storage blocked');return saved.get(key)||null;},setItem(key,value){if(options.storageError)throw Error('Storage blocked');saved.set(key,value);}};
  class AudioContext{
    constructor(){if(options.audioError)throw Error('Audio unavailable');this.currentTime=10;this.state='suspended';this.destination={};contexts.push(this);}
    resume(){if(options.resumeError)return Promise.reject(Error('Audio blocked'));this.state='running';return Promise.resolve();}
    createGain(){const values=[];const gain={values,gain:{setValueAtTime(value){values.push(value);},linearRampToValueAtTime(value){values.push(value);},exponentialRampToValueAtTime(value){values.push(value);}},connect(){},disconnect(){this.disconnected=true;}};gains.push(gain);return gain;}
    createOscillator(){if(options.nodeError)throw Error('Audio node unavailable');const note={frequency:{value:0},stops:[],connect(){},disconnect(){this.disconnected=true;},start(time){this.begin=time;},stop(time){this.stops.push(time);}};notes.push(note);return note;}
  }
  const context=vm.createContext({window:{AudioContext:options.noAudio?undefined:AudioContext},localStorage:storage});
  vm.runInContext(app,context);
  return {sounds:vm.runInContext('createSiteSounds()',context),saved,contexts,notes,gains};
}
async function run(){
  let test=fixture();assert(test.sounds.isEnabled());assert.equal(test.contexts.length,0);checks.push('Sound defaults to enabled without constructing AudioContext before a gesture');
  test.sounds.play('intro');const introNotes=test.notes.slice(),introVolume=Math.max(...test.gains[0].values);
  test.sounds.play('click');assert.equal(test.contexts.length,1);assert(introNotes.every(note=>note.stops.length===2&&note.disconnected));assert.equal(test.notes.length,4);assert(Math.max(...test.gains[3].values)<introVolume);assert(Math.abs(test.notes[3].stops[0]-test.notes[3].begin-.05)<.0001);checks.push('UI audio reuses the context, is quieter than intro and replaces existing voices');
  for(let i=0;i<20;i++)test.sounds.play('open');assert.equal(test.contexts.length,1);assert(test.notes.slice(0,-2).every(note=>note.disconnected));checks.push('Rapid actions leave only the latest effect connected');
  const lastVoices=test.notes.slice(-2);test.sounds.setEnabled(false);assert(lastVoices.every(note=>note.disconnected));const count=test.notes.length;test.sounds.play('success');test.sounds.unlock();assert.equal(test.notes.length,count);assert.equal(test.saved.get('player-one-sound-enabled'),'0');checks.push('Mute stops active voices immediately and suppresses further effects');
  test=fixture({saved:test.saved});assert(!test.sounds.isEnabled());test.sounds.play('intro');assert.equal(test.contexts.length,0);test.sounds.setEnabled(true);test.sounds.play('click');assert.equal(test.saved.get('player-one-sound-enabled'),'1');assert.equal(test.notes.length,1);checks.push('Preference survives new pages and can be enabled again');
  test=fixture();test.sounds.play('click');const note=test.notes[0];note.onended();assert(note.disconnected);const stops=note.stops.length;test.sounds.stop();assert.equal(note.stops.length,stops);checks.push('Completed voices disconnect and are removed from active playback');
  test=fixture();test.sounds.unlock();assert.equal(test.contexts.length,1);assert.equal(test.notes.length,0);await Promise.resolve();test.sounds.play('success');assert.equal(test.contexts.length,1);assert.equal(test.notes.length,3);checks.push('Async operations can unlock silently during a gesture and play their result later');
  test=fixture({storageError:true});assert(test.sounds.isEnabled());test.sounds.setEnabled(false);assert(!test.sounds.isEnabled());test.sounds.play('intro');assert.equal(test.contexts.length,0);test.sounds.setEnabled(true);test.sounds.play('click');assert.equal(test.notes.length,1);checks.push('Blocked localStorage preserves preference in page memory');
  for(const options of [{noAudio:true},{audioError:true},{resumeError:true},{nodeError:true}]){
    test=fixture(options);test.sounds.play('success');await Promise.resolve();test.sounds.setEnabled(false);test.sounds.setEnabled(true);test.sounds.play('error');await Promise.resolve();test.sounds.stop();assert(test.notes.every(note=>note.disconnected));
  }
  checks.push('Missing or failing AudioContext, resume and audio nodes fail silently');
  process.stdout.write(JSON.stringify({passed:checks.length,checks},null,2)+'\n');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
