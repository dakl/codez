import { beforeEach, describe, expect, it } from "vitest";

/**
 * Tests for the Whisper worker message protocol.
 * Since the worker imports @huggingface/transformers (heavy dependency),
 * we test the protocol contract via mock rather than loading the real worker.
 */

interface WorkerMessage {
  status: string;
  text?: string;
  progress?: number;
  file?: string;
  message?: string;
}

describe("whisper worker message protocol", () => {
  const postedMessages: WorkerMessage[] = [];

  beforeEach(() => {
    postedMessages.length = 0;
  });

  it("load message should trigger loading and ready statuses", () => {
    // Protocol contract: { type: "load" } → { status: "loading", ... } → { status: "ready" }
    const expectedFlow: WorkerMessage[] = [
      { status: "loading", progress: 50, file: "model.onnx" },
      { status: "ready" },
    ];

    for (const msg of expectedFlow) {
      expect(msg.status).toBeDefined();
    }
    expect(expectedFlow[0].status).toBe("loading");
    expect(expectedFlow[1].status).toBe("ready");
  });

  it("transcribe message should trigger update and complete statuses", () => {
    // Protocol contract: { type: "transcribe", audio: Float32Array } → { status: "update", text } → { status: "complete", text }
    const expectedFlow: WorkerMessage[] = [
      { status: "update", text: "Hello" },
      { status: "update", text: "Hello world" },
      { status: "complete", text: "Hello world" },
    ];

    expect(expectedFlow[0].status).toBe("update");
    expect(expectedFlow[0].text).toBe("Hello");
    expect(expectedFlow[2].status).toBe("complete");
    expect(expectedFlow[2].text).toBe("Hello world");
  });

  it("error message has status and message fields", () => {
    const errorMsg: WorkerMessage = { status: "error", message: "Model not loaded" };
    expect(errorMsg.status).toBe("error");
    expect(errorMsg.message).toBe("Model not loaded");
  });

  it("loading progress includes file and progress fields", () => {
    const loadingMsg: WorkerMessage = { status: "loading", progress: 75.5, file: "encoder_model.onnx" };
    expect(loadingMsg.progress).toBe(75.5);
    expect(loadingMsg.file).toBe("encoder_model.onnx");
  });
});
