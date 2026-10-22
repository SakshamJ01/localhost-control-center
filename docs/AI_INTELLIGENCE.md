# AI Project Intelligence Analyzer — Architecture & Guide

Localhost Developer Control Center features a built-in **AI Project Intelligence Analyzer** designed to solve a core problem in modern development: *configuring unfamiliar or multi-repo codebases without guessing how to run them.*

---

## 1. Overview

When you point Localhost to any directory on your computer, the analyzer:
1. **Reads Minimal Metadata**: Gathers the project name, top-level directory entries, package manifests (`package.json`), documentation (`README.md`), and environment examples (`.env.example`).
2. **Processes Context**: Feeds this metadata into an intelligent LLM prompt or the zero-API-key local heuristic engine.
3. **Generates Tailored Configuration**:
   - Clean display name and 1-2 sentence project summary.
   - Exact framework and runtime version.
   - Recommended command (e.g., `npm run dev` vs `npm start`) with an explicit explanation of *why*.
   - Predicted local development URL (e.g. `http://localhost:3000`).
   - Prerequisites (e.g., *"Run npm install if node_modules is missing"*, *"Copy .env.example to .env.local"*).
   - Technology tags for quick filtering.

---

## 2. Privacy & Security Model

> 🛡️ **Your source code is never uploaded.**

- **Only Metadata is Read**: The analyzer never scans your business logic, `.git` history, private keys, or `.env` files.
- **Strict Allow-List**: Only top-level directory names and non-secret documentation files (`package.json`, `README.md`, `.env.example`) are evaluated.
- **Local Heuristics Fallback**: If you prefer 100% offline development, leave the API key blank. The local heuristic analyzer will parse the files on your machine with zero external network traffic.
- **Credentials Stored Locally**: API keys are saved strictly to your local machine (`userData` store in Electron or browser `localStorage`) and are never sent to external servers other than the designated provider.

---

## 3. Supported AI Providers

### 1. OpenRouter (Recommended)
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Why OpenRouter?**: Gives access to hundreds of models from Google, Meta, Anthropic, and Mistral with a single key.
- **Zero-Credit Free Models**:
  - `google/gemini-2.0-flash-exp:free`: Ultra-fast reasoning and code analysis.
  - `meta-llama/llama-3.3-70b-instruct:free`: 70B parameter open-weights model.
  *Note:* Free models on OpenRouter end with `:free` and work even if your account has $0.00 credit balance!

### 2. Google Gemini API
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`
- **Supported Models**: `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`
- **Native JSON**: Utilizes `responseMimeType: "application/json"` for deterministic structured outputs.

### 3. OpenAI API
- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Supported Models**: `gpt-4o-mini`, `gpt-4o`
- **JSON Mode**: Employs `response_format: { type: "json_object" }`.

---

## 4. Multi-Tier Fallback Hierarchy

To ensure the user is **never blocked**, the analysis pipeline implements a 3-tier fallback strategy:

```
[User triggers analysis]
        │
        ▼
   Has API Key?
   ├── No  ──────> [Tier 3: Local Smart Heuristics Engine]
   └── Yes
        │
        ▼
[Tier 1: Preferred Model (e.g. Gemini 2.0 Flash Free)]
        │
     Success?
     ├── Yes ────> Output AI Configuration
     └── No (Rate limit / 402 credit / network)
          │
          ▼
   [Tier 2: Alternative Free Model (e.g. Llama 3.3 70B Free)]
          │
       Success?
       ├── Yes ──> Output AI Configuration
       └── No
            │
            ▼
   [Tier 3: Local Smart Heuristics Engine (AST / Package Parser)]
            │
            ▼
     Output Clean Fallback Configuration with Explanation
```

---

## 5. Dev Server Proxy & CSP

When testing Localhost in the browser (`http://localhost:5173`), modern web browsers enforce strict security boundaries:
1. **Content Security Policy (CSP)**: `index.html` includes an explicit `connect-src` directive allowing requests to `https://openrouter.ai`, `https://generativelanguage.googleapis.com`, and `https://api.openai.com`.
2. **Dev Server AI Proxy**: In the event that browser ad-blockers or privacy extensions block cross-origin requests to AI domains, `src/services/aiService.ts` automatically redirects the request through the Node.js dev server proxy at `/api/dev/ai-chat`.

---

## 6. Output Schema (`AIAnalysisResult`)

The AI engine outputs strict JSON validated against the following TypeScript interface:

```typescript
export interface AIAnalysisResult {
  project_name: string;          // Human-readable project title
  framework: string;             // Identified framework & version
  summary: string;               // 1-2 sentence overview
  recommended_command: string;   // The exact command to run (e.g. "npm run dev")
  command_explanation: string;   // Rationale behind the command choice
  dev_url: string | null;        // Default local port/URL
  prerequisites: string[];       // Setup steps before launch
  tags: string[];                // Tech stack tags (e.g. ["react", "vite", "typescript"])
  executable: string;            // The primary binary (e.g. "npm")
  args: string[];                // Command arguments (e.g. ["run", "dev"])
  warnings?: string[];           // Caveats, missing node_modules, etc.
}
```
