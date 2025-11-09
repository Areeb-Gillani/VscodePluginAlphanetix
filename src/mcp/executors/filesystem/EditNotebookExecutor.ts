import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BaseExecutor, ExecutionContext, ValidationError, FileNotFoundError } from '../BaseExecutor';

interface EditNotebookArgs {
    notebook_path: string;
    cell_id?: string;
    cell_idx?: number;
    new_source?: string;
    old_string?: string;
    new_string?: string;
}

interface EditNotebookResult {
    success: boolean;
    message?: string;
}

/**
 * Executor for editing Jupyter notebook cells
 * Supports editing existing cells and creating new cells
 */
export class EditNotebookExecutor extends BaseExecutor {
    constructor() {
        super('edit_notebook', '1.0.0', 'high', 'modify');
    }

    protected validateArgs(args: EditNotebookArgs): void {
        this.validateRequired(args, ['notebook_path']);
        this.validateType(args.notebook_path, 'string', 'notebook_path');

        if (!args.notebook_path.trim()) {
            throw new ValidationError('notebook_path cannot be empty');
        }

        // Must end with .ipynb
        if (!args.notebook_path.endsWith('.ipynb')) {
            throw new ValidationError('notebook_path must be a .ipynb file');
        }

        // Ensure absolute path
        if (!path.isAbsolute(args.notebook_path)) {
            throw new ValidationError('notebook_path must be an absolute path');
        }

        // Validate cell identification
        if (args.cell_id === undefined && args.cell_idx === undefined) {
            throw new ValidationError('Either cell_id or cell_idx must be provided');
        }

        if (args.cell_id !== undefined) {
            this.validateType(args.cell_id, 'string', 'cell_id');
        }

        if (args.cell_idx !== undefined) {
            this.validateType(args.cell_idx, 'number', 'cell_idx');
            if (args.cell_idx < 0) {
                throw new ValidationError('cell_idx must be non-negative');
            }
        }

        // Validate edit parameters
        if (args.new_source === undefined && (args.old_string === undefined || args.new_string === undefined)) {
            throw new ValidationError('Either new_source or both old_string and new_string must be provided');
        }

        if (args.new_source !== undefined) {
            this.validateType(args.new_source, 'string', 'new_source');
        }

        if (args.old_string !== undefined) {
            this.validateType(args.old_string, 'string', 'old_string');
        }

        if (args.new_string !== undefined) {
            this.validateType(args.new_string, 'string', 'new_string');
        }
    }

    protected async executeInternal(args: EditNotebookArgs, _context: ExecutionContext): Promise<EditNotebookResult> {
        console.log(`📓 EditNotebook: Editing ${args.notebook_path}`);

        // Check if file exists
        if (!fs.existsSync(args.notebook_path)) {
            throw new FileNotFoundError(`Notebook not found: ${args.notebook_path}`);
        }

        try {
            // Read notebook file
            const notebookContent = fs.readFileSync(args.notebook_path, 'utf-8');
            const notebook = JSON.parse(notebookContent);

            // Validate notebook structure
            if (!notebook.cells || !Array.isArray(notebook.cells)) {
                throw new ValidationError('Invalid notebook format: missing cells array');
            }

            // Find target cell
            let cellIndex: number;
            if (args.cell_idx !== undefined) {
                cellIndex = args.cell_idx;
            } else if (args.cell_id !== undefined) {
                cellIndex = notebook.cells.findIndex((cell: {id?: string}) => cell.id === args.cell_id);
                if (cellIndex === -1) {
                    throw new ValidationError(`Cell with id ${args.cell_id} not found`);
                }
            } else {
                throw new ValidationError('Either cell_id or cell_idx must be provided');
            }

            // Validate cell index
            if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
                throw new ValidationError(`Cell index ${cellIndex} out of range (0-${notebook.cells.length - 1})`);
            }

            const cell = notebook.cells[cellIndex];

            // Get current source (join if it's an array)
            const currentSource = Array.isArray(cell.source) ? cell.source.join('') : cell.source;

            // Apply edit
            let newSource: string;
            if (args.new_source !== undefined) {
                // Replace entire cell content
                newSource = args.new_source;
            } else if (args.old_string !== undefined && args.new_string !== undefined) {
                // String replacement
                if (!currentSource.includes(args.old_string)) {
                    throw new ValidationError('old_string not found in cell');
                }

                newSource = currentSource.replace(args.old_string, args.new_string);
            } else {
                throw new ValidationError('Invalid edit parameters');
            }

            // Update cell source (notebooks typically store source as array of lines)
            notebook.cells[cellIndex].source = newSource.split('\n').map((line, i, arr) => 
                i < arr.length - 1 ? line + '\n' : line
            );

            // Write back to file
            fs.writeFileSync(args.notebook_path, JSON.stringify(notebook, null, 2), 'utf-8');

            // Open notebook in VS Code
            const uri = vscode.Uri.file(args.notebook_path);
            await vscode.commands.executeCommand('vscode.open', uri);

            console.log(`✅ EditNotebook: Successfully edited cell ${cellIndex}`);

            vscode.window.showInformationMessage(
                `Edited cell ${cellIndex} in ${path.basename(args.notebook_path)}`
            );

            return {
                success: true,
                message: `Successfully edited cell ${cellIndex}`
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ EditNotebook: Failed:`, errorMessage);
            
            if (error instanceof ValidationError) {
                throw error;
            }
            
            throw new ValidationError(`Failed to edit notebook: ${errorMessage}`);
        }
    }
}
