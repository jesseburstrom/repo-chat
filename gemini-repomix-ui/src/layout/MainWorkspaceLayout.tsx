// src/layout/MainWorkspaceLayout.tsx
import React from 'react';

// Tailwind class constants (assuming these are defined globally or imported)
const mainContentWrapperBaseClasses = "flex flex-row flex-grow overflow-hidden";
const fileTreeFullscreenClasses = "w-[22%] max-w-[450px] h-full flex-shrink-0";
const fileContentPanelFullscreenClasses = "flex-1 h-full overflow-hidden border-l border-[#e7eaf3]";
const comparisonPanelForComparisonViewClasses = "flex-[2_1_0%] h-full overflow-hidden";
// Note: centralPanelComponent will manage its own internal classes for the center column

interface MainWorkspaceLayoutProps {
    //isFullScreenView: boolean;
    isComparisonView: boolean;
    showFileTree: boolean;
    fileTreeComponent: React.ReactNode | null; // Can be null if not shown
    centralPanelComponent: React.ReactNode;
    fileDisplayComponent: React.ReactNode | null; // Can be null if not shown
    mainContentWrapperHeightClass: string;
}

const MainWorkspaceLayout: React.FC<MainWorkspaceLayoutProps> = ({
    //isFullScreenView,
    isComparisonView,
    showFileTree,
    fileTreeComponent,
    centralPanelComponent,
    fileDisplayComponent,
    mainContentWrapperHeightClass,
}) => {
    const fileTreeContainerClasses = showFileTree ? fileTreeFullscreenClasses : "";
    const fileDisplayContainerClasses = fileDisplayComponent
        ? (isComparisonView ? comparisonPanelForComparisonViewClasses : fileContentPanelFullscreenClasses)
        : "";

    return (
        <div className={`${mainContentWrapperBaseClasses} ${mainContentWrapperHeightClass}`}>
            {showFileTree && fileTreeComponent && (
                <div className={fileTreeContainerClasses}>{fileTreeComponent}</div>
            )}
            {centralPanelComponent} {/* CentralInteractionPanel will define its own outer div and classes */}
            {fileDisplayComponent && (
                <div className={fileDisplayContainerClasses}>{fileDisplayComponent}</div>
            )}
        </div>
    );
};

export default MainWorkspaceLayout;