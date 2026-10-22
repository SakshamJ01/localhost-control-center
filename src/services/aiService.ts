import { ProjectContext, AIAnalysisResult, AppSettings } from '../types';

/**
 * Intelligent Local AI Analyzer fallback (zero-API-key heuristic engine)
 * Deeply parses package.json, README.md, and project structure without external API calls.
 */
export function localSmartAnalysis(context: ProjectContext): AIAnalysisResult {
  let pkg: any = null;
  if (context.package_json) {
    try {
      pkg = JSON.parse(context.package_json);
    } catch {}
  }

  const scripts = pkg?.scripts || {};
  const allDeps: Record<string, string> = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {})
  };

  // Determine Project Name & Description
  let projectName = pkg?.name || context.folder_name;
  if (projectName.includes('/')) {
    projectName = projectName.split('/').pop() || projectName;
  }
  // Title-case or clean
  projectName = projectName
    .split(/[-_]/)
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  let summary = pkg?.description || `Local software application running in directory "${context.folder_name}".`;

  // Framework & Tech Stack Detection
  let framework = 'Node.js Application';
  let devUrl: string | null = 'http://localhost:3000';
  let recommendedCommand = 'npm run dev';
  let commandExplanation = 'Runs development server with live reload.';
  const tags: string[] = ['node'];
  const prerequisites: string[] = [];
  const warnings: string[] = [];

  if (allDeps['next']) {
    framework = `Next.js ${allDeps['next'].replace(/^[^0-9]*/, '')} (React 19)`;
    devUrl = 'http://localhost:3000';
    recommendedCommand = 'npm run dev';
    commandExplanation = 'Runs Next.js development server with Turbopack and Fast Refresh. Note: "npm start" is for production and requires running "npm run build" first.';
    tags.push('nextjs', 'react');
  } else if (allDeps['vite']) {
    framework = 'React (Vite)';
    devUrl = 'http://localhost:5173';
    recommendedCommand = 'npm run dev';
    commandExplanation = 'Launches Vite high-performance dev server with Instant HMR.';
    tags.push('vite', 'react');
  } else if (allDeps['react-scripts']) {
    framework = 'Create React App';
    devUrl = 'http://localhost:3000';
    recommendedCommand = 'npm start';
    commandExplanation = 'Starts Webpack development server on port 3000.';
    tags.push('react');
  } else if (allDeps['astro']) {
    framework = 'Astro Web App';
    devUrl = 'http://localhost:4321';
    recommendedCommand = 'npm run dev';
    commandExplanation = 'Starts Astro local preview server on http://localhost:4321.';
    tags.push('astro');
  } else if (scripts['dev']) {
    recommendedCommand = 'npm run dev';
    commandExplanation = `Executes primary dev script defined in package.json ("${scripts['dev']}").`;
  } else if (scripts['start']) {
    recommendedCommand = 'npm start';
    commandExplanation = `Executes main startup script defined in package.json ("${scripts['start']}").`;
  }

  // Database detection
  if (allDeps['better-sqlite3'] || allDeps['sqlite3']) {
    tags.push('sqlite');
    prerequisites.push('Local SQLite database file will be initialized on first run.');
  } else if (allDeps['pg'] || allDeps['postgres']) {
    tags.push('postgresql');
    prerequisites.push('Requires running PostgreSQL server.');
  } else if (allDeps['prisma']) {
    tags.push('prisma');
    prerequisites.push('Run "npx prisma migrate dev" if schema was updated.');
  }

  // Testing & Tooling
  if (allDeps['vitest']) tags.push('vitest');
  if (allDeps['jest']) tags.push('jest');
  if (allDeps['typescript'] || context.files.includes('tsconfig.json')) tags.push('typescript');

  // Environment checks
  if (context.env_example || context.files.includes('.env.example')) {
    prerequisites.push('Ensure environment variables are configured in .env.local or .env.');
  }

  if (!context.files.includes('node_modules')) {
    warnings.push('"node_modules" not found. Run "npm install" before launching.');
  }

  // Check README for specific dev URLs or instructions
  if (context.readme) {
    const urlMatch = context.readme.match(/http:\/\/localhost:([0-9]{4})/);
    if (urlMatch) {
      devUrl = urlMatch[0];
    }
    const titleMatch = context.readme.match(/^#\s+(.+)$/m);
    if (titleMatch && (!pkg?.name || pkg.name === context.folder_name)) {
      projectName = titleMatch[1].trim();
    }
  }

  const parts = recommendedCommand.split(' ');
  const executable = parts[0];
  const args = parts.slice(1);

  return {
    project_name: projectName,
    framework,
    summary,
    recommended_command: recommendedCommand,
    command_explanation: commandExplanation,
    dev_url: devUrl,
    prerequisites,
    tags: Array.from(new Set(tags)),
    executable,
    args,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Test AI provider connection and API key validity
 */
export async function testAIConnection(
  provider: 'openrouter' | 'gemini' | 'openai',
  apiKey: string,
  model?: string
): Promise<{ success: boolean; latencyMs: number; message: string; error?: string }> {
  if (!apiKey.trim()) {
    return { success: false, latencyMs: 0, message: 'Please enter an API key', error: 'Missing API key' };
  }

  const startTime = Date.now();
  const testPrompt = 'Respond with JSON: {"status": "ok"}';

  try {
    if (provider === 'openrouter') {
      const selectedModel = model?.trim() || 'google/gemini-2.0-flash-exp:free';
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'https://github.com/SakshamJ01/localhost-control-center',
          'X-Title': 'Localhost Developer Control Center',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 20
        })
      });

      const latencyMs = Date.now() - startTime;
      if (!response.ok) {
        const errorText = await response.text();
        let parsedMsg = errorText;
        try {
          const jsonErr = JSON.parse(errorText);
          parsedMsg = jsonErr.error?.message || errorText;
        } catch {}
        return {
          success: false,
          latencyMs,
          message: `OpenRouter error (${response.status})`,
          error: parsedMsg
        };
      }

      return {
        success: true,
        latencyMs,
        message: `Successfully connected to OpenRouter using ${selectedModel}!`
      };
    } else if (provider === 'gemini') {
      const selectedModel = model?.trim() || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey.trim()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: testPrompt }] }]
        })
      });

      const latencyMs = Date.now() - startTime;
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          latencyMs,
          message: `Gemini error (${response.status})`,
          error: errorText
        };
      }

      return {
        success: true,
        latencyMs,
        message: `Successfully connected to Gemini API (${selectedModel})!`
      };
    } else {
      const selectedModel = model?.trim() || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 20
        })
      });

      const latencyMs = Date.now() - startTime;
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          latencyMs,
          message: `OpenAI error (${response.status})`,
          error: errorText
        };
      }

      return {
        success: true,
        latencyMs,
        message: `Successfully connected to OpenAI (${selectedModel})!`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      message: 'Network error or blocked request',
      error: err.message || String(err)
    };
  }
}

/**
 * Perform AI Project Analysis using OpenRouter, Gemini, OpenAI or smart local fallback
 */
export async function analyzeProjectWithAI(
  context: ProjectContext,
  settings?: AppSettings | null
): Promise<AIAnalysisResult> {
  const provider = settings?.ai_provider || 'openrouter';
  const apiKey = settings?.ai_api_key?.trim();

  // If no API key is provided, use the local smart AST/manifest analyzer
  if (!apiKey) {
    console.info('[AIService] No API key provided; using local smart heuristic analyzer.');
    return localSmartAnalysis(context);
  }

  const prompt = `You are an expert DevOps and full-stack software engineer analyzing a local software project to configure its development environment in Localhost Control Center.

Analyze the following project context and return a strict JSON response.

Project Folder Name: ${context.folder_name}
Files Present: ${context.files.join(', ')}

package.json:
${context.package_json || 'Not present'}

README.md:
${context.readme || 'Not present'}

Environment Example:
${context.env_example || 'Not present'}

Respond with ONLY valid JSON with this exact schema:
{
  "project_name": "string (clean, human-readable display name)",
  "framework": "string (e.g. 'Next.js 16 + React 19' or 'FastAPI Python' or 'Vite React')",
  "summary": "string (1-2 sentences summarizing what this project actually is and does)",
  "recommended_command": "string (the exact command to run for active local development, e.g. 'npm run dev')",
  "command_explanation": "string (clear explanation of why this command is chosen over others, e.g. why 'npm run dev' instead of 'npm start')",
  "dev_url": "string or null (e.g. 'http://localhost:3000' or 'http://localhost:5173')",
  "prerequisites": ["string (e.g. 'Run npm install if node_modules is missing', 'Copy .env.example to .env.local')"],
  "tags": ["string (array of relevant technology tags)"],
  "executable": "string (e.g. 'npm' or 'python' or 'cargo')",
  "args": ["string (array of arguments, e.g. ['run', 'dev'])"],
  "warnings": ["string (any potential caveats or gotchas for running locally)"]
}`;

  try {
    let rawResponseText = '';

    if (provider === 'openrouter') {
      // Prefer specified model, or try standard models with automatic fallback
      const modelsToTry = [
        settings?.ai_model?.trim() || 'google/gemini-2.0-flash-exp:free',
        'google/gemini-2.0-flash-exp:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'google/gemini-2.0-flash-001'
      ];
      // Filter duplicates
      const uniqueModels = Array.from(new Set(modelsToTry.filter(Boolean)));

      let lastError = '';
      let succeeded = false;

      for (const model of uniqueModels) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://github.com/SakshamJ01/localhost-control-center',
              'X-Title': 'Localhost Developer Control Center',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert developer assistant that analyzes local project codebases. You must return valid JSON only.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              response_format: { type: 'json_object' }
            })
          });

          if (!response.ok) {
            const errBody = await response.text();
            lastError = `Model ${model} failed (${response.status}): ${errBody}`;
            // If credit or model error, try next model
            continue;
          }

          const data = await response.json();
          rawResponseText = data.choices?.[0]?.message?.content || '';
          if (rawResponseText) {
            succeeded = true;
            break;
          }
        } catch (fetchErr: any) {
          lastError = fetchErr.message;
        }
      }

      if (!succeeded) {
        throw new Error(lastError || 'OpenRouter API request failed.');
      }
    } else if (provider === 'gemini') {
      const model = settings?.ai_model || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      rawResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // OpenAI compatible
      const model = settings?.ai_model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      rawResponseText = data.choices?.[0]?.message?.content || '';
    }

    // Clean JSON response (strip markdown fences if present)
    const cleaned = rawResponseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed: AIAnalysisResult = JSON.parse(cleaned);
    return parsed;
  } catch (err: any) {
    console.warn('[AIService] External AI call failed, falling back to local smart analyzer:', err);
    // Graceful fallback to local smart analysis with clear explanation
    const fallback = localSmartAnalysis(context);
    fallback.warnings = [
      ...(fallback.warnings || []),
      `AI Online Analysis note: ${err.message || 'API request issue'}. Generated configuration using local AST analyzer.`
    ];
    return fallback;
  }
}
