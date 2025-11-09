import * as vscode from 'vscode';
import * as fs from 'fs';
import { BaseExecutor, ExecutionContext, ValidationError, FileNotFoundError } from '../BaseExecutor';

interface EditFileArgs {
    file_path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;
}

interface EditFileResult {
    success: boolean;
    file_path: string;
    replacements_made: number;
}

/**
 * Executor for performing exact string replacements in files
 * This is a high-risk operation that modifies existing files
 */
export class EditFileExecutor extends BaseExecutor {
    private fileReadTracker: Set<string>;

    constructor() {
        super('edit_file', '1.0.0', 'high', 'modify');
        this.fileReadTracker = new Set();
    }

    protected validateArgs(args: EditFileArgs): void {
        this.validateRequired(args, ['file_path', 'old_string', 'new_string']);
        this.validateType(args.file_path, 'string', 'file_path');
        this.validateType(args.old_string, 'string', 'old_string');
        this.validateType(args.new_string, 'string', 'new_string');

        if (args.replace_all !== undefined) {
            this.validateType(args.replace_all, 'boolean', 'replace_all');
        }

        // Validate that old_string and new_string are different
        if (args.old_string === args.new_string) {
            throw new ValidationError('old_string and new_string must be different');
        }

        // Validate that old_string is not empty
        if (args.old_string.length === 0) {
            throw new ValidationError('old_string cannot be empty');
        }
    }

    protected async executeInternal(args: EditFileArgs, context: ExecutionContext): Promise<EditFileResult> {
        const filePath = this.normalizeFilePath(args.file_path);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new FileNotFoundError(`File does not exist: ${filePath}`);
        }

        // Verify file was read first
        if (!this.fileReadTracker.has(filePath)) {
            throw new ValidationError(
                'Cannot edit file without reading it first. Use read_file tool before edit_file.'
            );
        }

        // Read current content
        const content = fs.readFileSync(filePath, 'utf-8');

        // Count occurrences
        const occurrences = this.countOccurrences(content, args.old_string);

        if (occurrences === 0) {
            throw new ValidationError(
                `String not found in file. The old_string does not exist in ${filePath}`
            );
        }

        // If not replace_all and multiple occurrences, fail
        if (!args.replace_all && occurrences > 1) {
            throw new ValidationError(
                `String is not unique in file (found ${occurrences} occurrences). ` +
                `Either provide more context to make old_string unique, or set replace_all=true`
            );
        }

        // Perform replacement
        let newContent: string;
        let replacementsMade: number;

        if (args.replace_all) {
            newContent = content.split(args.old_string).join(args.new_string);
            replacementsMade = occurrences;
        } else {
            newContent = content.replace(args.old_string, args.new_string);
            replacementsMade = 1;
        }

        // Write the modified content
        fs.writeFileSync(filePath, newContent, 'utf-8');

        console.log(`✏️ EditFile: Made ${replacementsMade} replacement(s) in ${filePath}`);

        // Open the file in VS Code to show changes
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });

        // Show diff if possible
        if (replacementsMade === 1) {
            vscode.window.showInformationMessage(
                `Replaced 1 occurrence in ${filePath}`,
                'Show Changes'
            ).then(selection => {
                if (selection === 'Show Changes') {
                    // Could implement diff view here
                    vscode.commands.executeCommand('workbench.files.action.compareWithSaved');
                }
            });
        } else {
            vscode.window.showInformationMessage(
                `Replaced ${replacementsMade} occurrences in ${filePath}`
            );
        }

        return {
            success: true,
            file_path: filePath,
            replacements_made: replacementsMade
        };
    }

    /**
     * Count occurrences of a string
     */
    private countOccurrences(content: string, search: string): number {
        return content.split(search).length - 1;
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
