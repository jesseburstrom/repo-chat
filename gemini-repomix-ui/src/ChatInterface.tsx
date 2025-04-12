// src/ChatInterface.tsx
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHighlighter, bundledLanguages } from 'shikiji'; // Import from shikiji
import type { Highlighter } from 'shikiji'; // Import type

import { ChatMessage } from './api';
import './ChatInterface.css'; // Keep your existing CSS for overall layout

// --- Shikiji Highlighter Setup ---
// Use state to hold the highlighter instance as it's async
const useShikijiHighlighter = () => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function initHighlighter() {
      try {
        const hl = await getHighlighter({
          themes: ['material-theme-lighter'], // Choose theme(s) - 'material-theme-lighter' is close to materialLight
          langs: Object.keys(bundledLanguages), // Load all bundled languages or specify needed ones
        });
        if (isMounted) {
          setHighlighter(hl);
        }
      } catch (error) {
        console.error("Failed to initialize Shikiji:", error);
         if (isMounted) {
             // Handle error, maybe disable highlighting
         }
      }
    }
    initHighlighter();
    return () => { isMounted = false; }; // Cleanup on unmount
  }, []); // Run only once on mount

  return highlighter;
};
// --- End Shikiji Setup ---


interface ChatInterfaceProps {
  history: ChatMessage[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ history }) => {
   const highlighter = useShikijiHighlighter(); // Get the highlighter instance

  // Custom renderer using Shikiji
  const CodeBlockRenderer = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match ? match[1] : 'plaintext'; // Default to plaintext if no language
    const codeString = String(children).replace(/\n$/, '');

    // Don't highlight inline code blocks with the full highlighter
    if (inline) {
        return <code className="inline-code" {...props}>{children}</code>;
    }

    // If highlighter isn't ready yet, render plain code block
    if (!highlighter) {
        return <pre className={`language-${lang}`}><code className={`language-${lang}`} {...props}>{children}</code></pre>;
    }

    try {
        // Generate HTML with Shikiji
        const html = highlighter.codeToHtml(codeString, {
            lang: lang,
            theme: 'material-theme-lighter', // Use the theme loaded earlier
        });
        // Use dangerouslySetInnerHTML to render the generated HTML
        // Note: This is generally safe here as Shikiji outputs controlled HTML
        return <div dangerouslySetInnerHTML={{ __html: html }} {...props} />;

    } catch (error) {
         console.warn(`Shikiji highlighting failed for language "${lang}":`, error);
         // Fallback to plain pre/code block on error
         return <pre className={`language-${lang}`}><code className={`language-${lang}`} {...props}>{children}</code></pre>;
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
                components={{
                  code: CodeBlockRenderer, // Use Shikiji renderer
                }}
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
    </div>
  );
};

export default ChatInterface;
