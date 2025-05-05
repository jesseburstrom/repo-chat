
// src/ChatInterface.tsx
import React, { useState, useEffect, useRef, JSX } from 'react';
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
    // Only scroll if the history has messages AND the *last* message is from the model
    if (history.length > 0) {
      const lastMessage = history[history.length - 1];
      if (lastMessage.role !== 'model') {
        // Scroll to the bottom smoothly only when a model response arrives
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
      // If the last message role is 'user', do nothing, preserving the scroll position.
    }
  }, [history]); // Keep history as the dependency
  /* ------------------------------------------------------------------- */

  // Shikiji renderer for fenced code blocks
  const CodeBlockRenderer = ({ node, inline, className, children, ...props }: any) => {
    // --- State for Copy Button Feedback ---
    const [copyButtonText, setCopyButtonText] = useState('Copy');
    // --- End State ---

    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : 'plaintext';
    const codeString = String(children).replace(/\n$/, '');
    // --- NEW Logic for single-word triple-backticks ---
    // Heuristic: Check if it's NOT inline, has no language specified (no `language-` class),
    // and contains no spaces or newlines (likely a single word/token).
    const isLikelySingleWordBlock =
        !inline &&                           // Came from ```...```
        !match &&                            // No language specified (e.g., ```javascript)
        codeString.length > 0 &&             // Not empty
        !codeString.includes(' ') &&         // No spaces
        !codeString.includes('\n');          // No newlines

    if (isLikelySingleWordBlock) {
      // Render as bold instead of a code block
      // Using the trimmed string here is fine
      return <strong className="non-standard-code-highlight" {...props}>{codeString}</strong>;
    }
    // --- END NEW Logic ---

    if (inline)
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );
    // Function to handle the copy action
    const handleCopyClick = () => {
      if (!navigator.clipboard) {
        console.warn('Clipboard API not available');
        setCopyButtonText('Failed'); // Indicate failure if API is missing
        setTimeout(() => setCopyButtonText('Copy'), 2000);
        return;
      }
      navigator.clipboard.writeText(codeString)
        .then(() => {
          setCopyButtonText('Copied!');
          setTimeout(() => setCopyButtonText('Copy'), 1500); // Reset after 1.5 seconds
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          setCopyButtonText('Failed');
          setTimeout(() => setCopyButtonText('Copy'), 2000);
        });
    };

    // Create the language label element (only for block code)
    // Display 'plaintext' if no language was explicitly set in the markdown
    const languageLabel = (
      <span className="code-language-label">{lang}</span>
  );

   // --- Create the Copy Button ---
   const copyButton = (
    <button
      className={`copy-code-button ${copyButtonText !== 'Copy' ? 'copied' : ''}`}
      onClick={handleCopyClick}
      title="Copy code to clipboard" // Accessibility
    >
      {copyButtonText}
    </button>
  );
  // --- End Copy Button ---
  let codeBlockElement: JSX.Element;

  // Try using Shikiji highlighter
  if (highlighter) {
    try {
      const html = highlighter.codeToHtml(codeString, {
        lang,
        theme: 'material-theme-lighter',
      });
      codeBlockElement = <div dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (err) {
      console.warn(`Shikiji failed for "${lang}":`, err);
      // Fallback to default rendering if highlighter fails
      codeBlockElement = (
        <pre className={`language-${lang}`}>
          <code className={`language-${lang}`} {...props}>
            {children}
          </code>
        </pre>
      );
    }
  } else {
    // Fallback rendering (if highlighter not ready)
    codeBlockElement = (
      <pre className={`language-${lang}`}>
        <code className={`language-${lang}`} {...props}>
          {children}
        </code>
      </pre>
    );
  }

  // --- Return container with label, button, and code block ---
  return (
    <div className="code-block-wrapper" {...props}> {/* Outer wrapper for positioning */}
      <div className="code-block-header"> {/* Container for label and button */}
        {languageLabel}
        {copyButton}
      </div>
      {codeBlockElement} {/* The actual code block (Shikiji div or pre/code) */}
    </div>
  );
  // --- End Return ---
};
// --- End CodeBlockRenderer ---

return (
  <div className="chat-interface">
    {history.map((message, index) => (
      <div key={index} className={`chat-message ${message.role}`}>
        <span className="message-role">{message.role === 'user' ? 'You' : 'Model'}</span>
        <div className="message-content">
          {message.role === 'model' ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ code: CodeBlockRenderer }} // Use the updated renderer
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
    <div ref={bottomRef} /> {/* Scroll target */}
  </div>
);
};
export default ChatInterface;

