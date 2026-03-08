import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceInputState {
  isRecording: boolean;
  isTranscribing: boolean;
  isModelLoaded: boolean;
  isModelLoading: boolean;
  modelLoadProgress: number;
  partialText: string;
  error: string | null;
}

export interface UseVoiceInputReturn extends VoiceInputState {
  startRecording: () => void;
  stopAndTranscribe: () => void;
  loadModel: (modelId?: string) => void;
}

const WHISPER_SAMPLE_RATE = 16_000;

/**
 * Resample an AudioBuffer to 16kHz mono Float32Array for Whisper.
 */
async function resampleTo16kHz(audioBuffer: AudioBuffer): Promise<Float32Array> {
  const sourceSampleRate = audioBuffer.sampleRate;
  const targetLength = Math.round((audioBuffer.length * WHISPER_SAMPLE_RATE) / sourceSampleRate);

  const offlineContext = new OfflineAudioContext(1, targetLength, WHISPER_SAMPLE_RATE);
  const bufferSource = offlineContext.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineContext.destination);
  bufferSource.start(0);

  const rendered = await offlineContext.startRendering();
  return rendered.getChannelData(0);
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [partialText, setPartialText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize worker lazily
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../workers/whisper-worker.ts", import.meta.url), {
        type: "module",
      });

      workerRef.current.addEventListener("message", (event: MessageEvent) => {
        const { status } = event.data;

        if (status === "loading") {
          setModelLoadProgress(event.data.progress ?? 0);
        } else if (status === "ready") {
          setIsModelLoaded(true);
          setIsModelLoading(false);
          setModelLoadProgress(100);
        } else if (status === "update") {
          setPartialText(event.data.text);
        } else if (status === "complete") {
          setPartialText(event.data.text);
          setIsTranscribing(false);
        } else if (status === "error") {
          setError(event.data.message);
          setIsTranscribing(false);
          setIsModelLoading(false);
        }
      });
    }
    return workerRef.current;
  }, []);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  const loadModel = useCallback(
    (modelId?: string) => {
      if (isModelLoaded || isModelLoading) return;
      setIsModelLoading(true);
      setError(null);
      const worker = getWorker();
      worker.postMessage({ type: "load", modelId });
    },
    [isModelLoaded, isModelLoading, getWorker],
  );

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setPartialText("");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Microphone access denied";
      setError(message);
    }
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    setIsRecording(false);
    setIsTranscribing(true);

    // Wait for the final data to be available
    await new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => resolve();
      mediaRecorder.stop();
    });

    // Stop all tracks to release the microphone
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;

    // Convert recorded chunks to Float32Array at 16kHz
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();

    const float32Audio = await resampleTo16kHz(audioBuffer);

    // Send to worker for transcription
    const worker = getWorker();
    worker.postMessage({ type: "transcribe", audio: float32Audio }, [float32Audio.buffer]);
  }, [getWorker]);

  return {
    isRecording,
    isTranscribing,
    isModelLoaded,
    isModelLoading,
    modelLoadProgress,
    partialText,
    error,
    startRecording,
    stopAndTranscribe,
    loadModel,
  };
}
