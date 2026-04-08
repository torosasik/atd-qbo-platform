import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Trash2, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '../utils/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const SUGGESTED_PROMPTS = [
  "Show me today's PO activity",
  'What vendors do we order from most?',
  'Check for duplicate POs this week',
  "Summarize this month's purchases",
];

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/** Custom component overrides for ReactMarkdown with Tailwind styling */
const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 mt-3 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-gray-900 mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold text-gray-900 mt-2 mb-1">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-gray-700">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 pl-3 my-2 text-gray-600 italic">{children}</blockquote>
  ),
  code: ({ inline, className, children }) => {
    if (inline) {
      return (
        <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
      );
    }
    return (
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs leading-relaxed">
        <code className={className}>{children}</code>
      </pre>
    );
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border border-gray-200 rounded">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold text-gray-700 border-b border-gray-200">{children}</th>,
  td: ({ children }) => <td className="px-3 py-1.5 border-b border-gray-100 text-gray-600">{children}</td>,
  hr: () => <hr className="my-3 border-gray-200" />,
};

function SourceBadge({ source }) {
  const map = {
    Ollama: 'bg-gray-100 text-gray-600',
    Claude: 'bg-purple-100 text-purple-700',
    Error: 'bg-red-100 text-red-600',
  };
  if (!source) return null;
  const cls = map[source] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>
      {source}
    </span>
  );
}

function UserMessage({ msg }) {
  return (
    <div className="flex justify-end gap-3">
      <div className="max-w-2xl">
        <div className="bg-atd-blue text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
          {msg.content}
        </div>
        <div className="text-right mt-1">
          <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
        </div>
      </div>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-atd-blue-light flex items-center justify-center mt-0.5">
        <User className="h-4 w-4 text-white" />
      </div>
    </div>
  );
}

function AssistantMessage({ msg, onRetry, prevUserContent }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex gap-3 group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mt-0.5">
        <Bot className="h-4 w-4 text-gray-500" />
      </div>
      <div className="max-w-2xl">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-gray-700">
          <ReactMarkdown components={markdownComponents}>
            {msg.content || ''}
          </ReactMarkdown>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {msg.source && <SourceBadge source={msg.source} />}
          {msg.confidence != null && (
            <span className="text-xs text-gray-400">
              Confidence: {Math.round(msg.confidence * 100)}%
            </span>
          )}
          <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-1 text-gray-400 hover:text-gray-600"
            title="Copy to clipboard"
          >
            {copied ? (
              <span className="text-xs text-green-600">Copied!</span>
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
        {msg.error && prevUserContent && (
          <button
            onClick={() => onRetry(prevUserContent)}
            className="mt-1 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
        <Bot className="h-4 w-4 text-gray-500" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export default function AIChat() {
  // Load persisted messages from sessionStorage on mount
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('atd-ai-chat');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiSource, setAiSource] = useState({ label: 'Checking...', color: 'bg-gray-300' });
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  // Ref to avoid stale closure in handleKeyDown — always reads current input value
  const inputRef = useRef('');
  useEffect(() => { inputRef.current = input; }, [input]);

  // Persist messages to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem('atd-ai-chat', JSON.stringify(messages));
    } catch { /* storage full or unavailable */ }
  }, [messages]);

  useEffect(() => {
    api.getHealth()
      .then((health) => {
        const ollamaOk = health.services?.ollama?.status === 'connected';
        const claudeOk = health.services?.claude_api?.status === 'connected';
        if (ollamaOk) {
          setAiSource({ label: 'Using Ollama (Local)', color: 'bg-green-500' });
        } else if (claudeOk) {
          setAiSource({ label: 'Using Claude API', color: 'bg-blue-500' });
        } else {
          setAiSource({ label: 'AI Unavailable', color: 'bg-red-500' });
        }
      })
      .catch(() => {
        setAiSource({ label: 'AI Unavailable', color: 'bg-red-500' });
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxH = 3 * 24 + 16; // ~3 rows
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
  }

  const sendMessage = useCallback(
    async (text) => {
      const content = (text || input).trim();
      if (!content || isLoading) return;

      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      const userMsg = {
        id: Date.now() + Math.random(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await api.sendAiChat(content);
        const reply = {
          id: Date.now() + Math.random(),
          role: 'assistant',
          content: res.message || res.reply || res.content || JSON.stringify(res),
          source: res.source || null,
          confidence: res.confidence ?? null,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, reply]);
      } catch (err) {
        let msgContent;
        let source = 'Error';
        if (err.status === 404) {
          msgContent =
            'AI chat endpoint coming soon. This interface is ready and will connect once the backend endpoint is built. In the meantime, all other modules are fully functional.';
          source = null;
        } else {
          msgContent = `Something went wrong: ${err.message || 'Unknown error.'}`;
        }
        const errMsg = {
          id: Date.now() + Math.random(),
          role: 'assistant',
          content: msgContent,
          source,
          error: true,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading]
  );

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Use inputRef to avoid stale closure — always reads the current input value
      const text = inputRef.current;
      if (text.trim()) sendMessage(text);
    }
  }

  function clearChat() {
    setMessages([]);
    try { sessionStorage.removeItem('atd-ai-chat'); } catch { /* ignore */ }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-atd-dark">AI Assistant</h1>
          <p className="text-gray-500 text-sm mt-0.5">Ask questions about your QBO data</p>
        </div>
        <div className="flex items-center gap-3">
          {!isEmpty && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear chat"
            >
              <Trash2 size={15} />
              <span>Clear</span>
            </button>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`inline-block h-2 w-2 rounded-full ${aiSource.color}`} />
            <span>{aiSource.label}</span>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-5">
        {isEmpty && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-full bg-atd-blue bg-opacity-10 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-atd-blue" />
            </div>
            <h2 className="text-lg font-semibold text-atd-dark mb-1">Ask about your QBO data</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-xs">
              Query vendors, POs, and activity using natural language.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-atd-blue hover:text-atd-blue transition-colors shadow-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) =>
          msg.role === 'user' ? (
            <UserMessage key={msg.id} msg={msg} />
          ) : (
            <AssistantMessage
              key={msg.id}
              msg={msg}
              onRetry={sendMessage}
              prevUserContent={messages[idx - 1]?.content}
            />
          )
        )}

        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts bar (shown when there are messages) */}
      {!isEmpty && (
        <div className="px-4 lg:px-8 py-2 flex gap-2 overflow-x-auto flex-shrink-0 border-t border-gray-100 bg-gray-50">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-500 hover:border-atd-blue hover:text-atd-blue transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 px-4 lg:px-8 py-4 flex-shrink-0">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question... (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue disabled:opacity-60 leading-6"
            style={{ minHeight: '48px', maxHeight: '88px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 bg-atd-blue hover:bg-blue-700 text-white w-11 h-11 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" color="white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
