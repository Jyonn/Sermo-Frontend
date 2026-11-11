/** Check transport support before requesting a microphone or creating an invitation. */
export async function acquireVoiceMicrophone(): Promise<MediaStream> {
  const {isBrowserSupported}=await import('livekit-client');
  if(!isBrowserSupported())throw new DOMException('WebRTC unavailable','NotSupportedError');
  if(!navigator.mediaDevices?.getUserMedia)throw new DOMException('Microphone unavailable','NotFoundError');
  return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
}
