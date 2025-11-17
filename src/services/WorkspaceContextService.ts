import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Service to collect workspace context information for AI assistance
 */
export class WorkspaceContextService {
    private static instance: WorkspaceContextService;

    private constructor() {}

    public static getInstance(): WorkspaceContextService {
        if (!WorkspaceContextService.instance) {
            WorkspaceContextService.instance = new WorkspaceContextService();
        }
        return WorkspaceContextService.instance;
    }

    /**
     * Collect comprehensive workspace context
     */
    public async collectContext(): Promise<string> {
        const sections: string[] = [];

        // 1. Workspace root path
        const workspaceRoot = this.getWorkspaceRoot();
        if (workspaceRoot) {
            sections.push(`Workspace Root: ${workspaceRoot}`);
        }

        // 2. Programming languages detected
        const languages = await this.detectLanguages();
        if (languages.length > 0) {
            sections.push(`Detected Languages: ${languages.join(', ')}`);
        }

        // 3. Current file path
        const currentFile = this.getCurrentFile();
        if (currentFile) {
            sections.push(`Current File: ${currentFile}`);
        }

        // 4. Project structure overview
        const structure = await this.getProjectStructure();
        if (structure) {
            sections.push(`Project Structure:\n${structure}`);
        }

        // 5. Git repository info
        const gitInfo = await this.getGitInfo();
        if (gitInfo) {
            sections.push(`Git Repository:\n${gitInfo}`);
        }

        // 6. VS Code settings relevant to AI
        const settings = this.getRelevantSettings();
        if (settings) {
            sections.push(`Editor Settings:\n${settings}`);
        }

        if (sections.length === 0) {
            return 'No workspace context available.';
        }

        return `WORKSPACE CONTEXT:\n${sections.map(s => `- ${s}`).join('\n')}`;
    }

    /**
     * Get workspace root path
     */
    private getWorkspaceRoot(): string | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * Detect programming languages in workspace
     */
    private async detectLanguages(): Promise<string[]> {
        const languages = new Set<string>();
        const workspaceRoot = this.getWorkspaceRoot();
        
        if (!workspaceRoot) {
            return [];
        }

        try {
            // Common language file extensions
            const extensionToLanguage: { [key: string]: string } = {
                '.ts': 'TypeScript',
                '.tsx': 'TypeScript React',
                '.js': 'JavaScript',
                '.jsx': 'JavaScript React',
                '.java': 'Java',
                '.py': 'Python',
                '.cs': 'C#',
                '.cpp': 'C++',
                '.c': 'C',
                '.go': 'Go',
                '.rs': 'Rust',
                '.rb': 'Ruby',
                '.php': 'PHP',
                '.swift': 'Swift',
                '.kt': 'Kotlin',
                '.scala': 'Scala',
                '.r': 'R',
                '.sql': 'SQL',
                '.sh': 'Shell',
                '.html': 'HTML',
                '.css': 'CSS',
                '.scss': 'SCSS',
                '.less': 'LESS',
                '.json': 'JSON',
                '.xml': 'XML',
                '.yaml': 'YAML',
                '.yml': 'YAML',
                '.md': 'Markdown'
            };

            // Find files matching these extensions (limit to reasonable number)
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,tsx,js,jsx,java,py,cs,cpp,c,go,rs,rb,php,swift,kt,scala}',
                '**/node_modules/**',
                100
            );

            files.forEach(file => {
                const ext = path.extname(file.fsPath);
                const lang = extensionToLanguage[ext];
                if (lang) {
                    languages.add(lang);
                }
            });

            // Check for package managers to infer languages
            if (fs.existsSync(path.join(workspaceRoot, 'package.json'))) {
                languages.add('JavaScript/TypeScript');
            }
            if (fs.existsSync(path.join(workspaceRoot, 'pom.xml')) || 
                fs.existsSync(path.join(workspaceRoot, 'build.gradle'))) {
                languages.add('Java');
            }
            if (fs.existsSync(path.join(workspaceRoot, 'requirements.txt')) ||
                fs.existsSync(path.join(workspaceRoot, 'setup.py'))) {
                languages.add('Python');
            }
            if (fs.existsSync(path.join(workspaceRoot, 'Cargo.toml'))) {
                languages.add('Rust');
            }
            if (fs.existsSync(path.join(workspaceRoot, 'go.mod'))) {
                languages.add('Go');
            }

        } catch (error) {
            console.error('Error detecting languages:', error);
        }

        return Array.from(languages).sort();
    }

    /**
     * Get current active file path
     */
    private getCurrentFile(): string | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return editor.document.uri.fsPath;
        }

        // Return relative path if in workspace
        const filePath = editor.document.uri.fsPath;
        if (filePath.startsWith(workspaceRoot)) {
            return path.relative(workspaceRoot, filePath);
        }

        return filePath;
    }

    /**
     * Get project structure overview (top-level directories and key files)
     */
    private async getProjectStructure(): Promise<string | null> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return null;
        }

        try {
            const items: string[] = [];
            const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });

            // Get top-level directories (excluding common ignores)
            const ignoreDirs = ['node_modules', '.git', '.vscode', 'dist', 'build', 'target', '__pycache__', '.idea'];
            const dirs = entries
                .filter(e => e.isDirectory() && !ignoreDirs.includes(e.name) && !e.name.startsWith('.'))
                .map(e => `  📁 ${e.name}/`)
                .slice(0, 10); // Limit to 10 directories

            // Get key files (config, readme, etc.)
            const keyFiles = [
                'package.json', 'pom.xml', 'build.gradle', 'Cargo.toml', 'go.mod',
                'requirements.txt', 'setup.py', 'README.md', 'tsconfig.json',
                'docker-compose.yml', 'Dockerfile', '.env'
            ];
            const files = entries
                .filter(e => e.isFile() && keyFiles.includes(e.name))
                .map(e => `  📄 ${e.name}`);

            items.push(...dirs, ...files);

            if (items.length === 0) {
                return '  (empty or access restricted)';
            }

            return items.join('\n');
        } catch (error) {
            console.error('Error reading project structure:', error);
            return '  (error reading structure)';
        }
    }

    /**
     * Get Git repository information
     */
    private async getGitInfo(): Promise<string | null> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return null;
        }

        try {
            // Check if .git directory exists
            const gitPath = path.join(workspaceRoot, '.git');
            if (!fs.existsSync(gitPath)) {
                return '  Not a git repository';
            }

            // Try to get git extension API
            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
            if (!gitExtension) {
                return '  Git repository (details unavailable)';
            }

            const git = gitExtension.getAPI(1);
            const repo = git.repositories[0];
            
            if (!repo) {
                return '  Git repository (no active repo)';
            }

            const info: string[] = [];
            
            // Current branch
            const branch = repo.state.HEAD?.name;
            if (branch) {
                info.push(`Branch: ${branch}`);
            }

            // Remote URL (sanitized)
            const remotes = repo.state.remotes;
            if (remotes && remotes.length > 0) {
                const remote = remotes[0];
                if (remote.fetchUrl) {
                    // Sanitize URL (remove credentials)
                    const sanitizedUrl = remote.fetchUrl.replace(/https?:\/\/[^@]+@/, 'https://');
                    info.push(`Remote: ${sanitizedUrl}`);
                }
            }

            // Working tree status
            const changes = repo.state.workingTreeChanges.length;
            const staged = repo.state.indexChanges.length;
            if (changes > 0 || staged > 0) {
                info.push(`Changes: ${changes} modified, ${staged} staged`);
            }

            return info.length > 0 ? `  ${info.join('\n  ')}` : '  Git repository (clean)';
        } catch (error) {
            console.error('Error reading git info:', error);
            return '  Git repository (error reading info)';
        }
    }

    /**
     * Get relevant VS Code settings
     */
    private getRelevantSettings(): string | null {
        try {
            const config = vscode.workspace.getConfiguration();
            const settings: string[] = [];

            // Tab/indentation settings
            const tabSize = config.get<number>('editor.tabSize');
            const insertSpaces = config.get<boolean>('editor.insertSpaces');
            if (tabSize !== undefined && insertSpaces !== undefined) {
                settings.push(`Indentation: ${insertSpaces ? `${tabSize} spaces` : 'tabs'}`);
            }

            // Line ending
            const eol = config.get<string>('files.eol');
            if (eol) {
                settings.push(`Line Ending: ${eol === '\n' ? 'LF' : 'CRLF'}`);
            }

            // File encoding
            const encoding = config.get<string>('files.encoding');
            if (encoding) {
                settings.push(`Encoding: ${encoding}`);
            }

            // Formatter
            const formatter = config.get<string>('editor.defaultFormatter');
            if (formatter) {
                settings.push(`Formatter: ${formatter}`);
            }

            return settings.length > 0 ? `  ${settings.join('\n  ')}` : null;
        } catch (error) {
            console.error('Error reading settings:', error);
            return null;
        }
    }
}
