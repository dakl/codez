import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StreamingIndicatorProps {
  text: string;
}

export function StreamingIndicator({ text }: StreamingIndicatorProps) {
  if (!text) return null;

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-surface text-text-primary">
        <div className="select-text cursor-text">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              code: ({ className, children, ...props }) =>
                !className ? (
                  <code className="bg-code-bg-inline rounded px-1 py-0.5 font-mono text-[0.85em]" {...props}>
                    {children}
                  </code>
                ) : (
                  <code className={`${className} font-mono text-xs`} {...props}>
                    {children}
                  </code>
                ),
              pre: ({ children }) => (
                <pre className="bg-code-bg rounded-lg p-3 mb-2 overflow-x-auto text-xs font-mono">{children}</pre>
              ),
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
        <span className="inline-block w-1.5 h-4 bg-accent animate-pulse ml-0.5 align-text-bottom" />
      </div>
    </div>
  );
}
