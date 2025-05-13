# Gemini Repomix Assistant

**Gemini Repomix Assistant** is a powerful web application designed to help you understand, analyze, and interact with code repositories using Google's Gemini AI models. It leverages [Repomix](https://repomix.com/) (assumed tool, link if available) to create comprehensive context packs of your codebase, which are then used to fuel insightful conversations with Gemini.

Ask questions about your code, get explanations, request refactoring suggestions, and much more, all within a user-friendly chat interface.

**(Placeholder for a screenshot or GIF of the application in action)**

## Key Features

*   **Repository Analysis with AI:**
    *   Connect to any public GitHub repository.
    *   Generate a "Repomix pack" – a single file containing a structured representation of your selected codebase.
    *   Chat with Gemini AI, using the generated pack as a rich context source.
*   **Intelligent Chat Interface:**
    *   Converse with Gemini models about your code.
    *   Support for chat history to maintain conversation flow.
    *   Markdown rendering for responses, including syntax-highlighted code blocks.
*   **Contextual Code Interaction:**
    *   **File Tree Navigation:** View the directory structure of your Repomix pack.
    *   **Selective File Context:** Choose specific files from the tree to include in your prompts to Gemini, focusing the AI's attention.
    *   **File Content Viewer:** Inspect the content of any file from the pack with syntax highlighting.
    *   **Code Comparison:** When Gemini suggests code changes for a file, easily view a side-by-side comparison of the original and suggested code.
*   **User-Specific Configuration:**
    *   **Secure API Key Management:** Store your Google Gemini API key securely per user.
    *   **Customizable System Prompts:** Define and save your own system prompts to tailor Gemini's behavior for different tasks.
    *   **Model Selection:** Choose from a range of available Gemini models. Your last selected model is remembered.
*   **Cost Tracking:**
    *   Get estimates for token usage (input/output) and associated costs for each Gemini API call.
    *   View total session costs and token counts.
*   **Authentication:**
    *   Secure user authentication via Email/Password or GitHub OAuth, powered by Supabase.
*   **Repomix Integration:**
    *   Specify include/exclude patterns for files when generating Repomix packs.
    *   List and load previously generated packs.
    *   Manually upload existing Repomix pack files.

## How It Works

1.  **Authenticate:** Sign up or log in to your account.
2.  **Set API Key:** Provide your Google Gemini API key (you can get one from [Google AI Studio](https://aistudio.google.com/app/apikey)). This is stored securely and associated with your user account.
3.  **Generate or Select Repo Pack:**
    *   Enter a public GitHub repository URL. The backend will run Repomix to generate a context pack.
    *   Or, select a previously generated pack from your list.
    *   Or, manually upload a `.md` or `.txt` Repomix pack file.
4.  **Configure (Optional):**
    *   Set a custom system prompt to guide the AI's responses.
    *   Choose your preferred Gemini model.
5.  **Chat & Analyze:**
    *   Use the chat interface to ask questions or give instructions to Gemini regarding the loaded repository context.
    *   Select specific files from the repository's file tree to be included as focused context in your next prompt.
    *   View file contents or compare AI-suggested code changes.

## Tech Stack

*   **Frontend:**
    *   React
    *   TypeScript
    *   Tailwind CSS
    *   Vite (Build Tool)
    *   Shikiji (Syntax Highlighting)
*   **Backend:**
    *   Node.js
    *   Express.js
    *   TypeScript
*   **AI:**
    *   Google Gemini API
*   **Authentication & Database:**
    *   Supabase (Auth, PostgreSQL for user configurations)
*   **Code Packing:**
    *   Repomix CLI (assumed to be an external tool called by the backend)

## Setup and Installation

### Prerequisites

*   Node.js (LTS version recommended)
*   npm or yarn
*   Git
*   Access to a Supabase project
*   Google Gemini API Key

### Backend Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd <repository_name>/backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Create a `.env` file** in the `backend` directory with the following content:
    ```env
    PORT=8003

    # Supabase Configuration
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_ANON_KEY=your_supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key # For admin operations

    # Optional: Repomix executable path if not in PATH or using a specific version
    # REPOMIX_EXECUTABLE="npx repomix"
    ```
    *   Replace placeholders with your actual Supabase project credentials.
    *   The `SUPABASE_SERVICE_ROLE_KEY` is required for backend operations that need admin privileges (e.g., managing user API keys securely).

4.  **Database Schema:**
    The backend relies on two tables in your Supabase database:
    *   `user_gemini_keys`:
        *   `user_id` (UUID, primary key, foreign key to `auth.users.id`)
        *   `api_key` (TEXT, encrypted or appropriately secured)
        *   `last_selected_model` (TEXT, nullable)
        *   `created_at` (TIMESTAMPTZ, default `now()`)
        *   `updated_at` (TIMESTAMPTZ, default `now()`)
    *   `user_system_prompts`:
        *   `user_id` (UUID, primary key, foreign key to `auth.users.id`)
        *   `prompt_content` (TEXT)
        *   `created_at` (TIMESTAMPTZ, default `now()`)
        *   `updated_at` (TIMESTAMPTZ, default `now()`)

    You'll need to set up these tables and enable Row Level Security (RLS) policies appropriately. For example, users should only be able to access/modify their own data. The service role key bypasses RLS for trusted backend operations.

5.  **Start the backend server:**
    ```bash
    npm run dev # (or your configured start script)
    ```

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd ../gemini-repomix-ui
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Create a `.env.local` file** in the `gemini-repomix-ui` directory with your Supabase public credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
4.  **Start the frontend development server:**
    ```bash
    npm run dev
    ```
    The application should now be accessible, typically at `http://localhost:5173/repochat/`. The backend API calls will be proxied to `http://localhost:8003` as configured in `vite.config.ts`.

## Usage Guide

1.  **Authentication:** Open the application in your browser. You'll be prompted to log in or sign up.
2.  **Set Gemini API Key:**
    *   After logging in, if you haven't set your Gemini API key, a modal will appear.
    *   Enter your API key. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey). Ensure billing is enabled for the models you intend to use.
    *   You can also access this modal via the "Set API Key" button in the header if no key is set.
3.  **Generate a Repomix Pack:**
    *   In the "Generate Project Description" section, enter the GitHub URL of the repository you want to analyze.
    *   Adjust include/exclude patterns if needed (defaults are provided for common source code files).
    *   Click "Generate Description File". The backend will process the repo, and the new pack will appear in the "Load Generated Description" dropdown. It will also be automatically loaded.
4.  **Load an Existing Pack:**
    *   Select a previously generated pack from the "Load Generated Description" dropdown.
    *   Alternatively, click the "📎" (attach) button next to the prompt input to upload a Repomix file (usually `.md` or `.txt`) from your local system.
5.  **Chatting with Gemini:**
    *   Type your questions or instructions into the prompt input area at the bottom.
    *   Press Enter or click "Send".
    *   The AI's response will appear in the chat interface.
6.  **Using the File Tree (Fullscreen View):**
    *   Once a Repomix pack is loaded, you can click the "↔️ Expand" button in the header to enter fullscreen view.
    *   The file tree on the left shows the structure of the loaded repository.
    *   **View File:** Click on a file name in the tree to view its content in the rightmost panel.
    *   **Select for Prompt:** Check the box next to a file (or multiple files) to include its content directly in your next prompt to Gemini. This is useful for focusing the AI on specific parts of the codebase. Use "Select All" / "Deselect All" for convenience.
7.  **Code Comparison:**
    *   If Gemini's response includes a code block with a file path (e.g., `// src/utils/helper.ts`), a "Compare" button will appear next to the code block.
    *   Clicking "Compare" opens a side-by-side view showing the original file content (from your Repomix pack) and Gemini's suggested changes. This requires the file path in the code block to match a file in the loaded Repomix pack.
8.  **System Prompt:**
    *   Click "Set System Prompt" to reveal a textarea.
    *   Enter instructions to guide Gemini's persona, response style, or task focus (e.g., "You are a helpful assistant specializing in Python code reviews.").
    *   Click "Save to DB" to store this prompt for future sessions. It's loaded automatically.
9.  **Model Selection:**
    *   Use the "Select Model" dropdown in the "AI Model & Usage" section to choose different Gemini models.
    *   Capabilities and pricing notes for the selected model are displayed.
    *   Token usage and estimated costs are shown for the current call and the total session.

---

