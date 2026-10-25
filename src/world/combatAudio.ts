type CombatCue='swing'|'impact'|'incoming'|'healing'|'warning';

/** Short, quiet procedural cues; all effects follow the existing master volume. */
export class CombatAudio {
 private context:AudioContext|null=null;
 private master:GainNode|null=null;
 private noise:AudioBuffer|null=null;
 private level=1;
 private last=new Map<string,number>();
 private voices:number[]=[];
 private unlock=()=>{
  if(this.level<=0||typeof AudioContext==='undefined')return;
  try{
   if(!this.context){
    const ctx=this.context=new AudioContext();this.master=ctx.createGain();this.master.gain.value=this.level*.6;this.master.connect(ctx.destination);
    this.noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.24),ctx.sampleRate);
    const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   }
   if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
  }catch{/* Audio is optional; it must never interrupt gameplay. */}
 };
 constructor(){window.addEventListener('pointerdown',this.unlock,{capture:true});window.addEventListener('keydown',this.unlock,{capture:true});}
 setLevel(level:number){this.level=Math.max(0,Math.min(1,level));if(this.master&&this.context)this.master.gain.setTargetAtTime(this.level*.6,this.context.currentTime,.04);}
 play(cue:CombatCue,cls='guerrero'){
  const ctx=this.context,master=this.master;if(!ctx||!master||ctx.state!=='running'||this.level<=0||document.hidden)return;
  const now=ctx.currentTime,key=cue==='swing'?cue+cls:cue;
  if(now-(this.last.get(key)??-10)<(cue==='warning'?.5:.075))return;
  this.voices=this.voices.filter(time=>now-time<1);if(this.voices.length>=16)return;
  this.last.set(key,now);this.voices.push(now);
  const tone=(frequency:number,end:number,duration:number,gain:number,offset=0)=>{
   const source=ctx.createOscillator(),envelope=ctx.createGain(),start=now+offset;
   source.type='sine';source.frequency.setValueAtTime(frequency,start);source.frequency.exponentialRampToValueAtTime(Math.max(30,end),start+duration);
   envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(gain,start+.008);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
   source.connect(envelope);envelope.connect(master);source.onended=()=>{source.disconnect();envelope.disconnect();};source.start(start);source.stop(start+duration+.01);
  };
  const rustle=(frequency:number,duration:number,gain:number)=>{
   const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),envelope=ctx.createGain();source.buffer=this.noise;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.7;
   envelope.gain.setValueAtTime(gain,now);envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
   source.connect(filter);filter.connect(envelope);envelope.connect(master);source.onended=()=>{source.disconnect();filter.disconnect();envelope.disconnect();};source.start(now);source.stop(now+duration);
  };
  if(cue==='healing'){tone(440,530,.22,.022);tone(660,750,.2,.015,.065);}
  else if(cue==='warning'){tone(180,240,.12,.018);}
  else if(cue==='incoming'){rustle(440,.1,.045);tone(100,62,.12,.028);}
  else if(cue==='impact'){rustle(cls==='mago'?1700:950,.075,.04);tone(cls==='mago'?380:145,cls==='mago'?210:80,.11,.026);}
  else if(cls==='mago'||cls==='clerigo'){tone(cls==='clerigo'?520:430,cls==='clerigo'?760:630,.15,.018);}
  else if(cls==='explorador'){rustle(2100,.06,.035);tone(220,90,.08,.018);}
  else rustle(cls==='picaro'?2200:1400,.1,.025);
 }
 async dispose(){window.removeEventListener('pointerdown',this.unlock,{capture:true});window.removeEventListener('keydown',this.unlock,{capture:true});const context=this.context;this.context=null;this.master=null;this.noise=null;if(context&&context.state!=='closed')await context.close();}
}
