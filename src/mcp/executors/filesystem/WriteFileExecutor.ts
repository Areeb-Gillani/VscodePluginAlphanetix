import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseExecutor, ExecutionContext, ValidationError, PermissionError } from '../BaseExecutor';

interface WriteFileArgs {
    file_path: string;
    content: string;
}

interface WriteFileResult {
    success: boolean;
    file_path: string;
    bytes_written: number;
}

/**
 * Executor for writing files to the filesystem
 * WARNING: This is a high-risk operation that can overwrite existing files
 */
export class WriteFileExecutor extends BaseExecutor {
    private fileReadTracker: Set<string>;

    constructor() {
        super('write_file', '1.0.0', 'high', 'modify');
        this.fileReadTracker = new Set();
    }

    protected validateArgs(args: WriteFileArgs): void {
        this.validateRequired(args, ['file_path', 'content']);
        this.validateType(args.file_path, 'string', 'file_path');
        this.validateType(args.content, 'string', 'content');
    }

    protected async executeInternal(args: WriteFileArgs, context: ExecutionContext): Promise<WriteFileResult> {
        const filePath = this.normalizeFilePath(args.file_path);

        // Check if file exists
        const fileExists = fs.existsSync(filePath);

        // If file exists, verify it was read first (safety check)
        if (fileExists && !this.fileReadTracker.has(filePath)) {
            throw new ValidationError(
                'Cannot write to existing file without reading it first. Use read_file tool before write_file.'
            );
        }

        try {
            // Ensure directory exists
            const directory = path.dirname(filePath);
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            // Write file
            fs.writeFileSync(filePath, args.content, 'utf-8');
            
            const bytesWritten = Buffer.byteLength(args.content, 'utf-8');

            console.log(`✍️ WriteFile: Wrote ${bytesWritten} bytes to ${filePath}`);

            // Open the file in VS Code if it's not already open
            const uri = vscode.Uri.file(filePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });

            return {
                success: true,
                file_path: filePath,
                bytes_written: bytesWritten
            };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EACCES') {
                throw new PermissionError(`No permission to write to ${filePath}`);
            }
            throw error;
        }
    }

    /**
     * Mark a file as read (called by ReadFileExecutor or externally)
     */
    public markFileAsRead(filePath: string): void {
        this.fileReadTracker.add(filePath);
    }

    /**
     * Clear read tracker (for testing)
     */
    public clearReadTracker(): void {
        this.fileReadTracker.clear();
    }
}
