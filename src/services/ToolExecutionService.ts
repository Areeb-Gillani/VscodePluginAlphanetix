import * as vscode from 'vscode';
import { ExecutorRegistry } from '../mcp/executors/ExecutorRegistry';
import { StateManager } from '../state/StateManager';
import { ApiClient } from '../api/ApiClient';

/**
 * Tool call in OpenAI format (actual structure from API)
 */
export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

/**
 * Tool call in Anthropic format
 */
export interface AnthropicToolUse {
    id: string;
    type: 'tool_use';
    name: string;
    input: Record<string, unknown>;
}

/**
 * Tool call in Gemini format
 */
export interface GeminiFunctionCall {
    name: string;
    args: Record<string, unknown>;
}

/**
 * Generic tool call representation (flattened for internal use)
 */
export interface GenericToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
    toolCallId: string;
    toolName: string;
    success: boolean;
    result?: unknown;
    error?: string;
    executionTime: number;
}

/**
 * Parsed tool calls from LLM response
 */
export interface ParsedToolCalls {
    provider: 'openai' | 'anthropic' | 'gemini';
    calls: GenericToolCall[];
}

/**
 * Service for executing tools called by LLMs
 */
export class ToolExecutionService {
    private static instance: ToolExecutionService;
    private registry: ExecutorRegistry;
    private stateManager: StateManager;
    private apiClient: ApiClient;

    private constructor() {
        this.registry = ExecutorRegistry.getInstance();
        this.stateManager = StateManager.getInstance();
        this.apiClient = ApiClient.getInstance();
    }

    public static getInstance(): ToolExecutionService {
        if (!ToolExecutionService.instance) {
            ToolExecutionService.instance = new ToolExecutionService();
        }
        return ToolExecutionService.instance;
    }

    /**
     * Parse tool calls from LLM response based on provider format
     */
    public parseToolCalls(response: unknown, provider: 'openai' | 'anthropic' | 'gemini'): ParsedToolCalls | null {
        try {
            switch (provider) {
                case 'openai':
                    return this.parseOpenAIToolCalls(response);
                case 'anthropic':
                    return this.parseAnthropicToolCalls(response);
                case 'gemini':
                    return this.parseGeminiToolCalls(response);
                default:
                    console.warn(`⚠️ Unknown provider: ${provider}`);
                    return null;
            }
        } catch (error) {
            console.error('🔧 ToolExecution: Failed to parse tool calls:', error);
            return null;
        }
    }

    /**
     * Parse OpenAI format tool calls
     */
    private parseOpenAIToolCalls(response: unknown): ParsedToolCalls | null {
        const message = (response as {choices?: {message?: {tool_calls?: OpenAIToolCall[]}}[]})?.choices?.[0]?.message;
        
        if (!message?.tool_calls || message.tool_calls.length === 0) {
            return null;
        }

        const calls: GenericToolCall[] = message.tool_calls.map((tc: OpenAIToolCall) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
        }));

        return { provider: 'openai', calls };
    }

    /**
     * Parse Anthropic format tool calls
     */
    private parseAnthropicToolCalls(response: unknown): ParsedToolCalls | null {
        const content = (response as {content?: unknown[]})?.content;
        
        if (!content || !Array.isArray(content)) {
            return null;
        }

        const toolUses = content.filter((c: unknown) => (c as AnthropicToolUse).type === 'tool_use');
        
        if (toolUses.length === 0) {
            return null;
        }

        const calls: GenericToolCall[] = toolUses.map((tu: unknown) => {
            const toolUse = tu as AnthropicToolUse;
            return {
                id: toolUse.id,
                name: toolUse.name,
                arguments: toolUse.input
            };
        });

        return { provider: 'anthropic', calls };
    }

    /**
     * Parse Gemini format tool calls
     */
    private parseGeminiToolCalls(response: unknown): ParsedToolCalls | null {
        const candidates = (response as {candidates?: unknown[]})?.candidates;
        
        if (!candidates || candidates.length === 0) {
            return null;
        }

        const content = (candidates[0] as {content?: {parts?: unknown[]}})?.content;
        const parts = content?.parts;

        if (!parts || !Array.isArray(parts)) {
            return null;
        }

        const functionCalls = parts.filter((p: unknown) => (p as {functionCall?: unknown}).functionCall);

        if (functionCalls.length === 0) {
            return null;
        }

        const calls: GenericToolCall[] = functionCalls.map((fc: unknown, index: number) => {
            const funcCall = fc as {functionCall: GeminiFunctionCall};
            return {
                id: `gemini_${Date.now()}_${index}`, // Gemini doesn't provide call IDs
                name: funcCall.functionCall.name,
                arguments: funcCall.functionCall.args
            };
        });

        return { provider: 'gemini', calls };
    }

    /**
     * Execute multiple tool calls
     */
    public async executeToolCalls(calls: GenericToolCall[]): Promise<ToolExecutionResult[]> {
        console.log(`🔧 ToolExecution: Executing ${calls.length} tool call(s)`);

        const results: ToolExecutionResult[] = [];

        for (const call of calls) {
            const result = await this.executeToolCall(call);
            results.push(result);
        }

        return results;
    }

    /**
     * Execute a single tool call
     */
    public async executeToolCall(call: GenericToolCall): Promise<ToolExecutionResult> {
        const startTime = Date.now();

        try {
            // Get session context
            const sessionId = await this.stateManager.getCurrentSessionId();
            const mode = await this.stateManager.getSessionMode();
            const userId = await this.stateManager.getUserId();

            if (!sessionId || !userId) {
                throw new Error('Session not initialized');
            }

            console.log(`🔧 ToolExecution: Executing ${call.name} with mode=${mode}`);

            // Get the tool definition to populate context
            const toolDefinition = this.registry.getToolDefinition(call.name);
            if (!toolDefinition) {
                throw new Error(`Tool definition not found: ${call.name}`);
            }

            // Check if user confirmation is needed for high-risk operations
            const confirmed = await this.checkUserConfirmation(call.name, toolDefinition, call.arguments);
            if (!confirmed) {
                throw new Error('Operation cancelled by user');
            }

            // Build execution context based on BaseExecutor's ExecutionContext interface
            const context = {
                toolName: call.name,
                toolVersion: toolDefinition.version,
                mode,
                sessionId,
                userId
            };

            // Execute via registry
            const result = await this.registry.execute(call.name, call.arguments, context);

            const executionTime = Date.now() - startTime;

            console.log(`✅ ToolExecution: ${call.name} completed in ${executionTime}ms`);

            // Log execution to backend (async, fire-and-forget)
            this.logExecutionToBackend(
                sessionId,
                call.name,
                toolDefinition.version,
                mode,
                call.arguments,
                result,
                'SUCCESS',
                null,
                executionTime
            ).catch(err => console.warn('Failed to log execution:', err));

            return {
                toolCallId: call.id,
                toolName: call.name,
                success: true,
                result,
                executionTime
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;

            console.error(`❌ ToolExecution: ${call.name} failed:`, errorMessage);

            // Log execution failure to backend (async, fire-and-forget)
            const sessionId = await this.stateManager.getCurrentSessionId();
            const toolDefinition = this.registry.getToolDefinition(call.name);
            const mode = await this.stateManager.getSessionMode();
            
            if (sessionId && toolDefinition) {
                this.logExecutionToBackend(
                    sessionId,
                    call.name,
                    toolDefinition.version,
                    mode,
                    call.arguments,
                    null,
                    'ERROR',
                    { message: errorMessage, stack: errorStack },
                    executionTime
                ).catch(err => console.warn('Failed to log execution:', err));
            }

            return {
                toolCallId: call.id,
                toolName: call.name,
                success: false,
                error: errorMessage,
                executionTime
            };
        }
    }

    /**
     * Format tool execution results for LLM consumption (provider-specific)
     */
    public formatResultsForLLM(
        results: ToolExecutionResult[],
        provider: 'openai' | 'anthropic' | 'gemini'
    ): unknown[] {
        switch (provider) {
            case 'openai':
                return this.formatOpenAIResults(results);
            case 'anthropic':
                return this.formatAnthropicResults(results);
            case 'gemini':
                return this.formatGeminiResults(results);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    /**
     * Format results for OpenAI (tool messages)
     */
    private formatOpenAIResults(results: ToolExecutionResult[]): unknown[] {
        return results.map(r => ({
            role: 'tool',
            tool_call_id: r.toolCallId,
            name: r.toolName,
            content: r.success 
                ? JSON.stringify(r.result, null, 2)
                : `Error: ${r.error}`
        }));
    }

    /**
     * Format results for Anthropic (tool_result content blocks)
     */
    private formatAnthropicResults(results: ToolExecutionResult[]): unknown[] {
        return results.map(r => ({
            type: 'tool_result',
            tool_use_id: r.toolCallId,
            content: r.success
                ? JSON.stringify(r.result, null, 2)
                : `Error: ${r.error}`,
            is_error: !r.success
        }));
    }

    /**
     * Format results for Gemini (functionResponse parts)
     */
    private formatGeminiResults(results: ToolExecutionResult[]): unknown[] {
        return results.map(r => ({
            functionResponse: {
                name: r.toolName,
                response: r.success
                    ? r.result
                    : { error: r.error }
            }
        }));
    }

    /**
     * Get current workspace path
     */
    private getWorkspacePath(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    /**
     * Check if LLM response contains tool calls
     */
    public hasToolCalls(response: unknown, provider: 'openai' | 'anthropic' | 'gemini'): boolean {
        const parsed = this.parseToolCalls(response, provider);
        return parsed !== null && parsed.calls.length > 0;
    }

    /**
     * Check if user confirmation is needed and prompt if required
     * Returns true if operation should proceed, false if cancelled
     */
    private async checkUserConfirmation(
        toolName: string,
        toolDefinition: any,
        args: Record<string, unknown>
    ): Promise<boolean> {
        // Check risk level - only prompt for high-risk operations
        const riskLevel = toolDefinition.risk_level || 'low';
        
        if (riskLevel !== 'high') {
            return true; // No confirmation needed for low/medium risk
        }

        // Build confirmation message based on tool type
        let message = `⚠️ The AI wants to execute a high-risk operation:\n\n`;
        let details = '';

        switch (toolName) {
            case 'write_file':
                details = `Write to file: ${args.path}\nContent length: ${(args.content as string)?.length || 0} chars`;
                break;
            case 'delete_file':
                details = `Delete file: ${args.path}`;
                break;
            case 'bash':
                details = `Execute command: ${args.command}`;
                break;
            case 'multi_edit':
                details = `Edit multiple files: ${(args.edits as any[])?.length || 0} files`;
                break;
            default:
                details = `Tool: ${toolName}`;
        }

        message += `${details}\n\nDo you want to allow this operation?`;

        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            'Allow',
            'Cancel'
        );

        return choice === 'Allow';
    }

    /**
     * Log tool execution to backend (async, fire-and-forget)
     */
    private async logExecutionToBackend(
        sessionId: string,
        toolName: string,
        toolVersion: string,
        mode: 'ask' | 'agent',
        inputParams: Record<string, unknown>,
        outputResult: unknown,
        status: 'SUCCESS' | 'ERROR',
        errorDetails: { message?: string; stack?: string } | null,
        executionDurationMs: number
    ): Promise<void> {
        try {
            const modeUpper = mode.toUpperCase();
            
            await this.apiClient.post(
                `/api/mcp/executions/log?sessionId=${sessionId}`,
                {
                    toolName,
                    toolVersion,
                    mode: modeUpper,
                    inputParams,
                    outputResult: outputResult ? { data: outputResult } : null,
                    status,
                    errorDetails,
                    executionDurationMs
                }
            );

            console.log(`📊 Logged execution: ${toolName} (${status}) to backend`);
        } catch (error) {
            // Log but don't throw - logging failures shouldn't break tool execution
            console.warn('⚠️ Failed to log execution to backend:', error);
        }
    }
}
