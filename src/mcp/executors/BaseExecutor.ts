import * as vscode from 'vscode';

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    executionTimeMs: number;
}

/**
 * Tool execution context with metadata
 */
export interface ExecutionContext {
    toolName: string;
    toolVersion: string;
    mode: 'ask' | 'agent';
    sessionId?: string;
    userId?: string;
}

/**
 * Base class for all tool executors
 * Provides common functionality for validation, error handling, and logging
 */
export abstract class BaseExecutor {
    protected toolName: string;
    protected toolVersion: string;
    protected riskLevel: 'low' | 'medium' | 'high';
    protected executionType: 'fetch' | 'modify';

    constructor(
        toolName: string,
        toolVersion: string,
        riskLevel: 'low' | 'medium' | 'high',
        executionType: 'fetch' | 'modify'
    ) {
        this.toolName = toolName;
        this.toolVersion = toolVersion;
        this.riskLevel = riskLevel;
        this.executionType = executionType;
    }

    /**
     * Execute the tool with the given arguments
     */
    public async execute(args: any, context: ExecutionContext): Promise<ToolExecutionResult> {
        const startTime = Date.now();
        
        try {
            console.log(`🔧 Executor: Starting ${this.toolName} v${this.toolVersion}`);
            
            // Validate arguments
            this.validateArgs(args);
            
            // Check mode compatibility
            this.checkModeCompatibility(context.mode);
            
            // Execute the tool
            const result = await this.executeInternal(args, context);
            
            const executionTimeMs = Date.now() - startTime;
            console.log(`🔧 Executor: ${this.toolName} completed in ${executionTimeMs}ms`);
            
            return {
                success: true,
                data: result,
                executionTimeMs
            };
        } catch (error) {
            const executionTimeMs = Date.now() - startTime;
            console.error(`🔧 Executor: ${this.toolName} failed:`, error);
            
            return this.handleError(error as Error, executionTimeMs);
        }
    }

    /**
     * Internal execution logic - implemented by subclasses
     */
    protected abstract executeInternal(args: any, context: ExecutionContext): Promise<any>;

    /**
     * Validate arguments against schema - implemented by subclasses
     */
    protected abstract validateArgs(args: any): void;

    /**
     * Check if the tool can run in the given mode
     */
    protected checkModeCompatibility(mode: 'ask' | 'agent'): void {
        if (this.executionType === 'modify' && mode === 'ask') {
            throw new Error(
                `Tool ${this.toolName} cannot run in ASK mode (requires AGENT mode for ${this.executionType} operations)`
            );
        }
    }

    /**
     * Handle errors and convert to ToolExecutionResult
     */
    protected handleError(error: Error, executionTimeMs: number): ToolExecutionResult {
        let errorMessage = error.message;
        
        // Provide user-friendly error messages
        if (error instanceof ValidationError) {
            errorMessage = `Invalid arguments: ${error.message}`;
        } else if (error instanceof PermissionError) {
            errorMessage = `Permission denied: ${error.message}`;
        } else if (error instanceof FileNotFoundError) {
            errorMessage = `File not found: ${error.message}`;
        }

        return {
            success: false,
            error: errorMessage,
            executionTimeMs
        };
    }

    /**
     * Validate required fields
     */
    protected validateRequired(args: any, requiredFields: string[]): void {
        for (const field of requiredFields) {
            if (args[field] === undefined || args[field] === null) {
                throw new ValidationError(`Missing required field: ${field}`);
            }
        }
    }

    /**
     * Validate field types
     */
    protected validateType(value: any, expectedType: string, fieldName: string): void {
        const actualType = typeof value;
        
        if (expectedType === 'array' && !Array.isArray(value)) {
            throw new ValidationError(`Field ${fieldName} must be an array`);
        } else if (expectedType !== 'array' && actualType !== expectedType) {
            throw new ValidationError(
                `Field ${fieldName} must be of type ${expectedType}, got ${actualType}`
            );
        }
    }

    /**
     * Normalize file path to absolute path
     */
    protected normalizeFilePath(filePath: string): string {
        // Handle VS Code URIs
        if (filePath.startsWith('file://')) {
            return vscode.Uri.parse(filePath).fsPath;
        }

        // Ensure absolute path
        if (!this.isAbsolutePath(filePath)) {
            throw new ValidationError('File path must be absolute, not relative');
        }

        return filePath;
    }

    /**
     * Check if path is absolute
     */
    protected isAbsolutePath(filePath: string): boolean {
        // Windows: C:\path or \\UNC\path
        // Unix: /path
        return /^([a-zA-Z]:[\\/]|\\\\|\/)/i.test(filePath);
    }

    /**
     * Get tool metadata
     */
    public getMetadata() {
        return {
            name: this.toolName,
            version: this.toolVersion,
            riskLevel: this.riskLevel,
            executionType: this.executionType
        };
    }
}

/**
 * Custom error classes for better error handling
 */
export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class PermissionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PermissionError';
    }
}

export class FileNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileNotFoundError';
    }
}

export class ExecutionTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExecutionTimeoutError';
    }
}
