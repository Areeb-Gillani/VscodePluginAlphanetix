import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseExecutor, ExecutionContext, ValidationError, FileNotFoundError } from '../BaseExecutor';

interface ReadFileArgs {
    file_path: string;
    offset?: number;
    limit?: number;
}

interface ReadFileResult {
    content: string;
    lines_read: number;
    total_lines: number;
    file_type: string;
}

/**
 * Executor for reading files from the filesystem
 */
export class ReadFileExecutor extends BaseExecutor {
    constructor() {
        super('read_file', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: ReadFileArgs): void {
        this.validateRequired(args, ['file_path']);
        this.validateType(args.file_path, 'string', 'file_path');

        if (args.offset !== undefined) {
            this.validateType(args.offset, 'number', 'offset');
            if (args.offset < 0) {
                throw new ValidationError('offset must be non-negative');
            }
        }

        if (args.limit !== undefined) {
            this.validateType(args.limit, 'number', 'limit');
            if (args.limit <= 0) {
                throw new ValidationError('limit must be positive');
            }
        }
    }

    protected async executeInternal(args: ReadFileArgs, context: ExecutionContext): Promise<ReadFileResult> {
        const filePath = this.normalizeFilePath(args.file_path);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new FileNotFoundError(`File does not exist: ${filePath}`);
        }

        // Check if it's a file (not directory)
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            throw new ValidationError(`Path is not a file: ${filePath}`);
        }

        // Detect file type
        const fileType = this.detectFileType(filePath);

        // Read file content
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const totalLines = lines.length;

        // Apply offset and limit
        const offset = args.offset || 0;
        const limit = args.limit || 2000;
        const selectedLines = lines.slice(offset, offset + limit);

        // Format with line numbers (cat -n format)
        const formattedContent = selectedLines
            .map((line, index) => {
                const lineNumber = offset + index + 1;
                // Truncate lines longer than 2000 characters
                const truncatedLine = line.length > 2000 ? line.substring(0, 2000) + '...' : line;
                return `${lineNumber}\t${truncatedLine}`;
            })
            .join('\n');

        // Warn if file is empty
        if (totalLines === 0 || content.trim().length === 0) {
            console.warn(`⚠️ Warning: File ${filePath} is empty`);
        }

        return {
            content: formattedContent,
            lines_read: selectedLines.length,
            total_lines: totalLines,
            file_type: fileType
        };
    }

    private detectFileType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        
        const typeMap: { [key: string]: string } = {
            '.txt': 'text',
            '.md': 'markdown',
            '.json': 'json',
            '.xml': 'xml',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.c': 'c',
            '.cpp': 'cpp',
            '.h': 'header',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sql': 'sql',
            '.sh': 'shell',
            '.bat': 'batch',
            '.ps1': 'powershell',
            '.ipynb': 'notebook',
            '.pdf': 'pdf',
            '.png': 'image',
            '.jpg': 'image',
            '.jpeg': 'image',
            '.gif': 'image',
            '.svg': 'image'
        };

        return typeMap[ext] || 'text';
    }
}
