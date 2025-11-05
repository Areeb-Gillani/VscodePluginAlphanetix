/**
 * Model Context Protocol (MCP) types and interfaces
 * Based on the MCP specification for tool-calling and context sharing
 */

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: MCPToolInputSchema;
}

export interface MCPToolInputSchema {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
}

export interface MCPToolCall {
    name: string;
    arguments: Record<string, any>;
}

export interface MCPToolResult {
    content?: MCPContent[];
    isError?: boolean;
    _meta?: Record<string, any>;
}

export interface MCPContent {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    annotations?: MCPAnnotation[];
}

export interface MCPAnnotation {
    type: 'source_location' | 'priority' | 'audience';
    [key: string]: any;
}

export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

export interface MCPPrompt {
    name: string;
    description?: string;
    arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
    name: string;
    description?: string;
    required?: boolean;
}

export interface MCPMessage {
    role: 'user' | 'assistant';
    content: MCPContent;
}

// File operation specific types
export interface FileReadOptions {
    encoding?: 'utf8' | 'utf16le' | 'latin1' | 'base64' | 'hex' | 'ascii' | 'binary' | 'ucs2';
    start?: number;
    end?: number;
}

export interface FileWriteOptions {
    encoding?: 'utf8' | 'utf16le' | 'latin1' | 'base64' | 'hex' | 'ascii' | 'binary' | 'ucs2';
    mode?: number;
    flag?: string;
}

export interface DirectoryEntry {
    name: string;
    type: 'file' | 'directory' | 'symlink';
    size?: number;
    modified?: Date;
    path: string;
}

export interface SearchOptions {
    pattern?: string;
    isRegex?: boolean;
    isCaseSensitive?: boolean;
    includePattern?: string;
    excludePattern?: string;
    maxResults?: number;
}

export interface SearchResult {
    file: string;
    line: number;
    column: number;
    match: string;
    context?: {
        before: string[];
        after: string[];
    };
}

// Workspace context types
export interface WorkspaceInfo {
    name?: string;
    rootPath: string;
    folders: string[];
    activeEditor?: EditorInfo;
    openEditors: EditorInfo[];
}

export interface EditorInfo {
    fileName: string;
    languageId: string;
    content?: string;
    selection?: {
        start: Position;
        end: Position;
        text: string;
    };
    cursorPosition?: Position;
    isDirty: boolean;
    lineCount: number;
}

export interface Position {
    line: number;
    character: number;
}

// Code analysis types
export interface SymbolInfo {
    name: string;
    kind: SymbolKind;
    location: {
        file: string;
        range: {
            start: Position;
            end: Position;
        };
    };
    containerName?: string;
    detail?: string;
}

export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
}

export interface DependencyInfo {
    name: string;
    version?: string;
    type: 'npm' | 'maven' | 'pip' | 'nuget' | 'gem' | 'cargo' | 'other';
    file: string;
    isDev?: boolean;
}

// MCP Context for AI requests
export interface MCPContext {
    tools: MCPTool[];
    resources: MCPResource[];
    workspaceInfo: WorkspaceInfo;
    recentActions: MCPToolCall[];
}

// Enhanced AI completion request with MCP support
export interface MCPAICompletionRequest {
    message: string;
    chatSessionId?: string;
    aiModelId?: string;
    estimatedInputTokens: number;
    
    // MCP enhancements
    mcpContext?: MCPContext;
    tools?: MCPTool[];
    includeWorkspaceContext?: boolean;
    includeActiveFileContext?: boolean;
    maxContextSize?: number;
}

export interface MCPAICompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    message: string;
    tokensUsed: number;
    creditsUsed: number;
    chatSessionId?: string;
    
    // MCP response enhancements
    toolCalls?: MCPToolCall[];
    toolResults?: MCPToolResult[];
    contextUsed?: {
        files: string[];
        tools: string[];
        tokensFromContext: number;
    };
    
    choices?: Array<{
        index: number;
        message: {
            role: string;
            content: string;
            toolCalls?: MCPToolCall[];
        };
        finishReason: string;
    }>;
}