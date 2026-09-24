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

const AUDIO_CAPTURE_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 48_000,
};

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

export async function readMicrophonePermission(): Promise<PermissionState | "unknown"> {
  if (typeof navigator === "undefined") return "unknown";
  if (navigator.permissions?.query) {
    try {
      const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
      return permission.state;
    } catch {
      // Safari does not consistently expose microphone state through Permissions API.
    }
  }
  if (navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (devices.some((device) => device.kind === "audioinput" && device.label)) return "granted";
    } catch {
      // Device enumeration is only a no-prompt fallback for browsers without permission queries.
    }
  }
  return "unknown";
}

export async function requestMicrophoneAccess() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CAPTURE_CONSTRAINTS });
  stream.getTracks().forEach((track) => track.stop());
}

export async function createNoiseReducedAudioCapture(): Promise<NoiseReducedAudioCapture> {
  const sourceStream = await navigator.mediaDevices.getUserMedia({
    audio: AUDIO_CAPTURE_CONSTRAINTS,
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

    const silentOutput = context.createGain();
    silentOutput.gain.value = 0;
    source.connect(highPass).connect(lowPass).connect(compressor).connect(analyser).connect(silentOutput).connect(context.destination);

    let cleaned = false;
    return {
      // Record the native microphone stream. Some browsers advertise support for
      // recording a Web Audio destination but intermittently emit an empty WebM.
      stream: sourceStream,
      analyser,
      processed: false,
      cleanup: () => {
        if (cleaned) return;
        cleaned = true;
        source.disconnect();
        highPass.disconnect();
        lowPass.disconnect();
        compressor.disconnect();
        analyser.disconnect();
        silentOutput.disconnect();
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
