Model
Okay, here is a professional 
README.md
 tailored for your 
RepoChat
 project, incorporating details gleaned from the provided code structure and functionality. It includes setup, usage, features, and a Mermaid diagram illustrating the architecture.


# RepoChat: Gemini-Powered Codebase Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- Replace with your actual license -->
<!-- Add other badges as needed: build status, code coverage, etc. -->
<!-- ![Build Status](YOUR_BADGE_URL) -->

**Chat with your codebase! RepoChat uses Repomix to package your Git repository's code and Google's Gemini AI to answer questions about it.**

This tool provides a web interface to:
1.  Generate a combined Markdown representation of a target GitHub repository using `repomix`.
2.  Load previously generated repository descriptions.
3.  Engage in a chat conversation with Google's Gemini Pro model, automatically providing the selected repository's code as context for analysis, explanation, or refactoring suggestions.

![RepoChat Screenshot](<!-- TODO: Add a screenshot of the main UI -->)
*Fig 1: Main RepoChat Interface (Replace with actual screenshot)*

---

## Features

*   **Remote Repository Processing:** Input any public GitHub repository URL.
*   **Repomix Integration:** Automatically runs `repomix` on the backend to gather and format code files into a single Markdown file.
    *   Configurable include/exclude patterns.
    *   Saves both the main packed file (`.md`) and a cleaned execution summary (`.txt`).
*   **Repository Description Management:**
    *   Lists previously generated repository description files.
    *   Allows selecting and loading descriptions for analysis.
*   **Context-Aware AI Chat:**
    *   Uses Google Gemini Pro via its API.
    *   Automatically prepends the content of the selected repository description file to your prompts.
    *   Maintains chat history (limited turns).
*   **Web-Based UI:** Clean interface built with React, TypeScript, and Vite.
*   **Syntax Highlighting:** Renders code blocks within the chat using Shikiji for readability.
*   **Responsive Design:** Basic responsive layout for usability.

---

## Architecture

RepoChat consists of two main components: a React frontend and a Node.js/Express backend API.

1.  **Frontend (`gemini-repomix-ui`):**
    *   Built with Vite, React, and TypeScript.
    *   Provides the user interface for entering repository URLs, selecting generated files, and chatting.
    *   Makes API calls to the backend for generating descriptions, listing files, fetching file content, and interacting with the Gemini API proxy.
    *   Uses `shikiji` for client-side syntax highlighting in chat responses.

2.  **Backend (`backend`):**
    *   Built with Node.js, Express, and TypeScript.
    *   **`/run-repomix`:** Receives a repo URL, executes the `npx repomix` command, saves the output Markdown file and summary text file to the `generated_files` directory.
    *   **`/list-generated-files`:** Reads the `generated_files` directory and returns a list of available repository description files (`.md` only).
    *   **`/get-file-content/:filename`:** Reads and returns the content of a specified generated file (`.md` or `.txt`), with basic path traversal protection.
    *   **`/call-gemini`:** Acts as a secure proxy to the Google Gemini API. It receives the chat history and the new user prompt (prepended with repository context by the frontend), forwards it to the Gemini API using the server's API key, and returns the response.
    *   Requires a `GEMINI_API_KEY` environment variable.

### Interaction Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend (React UI)
    participant Backend (Node.js API)
    participant Repomix (CLI)
    participant FileSystem
    participant Gemini API

    User->>Frontend (React UI): Enters GitHub Repo URL & Clicks Generate
    Frontend (React UI)->>Backend (Node.js API): POST /api/run-repomix (repoUrl, patterns)
    Backend (Node.js API)->>Repomix (CLI): Executes `npx repomix --remote <url> --output temp.md ...`
    Repomix (CLI)-->>Backend (Node.js API): Completes execution (stdout/stderr)
    Backend (Node.js API)->>FileSystem: Saves cleaned summary (summary.txt)
    Backend (Node.js API)->>FileSystem: Renames temp output (repo.md)
    Backend (Node.js API)-->>Frontend (React UI): Returns { success: true, outputFilename: "repo.md" }
    Frontend (React UI)->>User: Shows success message
    Note over Frontend (React UI), Backend (Node.js API): Frontend fetches updated file list & auto-loads new file content
    Frontend (React UI)->>Backend (Node.js API): GET /api/list-generated-files
    Backend (Node.js API)->>FileSystem: Reads directory listing
    FileSystem-->>Backend (Node.js API): Returns file list
    Backend (Node.js API)-->>Frontend (React UI): Returns list [{ filename, repoIdentifier }]
    Frontend (React UI)->>Backend (Node.js API): GET /api/get-file-content/repo.md
    Backend (Node.js API)->>FileSystem: Reads repo.md
    FileSystem-->>Backend (Node.js API): Returns file content
    Backend (Node.js API)-->>Frontend (React UI): Returns { success: true, content: "..." }
    Frontend (React UI)->>User: Displays file attached indicator

    User->>Frontend (React UI): Enters chat prompt & Clicks Send
    Frontend (React UI)->>Frontend (React UI): Prepares message (Prepends file content + user prompt)
    Frontend (React UI)->>Backend (Node.js API): POST /api/call-gemini (history, newMessage)
    Backend (Node.js API)->>Gemini API: Sends prompt with context (using API Key)
    Gemini API-->>Backend (Node.js API): Returns model response
    Backend (Node.js API)-->>Frontend (React UI): Returns { success: true, text: "AI response" }
    Frontend (React UI)->>User: Displays AI response in chat


Setup and Installation

Prerequisites


Node.js (v18 or later recommended)

npm or yarn

Git

A Google Gemini API Key (https://aistudio.google.com/app/apikey)


Backend Setup


Navigate to the backend directory:
cd backend


Install dependencies:
npm install
# or
yarn install


Create environment file:
Create a 
.env
 file in the 
backend
 directory:
# backend/.env
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY

Replace 
YOUR_GOOGLE_GEMINI_API_KEY
 with your actual key.

Run the backend server (development mode):
npm run dev

This will start the server, typically on 
http://localhost:8003
, with auto-reloading using 
ts-node-dev
.
Alternatively, build and run for production:
npm run build
npm start



Frontend Setup


Navigate to the frontend directory:
cd gemini-repomix-ui


Install dependencies:
npm install
# or
yarn install


Run the frontend development server:
npm run dev

This will start the Vite development server, typically on 
http://localhost:5173
. It's configured to proxy API requests starting with 
/api
 to the backend server running on port 8003.



Running Locally


Start the Backend: Open a terminal, navigate to 
backend
, set up your 
.env
 file, and run 
npm run dev
.

Start the Frontend: Open a second terminal, navigate to 
gemini-repomix-ui
, and run 
npm run dev
.

Access the Application: Open your web browser and go to 
http://localhost:5173/repochat/
. (Note the 
/repochat/
 base path configured in Vite).



Usage


Open the App: Navigate to the running application in your browser.

Generate Description:

Enter the full GitHub URL of the repository you want to analyze in the "GitHub Repo URL" field (e.g., 
https://github.com/user/repo.git
).

(Optional) Adjust the "Include Patterns" and "Exclude Patterns" (comma-separated glob patterns). Defaults are provided for common code files.

Click "Generate Description File".

Wait for the process to complete. The backend will run 
repomix
, save the files, and the frontend will show a success message. The newly generated file should be automatically selected and loaded.



Load Existing Description:

If descriptions have been generated previously, use the "Load Generated Description" dropdown to select a repository.

The content of the selected 
.md
 file will be loaded and "attached" for context.



Chat with Gemini:

Type your question or instruction about the loaded codebase into the prompt input area at the bottom.

Press Enter (or click "Send").

The frontend will send your prompt along with the content of the attached description file to the backend, which proxies the request to Gemini.

The AI's response will appear in the chat interface. The attached file context is cleared after a successful response to prepare for the next turn.





Configuration


Backend (
backend/.env
):

GEMINI_API_KEY
: Required. Your API key for accessing the Google Gemini API.



Backend (
backend/src/server.ts
):

port
: The port the backend server runs on (default: 
8003
).

GENERATED_FILES_DIR
: The directory where Repomix outputs are stored (relative to the 
dist
 folder after build, or 
src
 folder during dev).

corsOptions
: Configure allowed origins for CORS. By default, allows 
http://localhost:5173
 (Vite dev server) and 
https://fluttersystems.com
. Adjust for production deployment.

Body parser limits (
bodyParser.json
, 
bodyParser.urlencoded
): Increased to 
10mb
 to handle potentially large repo description files.



Frontend (
gemini-repomix-ui/vite.config.ts
):

base
: Sets the base path for the application (default: 
/repochat/
). Adjust if deploying to a different path.

server.proxy
: Configures the API proxy for the development server.





Deployment Notes (Conceptual)


Backend: Deploy the Node.js application to a hosting provider (e.g., Heroku, Fly.io, AWS EC2/ECS, Google Cloud Run).

Ensure the 
GEMINI_API_KEY
 environment variable is set in the production environment.

Make sure the 
generated_files
 directory is writable by the server process or use a persistent volume/storage solution if needed across restarts/scaling.

Configure CORS (
corsOptions
 in 
server.ts
) to allow requests from your frontend's production domain.



Frontend: Build the static assets:
cd gemini-repomix-ui
npm run build

Deploy the contents of the 
gemini-repomix-ui/dist
 directory to a static hosting provider (e.g., Netlify, Vercel, GitHub Pages, AWS S3/CloudFront).

Reverse Proxy (Recommended): Use a reverse proxy like Nginx or Caddy in front of both the frontend static files and the backend API. This can handle:

Serving the frontend under the main domain (e.g., 
yourdomain.com/repochat/
).

Proxying API requests (e.g., 
yourdomain.com/api/
) to the backend service, eliminating the need for complex CORS configurations in the backend (proxy handles same-origin).

SSL termination.





Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.


<!-- Add specific contribution guidelines if you have them -->

Fork the repository.

Create a new feature branch (
git checkout -b feature/your-feature
).

Make your changes.

Commit your changes (
git commit -am 'Add some feature'
).

Push to the branch (
git push origin feature/your-feature
).

Open a Pull Request.



License

This project is licensed under the MIT License - see the LICENSE file for details. <!-- Create a LICENSE file if you haven't -->

