import { MUSIC_PROFILES, musicBar, type DayMusicPhase } from './dayMusicScore';
import { renderNote,primeMusicVoices, type MusicVoice } from './dayMusicVoice';

export interface MusicWorldFrame { playing:boolean; hour:number; inside?:boolean; dialogue?:boolean; combat?:boolean }
export function musicPhaseAtHour(hour:number):DayMusicPhase {
  const h=Number.isFinite(hour)?((hour%24)+24)%24:12;
  return h>=5&&h<8?'dawn':h>=8&&h<18?'day':h>=18&&h<21?'dusk':'night';
}

interface Track { phase:DayMusicPhase; gain:GainNode; bar:number; next:number; retireAt:number; voices:Set<MusicVoice> }
const CROSSFADE=8,LOOKAHEAD=.35;

/** An original, clock-led score. Rendering is scheduled independently of the 3D frame rate. */
export class DayMusic {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  private filter:BiquadFilterNode|null=null;
  private bus:GainNode|null=null;
  private tracks:Track[]=[];
  private voices=new Set<MusicVoice>();
  private cursors=new Map<DayMusicPhase,number>();
  private timer:number|undefined;
  private unlocked=false;
  private disposed=false;
  private starting=false;
  private running=false;
  private generation=0;
  private level=.45;
  private active=true;
  private mix='';
  private frame:MusicWorldFrame={playing:false,hour:12};

  constructor(enabled=true){
    this.active=enabled;
    document.addEventListener('pointerdown',this.unlock,{capture:true});
    document.addEventListener('keydown',this.unlock,{capture:true});
    document.addEventListener('visibilitychange',this.visibility);
  }
  get diagnostics(){return{enabled:this.active,playing:this.running,phase:musicPhaseAtHour(this.frame.hour),voices:this.voices.size,tracks:this.tracks.length,contextState:this.context?.state??'uncreated'};}

  setEnabled(enabled:boolean){this.active=enabled;this.sync();}
  setLevel(level:number){this.level=Number.isFinite(level)?Math.max(0,Math.min(1,level)):0;this.mix='';this.sync();}
  update(frame:MusicWorldFrame){this.frame=frame;this.sync();}

  private unlock=(event:Event)=>{
    if(!event.isTrusted||this.disposed)return;
    this.unlocked=true;this.sync();
  };
  private visibility=()=>this.sync();
  private allowed(){return !this.disposed&&this.active&&this.level>0&&this.frame.playing&&this.unlocked&&!document.hidden;}
  private sync(){
    if(!this.allowed()){if(this.running||this.starting)this.stop();return;}
    if(!this.running){if(!this.starting)void this.start();return;}
    const phase=musicPhaseAtHour(this.frame.hour);
    if(this.tracks[this.tracks.length-1]?.phase!==phase)this.beginTrack(phase);
    this.applyMix();
  }

  private makeGraph(){
    const audio=new AudioContext();this.context=audio;
    Object.defineProperty(audio,'brumaluzAudio',{value:'world-music'});
    this.master=audio.createGain();this.master.gain.value=0;
    this.filter=audio.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=6500;this.filter.Q.value=.45;
    const compressor=audio.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=18;compressor.ratio.value=2.5;compressor.attack.value=.02;compressor.release.value=.4;
    this.bus=audio.createGain();
    const dry=audio.createGain();dry.gain.value=.86;this.bus.connect(dry).connect(this.filter);
    const room=audio.createConvolver(),wet=audio.createGain();wet.gain.value=.17;
    const impulse=audio.createBuffer(2,Math.ceil(audio.sampleRate*1.8),audio.sampleRate);
    let seed=9137;
    for(let channel=0;channel<2;channel++){
      const data=impulse.getChannelData(channel);
      for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;const noise=(seed>>>0)/2147483648-1;data[i]=noise*Math.pow(1-i/data.length,2.8)*(i<audio.sampleRate*.012?.15:1);}
    }
    room.buffer=impulse;this.bus.connect(room).connect(wet).connect(this.filter);
    this.filter.connect(compressor).connect(this.master).connect(audio.destination);
  }
  private async start(){
    this.starting=true;const version=++this.generation;
    try{
      if(!this.context)this.makeGraph();
      await this.context!.resume();
      if(version!==this.generation||!this.allowed())return;
      if(this.context!.state!=='running'){this.unlocked=false;return;}
      await primeMusicVoices(this.context!,()=>version===this.generation&&this.allowed());
      if(version!==this.generation||!this.allowed())return;
      this.running=true;this.mix='';this.beginTrack(musicPhaseAtHour(this.frame.hour),true);this.applyMix();this.schedule();
      this.timer=window.setInterval(this.schedule,100);
    }catch(error){
      // A new trusted gesture may unlock audio after a browser policy rejection.
      if(version===this.generation){this.unlocked=false;this.stop();console.warn('No se pudo iniciar la música ambiental:',error);}
    }finally{this.starting=false;if(this.allowed()&&!this.running)queueMicrotask(()=>this.sync());}
  }
  private applyMix(){
    if(!this.context||!this.master||!this.filter)return;
    const attenuation=this.frame.dialogue ? .42 : this.frame.combat ? .72 : 1;
    const volume=.48*this.level*attenuation*(this.frame.inside ? .78 : 1);
    const key=`${volume}:${!!this.frame.inside}`;if(key===this.mix)return;this.mix=key;
    this.master.gain.setTargetAtTime(volume,this.context.currentTime,.6);
    this.filter.frequency.setTargetAtTime(this.frame.inside?3100:6500,this.context.currentTime,1.2);
  }
  private beginTrack(phase:DayMusicPhase,initial=false){
    const audio=this.context!,now=audio.currentTime;
    // At most one fading score and one arriving score, even after a clock jump.
    while(this.tracks.length>1)this.removeTrack(this.tracks.shift()!);
    const old=this.tracks[0];
    if(old){old.gain.gain.cancelAndHoldAtTime(now);old.gain.gain.linearRampToValueAtTime(0,now+CROSSFADE);old.retireAt=now+CROSSFADE;}
    const gain=audio.createGain();gain.gain.value=0;gain.connect(this.bus!);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+(initial?3:CROSSFADE));
    this.tracks.push({phase,gain,bar:this.cursors.get(phase)??0,next:now+.06,retireAt:Infinity,voices:new Set()});
  }
  private schedule=()=>{
    if(!this.running||!this.context)return;
    const now=this.context.currentTime;
    for(const track of [...this.tracks]){
      if(now>=track.retireAt){this.tracks.splice(this.tracks.indexOf(track),1);this.removeTrack(track);continue;}
      const profile=MUSIC_PROFILES[track.phase],beat=60/profile.bpm;
      if(track.next<now-.15)track.next=now+.05;
      while(track.next<now+LOOKAHEAD&&track.next<track.retireAt){
        for(const note of musicBar(track.phase,track.bar)){
          const start=track.next+note.beat*beat;if(start>=track.retireAt)continue;
          while(this.voices.size>=64){const oldest=this.voices.values().next().value!;oldest.stop();this.voices.delete(oldest);}
          const voice=renderNote(this.context,track.gain,note,start,note.duration*beat);
          this.voices.add(voice);track.voices.add(voice);
          voice.onended=()=>{this.voices.delete(voice);track.voices.delete(voice);};
        }
        track.bar++;this.cursors.set(track.phase,track.bar);track.next+=profile.beatsPerBar*beat;
        // Complete phrases breathe before returning, rather than filling every minute.
        if(track.bar%profile.bars===0)track.next+=track.phase==='day'?12:track.phase==='night'?24:18;
      }
    }
  };
  private removeTrack(track:Track){for(const voice of track.voices){voice.stop();this.voices.delete(voice);}track.voices.clear();track.gain.disconnect();}
  private stop(){
    this.generation++;this.running=false;window.clearInterval(this.timer);this.timer=undefined;
    if(this.context&&this.master){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setValueAtTime(0,this.context.currentTime);}
    for(const track of this.tracks)this.removeTrack(track);this.tracks=[];this.mix='';
    if(this.context?.state==='running')void this.context.suspend().catch(()=>{});
  }
  async dispose(){
    this.disposed=true;this.stop();document.removeEventListener('pointerdown',this.unlock,{capture:true});document.removeEventListener('keydown',this.unlock,{capture:true});document.removeEventListener('visibilitychange',this.visibility);
    if(this.context&&this.context.state!=='closed')await this.context.close();
  }
}
