import * as vscode from 'vscode';
import * as path from 'path';
import { BaseExecutor, ExecutionContext, ValidationError } from '../BaseExecutor';

interface GlobArgs {
    pattern: string;
}

interface GlobResult {
    matches: string[];
    count: number;
}

/**
 * Executor for finding files using glob patterns
 * Supports both glob patterns and fuzzy filename search
 */
export class GlobExecutor extends BaseExecutor {
    private readonly MAX_RESULTS = 10;

    constructor() {
        super('glob', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: GlobArgs): void {
        this.validateRequired(args, ['pattern']);
        this.validateType(args.pattern, 'string', 'pattern');

        if (args.pattern.trim().length === 0) {
            throw new ValidationError('pattern cannot be empty');
        }
    }

    protected async executeInternal(args: GlobArgs, _context: ExecutionContext): Promise<GlobResult> {
        const pattern = args.pattern.trim();

        // Check if pattern looks like a glob pattern (contains *, ?, [, etc.)
        const isGlobPattern = /[*?\[\]{}]/.test(pattern);

        let matches: vscode.Uri[];

        if (isGlobPattern) {
            // Use VS Code's findFiles for glob patterns
            matches = await this.findByGlobPattern(pattern);
        } else {
            // Use fuzzy search for simple filenames
            matches = await this.findByFuzzyName(pattern);
        }

        // Convert URIs to file paths and sort by modification time
        const sortedMatches = await this.sortByModificationTime(matches);

        // Limit results
        const limitedMatches = sortedMatches.slice(0, this.MAX_RESULTS);

        return {
            matches: limitedMatches,
            count: limitedMatches.length
        };
    }

    /**
     * Find files using glob pattern
     */
    private async findByGlobPattern(pattern: string): Promise<vscode.Uri[]> {
        // Normalize pattern for VS Code
        const normalizedPattern = pattern.startsWith('**/') ? pattern : `**/${pattern}`;
        
        // Exclude common directories
        const exclude = '{**/node_modules/**,**/dist/**,**/build/**,**/target/**,**/.git/**}';

        try {
            const uris = await vscode.workspace.findFiles(normalizedPattern, exclude, this.MAX_RESULTS);
            return uris;
        } catch (error) {
            console.error('🔍 Glob: Error finding files:', error);
            return [];
        }
    }

    /**
     * Find files by fuzzy name matching
     */
    private async findByFuzzyName(query: string): Promise<vscode.Uri[]> {
        // Search for files that contain the query in their name
        const pattern = `**/*${query}*`;
        const exclude = '{**/node_modules/**,**/dist/**,**/build/**,**/target/**,**/.git/**}';

        try {
            const uris = await vscode.workspace.findFiles(pattern, exclude, this.MAX_RESULTS);
            
            // Score and sort by relevance
            const scored = uris.map(uri => ({
                uri,
                score: this.calculateRelevanceScore(uri.fsPath, query)
            }));

            scored.sort((a, b) => b.score - a.score);
            
            return scored.map(item => item.uri);
        } catch (error) {
            console.error('🔍 Glob: Error in fuzzy search:', error);
            return [];
        }
    }

    /**
     * Calculate relevance score for fuzzy matching
     */
    private calculateRelevanceScore(filePath: string, query: string): number {
        const fileName = path.basename(filePath).toLowerCase();
        const queryLower = query.toLowerCase();
        
        let score = 0;

        // Exact match gets highest score
        if (fileName === queryLower) {
            score += 100;
        }

        // Starts with query
        if (fileName.startsWith(queryLower)) {
            score += 50;
        }

        // Contains query
        if (fileName.includes(queryLower)) {
            score += 25;
        }

        // Shorter paths are more relevant
        const depth = filePath.split(path.sep).length;
        score -= depth;

        // Prefer certain file types
        if (fileName.endsWith('.ts') || fileName.endsWith('.js') || fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
            score += 10;
        }

        return score;
    }

    /**
     * Sort URIs by modification time (newest first)
     */
    private async sortByModificationTime(uris: vscode.Uri[]): Promise<string[]> {
        const withStats = await Promise.all(
            uris.map(async uri => {
                try {
                    const stat = await vscode.workspace.fs.stat(uri);
                    return {
                        path: uri.fsPath,
                        mtime: stat.mtime
                    };
                } catch {
                    return {
                        path: uri.fsPath,
                        mtime: 0
                    };
                }
            })
        );

        withStats.sort((a, b) => b.mtime - a.mtime);
        
        return withStats.map(item => item.path);
    }
}
