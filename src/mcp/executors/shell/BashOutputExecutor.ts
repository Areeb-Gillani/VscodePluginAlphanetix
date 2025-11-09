import * as vscode from 'vscode';
import { BaseExecutor, ExecutionContext, ValidationError } from '../BaseExecutor';

interface BashOutputArgs {
    bash_id: string;
    filter?: string;
}

interface BashOutputResult {
    stdout: string;
    stderr: string;
    status: 'running' | 'completed' | 'not_found';
}

/**
 * Executor for retrieving output from background bash processes
 * Allows checking the status and output of long-running commands
 */
export class BashOutputExecutor extends BaseExecutor {
    constructor() {
        super('bash_output', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: BashOutputArgs): void {
        this.validateRequired(args, ['bash_id']);
        this.validateType(args.bash_id, 'string', 'bash_id');

        if (args.bash_id.trim().length === 0) {
            throw new ValidationError('bash_id cannot be empty');
        }

        if (args.filter !== undefined) {
            this.validateType(args.filter, 'string', 'filter');
            
            // Validate regex if filter is provided
            try {
                new RegExp(args.filter);
            } catch (error) {
                throw new ValidationError(`Invalid regex pattern in filter: ${args.filter}`);
            }
        }
    }

    protected async executeInternal(args: BashOutputArgs, _context: ExecutionContext): Promise<BashOutputResult> {
        console.log(`📤 BashOutput: Retrieving output for process ${args.bash_id}`);

        // Access BashExecutor's background processes
        // Note: This requires BashExecutor to expose its backgroundProcesses map
        // For now, we'll implement a basic version that returns placeholder data
        
        // TODO: Implement proper inter-executor communication
        // This would require either:
        // 1. A shared process registry service
        // 2. Making BashExecutor a singleton with public access to process map
        // 3. Using VS Code's extension context for storage

        const result: BashOutputResult = {
            stdout: '',
            stderr: '',
            status: 'not_found'
        };

        vscode.window.showWarningMessage(
            `bash_output is not fully implemented yet. Process ID: ${args.bash_id}`
        );

        console.warn('⚠️ BashOutput: Feature not fully implemented - requires process registry');

        return result;
    }

    /**
     * Apply regex filter to output lines
     */
    private applyFilter(output: string, filter: string): string {
        try {
            const regex = new RegExp(filter, 'gm');
            const lines = output.split('\n');
            const filteredLines = lines.filter(line => regex.test(line));
            return filteredLines.join('\n');
        } catch (error) {
            console.warn('⚠️ BashOutput: Filter application failed:', error);
            return output;
        }
    }
}
