export interface LiveTranscript {
  status: 'connecting' | 'listening' | 'unavailable' | 'complete';
  text: string; finalText: string; partialText: string;
}
export interface StreamGrant {ticket:string}
interface SocketLike {
  readyState:number; bufferedAmount:number;
  send:(data:string|ArrayBuffer)=>void; close:()=>void;
  addEventListener:(name:string, callback:(event:any)=>void)=>void;
}

/** One recording, one bounded connection. Never store a ticket or transcript. */
export class LiveTranscription {
  private socket:SocketLike|null=null;
  private ready=false;
  private ended=false;
  private stopping=false;
  private queue:ArrayBuffer[]=[];
  private queuedBytes=0;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private finishTimer:ReturnType<typeof setTimeout>|undefined;
  private resolve!: (result:{ok:boolean;text:string})=>void;
  private done=new Promise<{ok:boolean;text:string}>(resolve=>{this.resolve=resolve;});
  private abort=new AbortController();
  private state:LiveTranscript={status:'connecting',text:'',finalText:'',partialText:''};
  private node:AudioWorkletNode|null=null;
  private source:MediaStreamAudioSourceNode|null=null;
  private silence:GainNode|null=null;
  private stopPCM: (()=>void)|null=null;
  private onChange:(state:LiveTranscript)=>void;
  constructor(onChange:(state:LiveTranscript)=>void) {this.onChange=onChange;}
  connect(grant:(signal:AbortSignal)=>Promise<StreamGrant>, url:string, socketFactory:(url:string)=>SocketLike=url=>new WebSocket(url)) {
    this.timer=setTimeout(()=>this.settle(false),15000);
    void grant(this.abort.signal).then(({ticket})=>{
      if(this.ended)return;
      const socket=socketFactory(url);this.socket=socket;
      socket.addEventListener('open',()=>{if(!this.ended)socket.send(JSON.stringify({ticket}));});
      socket.addEventListener('message',event=>{
        if(this.ended)return;
        try {
          const data=JSON.parse(event.data);
          if(data.type==='ready') {
            this.ready=true;clearTimeout(this.timer);
            for(const chunk of this.queue)socket.send(chunk);
            this.queue=[];this.queuedBytes=0;
            this.state={...this.state,status:'listening'};this.onChange(this.state);
            if(this.stopping)socket.send(JSON.stringify({type:'finish'}));
          } else if(data.type==='transcript'&&typeof data.text==='string'&&data.text.length<=12000) {
            this.state={status:'listening',text:data.text,finalText:typeof data.final_text==='string'?data.final_text:'',partialText:typeof data.partial_text==='string'?data.partial_text:''};
            this.onChange(this.state);
          } else if(data.type==='done'&&typeof data.text==='string') {
            this.state={status:'complete',text:data.text,finalText:data.text,partialText:''};this.settle(true);
          } else if(data.type==='error')this.settle(false);
        } catch {this.settle(false);}
      });
      socket.addEventListener('close',()=>this.settle(false));
      socket.addEventListener('error',()=>this.settle(false));
    }).catch(()=>this.settle(false));
  }
  push(chunk:ArrayBuffer) {
    if(this.ended||this.stopping)return;
    if(!this.ready) {
      this.queuedBytes+=chunk.byteLength;
      if(this.queuedBytes>512000){this.settle(false);return;}
      this.queue.push(chunk);
    } else if(this.socket) {
      if(this.socket.bufferedAmount>256000){this.settle(false);return;}
      try{this.socket.send(chunk);}catch{this.settle(false);}
    }
  }
  async attach(stream:MediaStream, context:AudioContext|null) {
    if(this.ended)return;
    if(!context?.audioWorklet){this.settle(false);return;}
    try {
      await context.audioWorklet.addModule(new URL('./liveVoice.worklet.js',import.meta.url));
      if(this.ended)return;
      this.node=new AudioWorkletNode(context,'frienden-live-voice');
      this.node.port.onmessage=({data})=>{if(data==='stopped')this.stopPCM?.();else if(data instanceof ArrayBuffer)this.push(data);};
      this.source=context.createMediaStreamSource(stream);
      this.silence=context.createGain();this.silence.gain.value=0;
      this.source.connect(this.node).connect(this.silence).connect(context.destination);
    }catch{this.settle(false);}
  }
  async flush() {
    if(!this.node||this.ended)return;
    await new Promise<void>(resolve=>{
      const timer=setTimeout(resolve,180);
      this.stopPCM=()=>{clearTimeout(timer);resolve();};
      this.node!.port.postMessage('stop');
    });
    this.disconnectPCM();
  }
  private disconnectPCM() {
    this.stopPCM?.();this.stopPCM=null;
    this.source?.disconnect();this.node?.disconnect();this.silence?.disconnect();
    if(this.node)this.node.port.onmessage=null;
    this.source=null;this.node=null;this.silence=null;
  }
  finish() {
    if(!this.stopping&&!this.ended) {
      this.stopping=true;
      if(this.ready)this.socket?.send(JSON.stringify({type:'finish'}));
      this.finishTimer=setTimeout(()=>this.settle(false),9000);
    }
    return this.done;
  }
  cancel(){this.settle(false,true);}
  private settle(ok:boolean,cancelled=false) {
    if(this.ended)return;
    this.ended=true;this.abort.abort();clearTimeout(this.timer);clearTimeout(this.finishTimer);
    this.queue=[];this.disconnectPCM();
    if(this.socket&&this.socket.readyState<2)this.socket.close();
    if(!cancelled){this.state={...this.state,status:ok?'complete':'unavailable'};this.onChange(this.state);}
    this.resolve({ok,text:this.state.text});
  }
}
