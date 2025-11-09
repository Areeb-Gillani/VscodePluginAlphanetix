import * as fs from 'fs';
import * as path from 'path';
import { BaseExecutor, ExecutionContext, ValidationError, FileNotFoundError } from '../BaseExecutor';

interface ListDirectoryArgs {
    path: string;
    ignore?: string[];
}

interface DirectoryEntry {
    name: string;
    type: 'file' | 'directory';
    size: number;
}

interface ListDirectoryResult {
    entries: DirectoryEntry[];
    path: string;
}

/**
 * Executor for listing directory contents
 */
export class ListDirectoryExecutor extends BaseExecutor {
    constructor() {
        super('ls', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: ListDirectoryArgs): void {
        this.validateRequired(args, ['path']);
        this.validateType(args.path, 'string', 'path');

        if (args.ignore !== undefined) {
            this.validateType(args.ignore, 'array', 'ignore');
        }
    }

    protected async executeInternal(args: ListDirectoryArgs, context: ExecutionContext): Promise<ListDirectoryResult> {
        const dirPath = this.normalizeFilePath(args.path);

        // Check if directory exists
        if (!fs.existsSync(dirPath)) {
            throw new FileNotFoundError(`Directory does not exist: ${dirPath}`);
        }

        // Check if it's a directory
        const stats = fs.statSync(dirPath);
        if (!stats.isDirectory()) {
            throw new ValidationError(`Path is not a directory: ${dirPath}`);
        }

        // Read directory entries
        const fileNames = fs.readdirSync(dirPath);
        const entries: DirectoryEntry[] = [];

        // Build ignore patterns
        const ignorePatterns = args.ignore || [];

        for (const fileName of fileNames) {
            // Check if should be ignored
            if (this.shouldIgnore(fileName, ignorePatterns)) {
                continue;
            }

            try {
                const fullPath = path.join(dirPath, fileName);
                const entryStats = fs.statSync(fullPath);

                entries.push({
                    name: fileName,
                    type: entryStats.isDirectory() ? 'directory' : 'file',
                    size: entryStats.size
                });
            } catch (error) {
                // Skip entries that can't be read (e.g., permission denied)
                console.warn(`⚠️ ListDirectory: Cannot read ${fileName}:`, error);
            }
        }

        // Sort: directories first, then files, alphabetically
        entries.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
        });

        return {
            entries,
            path: dirPath
        };
    }

    /**
     * Check if a file should be ignored based on patterns
     */
    private shouldIgnore(fileName: string, patterns: string[]): boolean {
        for (const pattern of patterns) {
            if (this.matchesPattern(fileName, pattern)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Simple glob pattern matching
     * Supports: *, ?, [abc], [a-z]
     */
    private matchesPattern(fileName: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
            .replace(/\[([^\]]+)\]/g, '[$1]');
        
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(fileName);
    }
}
