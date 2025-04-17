# Gemini Repomix Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- Add other relevant badges: build status, coverage, etc. -->

A web application that leverages Google's Gemini Pro API and the `repomix` tool to enable conversational interactions with the content of GitHub repositories. Generate a concise representation of a codebase and then chat with Gemini to understand, analyze, or query it.

---

## Table of Contents

*   [Features](#features)
*   [Architecture](#architecture)
    *   [High-Level Overview](#high-level-overview)
    *   [Repomix Generation Flow](#repomix-generation-flow)
    *   [Chat Interaction Flow](#chat-interaction-flow)
*   [Prerequisites](#prerequisites)
*   [Setup](#setup)
    *   [Backend](#backend)
    *   [Frontend](#frontend)
*   [Running the Application](#running-the-application)
    *   [Backend Server](#backend-server)
    *   [Frontend Dev Server](#frontend-dev-server)
*   [Usage](#usage)
*   [Environment Variables](#environment-variables)
*   [Technology Stack](#technology-stack)
*   [Contributing](#contributing)
*   [License](#license)

---

## Features

*   **Repository Description Generation:** Enter a GitHub repository URL to generate a packed description file using `repomix`.
*   **Customizable Filtering:** Specify include/exclude file patterns for `repomix` generation.
*   **Description File Management:**
    *   Lists previously generated repository description files.
    *   Allows selecting a generated file to load its content.
    *   Automatically loads newly generated files.
*   **Context-Aware Chat:** Interact with Google's Gemini Pro API. The content of the selected/generated repository description file is automatically included as context in the conversation.
*   **Chat History:** Maintains conversation history within a session (limited turns sent to API for efficiency).
*   **Markdown & Syntax Highlighting:** Renders model responses with Markdown formatting and syntax highlighting for code blocks using Shikiji.
*   **Responsive UI:** Clean interface built with React and TypeScript.
*   **Clear Backend/Frontend Separation:** Node.js/Express backend handles API calls and `repomix` execution, while the React frontend manages the user interface.
*   **Auto-Resizing Input:** Chat input area expands automatically for multi-line messages.

---

## Architecture

The application consists of a React frontend and a Node.js backend.

### High-Level Overview

```mermaid
graph TD
    User["<fa:fa-user> User"] --> UI;
    UI{"<fa:fa-window-maximize> React Frontend (Vite)"} -- HTTP API Request /api/... --> Backend;
    Backend{"<fa:fa-server> Node.js Backend (Express)"} -- Run Command --> Repomix;
    Repomix("npx repomix") -- Writes File --> FileSystem["<fa:fa-file-alt> generated_files/*.md"];
    Backend -- Reads File --> FileSystem;
    Backend -- API Call --> GeminiAPI["<fa:fa-brain> Google Gemini API"];
    GeminiAPI -- Response --> Backend;
    Backend -- HTTP Response --> UI;
    UI -- Displays Info --> User;

    style UI fill:#f9f,stroke:#333,stroke-width:2px;
    style Backend fill:#ccf,stroke:#333,stroke-width:2px;
    style Repomix fill:#f8d7da,stroke:#721c24
    style FileSystem fill:#fff3cd,stroke:#856404
    style GeminiAPI fill:#d4edda,stroke:#155724
```
```mermaid
sequenceDiagram
    participant User
    participant UI (React)
    participant Backend (Express)
    participant Repomix (CLI via npx)
    participant FileSystem

    User->>UI: Enters GitHub Repo URL & Clicks Generate
    UI->>Backend: POST /api/run-repomix (repoUrl, include, exclude)
    Backend->>Repomix: Executes `npx repomix --remote <url> --output <path> ...`
    Repomix->>FileSystem: Clones repo (temp), processes files, writes `full_description_user_repo.md`
    Repomix-->>Backend: Command finishes (stdout/stderr)
    alt Command Successful
        Backend->>UI: Response { success: true, outputFilename: "..." }
        UI->>Backend: GET /api/list-generated-files (Refreshes list)
        Backend->>FileSystem: Reads directory listing
        FileSystem-->>Backend: List of files
        Backend-->>UI: Response { success: true, data: [...] }
        UI->>Backend: GET /api/get-file-content/<outputFilename> (Auto-loads)
        Backend->>FileSystem: Reads content of <outputFilename>
        FileSystem-->>Backend: File Content
        Backend-->>UI: Response { success: true, content: "..." }
        UI->>User: Shows success message, updates dropdown, attaches content
    else Command Fails
        Backend->>UI: Response { success: false, error: "..." }
        UI->>User: Shows error message
    end
```
```mermaid
sequenceDiagram
    participant User
    participant UI (React)
    participant Backend (Express)
    participant GeminiAPI

    User->>UI: Selects generated file (or keeps loaded one)
    User->>UI: Types prompt & Clicks Send (or Enter)
    UI->>UI: Combines Attached File Content + User Prompt
    UI->>Backend: POST /api/call-gemini (history, combinedPrompt)
    Backend->>GeminiAPI: Sends chat history + new combined message
    GeminiAPI-->>Backend: Receives model response text
    Backend->>UI: Response { success: true, text: "..." }
    UI->>UI: Clears attached file state
    UI->>UI: Renders model response (with Markdown/Syntax Highlighting)
    UI->>User: Displays model response
```
