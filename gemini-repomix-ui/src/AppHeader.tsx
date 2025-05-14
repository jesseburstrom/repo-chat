// gemini-repomix-ui/src/AppHeader.tsx
import React from 'react';

interface AppHeaderProps {
    userHasGeminiKey: boolean | null;
    apiKeyStatusLoading: boolean;
    onOpenApiKeyModal: () => void;
    userEmail: string | undefined;
    onSignOut: () => Promise<void>;
    showFullScreenToggle: boolean;
    isFullScreenView: boolean;
    onToggleFullScreen: () => void;
    isToggleFullScreenDisabled: boolean;
}

const headerActionButtonBaseClasses = "px-3 py-[6px] text-sm rounded-md cursor-pointer border border-[#d9dce3] bg-[#f0f2f5] text-[#333] transition-colors duration-200 ease-in-out leading-snug hover:enabled:bg-[#e7eaf3] hover:enabled:border-[#c8cdd8] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap";

const AppHeader: React.FC<AppHeaderProps> = ({
    userHasGeminiKey,
    apiKeyStatusLoading,
    onOpenApiKeyModal,
    userEmail,
    onSignOut,
    showFullScreenToggle,
    isFullScreenView,
    onToggleFullScreen,
    isToggleFullScreenDisabled,
}) => {
    return (
        <header className="flex items-center justify-between px-[30px] h-[70px] border-b border-[#e7eaf3] bg-white flex-shrink-0">
            <h1 className="text-2xl font-semibold text-[#2c3e50] m-0">
                Gemini Repomix Assistant
            </h1>
            <div className="flex items-center gap-[15px]">
                {userHasGeminiKey === false && !apiKeyStatusLoading && (
                    <button
                        onClick={onOpenApiKeyModal}
                        className={`${headerActionButtonBaseClasses} bg-[#fff3cd] text-[#664d03] border-[#ffecb5] hover:enabled:bg-[#ffeeba] hover:enabled:border-[#ffda6a]`}
                        title="Set your Gemini API Key"
                    >
                        ⚠️ Set API Key
                    </button>
                )}
                {userEmail && (
                    <span className="text-sm text-[#5a6e87] whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={userEmail}>
                        {userEmail}
                    </span>
                )}
                {userEmail && ( // Assuming if email exists, user exists for sign out
                    <button onClick={onSignOut} className={`${headerActionButtonBaseClasses} text-[#e74c3c] bg-transparent border-[#f5b7b1] hover:enabled:bg-[#fdedec] hover:enabled:text-[#cb4335] hover:enabled:border-[#f1948a]`}>
                        Logout
                    </button>
                )}
                {showFullScreenToggle && (
                    <button
                        onClick={onToggleFullScreen}
                        className={headerActionButtonBaseClasses}
                        title={isFullScreenView ? "Exit Full Screen View" : "Expand File View"}
                        disabled={isToggleFullScreenDisabled}
                    >
                        {isFullScreenView ? '📰 Collapse' : '↔️ Expand'}
                    </button>
                )}
            </div>
        </header>
    );
};

export default AppHeader;