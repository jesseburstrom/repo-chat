// FilePath: gemini-repomix-ui/src/ChatInterface.tsx
import React, { useState, useEffect, useRef, JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getHighlighter, bundledLanguages } from 'shikiji';
import type { Highlighter } from 'shikiji';

import { ChatMessage } from './App'; // Assuming ChatMessage is in App.tsx
import { ParsedRepomixData } from './utils/parseRepomix'; // Assuming ParsedRepomixData is here

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

interface CodeBlockRendererPropsFromMarkdown {
  node?: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

interface CustomCodeBlockRendererProps extends CodeBlockRendererPropsFromMarkdown {
  isParentBubbleFullWidth?: boolean;
  highlighter: Highlighter | null;
  parsedRepomixData: ParsedRepomixData | null;
  onStartComparison: (filePath: string, suggestedContent: string) => void;
}


const CodeBlockRenderer: React.FC<CustomCodeBlockRendererProps> = ({
    node,
    inline,
    className,
    children,
    isParentBubbleFullWidth,
    highlighter,
    parsedRepomixData,
    onStartComparison,
    ...rest
}) => {
    const [copyButtonText, setCopyButtonText] = useState('Copy');
    const rawCodeString = String(children).replace(/\n$/, '');
    const lines = rawCodeString.split('\n');

    let filePathFromComment: string | null = null;
    let actualFilePathForComparison: string | null = null;
    let contentAfterFilePathLine = rawCodeString;

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
            contentAfterFilePathLine = lines.slice(1).join('\n');
        }
    }
    
    const codeToRenderAndCopy = filePathFromComment ? contentAfterFilePathLine : rawCodeString;

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
    
    const isLikelySingleWordBlock = !inline && !matchLang && codeToRenderAndCopy.length > 0 && !codeToRenderAndCopy.includes(' ') && !codeToRenderAndCopy.includes('\n') && !filePathFromComment;
    if (isLikelySingleWordBlock) return <strong className="font-bold" {...rest}>{codeToRenderAndCopy}</strong>;
    if (inline) return <code className="bg-[#e8eaed] px-[0.4em] py-[0.1em] rounded-[4px] font-mono text-[0.9em]" {...rest}>{children}</code>;

    const handleCopyClick = () => {
      navigator.clipboard.writeText(codeToRenderAndCopy).then(() => {
        setCopyButtonText('Copied!'); setTimeout(() => setCopyButtonText('Copy'), 1500);
      }).catch(err => { setCopyButtonText('Failed'); setTimeout(() => setCopyButtonText('Copy'), 2000); console.error("Copy failed:", err);});
    };

    const displayPath = actualFilePathForComparison || filePathFromComment;
    const languageLabel = <span className="text-[0.8em] text-[#5f6368] font-sans capitalize">{displayPath ? `${displayPath} (${lang})` : lang}</span>;

    const copyButton = (
        <button
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
        codeBlockElement = <div className="!m-0" dangerouslySetInnerHTML={{ __html: html }} />;
      } catch (err) {
        codeBlockElement = <pre className="m-0 rounded-b-[6px] text-[0.9em] overflow-x-auto p-[10px] leading-[1.4] whitespace-pre bg-[#f8f8f8]"><code>{codeToRenderAndCopy}</code></pre>;
      }
    } else {
      codeBlockElement = <pre className="m-0 rounded-b-[6px] text-[0.9em] overflow-x-auto p-[10px] leading-[1.4] whitespace-pre bg-[#f8f8f8]"><code>{codeToRenderAndCopy}</code></pre>;
    }

    // Add mt-2 for space above. Keep mb-4 for space below, even in full-width.
    // If full-width, use negative horizontal margins.
    const wrapperClasses = `relative w-full mt-2 ${isParentBubbleFullWidth ? 'mx-[-15px] mb-2' : 'mb-4'}`;
    // Note: If this is the *very last* element in the bubble, the bubble's own py-[10px] or py-[15px] will provide bottom padding.
    // The mb-2 here ensures space if more text follows *after* this code block within the same bubble.

    return (
      <div className={wrapperClasses}>
        <div className="flex justify-between items-center px-2 py-[4px] bg-[#f0f0f0] rounded-t-[6px] border-b border-[#e0e0e0]">
          {languageLabel}
          <div className="flex items-center gap-2">
            {compareButton}
            {copyButton}
          </div>
        </div>
        {codeBlockElement}
      </div>
    );
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

  return (
    <div className="flex flex-col gap-[15px]"> {/* .chat-interface */}
      {history.map((message, index) => {
        const isModelMessage = message.role === 'model';
        const messageText = message.parts[0].text;
        
        const containsCodeBlock = isModelMessage && messageText.includes('```');

        // Adjusted vertical padding for bubbles containing code blocks for more whitespace
        const bubbleVerticalPadding = containsCodeBlock ? 'py-[15px]' : 'py-[10px]';
        const bubbleBaseClasses = `px-[15px] ${bubbleVerticalPadding} rounded-[18px] leading-[1.5] break-words`;
        
        const userBubbleClasses = `bg-[#e1f5fe] self-end rounded-br-[4px] max-w-[80%]`;
        const modelBubbleBaseClasses = `bg-white border border-[#e0e0e0] self-start rounded-bl-[4px]`;
        const modelTextBubbleClasses = `max-w-[80%]`;
        const modelCodeContainingBubbleClasses = `w-full`;

        const markdownContainerClass = containsCodeBlock ? "markdown-full-width" : "";

        return (
          <div
            key={index}
            className={`${bubbleBaseClasses} 
                       ${isModelMessage
                          ? `${modelBubbleBaseClasses} ${containsCodeBlock ? modelCodeContainingBubbleClasses : modelTextBubbleClasses}`
                          : userBubbleClasses
                       }`}
          >
            <span className="block font-medium text-[0.9em] text-[#5f6368] mb-1">
              {message.role === 'user' ? 'You' : 'Model'}
            </span>
            <div className={`text-base message-content-wrapper ${markdownContainerClass}`}>
              {isModelMessage ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: (props: CodeBlockRendererPropsFromMarkdown) => (
                        <CodeBlockRenderer
                            {...props}
                            isParentBubbleFullWidth={containsCodeBlock} 
                            highlighter={highlighter}
                            parsedRepomixData={parsedRepomixData}
                            onStartComparison={onStartComparison}
                        />
                    ),
                  }}
                >
                  {messageText}
                </ReactMarkdown>
              ) : (
                messageText.split('\n').map((line, i, arr) => (
                  <React.Fragment key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                  </React.Fragment>
                ))
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} style={{ height: '1px' }} /> {/* For scrolling */}
    </div>
  );
};

export default ChatInterface;