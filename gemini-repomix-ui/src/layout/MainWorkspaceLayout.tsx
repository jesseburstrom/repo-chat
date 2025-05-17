// src/layout/MainWorkspaceLayout.tsx
import React from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

// Tailwind class constants (assuming these are defined globally or imported)
const mainContentWrapperBaseClasses = "flex flex-row flex-grow overflow-hidden";
// These specific fullscreen width classes for children are no longer needed
// as react-resizable-panels will manage the widths.
// const fileTreeFullscreenClasses = "w-[22%] max-w-[450px] h-full flex-shrink-0";
// const fileContentPanelFullscreenClasses = "flex-1 h-full overflow-hidden border-l border-[#e7eaf3]";
// const comparisonPanelForComparisonViewClasses = "flex-[2_1_0%] h-full overflow-hidden";

interface MainWorkspaceLayoutProps {
  isFullScreenView: boolean; // <-- ADDED: To control resizable layout
  isComparisonView: boolean;
  // showFileTree: boolean; // Can be derived from fileTreeComponent !== null
  fileTreeComponent: React.ReactNode | null;
  centralPanelComponent: React.ReactNode;
  fileDisplayComponent: React.ReactNode | null;
  mainContentWrapperHeightClass: string;
}

// Style for the resize handle (you can customize this further)
const resizeHandleClassName =
  "w-1.5 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 cursor-col-resize transition-colors duration-100 ease-out flex items-center justify-center";
const resizeHandleInnerDotStyle =
  "w-1 h-1 bg-gray-500 rounded-full mx-auto my-1"; // For a small dot indicator

const MainWorkspaceLayout: React.FC<MainWorkspaceLayoutProps> = ({
  isFullScreenView,
  isComparisonView,
  fileTreeComponent,
  centralPanelComponent,
  fileDisplayComponent,
  mainContentWrapperHeightClass,
}) => {
  const commonWrapperClasses = `${mainContentWrapperBaseClasses} ${mainContentWrapperHeightClass}`;

  // If not in full screen mode, use a simpler layout (or your existing non-fullscreen logic)
  if (!isFullScreenView) {
    return (
      <div className={commonWrapperClasses}>
        {/* Assuming centralPanelComponent takes up available space in non-fullscreen */}
        {centralPanelComponent}
      </div>
    );
  }

  // Full Screen Mode with Resizable Panels
  if (isComparisonView) {
    // 2-panel layout: Central Interaction and Comparison Display
    return (
      <div className={commonWrapperClasses}>
        <PanelGroup direction="horizontal">
          <Panel defaultSize={50} minSize={20} order={1}>
            {/* Ensure centralPanelComponent fills the Panel */}
            {centralPanelComponent}
          </Panel>
          <PanelResizeHandle className={resizeHandleClassName}>
            {/* Optional: add visual dots or lines inside the handle */}
            <div>
              <div className={resizeHandleInnerDotStyle}></div>
              <div className={resizeHandleInnerDotStyle}></div>
              <div className={resizeHandleInnerDotStyle}></div>
            </div>
          </PanelResizeHandle>
          <Panel defaultSize={50} minSize={20} order={2}>
            {/* Ensure fileDisplayComponent (comparison) fills the Panel */}
            {fileDisplayComponent}
          </Panel>
        </PanelGroup>
      </div>
    );
  } else {
    // Regular full screen view (not comparison)
    // Determine the layout based on which components are present
    const showFileTree = !!fileTreeComponent;
    const showFileDisplay = !!fileDisplayComponent;

    if (showFileTree && showFileDisplay) {
      // 3-panel layout: FileTree, Central, FileDisplay
      return (
        <div className={commonWrapperClasses}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={10} order={1}>
              {fileTreeComponent}
            </Panel>
            <PanelResizeHandle className={resizeHandleClassName}>
              <div>
                <div className={resizeHandleInnerDotStyle}></div>
                <div className={resizeHandleInnerDotStyle}></div>
                <div className={resizeHandleInnerDotStyle}></div>
              </div>
            </PanelResizeHandle>
            <Panel defaultSize={50} minSize={30} order={2}>
              {centralPanelComponent}
            </Panel>
            <PanelResizeHandle className={resizeHandleClassName}>
              <div>
                <div className={resizeHandleInnerDotStyle}></div>
                <div className={resizeHandleInnerDotStyle}></div>
                <div className={resizeHandleInnerDotStyle}></div>
              </div>
            </PanelResizeHandle>
            <Panel defaultSize={30} minSize={10} order={3}>
              {fileDisplayComponent}
            </Panel>
          </PanelGroup>
        </div>
      );
    } else if (showFileTree) {
      // 2-panel layout: FileTree, Central
      return (
        <div className={commonWrapperClasses}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={25} minSize={10} order={1}>
              {fileTreeComponent}
            </Panel>
            <PanelResizeHandle className={resizeHandleClassName}>
              <div>
                <div className={resizeHandleInnerDotStyle}></div>
                <div className={resizeHandleInnerDotStyle}></div>
                <div className={resizeHandleInnerDotStyle}></div>
              </div>
            </PanelResizeHandle>
            <Panel defaultSize={75} minSize={30} order={2}>
              {centralPanelComponent}
            </Panel>
          </PanelGroup>
        </div>
      );
    } else if (showFileDisplay) {
      // 2-panel layout: Central, FileDisplay
      return (
        <div className={commonWrapperClasses}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={60} minSize={30} order={1}>
              {centralPanelComponent}
            </Panel>
            <PanelResizeHandle className={resizeHandleClassName}>
              <div>
                <div className={resizeHandleInnerDotStyle}></div>
                <div className={resizeHandleInnerDotStyle}></div>
                <div className={resizeHandleInnerDotStyle}></div>
              </div>
            </PanelResizeHandle>
            <Panel defaultSize={40} minSize={10} order={2}>
              {fileDisplayComponent}
            </Panel>
          </PanelGroup>
        </div>
      );
    } else {
      // Only Central Panel
      return (
        <div className={commonWrapperClasses}>{centralPanelComponent}</div>
      );
    }
  }
};

export default MainWorkspaceLayout;
