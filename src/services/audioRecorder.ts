// Audio recorder using standard MediaRecorder with live audio level detection
// Fully hardened for mobile browsers (Android Chrome, iOS Safari, mobile WebViews)

export interface AudioRecordingResult {
  blob: Blob;
  dataUrl: string;
  base64Data: string;
  mimeType: string;
  durationMs: number;
}

export interface VoiceRecorderController {
  stop: () => Promise<AudioRecordingResult | null>;
  cancel: () => void;
  getVolumeLevel: () => number; // 0 to 100
}

export async function startVoiceRecording(
  onVolumeChange?: (level: number) => void
): Promise<VoiceRecorderController> {
  if (typeof window === 'undefined') {
    throw new Error('Window context is required for microphone recording');
  }

  // Check mediaDevices support with webkit prefix fallback
  const mediaDevices =
    navigator.mediaDevices ||
    ((navigator as any).webkitGetUserMedia ? {
      getUserMedia: (c: MediaStreamConstraints) =>
        new Promise<MediaStream>((resolve, reject) => {
          (navigator as any).webkitGetUserMedia(c, resolve, reject);
        }),
    } : null);

  if (!mediaDevices || !mediaDevices.getUserMedia) {
    throw new Error('Microphone access is not supported on this device/browser');
  }

  let stream: MediaStream;
  try {
    // Attempt with standard mobile-friendly constraints
    stream = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (constraintErr) {
    console.warn('Advanced audio constraints not supported on this phone, falling back to basic audio:', constraintErr);
    // Fallback: minimal constraint that works on 100% of mobile devices
    stream = await mediaDevices.getUserMedia({ audio: true });
  }

  // Setup AudioContext for real-time volume detection (fails gracefully on restricted phones)
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let volumeInterval: any = null;
  let currentVolume = 0;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      volumeInterval = setInterval(() => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Normalize roughly to 0-100
        currentVolume = Math.min(100, Math.round((average / 128) * 100));
        if (onVolumeChange) {
          onVolumeChange(currentVolume);
        }
      }, 60);
    }
  } catch (audioContextErr) {
    console.warn('Could not initialize audio visualizer context (recording still active):', audioContextErr);
  }

  // Determine best supported mimeType across mobile and desktop
  let mimeType = '';
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/aac')) {
      mimeType = 'audio/aac';
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      mimeType = 'audio/ogg';
    }
  }

  let mediaRecorder: MediaRecorder;
  try {
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (mrErr) {
    console.warn('Standard MediaRecorder init with options failed, using raw stream:', mrErr);
    mediaRecorder = new MediaRecorder(stream);
  }

  const chunks: Blob[] = [];
  const startTime = Date.now();

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  try {
    mediaRecorder.start(250); // 250ms chunks are optimal for mobile
  } catch (e) {
    try {
      mediaRecorder.start();
    } catch (err) {
      console.warn('MediaRecorder start notice:', err);
    }
  }

  const cleanup = () => {
    if (volumeInterval) {
      clearInterval(volumeInterval);
      volumeInterval = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {}
    });
  };

  return {
    getVolumeLevel: () => currentVolume,
    cancel: () => {
      cleanup();
      try {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      } catch (e) {}
    },
    stop: (): Promise<AudioRecordingResult | null> => {
      return new Promise((resolve) => {
        const durationMs = Date.now() - startTime;

        mediaRecorder.onstop = async () => {
          cleanup();
          if (chunks.length === 0) {
            resolve(null);
            return;
          }

          const actualMime = mediaRecorder.mimeType || mimeType || (chunks[0] && chunks[0].type) || 'audio/webm';
          const blob = new Blob(chunks, { type: actualMime });

          // Convert to base64 Data URL and extract pure base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve({
              blob,
              dataUrl,
              base64Data,
              mimeType: actualMime,
              durationMs,
            });
          };
          reader.onerror = () => {
            resolve(null);
          };
          reader.readAsDataURL(blob);
        };

        try {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          } else {
            cleanup();
            resolve(null);
          }
        } catch (err) {
          cleanup();
          resolve(null);
        }
      });
    },
  };
}
