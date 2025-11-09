import * as vscode from 'vscode';
import * as path from 'path';
import { BaseExecutor, ExecutionContext, ValidationError } from '../BaseExecutor';

interface CodebaseSearchArgs {
    query: string;
    target_directories?: string[];
    max_results?: number;
}

interface CodeSnippet {
    file: string;
    line_start: number;
    line_end: number;
    content: string;
    relevance_score: number;
}

interface CodebaseSearchResult {
    results: CodeSnippet[];
    total_results: number;
}

/**
 * Executor for semantic codebase search
 * Uses VS Code's symbol and text search capabilities for code discovery
 */
export class CodebaseSearchExecutor extends BaseExecutor {
    private readonly DEFAULT_MAX_RESULTS = 10;
    private readonly CONTEXT_LINES = 3;

    constructor() {
        super('codebase_search', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: CodebaseSearchArgs): void {
        this.validateRequired(args, ['query']);
        this.validateType(args.query, 'string', 'query');

        if (args.query.trim().length === 0) {
            throw new ValidationError('query cannot be empty');
        }

        if (args.target_directories !== undefined) {
            this.validateType(args.target_directories, 'array', 'target_directories');
        }

        if (args.max_results !== undefined) {
            this.validateType(args.max_results, 'number', 'max_results');
            if (args.max_results <= 0) {
                throw new ValidationError('max_results must be positive');
            }
        }
    }

    protected async executeInternal(args: CodebaseSearchArgs, _context: ExecutionContext): Promise<CodebaseSearchResult> {
        const maxResults = args.max_results || this.DEFAULT_MAX_RESULTS;
        const query = args.query.trim();

        console.log(`🔍 CodebaseSearch: Searching for "${query}"`);

        try {
            // Strategy: Multi-phase search combining different VS Code APIs
            const results: CodeSnippet[] = [];

            // Phase 1: Symbol search (most relevant for code queries)
            const symbolResults = await this.searchSymbols(query, args.target_directories);
            results.push(...symbolResults);

            // Phase 2: Text search if we don't have enough results
            if (results.length < maxResults) {
                const textResults = await this.searchText(query, args.target_directories, maxResults - results.length);
                results.push(...textResults);
            }

            // Sort by relevance score
            results.sort((a, b) => b.relevance_score - a.relevance_score);

            // Limit results
            const finalResults = results.slice(0, maxResults);

            console.log(`🔍 CodebaseSearch: Found ${finalResults.length} results`);

            return {
                results: finalResults,
                total_results: finalResults.length
            };
        } catch (error) {
            console.error('🔍 CodebaseSearch: Search failed:', error);
            throw new ValidationError(`Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Search workspace symbols (functions, classes, etc.)
     */
    private async searchSymbols(query: string, targetDirectories?: string[]): Promise<CodeSnippet[]> {
        const results: CodeSnippet[] = [];

        try {
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                query
            );

            if (!symbols) {
                return results;
            }

            for (const symbol of symbols) {
                // Filter by target directories if specified
                if (targetDirectories && !this.isInTargetDirectories(symbol.location.uri.fsPath, targetDirectories)) {
                    continue;
                }

                try {
                    const document = await vscode.workspace.openTextDocument(symbol.location.uri);
                    const range = symbol.location.range;
                    
                    // Get context lines
                    const startLine = Math.max(0, range.start.line - this.CONTEXT_LINES);
                    const endLine = Math.min(document.lineCount - 1, range.end.line + this.CONTEXT_LINES);
                    
                    const lines: string[] = [];
                    for (let i = startLine; i <= endLine; i++) {
                        lines.push(document.lineAt(i).text);
                    }

                    const content = lines.join('\n');
                    const relevanceScore = this.calculateRelevanceScore(symbol.name, query, symbol.kind);

                    results.push({
                        file: symbol.location.uri.fsPath,
                        line_start: startLine + 1,
                        line_end: endLine + 1,
                        content,
                        relevance_score: relevanceScore
                    });
                } catch (error) {
                    // Skip files that can't be read
                    console.warn(`⚠️ Could not read symbol location:`, error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Symbol search failed:', error);
        }

        return results;
    }

    /**
     * Search text content
     */
    private async searchText(query: string, targetDirectories?: string[], limit: number = 10): Promise<CodeSnippet[]> {
        const results: CodeSnippet[] = [];

        try {
            // Build include pattern
            let includePattern = '**/*.{ts,tsx,js,jsx,java,py,go,rs,cpp,c,cs}';
            if (targetDirectories && targetDirectories.length > 0) {
                const patterns = targetDirectories.map(dir => `${dir}/**`);
                includePattern = `{${patterns.join(',')}}`;
            }

            const excludePattern = '{**/node_modules/**,**/dist/**,**/build/**,**/target/**,**/.git/**,**/out/**}';

            // Get candidate files
            const files = await vscode.workspace.findFiles(includePattern, excludePattern, limit * 3);
            const processedFiles = new Set<string>();

            for (const fileUri of files) {
                if (results.length >= limit) {
                    break;
                }

                const filePath = fileUri.fsPath;

                // Skip if already processed
                if (processedFiles.has(filePath)) {
                    continue;
                }
                processedFiles.add(filePath);

                try {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const text = document.getText();
                    
                    // Simple case-insensitive search
                    const lowerText = text.toLowerCase();
                    const lowerQuery = query.toLowerCase();
                    const matchIndex = lowerText.indexOf(lowerQuery);

                    if (matchIndex === -1) {
                        continue;
                    }

                    // Find the line number
                    const textBeforeMatch = text.substring(0, matchIndex);
                    const line = textBeforeMatch.split('\n').length - 1;

                    // Get context
                    const startLine = Math.max(0, line - this.CONTEXT_LINES);
                    const endLine = Math.min(document.lineCount - 1, line + this.CONTEXT_LINES);

                    const lines: string[] = [];
                    for (let i = startLine; i <= endLine; i++) {
                        lines.push(document.lineAt(i).text);
                    }

                    const content = lines.join('\n');
                    const relevanceScore = this.calculateTextRelevanceScore(content, query, filePath);

                    results.push({
                        file: filePath,
                        line_start: startLine + 1,
                        line_end: endLine + 1,
                        content,
                        relevance_score: relevanceScore
                    });
                } catch (error) {
                    console.warn(`⚠️ Could not read file ${filePath}:`, error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Text search failed:', error);
        }

        return results;
    }

    /**
     * Calculate relevance score for symbols
     */
    private calculateRelevanceScore(symbolName: string, query: string, kind: vscode.SymbolKind): number {
        const lowerSymbol = symbolName.toLowerCase();
        const lowerQuery = query.toLowerCase();

        let score = 0;

        // Exact match
        if (lowerSymbol === lowerQuery) {
            score += 100;
        }

        // Starts with query
        if (lowerSymbol.startsWith(lowerQuery)) {
            score += 50;
        }

        // Contains query
        if (lowerSymbol.includes(lowerQuery)) {
            score += 25;
        }

        // Bonus for certain symbol kinds
        if (kind === vscode.SymbolKind.Function || kind === vscode.SymbolKind.Method) {
            score += 10;
        } else if (kind === vscode.SymbolKind.Class || kind === vscode.SymbolKind.Interface) {
            score += 8;
        }

        return score;
    }

    /**
     * Calculate relevance score for text matches
     */
    private calculateTextRelevanceScore(content: string, query: string, filePath: string): number {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();

        let score = 0;

        // Count occurrences
        const occurrences = (lowerContent.match(new RegExp(lowerQuery, 'g')) || []).length;
        score += occurrences * 5;

        // Bonus for code files (vs test files)
        const fileName = path.basename(filePath).toLowerCase();
        if (!fileName.includes('test') && !fileName.includes('spec')) {
            score += 10;
        }

        // Bonus for certain file types
        if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
            score += 5;
        }

        return score;
    }

    /**
     * Check if file is in target directories
     */
    private isInTargetDirectories(filePath: string, targetDirectories: string[]): boolean {
        const normalizedPath = filePath.replace(/\\/g, '/');
        
        return targetDirectories.some(dir => {
            const normalizedDir = dir.replace(/\\/g, '/');
            return normalizedPath.includes(normalizedDir);
        });
    }
}
