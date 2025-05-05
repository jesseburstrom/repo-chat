# Gemini Repomix Assistant

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
### Repomix Generation Flow (Simplified)
```mermaid
sequenceDiagram
    participant User
    participant UI (React)
    participant Backend (Express)
    participant Repomix

    User->>UI: Request Repo Generation
    UI->>Backend: Trigger Repomix run
    Backend->>Repomix: Execute command
    Repomix-->>Backend: Command Complete (Success/Fail)
    Backend-->>UI: Generation Result (Filename or Error)
    UI->>User: Display Status (Success/Error + Load File)
```
### Chat Interaction Flow (Simplified)
```mermaid
sequenceDiagram
    participant User
    participant UI (React)
    participant Backend (Express)
    participant GeminiAPI

    User->>UI: Send Prompt (+ Attached Context)
    UI->>Backend: Forward Prompt + Context
    Backend->>GeminiAPI: Call API with Message
    GeminiAPI-->>Backend: API Response Text
    Backend-->>UI: Return Response Text
    UI->>User: Display Model Response
```
### Repomix Generation Flow
```mermaid
sequenceDiagram
    participant User
    participant UI (React)
    participant Backend (Express)
    participant Repomix (CLI via npx)
    participant FileSystem

    User->>UI: Enters GitHub Repo URL & Clicks Generate
    UI->>Backend: POST /api/run-repomix (repoUrl, include, exclude)
    Backend->>Repomix: Executes `npx repomix ... --output temp_file.md`
    Note over Repomix, Backend: Repomix clones repo, processes files, writes temp file, outputs summary to stdout.
    Repomix-->>Backend: Command finishes (stdout/stderr)

    alt Command Successful
        Backend->>Backend: Extracts & cleans summary from stdout
        Backend->>FileSystem: Writes cleaned `user_repo_pack_summary.txt`
        Backend->>FileSystem: Renames `temp_file.md` to `user_repo.md`
        Backend->>UI: Response { success: true, outputFilename: "user_repo.md", message: "..." }

        UI->>Backend: GET /api/list-generated-files (Refreshes list)
        Backend-->>UI: Response { success: true, data: [... only .md files] }

        UI->>Backend: GET /api/get-file-content/user_repo.md (Auto-loads main file)
        Backend-->>FileSystem: Read `user_repo.md`
        FileSystem-->>Backend: File Content
        Backend-->>UI: Response { success: true, content: "..." }
        UI->>User: Shows success message, updates dropdown, attaches .md content
    else Command Fails
        Backend->>UI: Response { success: false, error: "..." }
        UI->>User: Shows error message
    end
```
### Chat Interaction Flow
```mermaid
sequenceDiagram
    participant User
    participant UI (React)
    participant Backend (Express)
    participant GeminiAPI

    User->>UI: Selects generated file (or keeps loaded one)
    User->>UI: Types prompt & Clicks Send (or Enter)
    UI->>UI: Combines Attached .md File Content + User Prompt
    UI->>Backend: POST /api/call-gemini (history, combinedPrompt)
    Backend->>GeminiAPI: Sends chat history + new combined message
    GeminiAPI-->>Backend: Receives model response text
    Backend->>UI: Response { success: true, text: "..." }
    UI->>UI: Clears attached file state
    UI->>UI: Renders model response (Markdown/Syntax Highlighting)
    UI->>User: Displays model response (Chat auto-scrolls)
```
## Prerequisites

*   **Node.js:** LTS version recommended (e.g., v18 or v20+). Includes `npm`.
*   **Git:** Required by `repomix` to clone repositories.
*   **Google Gemini API Key:** Obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

---

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  **Backend Setup:**
    ```bash
    cd backend
    npm install # or yarn install
    ```
    *   Create a `.env` file in the `backend` directory:
        ```bash
        touch .env
        ```
    *   Add your Google Gemini API key to the `.env` file:
        ```env
        # backend/.env
        GEMINI_API_KEY=YOUR_API_KEY_HERE
        ```

3.  **Frontend Setup:**
    ```bash
    cd ../gemini-repomix-ui
    npm install # or yarn install
    ```

---

## Running the Application

You need to run both the backend and frontend servers concurrently.

### Backend Server

```bash
cd backend
npm run start # Check package.json for the exact start script (e.g., could be 'dev' if using ts-node-dev)
```

The backend server will typically start on `http://localhost:8003`. Generated description files will be stored in `backend/generated_files`.

### Frontend Dev Server

```bash
cd gemini-repomix-ui
npm run dev
```

The frontend development server (Vite) will start, usually on `http://localhost:5173`.

**Access the application** in your browser at the URL provided by the Vite server, likely `http://localhost:5173/repochat/` (Note the `/repochat/` base path defined in `vite.config.ts`).

The Vite dev server is configured to proxy requests starting with `/api` to the backend server running on port 8003.

---

## Usage

1.  **Start both** the backend and frontend servers as described above.
2.  **Open the application** in your web browser (e.g., `http://localhost:5173/repochat/`).
3.  **Generate a Description:**
    *   Enter the full URL of a public GitHub repository (e.g., `https://github.com/user/repo.git`).
    *   (Optional) Adjust the include/exclude patterns. Defaults target common code files and exclude logs/temp files.
    *   Click "Generate Description File".
    *   Wait for the process to complete. The backend runs `repomix`, which clones the repo and creates the `.md` file.
    *   Upon successful generation, the file will be automatically selected and its content loaded into the chat context.
4.  **Or Load an Existing Description:**
    *   If descriptions have been generated previously, use the "Load Generated Description" dropdown to select one.
    *   The content of the selected file will be loaded into the chat context.
5.  **Chat with Gemini:**
    *   The loaded description file's name will appear below the input area.
    *   Type your question or prompt about the repository code (e.g., "Explain the purpose of the main function in server.ts", "Summarize the UI components", "What state management is used?").
    *   Press Enter or click "Send".
    *   The frontend sends your prompt *along with the content of the loaded description file* to the backend, which forwards it to the Gemini API.
    *   View the model's response in the chat interface. The loaded file context is cleared after a successful response, ready for the next interaction (which might use the same file if selected again or a different one).

---

## Environment Variables

*   `GEMINI_API_KEY` (Required): Your API key for accessing the Google Gemini API. Place this in the `backend/.env` file.

---

## Technology Stack

*   **Backend:** Node.js, Express, TypeScript
*   **Frontend:** React, Vite, TypeScript, CSS
*   **API:** Google Gemini Pro
*   **Code Processing:** Repomix
*   **Syntax Highlighting:** Shikiji

---

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

*(Optional: Add more specific contribution guidelines if needed - e.g., coding style, testing requirements)*


```

