import type { AgentMessage } from "@shared/agent-types";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
  message: AgentMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "tool_use") {
    return <ToolUseBubble message={message} />;
  }

  if (message.role === "tool_result") {
    return <ToolResultBubble message={message} />;
  }

  const isUser = message.role === "user";
  const isError = message.isError;

  let bubbleClasses: string;
  if (isError) {
    bubbleClasses = "bg-error-muted text-error border border-error/30";
  } else if (isUser) {
    bubbleClasses = "bg-accent text-white";
  } else {
    bubbleClasses = "bg-surface text-text-primary";
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${bubbleClasses}`}>
        {isError && <div className="text-xs font-medium text-error mb-1">Error</div>}
        {message.thinking && <ThinkingBlock text={message.thinking} />}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words select-text cursor-text">{message.content}</div>
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>
    </div>
  );
}

function ToolUseBubble({ message }: { message: AgentMessage }) {
  const toolName = message.toolName ?? "Tool";

  // Parse input for a concise label
  let label = "";
  try {
    const input = JSON.parse(message.content);
    if (input.file_path) {
      label = shortPath(input.file_path);
    } else if (input.command) {
      label = input.command.length > 60 ? `${input.command.slice(0, 60)}…` : input.command;
    } else if (input.pattern) {
      label = input.pattern;
    } else if (input.query) {
      label = input.query.length > 60 ? `${input.query.slice(0, 60)}…` : input.query;
    }
  } catch {
    label = message.content.length > 60 ? `${message.content.slice(0, 60)}…` : message.content;
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 text-xs text-text-muted">
      <span className="font-mono font-medium text-text-secondary">{toolName}</span>
      {label && <span className="font-mono truncate max-w-[400px]">{label}</span>}
    </div>
  );
}

function ToolResultBubble({ message }: { message: AgentMessage }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentPreview = message.content.length > 120 ? `${message.content.slice(0, 120)}…` : message.content;

  return (
    <div className="py-1 px-3 text-xs text-text-muted">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 hover:text-text-secondary transition-colors"
      >
        <span className={`transition-transform duration-150 text-[10px] ${isExpanded ? "rotate-90" : ""}`}>▶</span>
        <span className="font-mono truncate max-w-[500px]">{contentPreview}</span>
      </button>
      {isExpanded && (
        <div className="mt-1 ml-4 font-mono text-[11px] text-text-muted whitespace-pre-wrap break-words select-text cursor-text max-h-48 overflow-y-auto border-l-2 border-border-subtle pl-3">
          {message.content}
        </div>
      )}
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        <span className={`transition-transform duration-150 text-[10px] ${isExpanded ? "rotate-90" : ""}`}>▶</span>
        <span className="font-medium">Thinking</span>
      </button>
      {isExpanded && (
        <div className="mt-1.5 text-text-muted text-xs leading-relaxed whitespace-pre-wrap break-words select-text cursor-text italic max-h-60 overflow-y-auto border-l-2 border-border-subtle pl-3">
          {text}
        </div>
      )}
    </div>
  );
}

function transformInsightBlocks(text: string): string {
  return text.replace(/`★ Insight ─+`\n([\s\S]*?)\n`─+`/g, (_match, body: string) => {
    const quoted = body
      .trim()
      .split("\n")
      .map((line: string) => `> ${line}`)
      .join("\n");
    return `> **★ Insight**\n>\n${quoted}`;
  });
}

function MarkdownContent({ content }: { content: string }) {
  const processedContent = transformInsightBlocks(content);
  return (
    <div className="select-text cursor-text markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-code-bg-inline rounded px-1 py-0.5 font-mono text-[0.85em]" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className ?? ""} font-mono text-xs`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-code-bg rounded-lg p-3 mb-2 overflow-x-auto text-xs font-mono">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-accent/50 pl-3 text-text-secondary italic mb-2">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="underline underline-offset-2 opacity-80 hover:opacity-100"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-text-muted/20 my-2" />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="text-xs border-collapse w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-text-muted/30 px-2 py-1 font-semibold text-left bg-code-bg">{children}</th>
          ),
          td: ({ children }) => <td className="border border-text-muted/20 px-2 py-1">{children}</td>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

function shortPath(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 3) return filePath;
  return `…/${parts.slice(-2).join("/")}`;
}
