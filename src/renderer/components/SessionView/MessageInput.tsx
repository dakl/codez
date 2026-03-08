import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { Tooltip } from "../Tooltip";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceInput();

  // Auto-focus when not disabled
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  // Append transcribed text to textarea when transcription completes
  const lastPartialRef = useRef("");
  useEffect(() => {
    if (voice.partialText && voice.partialText !== lastPartialRef.current) {
      lastPartialRef.current = voice.partialText;
      if (!voice.isTranscribing) {
        // Transcription complete — append final text
        setText((prev) => {
          const separator = prev.trim() ? " " : "";
          return prev.trim() + separator + voice.partialText.trim();
        });
      }
    }
  }, [voice.partialText, voice.isTranscribing]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    lastPartialRef.current = "";
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  const handleMicClick = useCallback(() => {
    if (voice.isRecording) {
      voice.stopAndTranscribe();
    } else if (!voice.isTranscribing) {
      if (!voice.isModelLoaded) {
        // First click: load the model (don't record yet)
        if (!voice.isModelLoading) {
          voice.loadModel();
        }
        return;
      }
      voice.startRecording();
    }
  }, [voice]);

  const micLabel = voice.isRecording
    ? "Stop recording"
    : voice.isTranscribing
      ? "Transcribing..."
      : voice.isModelLoading
        ? `Loading model (${Math.round(voice.modelLoadProgress)}%)`
        : !voice.isModelLoaded
          ? "Load voice model"
          : "Voice input";

  // Display text: show partial transcription while transcribing, otherwise the textarea text
  const displayText =
    voice.isTranscribing && voice.partialText ? text + (text.trim() ? " " : "") + voice.partialText : text;

  return (
    <div className="border-t border-border p-4">
      {voice.error && <div className="mb-2 text-xs text-red-400">{voice.error}</div>}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={displayText}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Type a message... (↵ to send, ⇧↵ for newline)"
          disabled={disabled || voice.isTranscribing}
          rows={1}
          className="flex-1 resize-none rounded-lg bg-input border border-border px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent disabled:opacity-50"
        />
        <Tooltip label={micLabel} position="above">
          <button
            onClick={handleMicClick}
            disabled={disabled || voice.isTranscribing || voice.isModelLoading}
            type="button"
            className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${
              voice.isRecording
                ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                : "bg-surface-hover text-text-secondary hover:bg-surface-active"
            } disabled:opacity-30`}
            aria-label={micLabel}
          >
            {voice.isRecording ? (
              <MicOnIcon />
            ) : voice.isTranscribing || voice.isModelLoading ? (
              <SpinnerIcon />
            ) : (
              <MicOffIcon />
            )}
          </button>
        </Tooltip>
        <Tooltip label="Send message (↵)" position="above">
          <button
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            type="button"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent transition-colors"
          >
            Send
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function MicOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function MicOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" x2="12" y1="19" y2="22" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}
