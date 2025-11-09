import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { BaseExecutor, ExecutionContext, ValidationError, ExecutionTimeoutError } from '../BaseExecutor';

interface BashArgs {
    command: string;
    timeout?: number;
    description?: string;
    run_in_background?: boolean;
}

interface BashResult {
    stdout: string;
    stderr: string;
    exit_code: number;
    bash_id?: string;
}

/**
 * Executor for running shell commands
 * On Windows, translates to PowerShell commands
 * This is a HIGH-RISK operation
 */
export class BashExecutor extends BaseExecutor {
    private readonly DEFAULT_TIMEOUT = 120000; // 2 minutes
    private readonly MAX_TIMEOUT = 600000; // 10 minutes
    private readonly MAX_OUTPUT_SIZE = 30000; // 30KB characters
    private backgroundProcesses: Map<string, child_process.ChildProcess>;

    constructor() {
        super('bash', '1.0.0', 'high', 'modify');
        this.backgroundProcesses = new Map();
    }

    protected validateArgs(args: BashArgs): void {
        this.validateRequired(args, ['command']);
        this.validateType(args.command, 'string', 'command');

        if (args.command.trim().length === 0) {
            throw new ValidationError('command cannot be empty');
        }

        // Check for newlines
        if (args.command.includes('\n')) {
            throw new ValidationError(
                'command cannot contain newlines. Use semicolon (;) or && to chain commands'
            );
        }

        if (args.timeout !== undefined) {
            this.validateType(args.timeout, 'number', 'timeout');
            if (args.timeout <= 0 || args.timeout > this.MAX_TIMEOUT) {
                throw new ValidationError(
                    `timeout must be between 1 and ${this.MAX_TIMEOUT} milliseconds`
                );
            }
        }

        if (args.description !== undefined) {
            this.validateType(args.description, 'string', 'description');
        }

        if (args.run_in_background !== undefined) {
            this.validateType(args.run_in_background, 'boolean', 'run_in_background');
        }
    }

    protected async executeInternal(args: BashArgs, _context: ExecutionContext): Promise<BashResult> {
        const timeout = args.timeout || this.DEFAULT_TIMEOUT;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        // Detect platform and prepare command
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? 'powershell.exe' : '/bin/bash';
        const command = this.prepareCommand(args.command, isWindows);

        console.log(`🐚 Bash: Executing command: ${command}`);
        if (args.description) {
            console.log(`🐚 Bash: Description: ${args.description}`);
        }

        // Show user notification for high-risk commands
        if (this.isHighRiskCommand(command)) {
            const proceed = await vscode.window.showWarningMessage(
                `About to execute potentially dangerous command: ${command.substring(0, 100)}`,
                { modal: true },
                'Execute',
                'Cancel'
            );

            if (proceed !== 'Execute') {
                throw new ValidationError('Command execution cancelled by user');
            }
        }

        // Run in background if requested
        if (args.run_in_background) {
            return this.executeBackground(command, shell, workspaceFolder);
        }

        // Execute command synchronously
        return new Promise((resolve) => {
            const proc = child_process.exec(
                command,
                {
                    cwd: workspaceFolder,
                    shell,
                    timeout,
                    maxBuffer: 1024 * 1024 * 10 // 10MB
                },
                (error, stdout, stderr) => {
                    let exitCode = 0;
                    
                    if (error) {
                        if ((error as any).killed && (error as any).signal === 'SIGTERM') {
                            resolve({
                                stdout: this.truncateOutput(stdout),
                                stderr: 'Command timed out',
                                exit_code: 124 // Timeout exit code
                            });
                            return;
                        }
                        exitCode = error.code || 1;
                    }

                    resolve({
                        stdout: this.truncateOutput(stdout),
                        stderr: this.truncateOutput(stderr),
                        exit_code: exitCode
                    });
                }
            );

            // Show progress
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: args.description || 'Executing command...',
                cancellable: true
            }, (progress, token) => {
                token.onCancellationRequested(() => {
                    proc.kill();
                });

                return new Promise<void>(resolveProgress => {
                    proc.on('exit', () => resolveProgress());
                    proc.on('error', () => resolveProgress());
                });
            });
        });
    }

    /**
     * Execute command in background
     */
    private executeBackground(command: string, shell: string, cwd?: string): BashResult {
        const bashId = `bash_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        const proc = child_process.exec(command, {
            cwd,
            shell,
            maxBuffer: 1024 * 1024 * 10
        });

        this.backgroundProcesses.set(bashId, proc);

        // Clean up when process exits
        proc.on('exit', () => {
            this.backgroundProcesses.delete(bashId);
        });

        vscode.window.showInformationMessage(
            `Background process started (ID: ${bashId}). Use bash_output to check results.`
        );

        return {
            stdout: '',
            stderr: '',
            exit_code: 0,
            bash_id: bashId
        };
    }

    /**
     * Prepare command for execution on the target platform
     */
    private prepareCommand(command: string, isWindows: boolean): string {
        if (!isWindows) {
            return command;
        }

        // On Windows, adapt common Unix commands to PowerShell equivalents
        let adapted = command;

        // Common command translations
        const translations: Record<string, string> = {
            'ls': 'Get-ChildItem',
            'pwd': 'Get-Location',
            'cat': 'Get-Content',
            'echo': 'Write-Output',
            'rm': 'Remove-Item',
            'cp': 'Copy-Item',
            'mv': 'Move-Item',
            'mkdir': 'New-Item -ItemType Directory',
            'touch': 'New-Item -ItemType File'
        };

        // Simple word-boundary replacement
        for (const [unix, powershell] of Object.entries(translations)) {
            const regex = new RegExp(`\\b${unix}\\b`, 'g');
            adapted = adapted.replace(regex, powershell);
        }

        return adapted;
    }

    /**
     * Check if command is high-risk
     */
    private isHighRiskCommand(command: string): boolean {
        const highRiskPatterns = [
            /\brm\s+-rf\b/i,
            /\bformat\b/i,
            /\bdel\s+\/s\b/i,
            /\bdd\s+if=/i,
            /\bmkfs\b/i,
            /\bfdisk\b/i,
            />\s*\/dev\//i
        ];

        return highRiskPatterns.some(pattern => pattern.test(command));
    }

    /**
     * Truncate output if too large
     */
    private truncateOutput(output: string): string {
        if (output.length <= this.MAX_OUTPUT_SIZE) {
            return output;
        }

        const truncated = output.substring(0, this.MAX_OUTPUT_SIZE);
        return truncated + `\n\n... (output truncated, ${output.length - this.MAX_OUTPUT_SIZE} characters omitted)`;
    }

    /**
     * Get output from background process
     */
    public getBackgroundOutput(bashId: string): BashResult | null {
        const proc = this.backgroundProcesses.get(bashId);
        
        if (!proc) {
            return null;
        }

        // Check if process is still running
        if (proc.exitCode === null) {
            return {
                stdout: 'Process still running...',
                stderr: '',
                exit_code: -1,
                bash_id: bashId
            };
        }

        return {
            stdout: 'Background process completed',
            stderr: '',
            exit_code: proc.exitCode || 0,
            bash_id: bashId
        };
    }
}
