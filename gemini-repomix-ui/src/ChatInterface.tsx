// FilePath: gemini-repomix-ui/src/ChatInterface.tsx
import React, { useState, useEffect, useRef, JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHighlighter, bundledLanguages } from 'shikiji';
import type { Highlighter } from 'shikiji';

import { ChatMessage } from './App'; // Assuming ChatMessage is in App.tsx
import { ParsedRepomixData } from './utils/parseRepomix'; // Assuming ParsedRepomixData is here
import './ChatInterface.css';

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

// --- CORRECTED Props Interface ---
interface ChatInterfaceProps {
  history: ChatMessage[];
  parsedRepomixData: ParsedRepomixData | null;
  onStartComparison: (filePath: string, suggestedContent: string) => void;
}
// --- End Corrected Props ---

const ChatInterface: React.FC<ChatInterfaceProps> = ({ history, parsedRepomixData, onStartComparison }) => {
  const highlighter = useShikijiHighlighter();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (history.length > 0) {
      const lastMessage = history[history.length - 1];
      const scrollableArea = bottomRef.current?.closest('.scrollable-content-area');
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

  const CodeBlockRenderer = ({ node, inline, className, children, ...props }: any) => {
    const [copyButtonText, setCopyButtonText] = useState('Copy');
    const rawCodeString = String(children);
    const lines = rawCodeString.split('\n');

    let filePathFromComment: string | null = null; // Path extracted from the comment
    let actualFilePathForComparison: string | null = null; // Path to use for comparison (potentially resolved full path)
    let contentAfterFilePathLine = rawCodeString.replace(/\n$/, '');

    if (lines.length > 0) {
        const firstLine = lines[0].trim();
        // console.log("[CodeBlockRenderer] Raw first line of code block:", `'${firstLine}'`);

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
        // console.log("[CodeBlockRenderer] Extracted filePathFromComment (lenient):", filePathFromComment);
    }

    // --- Attempt to resolve partial path to full path ---
    if (filePathFromComment && parsedRepomixData?.fileContents) {
        if (parsedRepomixData.fileContents[filePathFromComment]) {
            actualFilePathForComparison = filePathFromComment; // Direct match (full path was provided)
        } else {
            // Try to find a key in fileContents that ENDS WITH the filePathFromComment
            const possibleMatches = Object.keys(parsedRepomixData.fileContents)
                .filter(key => key.endsWith(filePathFromComment!)); // filePathFromComment is not null here

            if (possibleMatches.length === 1) {
                actualFilePathForComparison = possibleMatches[0]; // Unique suffix match found
                console.log(`[CodeBlockRenderer] Partial path "${filePathFromComment}" resolved to full path "${actualFilePathForComparison}" for comparison.`);
            } else if (possibleMatches.length > 1) {
                console.warn(`[CodeBlockRenderer] Partial path "${filePathFromComment}" is ambiguous. Found multiple matches: ${possibleMatches.join(', ')}. Comparison disabled.`);
            } else {
                // console.log(`[CodeBlockRenderer] Partial path "${filePathFromComment}" not found as a full path or unique suffix in parsedRepomixData.`);
            }
        }
    }
    // --- End Path Resolution ---

    const canCompareFile = actualFilePathForComparison && parsedRepomixData?.fileContents[actualFilePathForComparison];
    // console.log(`[CodeBlockRenderer] canCompareFile: ${canCompareFile} (resolved path for comparison: "${actualFilePathForComparison}")`);

    const matchLang = /language-(\w+)/.exec(className || '');
    // Use actualFilePathForComparison if available for better language guessing from full path, else fallback
    const pathForLangGuess = actualFilePathForComparison || filePathFromComment;
    const lang = matchLang ? matchLang[1] : (pathForLangGuess?.split('.').pop() || 'plaintext');
    
    // Decision to strip first line is based on whether *any* path was parsed from comment
    const codeToRenderAndCopy = filePathFromComment ? contentAfterFilePathLine : rawCodeString.replace(/\n$/, '');

    const isLikelySingleWordBlock = !inline && !matchLang && codeToRenderAndCopy.length > 0 && !codeToRenderAndCopy.includes(' ') && !codeToRenderAndCopy.includes('\n') && !filePathFromComment;
    if (isLikelySingleWordBlock) return <strong className="non-standard-code-highlight" {...props}>{codeToRenderAndCopy}</strong>;
    if (inline) return <code className="inline-code" {...props}>{children}</code>;

    const handleCopyClick = () => {
      navigator.clipboard.writeText(codeToRenderAndCopy).then(() => {
        setCopyButtonText('Copied!'); setTimeout(() => setCopyButtonText('Copy'), 1500);
      }).catch(err => { setCopyButtonText('Failed'); setTimeout(() => setCopyButtonText('Copy'), 2000); console.error("Copy failed:", err);});
    };

    // Display path: prefer resolved full path if available, else the path from comment
    const displayPath = actualFilePathForComparison || filePathFromComment;
    const languageLabel = <span className="code-language-label">{displayPath ? `${displayPath} (${lang})` : lang}</span>;
    const copyButton = <button className={`copy-code-button ${copyButtonText !== 'Copy' ? 'copied' : ''}`} onClick={handleCopyClick} title="Copy code"> {copyButtonText} </button>;
    
    const compareButton = canCompareFile && actualFilePathForComparison ? ( // Guard with actualFilePathForComparison
        <button
            onClick={() => onStartComparison(actualFilePathForComparison, contentAfterFilePathLine)} // Use actualFilePathForComparison
            className="compare-button"
            title={`Compare changes for ${actualFilePathForComparison}`} // Use actualFilePathForComparison
        >
            Compare
        </button>
    ) : null;

    let codeBlockElement: JSX.Element;
    if (highlighter) {
      try {
        const html = highlighter.codeToHtml(codeToRenderAndCopy, { lang, theme: 'material-theme-lighter' });
        codeBlockElement = <div dangerouslySetInnerHTML={{ __html: html }} />;
      } catch (err) {
        // console.warn(`[CodeBlockRenderer] Shikiji failed for lang "${lang}", path "${displayPath}":`, err);
        codeBlockElement = <pre><code>{codeToRenderAndCopy}</code></pre>;
      }
    } else {
      codeBlockElement = <pre><code>{codeToRenderAndCopy}</code></pre>;
    }

    return (
      <div className="code-block-wrapper" {...props}>
        <div className="code-block-header">
          {languageLabel}
          <div className="code-block-actions">
            {compareButton}
            {copyButton}
          </div>
        </div>
        {codeBlockElement}
      </div>
    );
  };

  return (
    <div className="chat-interface">
      {history.map((message, index) => (
        <div key={index} className={`chat-message ${message.role}`}>
          <span className="message-role">{message.role === 'user' ? 'You' : 'Model'}</span>
          <div className="message-content">
            {message.role === 'model' ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlockRenderer }}>
                {message.parts[0].text}
              </ReactMarkdown>
            ) : (
              message.parts[0].text.split('\n').map((line, i) => <React.Fragment key={i}>{line}<br /></React.Fragment>)
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} style={{ height: '1px' }} />
    </div>
  );
};

export default ChatInterface;