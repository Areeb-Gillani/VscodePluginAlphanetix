import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ApiClient } from '../api/ApiClient';
import { ExecutorRegistry, ToolDefinition } from '../mcp/executors/ExecutorRegistry';
import { ReadFileExecutor } from '../mcp/executors/filesystem/ReadFileExecutor';
import { WriteFileExecutor } from '../mcp/executors/filesystem/WriteFileExecutor';
import { EditFileExecutor } from '../mcp/executors/filesystem/EditFileExecutor';
import { ListDirectoryExecutor } from '../mcp/executors/filesystem/ListDirectoryExecutor';
import { GlobExecutor } from '../mcp/executors/search/GlobExecutor';
import { GrepSearchExecutor } from '../mcp/executors/search/GrepSearchExecutor';
import { CodebaseSearchExecutor } from '../mcp/executors/search/CodebaseSearchExecutor';
import { BashExecutor } from '../mcp/executors/shell/BashExecutor';

interface EnhancedToolFormat {
    version: string;
    metadata: {
        description: string;
        last_updated: string;
        supported_providers: string[];
        min_extension_version: string;
    };
    tools: ToolDefinition[];
}

interface CapabilityRegistrationRequest {
    extensionVersion: string;
    tools: Array<{
        name: string;
        version: string;
        modes: string[];
    }>;
}

interface CapabilityRegistrationResponse {
    id: string;
    sessionId: string;
    extensionVersion: string;
    registeredAt: string;
}

interface TransformRequest {
    toolNames: string[];
    toolVersions: Record<string, string>;
    provider: string;
    mode: string;
}

interface TransformedToolsResponse {
    provider: string;
    mode: string;
    tools: unknown[];
    toolCount: number;
    cached: boolean;
}

/**
 * Service for managing MCP tool capabilities
 * - Loads tool definitions from JSON
 * - Registers capabilities with backend
 * - Manages tool intersection and transformation
 */
export class McpCapabilityService {
    private static instance: McpCapabilityService;
    private toolsLoaded = false;
    private toolDefinitions: ToolDefinition[] = [];
    private extensionVersion: string;
    private registeredCapabilities: Map<string, CapabilityRegistrationResponse> = new Map();

    private constructor() {
        this.extensionVersion = this.getExtensionVersion();
    }

    public static getInstance(): McpCapabilityService {
        if (!McpCapabilityService.instance) {
            McpCapabilityService.instance = new McpCapabilityService();
        }
        return McpCapabilityService.instance;
    }

    /**
     * Initialize the service by loading tool definitions and registering executors
     */
    public async initialize(): Promise<void> {
        console.log('🔧 McpCapability: Initializing service...');
        
        await this.loadToolDefinitions();
        this.registerExecutors();
        
        console.log(`🔧 McpCapability: Initialized with ${this.toolDefinitions.length} tools`);
    }

    /**
     * Load tool definitions from alphanetix-mcp-tools-enhanced.json
     */
    public async loadToolDefinitions(): Promise<void> {
        if (this.toolsLoaded) {
            console.log('🔧 McpCapability: Tools already loaded');
            return;
        }

        try {
            // Get the backend workspace folder path
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder found');
            }

            // Look for the AlphanetixAI backend folder
            let toolsJsonPath: string | null = null;

            for (const folder of workspaceFolders) {
                const possiblePath = path.join(
                    folder.uri.fsPath,
                    '..',
                    'AlphanetixAI',
                    'alphanetix-mcp-tools-enhanced.json'
                );

                if (fs.existsSync(possiblePath)) {
                    toolsJsonPath = possiblePath;
                    break;
                }
            }

            // Fallback: try relative to extension
            if (!toolsJsonPath) {
                const extensionPath = vscode.extensions.getExtension('alphanetix.alphanetix-code-assistant')?.extensionPath;
                if (extensionPath) {
                    const fallbackPath = path.join(
                        extensionPath,
                        '..',
                        '..',
                        'AlphanetixAI',
                        'alphanetix-mcp-tools-enhanced.json'
                    );
                    
                    if (fs.existsSync(fallbackPath)) {
                        toolsJsonPath = fallbackPath;
                    }
                }
            }

            if (!toolsJsonPath) {
                throw new Error('Could not find alphanetix-mcp-tools-enhanced.json');
            }

            console.log(`🔧 McpCapability: Loading tools from ${toolsJsonPath}`);

            const content = fs.readFileSync(toolsJsonPath, 'utf-8');
            const toolsData: EnhancedToolFormat = JSON.parse(content);

            // Validate format version
            if (toolsData.metadata.min_extension_version > this.extensionVersion) {
                console.warn(
                    `⚠️ Tools require extension version ${toolsData.metadata.min_extension_version}, ` +
                    `but current version is ${this.extensionVersion}`
                );
            }

            this.toolDefinitions = toolsData.tools;
            this.toolsLoaded = true;

            // Register tool definitions in the registry
            const registry = ExecutorRegistry.getInstance();
            for (const tool of this.toolDefinitions) {
                registry.registerToolDefinition(tool);
            }

            console.log(`🔧 McpCapability: Loaded ${this.toolDefinitions.length} tool definitions`);
        } catch (error) {
            console.error('🔧 McpCapability: Failed to load tool definitions:', error);
            throw error;
        }
    }

    /**
     * Register all executors with the ExecutorRegistry
     */
    private registerExecutors(): void {
        const registry = ExecutorRegistry.getInstance();

        // Register filesystem executors
        registry.register('read_file', new ReadFileExecutor());
        registry.register('write_file', new WriteFileExecutor());
        registry.register('edit_file', new EditFileExecutor());
        registry.register('ls', new ListDirectoryExecutor());

        // Register search executors
        registry.register('glob', new GlobExecutor());
        registry.register('grep_search', new GrepSearchExecutor());
        registry.register('codebase_search', new CodebaseSearchExecutor());

        // Register shell executors
        registry.register('bash', new BashExecutor());

        console.log(`🔧 McpCapability: Registered ${registry.getToolNames().length} executors`);
    }

    /**
     * Register capabilities with the backend for a specific session
     */
    public async registerCapabilities(sessionId: string): Promise<CapabilityRegistrationResponse> {
        // Check if already registered for this session
        if (this.registeredCapabilities.has(sessionId)) {
            console.log(`🔧 McpCapability: Already registered for session ${sessionId}`);
            return this.registeredCapabilities.get(sessionId)!;
        }

        try {
            const registry = ExecutorRegistry.getInstance();
            const toolNames = registry.getToolNames();

            // Build capability payload
            const tools = toolNames.map(name => {
                const definition = registry.getToolDefinition(name);
                if (!definition) {
                    throw new Error(`Tool definition not found for ${name}`);
                }

                const modes: string[] = [];
                if (definition.modes.ask) {
                    modes.push('ask');
                }
                if (definition.modes.agent) {
                    modes.push('agent');
                }

                return {
                    name: definition.name,
                    version: definition.version,
                    modes
                };
            });

            const request: CapabilityRegistrationRequest = {
                extensionVersion: this.extensionVersion,
                tools
            };

            console.log(`🔧 McpCapability: Registering ${tools.length} tools for session ${sessionId}`);

            const apiClient = ApiClient.getInstance();
            const response = await apiClient.post<CapabilityRegistrationResponse>(
                `/api/mcp/capabilities/register?sessionId=${sessionId}`,
                request
            );

            this.registeredCapabilities.set(sessionId, response);

            console.log(`🔧 McpCapability: Registration successful for session ${sessionId}`);

            return response;
        } catch (error) {
            console.error('🔧 McpCapability: Registration failed:', error);
            throw error;
        }
    }

    /**
     * Get tool intersection for a session (tools available in both client and agent)
     */
    public async getAvailableTools(
        sessionId: string,
        agentId: string,
        mode: 'ask' | 'agent'
    ): Promise<Map<string, string>> {
        try {
            const apiClient = ApiClient.getInstance();
            const response = await apiClient.get<Record<string, string>>(
                `/api/mcp/capabilities/intersection`,
                { sessionId, agentId, mode }
            );

            return new Map(Object.entries(response));
        } catch (error) {
            console.error('🔧 McpCapability: Failed to get tool intersection:', error);
            throw error;
        }
    }

    /**
     * Get transformed tools for a specific provider
     */
    public async getTransformedTools(
        provider: string,
        mode: 'ask' | 'agent',
        toolVersions: Map<string, string>
    ): Promise<TransformedToolsResponse> {
        try {
            const request: TransformRequest = {
                toolNames: Array.from(toolVersions.keys()),
                toolVersions: Object.fromEntries(toolVersions),
                provider,
                mode
            };

            const apiClient = ApiClient.getInstance();
            const response = await apiClient.post<TransformedToolsResponse>(
                '/api/mcp/capabilities/transform',
                request
            );

            console.log(
                `🔧 McpCapability: Transformed ${response.toolCount} tools for ${provider}/${mode} ` +
                `(cached: ${response.cached})`
            );

            return response;
        } catch (error) {
            console.error('🔧 McpCapability: Failed to get transformed tools:', error);
            throw error;
        }
    }

    /**
     * Get extension version from package.json
     */
    private getExtensionVersion(): string {
        try {
            const extension = vscode.extensions.getExtension('alphanetix.alphanetix-code-assistant');
            return extension?.packageJSON?.version || '1.0.0';
        } catch {
            return '1.0.0';
        }
    }

    /**
     * Get all tool definitions
     */
    public getToolDefinitions(): ToolDefinition[] {
        return [...this.toolDefinitions];
    }

    /**
     * Get tools for a specific mode
     */
    public getToolsForMode(mode: 'ask' | 'agent'): ToolDefinition[] {
        return this.toolDefinitions.filter(tool => tool.modes[mode]);
    }

    /**
     * Clear registered capabilities (for testing or re-initialization)
     */
    public clearRegistrations(): void {
        this.registeredCapabilities.clear();
        console.log('🔧 McpCapability: Cleared all registrations');
    }
}
