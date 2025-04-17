
// src/ChatInterface.tsx
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHighlighter, bundledLanguages } from 'shikiji';
import type { Highlighter } from 'shikiji';

import { ChatMessage } from './App';
import './ChatInterface.css';

/* ---------------- Shikiji highlighter (unchanged) ---------------- */
const useShikijiHighlighter = () => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const hl = await getHighlighter({
          themes: ['material-theme-lighter'],
          langs: Object.keys(bundledLanguages),
        });
        if (isMounted) setHighlighter(hl);
      } catch (err) {
        console.error('Failed to initialise Shikiji:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return highlighter;
};
/* ----------------------------------------------------------------- */

interface ChatInterfaceProps {
  history: ChatMessage[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ history }) => {
  const highlighter = useShikijiHighlighter();
  const bottomRef = useRef<HTMLDivElement>(null);     // ⬇ scroll target

  /* ----- Auto‑scroll to the newest message whenever history grows ---- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);
  /* ------------------------------------------------------------------- */

  // Shikiji renderer for fenced code blocks
  const CodeBlockRenderer = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : 'plaintext';
    const codeString = String(children).replace(/\n$/, '');

    if (inline)
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );

    if (!highlighter) {
      return (
        <pre className={`language-${lang}`}>
          <code className={`language-${lang}`} {...props}>
            {children}
          </code>
        </pre>
      );
    }

    try {
      const html = highlighter.codeToHtml(codeString, {
        lang,
        theme: 'material-theme-lighter',
      });
      return <div dangerouslySetInnerHTML={{ __html: html }} {...props} />;
    } catch (err) {
      console.warn(`Shikiji failed for "${lang}":`, err);
      return (
        <pre className={`language-${lang}`}>
          <code className={`language-${lang}`} {...props}>
            {children}
          </code>
        </pre>
      );
    }
  };

  return (
    <div className="chat-interface">
      {history.map((message, index) => (
        <div key={index} className={`chat-message ${message.role}`}>
          <span className="message-role">{message.role === 'user' ? 'You' : 'Model'}</span>
          <div className="message-content">
            {message.role === 'model' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ code: CodeBlockRenderer }}
              >
                {message.parts[0].text}
              </ReactMarkdown>
            ) : (
              message.parts[0].text.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  <br />
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      ))}

      {/* Invisible anchor that we scroll to */}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatInterface;

