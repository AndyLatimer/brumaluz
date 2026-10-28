export type CombatCue = 'swing' | 'skill' | 'release' | 'impact' | 'incoming' | 'healing' | 'warning' | 'enemy' | 'death' | 'mining' | 'chopping' | 'harvesting' | 'crafted';
export interface CombatSoundOptions { strong?: boolean; gain?: number; pan?: number }

/** Shared noise is prepared once on gesture, never during a hit or a render frame. */
export function combatNoise(ctx: BaseAudioContext) {
 const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.7),ctx.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 return buffer;
}

/** Small layered instruments, shared by the game and offline listening checks. */
export function scheduleCombatSound(ctx:BaseAudioContext,output:AudioNode,noise:AudioBuffer,cue:CombatCue,voice:string,strong=false,start=ctx.currentTime) {
 const weight=strong?1.35:1,variation=.94+Math.random()*.12;
 const magic=['mago','clerigo','magic','shadow'].includes(voice);
 const tone=(hz:number,end:number,duration:number,level:number,offset=0,type:OscillatorType='sine')=>{
  const source=ctx.createOscillator(),envelope=ctx.createGain(),at=start+offset;
  source.type=type;source.frequency.setValueAtTime(hz*variation,at);source.frequency.exponentialRampToValueAtTime(Math.max(25,end*variation),at+duration);
  envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(level*weight,at+.006);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(envelope);envelope.connect(output);
  source.onended=()=>{source.disconnect();envelope.disconnect();};source.start(at);source.stop(at+duration+.015);
 };
 const air=(hz:number,duration:number,level:number,offset=0,end=hz)=>{
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),envelope=ctx.createGain(),at=start+offset;
  source.buffer=noise;source.playbackRate.value=variation;filter.type='bandpass';filter.Q.value=.8;
  filter.frequency.setValueAtTime(hz,at);filter.frequency.exponentialRampToValueAtTime(Math.max(60,end),at+duration);
  envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(level*weight,at+.009);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter);filter.connect(envelope);envelope.connect(output);
  source.onended=()=>{source.disconnect();filter.disconnect();envelope.disconnect();};source.start(at);source.stop(at+duration+.015);
 };
 if(cue==='mining'){
  air(2100,.065,.09);tone(980,640,.16,.055,0,'triangle');tone(1470,1100,.13,.025,.015);
 }else if(cue==='chopping'){
  air(550,.09,.11,0,180);tone(170,65,.12,.09,0,'triangle');air(1900,.06,.035,.035);
 }else if(cue==='harvesting'){
  air(2600,.19,.07,0,900);air(3700,.08,.025,.08,1800);
 }else if(cue==='crafted'){
  tone(660,660,.2,.04);tone(880,880,.23,.025,.07);
 }else if(cue==='healing'){
  air(2400,.35,.035,0,1200);tone(523,528,.38,.07);tone(659,664,.32,.045,.07);tone(784,790,.36,.03,.14);
 }else if(cue==='warning'){
  // A rising breath, not an alarm or a reward jingle.
  air(magic?650:350,.23,.1,0,magic?1500:700);tone(magic?150:100,magic?230:130,.22,.055);
 }else if(cue==='death'){
  air(magic?1400:600,.42,.15,0,120);tone(magic?220:110,40,.42,.09);
  if(magic)tone(330,65,.48,.04,.025);else air(180,.18,.16,.13);
 }else if(cue==='incoming'){
  air(650,.13,.16,0,220);tone(135,48,.17,.13);air(1700,.06,.045);
 }else if(cue==='impact'){
  if(magic){air(voice==='shadow'?850:1900,.2,.13,0,450);tone(voice==='clerigo'?590:360,voice==='clerigo'?320:130,.21,.08);tone(voice==='clerigo'?885:550,260,.15,.035);}
  else {air(voice==='explorador'?1900:1000,.105,.16,0,360);tone(voice==='picaro'?185:125,55,.14,.105);if(voice==='guerrero')tone(740,500,.09,.025,0,'triangle');}
 }else if(cue==='skill'){
  if(magic){air(500,.32,.065,0,1800);tone(voice==='clerigo'?330:200,voice==='clerigo'?660:440,.32,.045);}
  else {air(voice==='explorador'?1200:500,.23,.1,0,2000);tone(voice==='explorador'?170:90,voice==='explorador'?260:140,.18,.035);}
 }else if(cue==='release'||cue==='swing'||cue==='enemy'){
  if(magic){air(1800,.19,.09,0,650);tone(voice==='clerigo'?660:voice==='shadow'?180:440,voice==='shadow'?80:260,.18,.055);}
  else if(voice==='explorador'){air(3200,.075,.15,0,1100);tone(280,95,.09,.065,0,'triangle');}
  else if(voice==='beast'){air(330,.22,.16,0,150);tone(85,55,.2,.08,0,'triangle');}
  else {air(voice==='picaro'?2500:1500,strong?.19:.14,.15,0,450);if(strong)tone(100,60,.15,.035);}
 }
 return cue==='death'?.55:cue==='healing'?.56:.4;
}

/** Gesture unlocked effects with bounded polyphony and no hidden-tab backlog. */
export class CombatAudio {
 private context:AudioContext|null=null;
 private master:GainNode|null=null;
 private noise:AudioBuffer|null=null;
 private level=1;
 private last=new Map<string,number>();
 private voices:number[]=[];
 private outputs=new Set<GainNode>();
 private unlock=()=>{
  if(this.level<=0||typeof AudioContext==='undefined')return;
  try{
   if(!this.context){
    const ctx=this.context=new AudioContext();this.master=ctx.createGain();this.master.gain.value=this.level*.65;
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=8;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.12;
    this.master.connect(limiter);limiter.connect(ctx.destination);this.noise=combatNoise(ctx);
   }
   if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
  }catch{/* Audio must never interrupt gameplay. */}
 };
 private visibility=()=>{if(document.hidden)this.silence();};
 constructor(){window.addEventListener('pointerdown',this.unlock,{capture:true});window.addEventListener('keydown',this.unlock,{capture:true});document.addEventListener('visibilitychange',this.visibility);}
 private silence(){for(const output of this.outputs)output.disconnect();this.outputs.clear();this.voices=[];this.last.clear();}
 setLevel(level:number){this.level=Number.isFinite(level)?Math.max(0,Math.min(1,level)):0;if(this.master&&this.context)this.master.gain.setTargetAtTime(this.level*.65,this.context.currentTime,.015);if(!this.level)this.silence();}
 play(cue:CombatCue,voice='guerrero',options:CombatSoundOptions={}){
  const ctx=this.context,master=this.master,noise=this.noise;
  if(!ctx||!master||!noise||ctx.state!=='running'||this.level<=0||document.hidden)return;
  const gain=Number.isFinite(options.gain)?Math.max(0,Math.min(1,options.gain!)):1;if(gain<=.005)return;
  const now=ctx.currentTime,key=cue+':'+voice;
  if(now-(this.last.get(key)??-10)<(cue==='warning'?.3:.035))return;
  this.voices=this.voices.filter(end=>end>now);if(this.voices.length>=24)return;
  this.last.set(key,now);
  const output=ctx.createGain(),pan=ctx.createStereoPanner();output.gain.value=gain;
  pan.pan.value=Number.isFinite(options.pan)?Math.max(-.8,Math.min(.8,options.pan!)):0;
  output.connect(pan);pan.connect(master);this.outputs.add(output);
  const duration=scheduleCombatSound(ctx,output,noise,cue,voice,options.strong,now);this.voices.push(now+duration);
  // An audio-clock callback releases the graph even when rendering pauses.
  const cleanup=ctx.createConstantSource();cleanup.offset.value=0;cleanup.connect(master);
  cleanup.onended=()=>{output.disconnect();pan.disconnect();this.outputs.delete(output);cleanup.disconnect();};
  cleanup.start(now);cleanup.stop(now+duration);
 }
 async dispose(){
  window.removeEventListener('pointerdown',this.unlock,{capture:true});window.removeEventListener('keydown',this.unlock,{capture:true});document.removeEventListener('visibilitychange',this.visibility);
  this.silence();const context=this.context;this.context=null;this.master=null;this.noise=null;if(context&&context.state!=='closed')await context.close();
 }
}
