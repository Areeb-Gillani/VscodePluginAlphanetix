import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseExecutor, ExecutionContext, ValidationError, FileNotFoundError } from '../BaseExecutor';

interface EditOperation {
    old_string: string;
    new_string: string;
    replace_all?: boolean;
}

interface MultiEditArgs {
    file_path: string;
    edits: EditOperation[];
}

interface MultiEditResult {
    success: boolean;
    edits_applied: number;
    file_path: string;
}

/**
 * Executor for performing multiple edits to a single file in one operation
 * Edits are applied sequentially, with each edit operating on the result of the previous one
 * HIGH-RISK operation - all edits must succeed or none are applied (atomic)
 */
export class MultiEditExecutor extends BaseExecutor {
    private readFiles: Set<string>;

    constructor() {
        super('multi_edit', '1.0.0', 'high', 'modify');
        this.readFiles = new Set();
    }

    protected validateArgs(args: MultiEditArgs): void {
        this.validateRequired(args, ['file_path', 'edits']);
        this.validateType(args.file_path, 'string', 'file_path');

        if (!args.file_path.trim()) {
            throw new ValidationError('file_path cannot be empty');
        }

        // Ensure absolute path
        if (!path.isAbsolute(args.file_path)) {
            throw new ValidationError('file_path must be an absolute path');
        }

        // Validate edits array
        if (!Array.isArray(args.edits)) {
            throw new ValidationError('edits must be an array');
        }

        if (args.edits.length === 0) {
            throw new ValidationError('edits array cannot be empty');
        }

        // Validate each edit operation
        for (let i = 0; i < args.edits.length; i++) {
            const edit = args.edits[i];
            
            if (!edit.old_string || typeof edit.old_string !== 'string') {
                throw new ValidationError(`edits[${i}].old_string is required and must be a string`);
            }

            if (!edit.new_string || typeof edit.new_string !== 'string') {
                throw new ValidationError(`edits[${i}].new_string is required and must be a string`);
            }

            if (edit.old_string === edit.new_string) {
                throw new ValidationError(`edits[${i}]: old_string and new_string cannot be identical`);
            }

            if (edit.replace_all !== undefined && typeof edit.replace_all !== 'boolean') {
                throw new ValidationError(`edits[${i}].replace_all must be a boolean`);
            }
        }
    }

    protected async executeInternal(args: MultiEditArgs, _context: ExecutionContext): Promise<MultiEditResult> {
        console.log(`📝 MultiEdit: Processing ${args.edits.length} edits for ${args.file_path}`);

        // Check if file exists
        if (!fs.existsSync(args.file_path)) {
            throw new FileNotFoundError(`File not found: ${args.file_path}`);
        }

        // Ensure file was read first (if it exists)
        const normalizedPath = path.normalize(args.file_path);
        if (!this.readFiles.has(normalizedPath)) {
            throw new ValidationError(
                'You must use read_file tool first before editing. This ensures you have current file context.'
            );
        }

        // Read current file content
        let content = fs.readFileSync(args.file_path, 'utf-8');
        const originalContent = content;
        
        // Track applied edits
        let editsApplied = 0;

        try {
            // Apply each edit sequentially
            for (let i = 0; i < args.edits.length; i++) {
                const edit = args.edits[i];
                const replaceAll = edit.replace_all || false;

                console.log(`📝 MultiEdit: Applying edit ${i + 1}/${args.edits.length}...`);

                if (replaceAll) {
                    // Replace all occurrences
                    const occurrences = (content.match(new RegExp(this.escapeRegex(edit.old_string), 'g')) || []).length;
                    
                    if (occurrences === 0) {
                        throw new ValidationError(
                            `Edit ${i + 1}: old_string not found in file (after ${editsApplied} successful edits)`
                        );
                    }

                    content = content.split(edit.old_string).join(edit.new_string);
                    console.log(`📝 MultiEdit: Replaced ${occurrences} occurrence(s)`);
                } else {
                    // Replace single occurrence
                    const index = content.indexOf(edit.old_string);
                    
                    if (index === -1) {
                        throw new ValidationError(
                            `Edit ${i + 1}: old_string not found in file (after ${editsApplied} successful edits)`
                        );
                    }

                    // Check for multiple occurrences (ambiguous)
                    const secondIndex = content.indexOf(edit.old_string, index + 1);
                    if (secondIndex !== -1) {
                        throw new ValidationError(
                            `Edit ${i + 1}: old_string appears multiple times. Provide more context or use replace_all=true`
                        );
                    }

                    // Perform replacement
                    content = content.substring(0, index) + edit.new_string + content.substring(index + edit.old_string.length);
                    console.log(`📝 MultiEdit: Replaced single occurrence`);
                }

                editsApplied++;
            }

            // Write the final result
            fs.writeFileSync(args.file_path, content, 'utf-8');

            // Open file and show diff
            const document = await vscode.workspace.openTextDocument(args.file_path);
            await vscode.window.showTextDocument(document, {
                preview: false,
                preserveFocus: true
            });

            console.log(`✅ MultiEdit: Successfully applied ${editsApplied} edit(s) to ${args.file_path}`);

            vscode.window.showInformationMessage(
                `Applied ${editsApplied} edit(s) to ${path.basename(args.file_path)}`
            );

            return {
                success: true,
                edits_applied: editsApplied,
                file_path: args.file_path
            };

        } catch (error) {
            // Rollback: restore original content
            if (editsApplied > 0) {
                console.warn(`⚠️ MultiEdit: Rolling back ${editsApplied} edit(s) due to error`);
                fs.writeFileSync(args.file_path, originalContent, 'utf-8');
            }

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ MultiEdit: Failed:`, errorMessage);
            throw error;
        }
    }

    /**
     * Track that a file has been read (called by ReadFileExecutor)
     */
    public markFileAsRead(filePath: string): void {
        this.readFiles.add(path.normalize(filePath));
    }

    /**
     * Escape special regex characters
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
