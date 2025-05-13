// FilePath: gemini-repomix-ui/src/ChatInterface.tsx
import React, { useState, useEffect, useRef, JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHighlighter, bundledLanguages } from 'shikiji';
import type { Highlighter } from 'shikiji';

import { ChatMessage } from './App'; // Assuming ChatMessage is in App.tsx
import { ParsedRepomixData } from './utils/parseRepomix'; // Assuming ParsedRepomixData is here
// Removed: import './ChatInterface.css'; // Migrated to Tailwind

const useShikijiHighlighter = () => {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const hl = await getHighlighter({ themes: ['material-theme-lighter'], langs: Object.keys(bundledLanguages) });
        if (isMounted) setHighlighter(hl);
      } catch (err) { console.error('Failed to initialise Shikiji in ChatInterface:', err); }
    })();
    return () => { isMounted = false; };
  }, []);
  return highlighter;
};

interface ChatInterfaceProps {
  history: ChatMessage[];
  parsedRepomixData: ParsedRepomixData | null;
  onStartComparison: (filePath: string, suggestedContent: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ history, parsedRepomixData, onStartComparison }) => {
  const highlighter = useShikijiHighlighter();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll logic remains the same
    if (history.length > 0) {
      const lastMessage = history[history.length - 1];
      const scrollableArea = bottomRef.current?.closest('.scrollable-content-area'); // Assuming parent still has this class for targeting
      if (lastMessage.role !== 'model' || history.length === 1) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else if (scrollableArea) {
        const { scrollTop, scrollHeight, clientHeight } = scrollableArea;
        if (scrollHeight - scrollTop - clientHeight < 150) {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      } else {
         bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [history]);

  // --- CodeBlockRenderer Component ---
  const CodeBlockRenderer = ({ node, inline, className, children, ...props }: any) => {
    const [copyButtonText, setCopyButtonText] = useState('Copy');
    const rawCodeString = String(children);
    const lines = rawCodeString.split('\n');

    let filePathFromComment: string | null = null;
    let actualFilePathForComparison: string | null = null;
    let contentAfterFilePathLine = rawCodeString.replace(/\n$/, '');

    if (lines.length > 0) {
        const firstLine = lines[0].trim();
        const pathPattern = /((?:[\w.-]+\/)*[\w.-]+\.[\w.-]+)/;
        const lenientLineCommentRegex = new RegExp(`^(?://|#|--)\\s*.*?${pathPattern.source}`);
        const lenientCssBlockCommentRegex = new RegExp(`^\\/\\*\\s*.*?${pathPattern.source}.*?\\*\\/`);
        const lenientHtmlCommentRegex = new RegExp(`^<!--\\s*.*?${pathPattern.source}.*?-->`);

        let pathMatch: RegExpMatchArray | null = null;
        pathMatch = firstLine.match(lenientCssBlockCommentRegex) || firstLine.match(lenientHtmlCommentRegex) || firstLine.match(lenientLineCommentRegex);

        if (pathMatch && pathMatch[1]) {
            filePathFromComment = pathMatch[1];
            contentAfterFilePathLine = lines.slice(1).join('\n').replace(/\n$/, '');
        }
    }

    // Path resolution logic remains the same
    if (filePathFromComment && parsedRepomixData?.fileContents) {
        if (parsedRepomixData.fileContents[filePathFromComment]) {
            actualFilePathForComparison = filePathFromComment;
        } else {
            const possibleMatches = Object.keys(parsedRepomixData.fileContents)
                .filter(key => key.endsWith(filePathFromComment!));
            if (possibleMatches.length === 1) {
                actualFilePathForComparison = possibleMatches[0];
            } else if (possibleMatches.length > 1) {
                console.warn(`[CodeBlockRenderer] Ambiguous path: ${filePathFromComment}. Matches: ${possibleMatches.join(', ')}`);
            }
        }
    }

    const canCompareFile = actualFilePathForComparison && parsedRepomixData?.fileContents[actualFilePathForComparison];
    const matchLang = /language-(\w+)/.exec(className || '');
    const pathForLangGuess = actualFilePathForComparison || filePathFromComment;
    const lang = matchLang ? matchLang[1] : (pathForLangGuess?.split('.').pop() || 'plaintext');
    const codeToRenderAndCopy = filePathFromComment ? contentAfterFilePathLine : rawCodeString.replace(/\n$/, '');

    // Apply Tailwind styles for inline and non-standard code
    const isLikelySingleWordBlock = !inline && !matchLang && codeToRenderAndCopy.length > 0 && !codeToRenderAndCopy.includes(' ') && !codeToRenderAndCopy.includes('\n') && !filePathFromComment;
    if (isLikelySingleWordBlock) return <strong className="font-bold" {...props}>{codeToRenderAndCopy}</strong>; // .non-standard-code-highlight
    if (inline) return <code className="bg-[#e8eaed] px-[0.4em] py-[0.1em] rounded-[4px] font-mono text-[0.9em]" {...props}>{children}</code>; // .inline-code

    const handleCopyClick = () => {
      navigator.clipboard.writeText(codeToRenderAndCopy).then(() => {
        setCopyButtonText('Copied!'); setTimeout(() => setCopyButtonText('Copy'), 1500);
      }).catch(err => { setCopyButtonText('Failed'); setTimeout(() => setCopyButtonText('Copy'), 2000); console.error("Copy failed:", err);});
    };

    const displayPath = actualFilePathForComparison || filePathFromComment;
    const languageLabel = <span className="text-[0.8em] text-[#5f6368] font-sans capitalize">{displayPath ? `${displayPath} (${lang})` : lang}</span>; // .code-language-label

    const copyButton = (
        <button
            // .copy-code-button & .copied logic
            className={`px-2 py-[2px] text-[0.75em] font-sans border rounded-[4px] cursor-pointer transition-colors duration-200 ease-in-out ml-[10px]
                       ${copyButtonText !== 'Copy' ? 'bg-[#a5d6a7] text-[#1b5e20] border-[#81c784] hover:bg-[#a5d6a7] hover:text-[#1b5e20]' : 'bg-[#e0e0e0] text-[#333] border-[#ccc] hover:bg-[#d0d0d0] hover:border-[#bbb]'}`}
            onClick={handleCopyClick}
            title="Copy code"
        >
            {copyButtonText}
        </button>
    );

    const compareButton = canCompareFile && actualFilePathForComparison ? (
        <button
            onClick={() => onStartComparison(actualFilePathForComparison, contentAfterFilePathLine)}
            // .compare-button
            className="px-2 py-[2px] text-[0.75em] font-sans text-[#333] bg-[#e0e0e0] border border-[#ccc] rounded-[4px] cursor-pointer transition-colors duration-200 ease-in-out hover:bg-[#d0d0d0] hover:border-[#bbb]"
            title={`Compare changes for ${actualFilePathForComparison}`}
        >
            Compare
        </button>
    ) : null;

    let codeBlockElement: JSX.Element;
    if (highlighter) {
      try {
        const html = highlighter.codeToHtml(codeToRenderAndCopy, { lang, theme: 'material-theme-lighter' });
        // The div wrapping dangerouslySetInnerHTML *must not* have conflicting whitespace/overflow styles
        // Styles are applied by Shikiji's output <pre> tag itself
        codeBlockElement = <div className="!m-0" dangerouslySetInnerHTML={{ __html: html }} />; // Override potential margin
      } catch (err) {
        // Fallback styling with Tailwind
        codeBlockElement = <pre className="m-0 rounded-b-[6px] text-[0.9em] overflow-x-auto p-[10px] leading-[1.4] whitespace-pre bg-[#f8f8f8]"><code>{codeToRenderAndCopy}</code></pre>;
      }
    } else {
      // Fallback styling with Tailwind
      codeBlockElement = <pre className="m-0 rounded-b-[6px] text-[0.9em] overflow-x-auto p-[10px] leading-[1.4] whitespace-pre bg-[#f8f8f8]"><code>{codeToRenderAndCopy}</code></pre>;
    }

    // Shikiji's generated pre tag should have styles matching the old CSS rule:
    // .code-block-wrapper > div[class*="shiki"], .code-block-wrapper > pre[class*="language-"]
    // margin: 0 !important; border-radius: 0 0 6px 6px; font-size: 0.9em !important; overflow-x: auto; padding: 10px !important; line-height: 1.4; white-space: pre; background-color: #f8f8f8;
    // Tailwind classes are applied to the fallback <pre> above.

    return (
      // .code-block-wrapper
      <div className="relative mb-4" {...props}>
        {/* .code-block-header */}
        <div className="flex justify-between items-center px-2 py-[4px] bg-[#f0f0f0] rounded-t-[6px] border-b border-[#e0e0e0]">
          {languageLabel}
          {/* .code-block-actions */}
          <div className="flex items-center gap-2">
            {compareButton}
            {copyButton}
          </div>
        </div>
        {codeBlockElement}
      </div>
    );
  };
  // --- End CodeBlockRenderer Component ---

  return (
    // .chat-interface
    <div className="flex flex-col gap-[15px]">
      {history.map((message, index) => (
        // .chat-message base styles
        <div
          key={index}
          className={`max-w-[80%] px-[15px] py-[10px] rounded-[18px] leading-[1.5] break-words
                     ${message.role === 'user'
                        // .chat-message.user styles
                        ? 'bg-[#e1f5fe] self-end rounded-br-[4px]'
                        // .chat-message.model styles
                        : 'bg-white border border-[#e0e0e0] self-start rounded-bl-[4px]'
                     }`}
        >
          {/* .message-role */}
          <span className="block font-medium text-[0.9em] text-[#5f6368] mb-1">
            {message.role === 'user' ? 'You' : 'Model'}
          </span>
          {/* .message-content base styles */}
          <div className="text-base">
            {message.role === 'model' ? (
              // .message-content p, .message-content br handled by Markdown rendering + CodeBlockRenderer
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ code: CodeBlockRenderer }}
                // Add Tailwind classes for markdown elements if needed (e.g., p margin)
                // className="prose prose-sm max-w-none" // Example using Tailwind typography plugin
              >
                {message.parts[0].text}
              </ReactMarkdown>
            ) : (
              // Render user text with basic line breaks (Tailwind doesn't directly style <br>)
              // This preserves manual line breaks entered by the user.
              message.parts[0].text.split('\n').map((line, i, arr) => (
                <React.Fragment key={i}>
                    {line}
                    {i < arr.length - 1 && <br />} {/* Add <br> except after the last line */}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} style={{ height: '1px' }} /> {/* For scrolling */}
    </div>
  );
};

export default ChatInterface;