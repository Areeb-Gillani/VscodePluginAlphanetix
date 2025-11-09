import * as vscode from 'vscode';
import { BaseExecutor, ExecutionContext, ValidationError } from '../BaseExecutor';

interface GrepSearchArgs {
    pattern: string;
    glob?: string;
    type?: string;
    output_mode?: 'content' | 'files_with_matches' | 'count';
    multiline?: boolean;
    case_sensitive?: boolean;
}

interface SearchMatch {
    file: string;
    line?: number;
    column?: number;
    content?: string;
    count?: number;
}

interface GrepSearchResult {
    matches: SearchMatch[];
    total_matches: number;
    truncated: boolean;
}

/**
 * Executor for searching code using VS Code's search functionality
 * Simulates ripgrep-like behavior
 */
export class GrepSearchExecutor extends BaseExecutor {
    private readonly MAX_RESULTS = 50;

    constructor() {
        super('grep_search', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: GrepSearchArgs): void {
        this.validateRequired(args, ['pattern']);
        this.validateType(args.pattern, 'string', 'pattern');

        if (args.pattern.trim().length === 0) {
            throw new ValidationError('pattern cannot be empty');
        }

        if (args.glob !== undefined) {
            this.validateType(args.glob, 'string', 'glob');
        }

        if (args.type !== undefined) {
            this.validateType(args.type, 'string', 'type');
        }

        if (args.output_mode !== undefined) {
            if (!['content', 'files_with_matches', 'count'].includes(args.output_mode)) {
                throw new ValidationError(
                    'output_mode must be one of: content, files_with_matches, count'
                );
            }
        }

        if (args.multiline !== undefined) {
            this.validateType(args.multiline, 'boolean', 'multiline');
        }

        if (args.case_sensitive !== undefined) {
            this.validateType(args.case_sensitive, 'boolean', 'case_sensitive');
        }
    }

    protected async executeInternal(args: GrepSearchArgs, _context: ExecutionContext): Promise<GrepSearchResult> {
        const outputMode = args.output_mode || 'files_with_matches';
        
        // Build file pattern
        let includePattern = '**/*';
        if (args.glob) {
            includePattern = args.glob;
        } else if (args.type) {
            includePattern = this.typeToGlob(args.type);
        }

        // Exclude common directories
        const excludePattern = '{**/node_modules/**,**/dist/**,**/build/**,**/target/**,**/.git/**,**/out/**}';

        try {
            // Use VS Code's findFiles to get candidate files, then search content
            const files = await vscode.workspace.findFiles(includePattern, excludePattern, this.MAX_RESULTS * 2);
            
            const matches: SearchMatch[] = [];
            const fileMap = new Map<string, number>();
            const regex = new RegExp(args.pattern, args.case_sensitive ? 'g' : 'gi');

            for (const fileUri of files) {
                if (matches.length >= this.MAX_RESULTS && outputMode !== 'count') {
                    break;
                }

                try {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const text = document.getText();
                    const lines = text.split('\n');

                    let fileMatchCount = 0;

                    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
                        const line = lines[lineNum];
                        const lineMatches = line.match(regex);

                        if (lineMatches) {
                            fileMatchCount += lineMatches.length;

                            if (outputMode === 'content' && matches.length < this.MAX_RESULTS) {
                                matches.push({
                                    file: fileUri.fsPath,
                                    line: lineNum + 1,
                                    column: line.indexOf(lineMatches[0]) + 1,
                                    content: line.trim()
                                });
                            }
                        }
                    }

                    if (fileMatchCount > 0) {
                        if (outputMode === 'files_with_matches' && !fileMap.has(fileUri.fsPath)) {
                            matches.push({ file: fileUri.fsPath });
                            fileMap.set(fileUri.fsPath, 1);
                        } else if (outputMode === 'count') {
                            fileMap.set(fileUri.fsPath, fileMatchCount);
                        }
                    }
                } catch (error) {
                    // Skip files that can't be read
                    console.warn(`⚠️ Could not read file ${fileUri.fsPath}:`, error);
                }
            }

            // For count mode, convert fileMap to matches
            if (outputMode === 'count') {
                for (const [file, count] of fileMap.entries()) {
                    matches.push({ file, count });
                }
            }

            const truncated = matches.length > this.MAX_RESULTS;
            const finalMatches = matches.slice(0, this.MAX_RESULTS);

            console.log(
                `🔍 GrepSearch: Found ${finalMatches.length} matches for pattern "${args.pattern}" ` +
                `(truncated: ${truncated})`
            );

            return {
                matches: finalMatches,
                total_matches: finalMatches.length,
                truncated
            };
        } catch (error) {
            console.error('🔍 GrepSearch: Search failed:', error);
            throw new ValidationError(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Convert file type to glob pattern
     */
    private typeToGlob(type: string): string {
        const typeMap: { [key: string]: string } = {
            'js': '**/*.{js,jsx}',
            'javascript': '**/*.{js,jsx}',
            'ts': '**/*.{ts,tsx}',
            'typescript': '**/*.{ts,tsx}',
            'py': '**/*.py',
            'python': '**/*.py',
            'java': '**/*.java',
            'c': '**/*.{c,h}',
            'cpp': '**/*.{cpp,hpp,cc,cxx}',
            'cs': '**/*.cs',
            'csharp': '**/*.cs',
            'go': '**/*.go',
            'rs': '**/*.rs',
            'rust': '**/*.rs',
            'rb': '**/*.rb',
            'ruby': '**/*.rb',
            'php': '**/*.php',
            'swift': '**/*.swift',
            'kt': '**/*.kt',
            'kotlin': '**/*.kt',
            'scala': '**/*.scala',
            'html': '**/*.{html,htm}',
            'css': '**/*.{css,scss,sass,less}',
            'json': '**/*.json',
            'xml': '**/*.xml',
            'yaml': '**/*.{yaml,yml}',
            'md': '**/*.{md,markdown}',
            'sql': '**/*.sql',
            'sh': '**/*.{sh,bash}',
            'ps1': '**/*.ps1',
            'powershell': '**/*.ps1'
        };

        return typeMap[type.toLowerCase()] || `**/*.${type}`;
    }
}
