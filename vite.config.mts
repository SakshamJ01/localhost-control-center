import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

/**
 * Localhost Developer Control Center Dev Server API Plugin
 * Allows the browser preview at http://localhost:5173 to directly inspect
 * and read real files on the host machine without being trapped in browser mock data.
 */
function localhostDevApiPlugin(): Plugin {
  return {
    name: 'localhost-dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const parsedUrl = new URL(req.url, 'http://localhost:5173');

        // 1. Read project context for AI analysis
        if (parsedUrl.pathname === '/api/dev/read-project-context') {
          const rawPath = parsedUrl.searchParams.get('path');
          const folderPath = rawPath ? rawPath.trim().replace(/^["']|["']$/g, '') : null;
          res.setHeader('Content-Type', 'application/json');

          if (!folderPath || !fs.existsSync(folderPath)) {
            res.end(JSON.stringify({ success: false, context: null, error: 'Directory does not exist' }));
            return;
          }

          try {
            const stat = fs.statSync(folderPath);
            if (!stat.isDirectory()) {
              res.end(JSON.stringify({ success: false, context: null, error: 'Path is not a directory' }));
              return;
            }

            const folderName = path.basename(folderPath);
            const files = fs.readdirSync(folderPath).slice(0, 80);

            let pkgJson: string | undefined;
            const pkgPath = path.join(folderPath, 'package.json');
            if (fs.existsSync(pkgPath)) {
              try {
                pkgJson = fs.readFileSync(pkgPath, 'utf8').slice(0, 10000);
              } catch {}
            }

            let readme: string | undefined;
            for (const r of ['README.md', 'readme.md', 'README', 'readme.markdown']) {
              const rPath = path.join(folderPath, r);
              if (fs.existsSync(rPath)) {
                try {
                  readme = fs.readFileSync(rPath, 'utf8').slice(0, 6000);
                  break;
                } catch {}
              }
            }

            let envExample: string | undefined;
            const envPath = path.join(folderPath, '.env.example');
            if (fs.existsSync(envPath)) {
              try {
                envExample = fs.readFileSync(envPath, 'utf8').slice(0, 3000);
              } catch {}
            }

            res.end(JSON.stringify({
              success: true,
              context: {
                folder_name: folderName,
                folder_path: folderPath,
                files,
                package_json: pkgJson,
                readme,
                env_example: envExample
              }
            }));
          } catch (err: any) {
            res.end(JSON.stringify({ success: false, context: null, error: err.message }));
          }
          return;
        }

        // 2. Detect project scripts and frameworks
        if (parsedUrl.pathname === '/api/dev/detect-project') {
          const rawPath = parsedUrl.searchParams.get('path');
          const folderPath = rawPath ? rawPath.trim().replace(/^["']|["']$/g, '') : null;
          res.setHeader('Content-Type', 'application/json');

          if (!folderPath || !fs.existsSync(folderPath)) {
            res.end(JSON.stringify({ success: false, detection: null }));
            return;
          }

          try {
            const folderBasename = path.basename(folderPath);
            const pkgPath = path.join(folderPath, 'package.json');
            let detection: any = null;

            if (fs.existsSync(pkgPath)) {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
              const scripts = pkg.scripts || {};
              const allDeps: Record<string, string> = {
                ...(pkg.dependencies || {}),
                ...(pkg.devDependencies || {})
              };

              let framework = 'Node.js App';
              let devUrl: string | null = 'http://localhost:3000';
              const tags = ['node'];

              if (allDeps['next']) {
                framework = 'Next.js App';
                devUrl = 'http://localhost:3000';
                tags.push('nextjs', 'react');
              } else if (allDeps['vite']) {
                framework = 'Vite App';
                devUrl = 'http://localhost:5173';
                tags.push('vite', 'react');
              } else if (allDeps['react-scripts']) {
                framework = 'Create React App';
                devUrl = 'http://localhost:3000';
                tags.push('react');
              } else if (allDeps['astro']) {
                framework = 'Astro Site';
                devUrl = 'http://localhost:4321';
                tags.push('astro');
              }

              if (allDeps['typescript'] || fs.existsSync(path.join(folderPath, 'tsconfig.json'))) {
                tags.push('typescript');
              }

              const availableScripts = Object.keys(scripts).map(key => {
                const isStart = key === 'start' || key === 'test';
                return {
                  id: `script_${key}`,
                  name: key,
                  command: String(scripts[key]),
                  executable: 'npm',
                  args: isStart ? [key] : ['run', key],
                  full_command: isStart ? `npm ${key}` : `npm run ${key}`,
                  is_recommended: false
                };
              });

              const priorityKeys = ['dev', 'start:dev', 'serve', 'develop', 'start'];
              const recKey = priorityKeys.find(k => scripts[k] !== undefined) || Object.keys(scripts)[0];
              const recScript = availableScripts.find(s => s.name === recKey);
              if (recScript) recScript.is_recommended = true;

              let suggestedName = pkg.name || folderBasename;
              if (suggestedName.includes('/')) {
                suggestedName = suggestedName.split('/').pop() || suggestedName;
              }

              detection = {
                framework,
                project_type: 'node',
                suggested_name: suggestedName,
                suggested_dev_url: devUrl,
                suggested_tags: tags,
                package_manager: 'npm',
                available_scripts: availableScripts,
                recommended_script: recScript || null
              };
            }

            res.end(JSON.stringify({ success: true, detection }));
          } catch (err: any) {
            res.end(JSON.stringify({ success: false, detection: null, error: err.message }));
          }
          return;
        }

        // 3. AI Proxy for browser dev preview (bypasses browser adblocker & CORS restrictions)
        if (parsedUrl.pathname === '/api/dev/ai-chat' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(bodyStr);
              const { url, headers, body } = payload;

              const fetchResp = await fetch(url, {
                method: 'POST',
                headers: headers || {},
                body: typeof body === 'string' ? body : JSON.stringify(body)
              });

              const respText = await fetchResp.text();
              res.statusCode = fetchResp.status;
              res.end(respText);
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: { message: err.message || 'Dev AI proxy failed' } }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localhostDevApiPlugin()],
  base: './',
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
