// src/layout/AppLayout.tsx
import React from 'react';
import AppHeader, { AppHeaderProps } from '../components/AppHeader'; // Assuming AppHeaderProps is exported or defined here

// Tailwind class constants (assuming these are defined globally or imported)
const appContainerBaseClasses = "flex flex-col h-screen bg-white border border-[#e7eaf3] overflow-hidden";
const appContainerNormalClasses = "w-[80%] mx-auto my-[30px] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.08),_0_1px_3px_rgba(0,0,0,0.05)] h-[calc(100vh_-_60px)]";
const appContainerFullscreenClasses = "w-full max-w-none m-0 border-none rounded-none shadow-none h-screen";


interface AppLayoutProps {
    isFullScreenView: boolean;
    headerProps: Pick<
        AppHeaderProps,
        | 'userHasGeminiKey'
        | 'apiKeyStatusLoading'
        | 'onOpenApiKeyModal'
        | 'userEmail'
        | 'onSignOut'
        | 'showFullScreenToggle'
        | 'isFullScreenView' // This is passed to AppHeader as well
        | 'onToggleFullScreen'
        | 'isToggleFullScreenDisabled'
    >;
    children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ isFullScreenView, headerProps, children }) => {
    const appContainerClasses = `${appContainerBaseClasses} ${isFullScreenView ? appContainerFullscreenClasses : appContainerNormalClasses}`;
    return (
        <div className={appContainerClasses}>
            <AppHeader {...headerProps} />
            {children} {/* This will be ApiKeyModal and MainWorkspaceLayout */}
            <footer className="flex items-center justify-end px-[30px] py-[10px] h-[45px] border-t border-[#e7eaf3] bg-[#f8f9fc] text-xs text-[#7f8c9a] flex-shrink-0">
                Powered by Gemini & Repomix
            </footer>
        </div>
    );
};

export default AppLayout;