import * as vscode from 'vscode';
import { 
    MCPTool, 
    MCPToolCall, 
    MCPToolResult, 
    MCPContext,
    MCPResource,
    WorkspaceInfo,
    MCPAICompletionRequest,
    MCPContent
} from './types';
import { FileTools } from './FileTools';
import { WorkspaceTools } from './WorkspaceTools';
import { StateManager } from '../state/StateManager';

/**
 * Main MCP service that coordinates all tools and provides context to AI
 */
export class MCPService {
    private static instance: MCPService;
    private availableTools: MCPTool[] = [];
    private recentActions: MCPToolCall[] = [];
    private maxRecentActions = 50;

    private constructor() {
        this.initializeTools();
    }

    public static getInstance(): MCPService {
        if (!MCPService.instance) {
            MCPService.instance = new MCPService();
        }
        return MCPService.instance;
    }

    /**
     * Initialize all available MCP tools
     */
    private initializeTools(): void {
        this.availableTools = [
            ...FileTools.getTools(),
            ...WorkspaceTools.getTools()
        ];
    }

    /**
     * Get all available tools
     */
    public getAvailableTools(): MCPTool[] {
        return [...this.availableTools];
    }

    /**
     * Get tools by category
     */
    public getToolsByCategory(category: 'file' | 'workspace' | 'analysis'): MCPTool[] {
        const prefixes: Record<string, string[]> = {
            file: ['read_file', 'write_file', 'list_directory', 'search_workspace', 'get_file_stats', 'create_file', 'delete_file', 'move_file'],
            workspace: ['get_workspace_info', 'get_active_editor', 'get_open_editors', 'get_selection', 'get_cursor_position', 'get_symbols', 'get_definition', 'get_references', 'get_hover_info', 'get_problems', 'get_workspace_symbols'],
            analysis: [] // Future code analysis tools
        };

        return this.availableTools.filter(tool => 
            prefixes[category].includes(tool.name)
        );
    }

    /**
     * Execute a tool with error handling and logging
     */
    public async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
        try {
            console.log(`🔧 MCP: Executing tool ${toolCall.name} with args:`, toolCall.arguments);
            
            // Add to recent actions
            this.addRecentAction(toolCall);

            // Execute the appropriate tool
            let result: MCPToolResult;
            
            if (this.isFileTool(toolCall.name)) {
                result = await FileTools.executeTool(toolCall);
            } else if (this.isWorkspaceTool(toolCall.name)) {
                result = await WorkspaceTools.executeTool(toolCall);
            } else {
                result = {
                    isError: true,
                    content: [{
                        type: 'text',
                        text: `Unknown tool: ${toolCall.name}`
                    }]
                };
            }

            console.log(`🔧 MCP: Tool ${toolCall.name} ${result.isError ? 'failed' : 'completed'}`);
            
            return result;
        } catch (error) {
            console.error(`🔧 MCP: Tool execution error for ${toolCall.name}:`, error);
            
            return {
                isError: true,
                content: [{
                    type: 'text',
                    text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
            };
        }
    }

    /**
     * Execute multiple tools in sequence
     */
    public async executeTools(toolCalls: MCPToolCall[]): Promise<MCPToolResult[]> {
        const results: MCPToolResult[] = [];
        
        for (const toolCall of toolCalls) {
            const result = await this.executeTool(toolCall);
            results.push(result);
            
            // If a critical tool fails, we might want to stop execution
            if (result.isError && this.isCriticalTool(toolCall.name)) {
                console.warn(`🔧 MCP: Critical tool ${toolCall.name} failed, stopping execution`);
                break;
            }
        }
        
        return results;
    }

    /**
     * Get comprehensive workspace context for AI
     */
    public async getWorkspaceContext(): Promise<MCPContext> {
        try {
            const workspaceInfo = await this.gatherWorkspaceInfo();
            const resources = await this.gatherResources();
            
            return {
                tools: this.availableTools,
                resources,
                workspaceInfo,
                recentActions: this.recentActions.slice(-10) // Last 10 actions
            };
        } catch (error) {
            console.error('🔧 MCP: Error gathering workspace context:', error);
            
            // Return minimal context on error
            return {
                tools: this.availableTools,
                resources: [],
                workspaceInfo: {
                    rootPath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                    folders: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [],
                    openEditors: []
                },
                recentActions: []
            };
        }
    }

    /**
     * Get context for active file and selection
     */
    public async getActiveFileContext(): Promise<MCPContent[]> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return [{
                type: 'text',
                text: 'No active editor'
            }];
        }

        const content: MCPContent[] = [];
        
        // Add file info
        content.push({
            type: 'text',
            text: `Active File: ${activeEditor.document.fileName}
Language: ${activeEditor.document.languageId}
Lines: ${activeEditor.document.lineCount}
Is Modified: ${activeEditor.document.isDirty}`,
            annotations: [{
                type: 'source_location',
                filePath: activeEditor.document.fileName
            }]
        });

        // Add selection if any
        if (!activeEditor.selection.isEmpty) {
            const selectedText = activeEditor.document.getText(activeEditor.selection);
            content.push({
                type: 'text',
                text: `Selected Text (Lines ${activeEditor.selection.start.line + 1}-${activeEditor.selection.end.line + 1}):\n${selectedText}`,
                annotations: [{
                    type: 'source_location',
                    filePath: activeEditor.document.fileName,
                    selectionStart: activeEditor.selection.start,
                    selectionEnd: activeEditor.selection.end
                }]
            });
        }

        // Add cursor context
        const cursorLine = activeEditor.selection.active.line;
        const startLine = Math.max(0, cursorLine - 5);
        const endLine = Math.min(activeEditor.document.lineCount - 1, cursorLine + 5);
        
        const contextLines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            const prefix = i === cursorLine ? '>>> ' : '    ';
            contextLines.push(`${prefix}${i + 1}: ${activeEditor.document.lineAt(i).text}`);
        }
        
        content.push({
            type: 'text',
            text: `Cursor Context:\n${contextLines.join('\n')}`,
            annotations: [{
                type: 'source_location',
                filePath: activeEditor.document.fileName,
                cursorLine: cursorLine + 1
            }]
        });

        return content;
    }

    /**
     * Enhance AI completion request with MCP context
     */
    public async enhanceCompletionRequest(
        message: string,
        includeWorkspaceContext = false,
        includeActiveFileContext = true,
        maxContextSize = 10000
    ): Promise<MCPAICompletionRequest> {
        const mcpContext = includeWorkspaceContext ? await this.getWorkspaceContext() : undefined;
        const activeFileContext = includeActiveFileContext ? await this.getActiveFileContext() : [];
        
        // Build enhanced message with context
        let enhancedMessage = message;
        
        if (activeFileContext.length > 0) {
            const contextText = activeFileContext
                .map(content => content.text)
                .join('\n\n');
            
            if (contextText.length < maxContextSize) {
                enhancedMessage = `${message}\n\n--- Current Context ---\n${contextText}`;
            }
        }

        // Estimate tokens (rough calculation)
        const estimatedTokens = Math.ceil(enhancedMessage.length / 4);

        return {
            message: enhancedMessage,
            estimatedInputTokens: estimatedTokens,
            mcpContext,
            includeWorkspaceContext,
            includeActiveFileContext,
            maxContextSize
        };
    }

    /**
     * Process tool calls from AI response
     */
    public async processToolCalls(toolCalls: MCPToolCall[]): Promise<MCPToolResult[]> {
        if (!toolCalls || toolCalls.length === 0) {
            return [];
        }

        console.log(`🔧 MCP: Processing ${toolCalls.length} tool calls`);
        
        // Show progress for multiple tools
        if (toolCalls.length > 1) {
            return vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Executing AI tools...',
                cancellable: false
            }, async (progress) => {
                const results: MCPToolResult[] = [];
                
                for (let i = 0; i < toolCalls.length; i++) {
                    const toolCall = toolCalls[i];
                    progress.report({
                        message: `Running ${toolCall.name}... (${i + 1}/${toolCalls.length})`,
                        increment: (100 / toolCalls.length)
                    });
                    
                    const result = await this.executeTool(toolCall);
                    results.push(result);
                }
                
                return results;
            });
        } else {
            return [await this.executeTool(toolCalls[0])];
        }
    }

    /**
     * Get tool usage statistics
     */
    public getToolStats(): { [toolName: string]: number } {
        const stats: { [toolName: string]: number } = {};
        
        for (const action of this.recentActions) {
            stats[action.name] = (stats[action.name] || 0) + 1;
        }
        
        return stats;
    }

    /**
     * Clear recent actions history
     */
    public clearHistory(): void {
        this.recentActions = [];
    }

    /**
     * Get recent actions for debugging
     */
    public getRecentActions(): MCPToolCall[] {
        return [...this.recentActions];
    }

    // Private helper methods
    private addRecentAction(toolCall: MCPToolCall): void {
        this.recentActions.push({
            ...toolCall,
            timestamp: Date.now()
        } as any);
        
        // Keep only recent actions
        if (this.recentActions.length > this.maxRecentActions) {
            this.recentActions = this.recentActions.slice(-this.maxRecentActions);
        }
    }

    private isFileTool(toolName: string): boolean {
        return toolName.startsWith('read_file') || 
               toolName.startsWith('write_file') ||
               toolName.startsWith('list_directory') ||
               toolName.startsWith('search_workspace') ||
               toolName.startsWith('get_file_stats') ||
               toolName.startsWith('create_file') ||
               toolName.startsWith('delete_file') ||
               toolName.startsWith('move_file');
    }

    private isWorkspaceTool(toolName: string): boolean {
        return toolName.startsWith('get_workspace_info') ||
               toolName.startsWith('get_active_editor') ||
               toolName.startsWith('get_open_editors') ||
               toolName.startsWith('get_selection') ||
               toolName.startsWith('get_cursor_position') ||
               toolName.startsWith('get_symbols') ||
               toolName.startsWith('get_definition') ||
               toolName.startsWith('get_references') ||
               toolName.startsWith('get_hover_info') ||
               toolName.startsWith('get_problems') ||
               toolName.startsWith('get_workspace_symbols');
    }

    private isCriticalTool(toolName: string): boolean {
        // Define which tools are critical and should stop execution if they fail
        return ['delete_file', 'write_file'].includes(toolName);
    }

    private async gatherWorkspaceInfo(): Promise<WorkspaceInfo> {
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const activeEditor = vscode.window.activeTextEditor;
        const openEditors = vscode.window.visibleTextEditors;

        const workspaceInfo: WorkspaceInfo = {
            name: vscode.workspace.name,
            rootPath: workspaceFolders[0]?.uri.fsPath || '',
            folders: workspaceFolders.map(folder => folder.uri.fsPath),
            activeEditor: activeEditor ? {
                fileName: activeEditor.document.fileName,
                languageId: activeEditor.document.languageId,
                isDirty: activeEditor.document.isDirty,
                lineCount: activeEditor.document.lineCount,
                selection: !activeEditor.selection.isEmpty ? {
                    start: { line: activeEditor.selection.start.line, character: activeEditor.selection.start.character },
                    end: { line: activeEditor.selection.end.line, character: activeEditor.selection.end.character },
                    text: activeEditor.document.getText(activeEditor.selection)
                } : undefined,
                cursorPosition: { line: activeEditor.selection.active.line, character: activeEditor.selection.active.character }
            } : undefined,
            openEditors: openEditors.map(editor => ({
                fileName: editor.document.fileName,
                languageId: editor.document.languageId,
                isDirty: editor.document.isDirty,
                lineCount: editor.document.lineCount
            }))
        };

        return workspaceInfo;
    }

    private async gatherResources(): Promise<MCPResource[]> {
        const resources: MCPResource[] = [];
        
        // Add open files as resources
        const openEditors = vscode.window.visibleTextEditors;
        for (const editor of openEditors) {
            resources.push({
                uri: editor.document.uri.toString(),
                name: editor.document.fileName.split(/[\\/]/).pop() || 'Untitled',
                description: `${editor.document.languageId} file (${editor.document.lineCount} lines)`,
                mimeType: this.getMimeTypeForLanguage(editor.document.languageId)
            });
        }

        // Add workspace folders
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        for (const folder of workspaceFolders) {
            resources.push({
                uri: folder.uri.toString(),
                name: folder.name,
                description: 'Workspace folder',
                mimeType: 'inode/directory'
            });
        }

        return resources;
    }

    private getMimeTypeForLanguage(languageId: string): string {
        const mimeTypes: { [key: string]: string } = {
            'typescript': 'text/typescript',
            'javascript': 'text/javascript',
            'python': 'text/x-python',
            'java': 'text/x-java-source',
            'json': 'application/json',
            'xml': 'application/xml',
            'html': 'text/html',
            'css': 'text/css',
            'markdown': 'text/markdown',
            'yaml': 'application/x-yaml',
            'plaintext': 'text/plain'
        };
        
        return mimeTypes[languageId] || 'text/plain';
    }
}