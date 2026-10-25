// Render the original game score to stereo WAV previews using the same sampled voices.
// npm run music:render [-- --full] — no external service, assets or audio codecs needed.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {stripVTControlCharacters} from 'node:util';

const port=4193,url=`http://127.0.0.1:${port}`,full=process.argv.includes('--full');
let browser;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort']);
try{
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Music render server did not start')),15000);
    server.once('error',reject);server.once('exit',code=>reject(new Error(`Vite exited: ${code}`)));
    server.stdout.on('data',data=>{if(stripVTControlCharacters(String(data)).includes(url)){clearTimeout(timer);resolve();}});
    server.stderr.on('data',data=>process.stderr.write(data));
  });
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
  const page=await browser.newPage();
  await page.route(`${url}/__music-preview`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Brumaluz · Música</title>'}));
  await page.goto(`${url}/__music-preview`);
  const directory=join('art','music');await mkdir(directory,{recursive:true});
  for(const phase of ['dawn','day','dusk','night']){
    const result=await page.evaluate(async({phase,full})=>{
      const {MUSIC_PROFILES,musicBar}=await import('/src/world/dayMusicScore.ts');
      const {renderNote,primeMusicVoices}=await import('/src/world/dayMusicVoice.ts');
      const profile=MUSIC_PROFILES[phase],beat=60/profile.bpm,bars=full?profile.bars:8;
      const seconds=bars*profile.beatsPerBar*beat+5,rate=24000;
      const audio=new OfflineAudioContext(2,Math.ceil(seconds*rate),rate);
      const dry=audio.createGain(),master=audio.createGain(),filter=audio.createBiquadFilter(),room=audio.createConvolver(),wet=audio.createGain();
      master.gain.value=.78;filter.type='lowpass';filter.frequency.value=6500;wet.gain.value=.14;
      const compressor=audio.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=18;compressor.ratio.value=2.5;compressor.attack.value=.02;compressor.release.value=.4;
      const impulse=audio.createBuffer(2,rate*1.8,rate);let seed=9137;
      for(let c=0;c<2;c++){const data=impulse.getChannelData(c);for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=((seed>>>0)/2147483648-1)*Math.pow(1-i/data.length,2.8);}}
      room.buffer=impulse;dry.connect(filter);dry.connect(room).connect(wet).connect(filter);filter.connect(compressor).connect(master).connect(audio.destination);
      const fade=audio.createGain();fade.gain.setValueAtTime(0,0);fade.gain.linearRampToValueAtTime(1,1.2);fade.gain.setValueAtTime(1,seconds-4);fade.gain.linearRampToValueAtTime(0,seconds-.05);fade.connect(dry);
      await primeMusicVoices(audio);
      for(let bar=0;bar<bars;bar++)for(const note of musicBar(phase,bar))renderNote(audio,fade,note,.1+(bar*profile.beatsPerBar+note.beat)*beat,note.duration*beat);
      const buffer=await audio.startRendering(),samples=buffer.length,channels=2;
      const wav=new ArrayBuffer(44+samples*channels*2),view=new DataView(wav);
      const label=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
      label(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);label(8,'WAVE');label(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);label(36,'data');view.setUint32(40,samples*4,true);
      let peak=0,energy=0;
      for(let i=0;i<samples;i++)for(let c=0;c<channels;c++){const sample=buffer.getChannelData(c)[i];peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;view.setInt16(44+(i*2+c)*2,Math.round(Math.max(-1,Math.min(1,sample))*32767),true);}
      let binary='';const bytes=new Uint8Array(wav);for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      return {title:profile.title,seconds,peak,rms:Math.sqrt(energy/(samples*2)),base64:btoa(binary)};
    },{phase,full});
    const path=join(directory,`${phase}${full?'-full':''}.wav`);await writeFile(path,Buffer.from(result.base64,'base64'));
    console.log(`${path}: ${result.title}, ${result.seconds.toFixed(1)} s, peak ${result.peak.toFixed(3)}, RMS ${result.rms.toFixed(4)}`);
  }
}finally{
  await browser?.close();
  if(server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
}
