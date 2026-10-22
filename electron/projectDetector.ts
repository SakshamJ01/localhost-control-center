import fs from 'fs';
import path from 'path';
import { ProjectDetection, DetectedScript } from '../src/types';

export function detectProjectInFolder(folderPath: string): ProjectDetection | null {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return null;
    }

    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      return null;
    }

    const folderBasename = path.basename(folderPath);

    // 1. Check for package.json (Node.js ecosystem)
    const pkgPath = path.join(folderPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkgContent = fs.readFileSync(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgContent);

        // Detect package manager
        let pm: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm';
        if (fs.existsSync(path.join(folderPath, 'pnpm-lock.yaml'))) {
          pm = 'pnpm';
        } else if (fs.existsSync(path.join(folderPath, 'yarn.lock'))) {
          pm = 'yarn';
        } else if (fs.existsSync(path.join(folderPath, 'bun.lockb')) || fs.existsSync(path.join(folderPath, 'bun.lock'))) {
          pm = 'bun';
        }

        const allDeps: Record<string, string> = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {})
        };

        // Detect Framework & default port
        let framework = 'Node.js Application';
        let suggestedDevUrl: string | null = 'http://localhost:3000';
        const suggestedTags: string[] = ['node'];

        if (allDeps['next']) {
          framework = 'Next.js App';
          suggestedDevUrl = 'http://localhost:3000';
          suggestedTags.push('nextjs', 'react');
        } else if (allDeps['vite']) {
          framework = 'Vite App';
          suggestedDevUrl = 'http://localhost:5173';
          suggestedTags.push('vite');
          if (allDeps['react']) suggestedTags.push('react');
          if (allDeps['vue']) suggestedTags.push('vue');
          if (allDeps['svelte']) suggestedTags.push('svelte');
        } else if (allDeps['react-scripts']) {
          framework = 'Create React App';
          suggestedDevUrl = 'http://localhost:3000';
          suggestedTags.push('react');
        } else if (allDeps['astro']) {
          framework = 'Astro Site';
          suggestedDevUrl = 'http://localhost:4321';
          suggestedTags.push('astro');
        } else if (allDeps['@remix-run/react'] || allDeps['@remix-run/node']) {
          framework = 'Remix App';
          suggestedDevUrl = 'http://localhost:3000';
          suggestedTags.push('remix');
        } else if (allDeps['nuxt']) {
          framework = 'Nuxt App';
          suggestedDevUrl = 'http://localhost:3000';
          suggestedTags.push('nuxt', 'vue');
        } else if (allDeps['@sveltejs/kit']) {
          framework = 'SvelteKit App';
          suggestedDevUrl = 'http://localhost:5173';
          suggestedTags.push('svelte');
        } else if (allDeps['@angular/core']) {
          framework = 'Angular App';
          suggestedDevUrl = 'http://localhost:4200';
          suggestedTags.push('angular');
        } else if (allDeps['@nestjs/core']) {
          framework = 'NestJS API';
          suggestedDevUrl = 'http://localhost:3000';
          suggestedTags.push('nestjs', 'backend');
        } else if (allDeps['express'] || allDeps['fastify'] || allDeps['koa']) {
          framework = 'Node.js Web Server';
          suggestedDevUrl = 'http://localhost:3000';
          suggestedTags.push('backend', 'api');
        }

        if (allDeps['typescript'] || fs.existsSync(path.join(folderPath, 'tsconfig.json'))) {
          suggestedTags.push('typescript');
        }

        // Parse scripts
        const scripts = pkg.scripts || {};
        const availableScripts: DetectedScript[] = [];
        const scriptKeys = Object.keys(scripts);

        for (const key of scriptKeys) {
          const raw = String(scripts[key]);
          let fullCommand = '';
          let exec = pm;
          let args: string[] = [];

          if (pm === 'npm') {
            if (key === 'start' || key === 'test') {
              fullCommand = `npm ${key}`;
              args = [key];
            } else {
              fullCommand = `npm run ${key}`;
              args = ['run', key];
            }
          } else if (pm === 'yarn') {
            fullCommand = `yarn ${key}`;
            args = [key];
          } else if (pm === 'pnpm') {
            fullCommand = `pnpm ${key}`;
            args = [key];
          } else if (pm === 'bun') {
            fullCommand = key === 'start' || key === 'test' ? `bun ${key}` : `bun run ${key}`;
            args = key === 'start' || key === 'test' ? [key] : ['run', key];
          }

          availableScripts.push({
            id: `script_${key}`,
            name: key,
            command: raw,
            executable: exec,
            args,
            full_command: fullCommand,
            is_recommended: false
          });
        }

        // Determine recommended script
        // Priority order: dev > start:dev > serve > develop > start > first script
        const priorityKeys = ['dev', 'start:dev', 'serve', 'develop', 'start'];
        let recommendedKey = priorityKeys.find(k => scripts[k] !== undefined);
        if (!recommendedKey && scriptKeys.length > 0) {
          recommendedKey = scriptKeys[0];
        }

        let recommendedScript: DetectedScript | null = null;
        if (recommendedKey) {
          const found = availableScripts.find(s => s.name === recommendedKey);
          if (found) {
            found.is_recommended = true;
            recommendedScript = found;
          }
        }

        // Project name: prefer clean package name, fallback to folder basename
        let suggestedName = pkg.name || folderBasename;
        if (suggestedName.includes('/')) {
          suggestedName = suggestedName.split('/').pop() || suggestedName;
        }

        return {
          framework,
          project_type: 'node',
          suggested_name: suggestedName,
          suggested_dev_url: suggestedDevUrl,
          suggested_tags: Array.from(new Set(suggestedTags)),
          package_manager: pm,
          available_scripts: availableScripts,
          recommended_script: recommendedScript
        };
      } catch (err) {
        console.warn('[ProjectDetector] Error parsing package.json:', err);
      }
    }

    // 2. Check for Python
    const hasPyProject = fs.existsSync(path.join(folderPath, 'pyproject.toml'));
    const hasReqs = fs.existsSync(path.join(folderPath, 'requirements.txt'));
    const hasManagePy = fs.existsSync(path.join(folderPath, 'manage.py'));
    const hasAppPy = fs.existsSync(path.join(folderPath, 'app.py'));
    const hasMainPy = fs.existsSync(path.join(folderPath, 'main.py'));

    if (hasPyProject || hasReqs || hasManagePy || hasAppPy || hasMainPy) {
      let framework = 'Python Project';
      let fullCommand = 'python app.py';
      let args = ['app.py'];
      let suggestedDevUrl: string | null = 'http://localhost:5000';
      const suggestedTags = ['python'];

      if (hasManagePy) {
        framework = 'Django App';
        fullCommand = 'python manage.py runserver';
        args = ['manage.py', 'runserver'];
        suggestedDevUrl = 'http://localhost:8000';
        suggestedTags.push('django');
      } else if (hasMainPy) {
        framework = 'FastAPI / Python App';
        fullCommand = 'python main.py';
        args = ['main.py'];
        suggestedDevUrl = 'http://localhost:8000';
        suggestedTags.push('fastapi');
      } else if (hasAppPy) {
        framework = 'Flask / Python App';
        fullCommand = 'python app.py';
        args = ['app.py'];
        suggestedDevUrl = 'http://localhost:5000';
        suggestedTags.push('flask');
      }

      const defaultScript: DetectedScript = {
        id: 'script_py_run',
        name: 'run',
        command: fullCommand,
        executable: 'python',
        args,
        full_command: fullCommand,
        is_recommended: true
      };

      return {
        framework,
        project_type: 'python',
        suggested_name: folderBasename,
        suggested_dev_url: suggestedDevUrl,
        suggested_tags: suggestedTags,
        package_manager: 'python',
        available_scripts: [defaultScript],
        recommended_script: defaultScript
      };
    }

    // 3. Check for Rust (Cargo.toml)
    if (fs.existsSync(path.join(folderPath, 'Cargo.toml'))) {
      const defaultScript: DetectedScript = {
        id: 'script_cargo_run',
        name: 'run',
        command: 'cargo run',
        executable: 'cargo',
        args: ['run'],
        full_command: 'cargo run',
        is_recommended: true
      };

      return {
        framework: 'Rust Project',
        project_type: 'rust',
        suggested_name: folderBasename,
        suggested_dev_url: null,
        suggested_tags: ['rust'],
        package_manager: 'cargo',
        available_scripts: [defaultScript],
        recommended_script: defaultScript
      };
    }

    // 4. Check for Go (go.mod)
    if (fs.existsSync(path.join(folderPath, 'go.mod'))) {
      const defaultScript: DetectedScript = {
        id: 'script_go_run',
        name: 'run',
        command: 'go run .',
        executable: 'go',
        args: ['run', '.'],
        full_command: 'go run .',
        is_recommended: true
      };

      return {
        framework: 'Go Project',
        project_type: 'go',
        suggested_name: folderBasename,
        suggested_dev_url: 'http://localhost:8080',
        suggested_tags: ['go'],
        package_manager: 'go',
        available_scripts: [defaultScript],
        recommended_script: defaultScript
      };
    }

    // 5. Check for static index.html
    if (fs.existsSync(path.join(folderPath, 'index.html'))) {
      return {
        framework: 'Static Web Page',
        project_type: 'static',
        suggested_name: folderBasename,
        suggested_dev_url: null,
        suggested_tags: ['frontend', 'html'],
        package_manager: 'none',
        available_scripts: [],
        recommended_script: null
      };
    }

    // Fallback: directory only
    return {
      framework: 'Local Directory',
      project_type: 'unknown',
      suggested_name: folderBasename,
      suggested_dev_url: null,
      suggested_tags: [],
      package_manager: 'none',
      available_scripts: [],
      recommended_script: null
    };
  } catch (err) {
    console.error('[ProjectDetector] Failed to detect project:', err);
    return null;
  }
}
