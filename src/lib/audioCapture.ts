export interface NoiseReducedAudioCapture {
  stream: MediaStream;
  analyser: AnalyserNode | null;
  processed: boolean;
  cleanup: () => void;
}

const AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function audioContextConstructor() {
  return window.AudioContext
    || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    || null;
}

export function preferredAudioMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return AUDIO_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

export function audioFileExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export async function createNoiseReducedAudioCapture(): Promise<NoiseReducedAudioCapture> {
  const sourceStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 48_000,
    },
  });
  const AudioContextCtor = audioContextConstructor();
  if (!AudioContextCtor) {
    return {
      stream: sourceStream,
      analyser: null,
      processed: false,
      cleanup: () => sourceStream.getTracks().forEach((track) => track.stop()),
    };
  }

  let context: AudioContext | null = null;
  try {
    context = new AudioContextCtor({ latencyHint: "interactive" });
    await context.resume().catch(() => undefined);

    const source = context.createMediaStreamSource(sourceStream);
    const highPass = context.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = 85;
    highPass.Q.value = 0.72;

    const lowPass = context.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 12_000;
    lowPass.Q.value = 0.5;

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.24;

    const analyser = context.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.72;

    const destination = context.createMediaStreamDestination();
    source.connect(highPass).connect(lowPass).connect(compressor).connect(analyser).connect(destination);
    if (!destination.stream.getAudioTracks().length) throw new Error("processed_audio_track_unavailable");

    let cleaned = false;
    return {
      stream: destination.stream,
      analyser,
      processed: true,
      cleanup: () => {
        if (cleaned) return;
        cleaned = true;
        source.disconnect();
        highPass.disconnect();
        lowPass.disconnect();
        compressor.disconnect();
        analyser.disconnect();
        destination.disconnect();
        destination.stream.getTracks().forEach((track) => track.stop());
        sourceStream.getTracks().forEach((track) => track.stop());
        void context?.close().catch(() => undefined);
      },
    };
  } catch {
    void context?.close().catch(() => undefined);
    return {
      stream: sourceStream,
      analyser: null,
      processed: false,
      cleanup: () => sourceStream.getTracks().forEach((track) => track.stop()),
    };
  }
}
