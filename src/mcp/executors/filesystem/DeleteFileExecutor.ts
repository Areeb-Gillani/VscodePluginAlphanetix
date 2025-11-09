import * as vscode from 'vscode';
import * as fs from 'fs';
import { BaseExecutor, ExecutionContext, ValidationError, FileNotFoundError } from '../BaseExecutor';

interface DeleteFileArgs {
    file_path: string;
}

interface DeleteFileResult {
    success: boolean;
    message?: string;
}

/**
 * Executor for deleting files
 * HIGH-RISK operation that permanently removes files
 */
export class DeleteFileExecutor extends BaseExecutor {
    constructor() {
        super('delete_file', '1.0.0', 'high', 'modify');
    }

    protected validateArgs(args: DeleteFileArgs): void {
        this.validateRequired(args, ['file_path']);
        this.validateType(args.file_path, 'string', 'file_path');

        if (!args.file_path.trim()) {
            throw new ValidationError('file_path cannot be empty');
        }

        // Ensure absolute path
        if (!path.isAbsolute(args.file_path)) {
            throw new ValidationError('file_path must be an absolute path');
        }
    }

    protected async executeInternal(args: DeleteFileArgs, _context: ExecutionContext): Promise<DeleteFileResult> {
        console.log(`🗑️ DeleteFile: Deleting ${args.file_path}`);

        // Check if file exists
        if (!fs.existsSync(args.file_path)) {
            throw new FileNotFoundError(`File not found: ${args.file_path}`);
        }

        // Check if it's a file (not a directory)
        const stats = fs.statSync(args.file_path);
        if (!stats.isFile()) {
            throw new ValidationError('Path is not a file (may be a directory)');
        }

        // Confirm deletion with user
        const fileName = path.basename(args.file_path);
        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete "${fileName}"? This cannot be undone.`,
            { modal: true },
            'Delete',
            'Cancel'
        );

        if (confirmation !== 'Delete') {
            return {
                success: false,
                message: 'Deletion cancelled by user'
            };
        }

        try {
            // Delete the file
            fs.unlinkSync(args.file_path);

            console.log(`✅ DeleteFile: Successfully deleted ${args.file_path}`);

            vscode.window.showInformationMessage(`Deleted: ${fileName}`);

            return {
                success: true,
                message: `Successfully deleted ${fileName}`
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ DeleteFile: Failed to delete ${args.file_path}:`, errorMessage);
            throw new ValidationError(`Failed to delete file: ${errorMessage}`);
        }
    }
}

// Import path module
import * as path from 'path';
