export type HoldGesture = "idle" | "recording" | "sliding" | "cancel";
export function holdGesture(startY:number, currentY:number, height:number, sliding:boolean):HoldGesture {
  const moved = sliding || startY-currentY>12;
  return moved && currentY<=Math.min(startY-72,height/2+44) ? "cancel" : moved ? "sliding" : "recording";
}

interface Capture {stream:MediaStream;analyser:AnalyserNode|null;cleanup:()=>void}
export interface HoldRecordingState {phase:"idle"|"requesting"|"recording";duration:number;bars:number[]}
interface RecorderOptions {capture:()=>Promise<Capture>;recorder:(stream:MediaStream)=>MediaRecorder;now?:()=>number;
  onState:(state:HoldRecordingState)=>void;onRecorded:(blob:Blob,duration:number,mime:string)=>void;onError:(error:unknown)=>void}
export class HoldToTalkRecorder {
  private generation=0;
  private capture:Capture|null=null;
  private recorder:MediaRecorder|null=null;
  private timer:ReturnType<typeof setInterval>|null=null;
  private stopping=false;
  private options:RecorderOptions;
  constructor(options:RecorderOptions) {this.options=options;}
  private now=()=>this.options.now?.() ?? Date.now();
  private idle=()=>this.options.onState({phase:"idle",duration:0,bars:[]});
  private cleanup() {if(this.timer!==null) clearInterval(this.timer);this.timer=null;this.capture?.cleanup();this.capture=null;this.recorder=null;}
  async start() {
    this.cancel();
    const token=++this.generation;
    this.stopping=false;
    this.options.onState({phase:"requesting",duration:0,bars:Array(12).fill(.16)});
    try {
      const capture=await this.options.capture();
      if(token!==this.generation){capture.cleanup();return;}
      this.capture=capture;
      const recorder=this.options.recorder(capture.stream);
      this.recorder=recorder;
      const chunks:Blob[]=[];
      let consumed=false;
      let startedAt=this.now();
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onstop=()=>{
        if(consumed || token!==this.generation)return;
        consumed=true;this.generation++;
        const duration=Math.min(60,Math.max(0,(this.now()-startedAt)/1000));
        const mime=recorder.mimeType || "audio/webm";
        const blob=new Blob(chunks,{type:mime});
        this.cleanup();this.idle();
        if(blob.size===0 || duration<.4){this.options.onError(new Error("too-short"));return;}
        this.options.onRecorded(blob,duration,mime);
      };
      recorder.start();startedAt=this.now();
      const tick=()=>{
        if(token!==this.generation)return;
        const duration=Math.min(60,(this.now()-startedAt)/1000);
        const bars=Array(12).fill(.2);
        if(capture.analyser){const data=new Uint8Array(capture.analyser.frequencyBinCount);capture.analyser.getByteFrequencyData(data);bars.forEach((_,i)=>{bars[i]=Math.max(.12,Math.min(.82,(data[Math.floor(i*data.length/12)]??0)/150));});}
        this.options.onState({phase:"recording",duration,bars});
        if(duration>=60)this.stop();
      };
      tick();this.timer=setInterval(tick,100);
    } catch(error) {if(token!==this.generation)return;this.cleanup();this.idle();this.options.onError(error);}
  }
  stop() {
    if(this.stopping)return;
    if(!this.recorder){this.cancel();return;}
    this.stopping=true;
    try {if(this.recorder.state==="recording")this.recorder.stop();}catch(error){this.cancel();this.options.onError(error);}
  }
  cancel() {
    this.generation++;
    const recorder=this.recorder;
    if(recorder){recorder.onstop=null;try{if(recorder.state==="recording")recorder.stop();}catch{/* Already stopped by the browser. */}}
    this.cleanup();this.idle();
  }
}
