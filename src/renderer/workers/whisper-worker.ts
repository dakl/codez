/**
 * Web Worker for Whisper speech-to-text inference.
 *
 * Uses @huggingface/transformers to run Whisper locally via WASM/WebGPU.
 * Singleton model — loaded once and reused across transcription requests.
 *
 * Protocol (postMessage):
 *   → { type: "load", modelId?: string }
 *   ← { status: "loading", progress: number, file: string }
 *   ← { status: "ready" }
 *
 *   → { type: "transcribe", audio: Float32Array, language?: string }
 *   ← { status: "update", text: string }
 *   ← { status: "complete", text: string }
 *   ← { status: "error", message: string }
 */

import {
  AutoProcessor,
  AutoTokenizer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type Processor,
  TextStreamer,
  WhisperForConditionalGeneration,
} from "@huggingface/transformers";

const DEFAULT_MODEL_ID = "onnx-community/whisper-large-v3-turbo";
const MAX_NEW_TOKENS = 256;

let tokenizer: PreTrainedTokenizer | null = null;
let processor: Processor | null = null;
let model: PreTrainedModel | null = null;
let isProcessing = false;

async function loadModel(modelId: string): Promise<void> {
  const progressCallback = (event: { status: string; file?: string; progress?: number }) => {
    if (event.status === "progress" && event.progress !== undefined) {
      self.postMessage({
        status: "loading",
        progress: event.progress,
        file: event.file ?? "",
      });
    }
  };

  tokenizer = await AutoTokenizer.from_pretrained(modelId, {
    progress_callback: progressCallback,
  });

  processor = await AutoProcessor.from_pretrained(modelId, {
    progress_callback: progressCallback,
  });

  model = await WhisperForConditionalGeneration.from_pretrained(modelId, {
    dtype: {
      encoder_model: "q4f16",
      decoder_model_merged: "q4f16",
    },
    device: "wasm",
    progress_callback: progressCallback,
  });

  self.postMessage({ status: "ready" });
}

async function transcribe(audio: Float32Array, language?: string): Promise<void> {
  if (!tokenizer || !processor || !model) {
    self.postMessage({ status: "error", message: "Model not loaded" });
    return;
  }

  if (isProcessing) {
    self.postMessage({ status: "error", message: "Already processing" });
    return;
  }

  isProcessing = true;

  try {
    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => {
        self.postMessage({ status: "update", text });
      },
    });

    const inputs = await processor(audio);

    const generateOptions: Record<string, unknown> = {
      input_features: inputs.input_features,
      max_new_tokens: MAX_NEW_TOKENS,
      streamer,
    };

    // Only set language if explicitly provided; otherwise Whisper auto-detects
    if (language) {
      generateOptions.language = language;
    }

    const outputs = await (model as { generate: (opts: Record<string, unknown>) => Promise<unknown[]> }).generate(
      generateOptions,
    );

    const decoded = (
      tokenizer as unknown as { batch_decode: (ids: unknown[], opts: Record<string, boolean>) => string[] }
    ).batch_decode(outputs, { skip_special_tokens: true });

    self.postMessage({ status: "complete", text: decoded[0]?.trim() ?? "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    self.postMessage({ status: "error", message });
  } finally {
    isProcessing = false;
  }
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "load") {
    const modelId = event.data.modelId ?? DEFAULT_MODEL_ID;
    try {
      await loadModel(modelId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load model";
      self.postMessage({ status: "error", message });
    }
  }

  if (type === "transcribe") {
    await transcribe(event.data.audio, event.data.language);
  }
});
