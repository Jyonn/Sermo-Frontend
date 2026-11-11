/** Settle the call before disconnecting, so participant_left cannot win a normal hangup. */
export async function endVoiceCallMedia<T>(mute:()=>void,settle:()=>Promise<T>,release:()=>void):Promise<T> {
  mute();
  try{return await settle()}
  finally{release()}
}
