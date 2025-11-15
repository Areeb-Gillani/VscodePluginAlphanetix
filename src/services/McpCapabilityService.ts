import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ApiClient } from '../api/ApiClient';
import { ExecutorRegistry, ToolDefinition } from '../mcp/executors/ExecutorRegistry';
import { ReadFileExecutor } from '../mcp/executors/filesystem/ReadFileExecutor';
import { WriteFileExecutor } from '../mcp/executors/filesystem/WriteFileExecutor';
import { EditFileExecutor } from '../mcp/executors/filesystem/EditFileExecutor';
import { ListDirectoryExecutor } from '../mcp/executors/filesystem/ListDirectoryExecutor';
import { DeleteFileExecutor } from '../mcp/executors/filesystem/DeleteFileExecutor';
import { MultiEditExecutor } from '../mcp/executors/filesystem/MultiEditExecutor';
import { ReapplyExecutor } from '../mcp/executors/filesystem/ReapplyExecutor';
import { EditNotebookExecutor } from '../mcp/executors/filesystem/EditNotebookExecutor';
import { GlobExecutor } from '../mcp/executors/search/GlobExecutor';
import { GrepSearchExecutor } from '../mcp/executors/search/GrepSearchExecutor';
import { CodebaseSearchExecutor } from '../mcp/executors/search/CodebaseSearchExecutor';
import { BashExecutor } from '../mcp/executors/shell/BashExecutor';
import { BashOutputExecutor } from '../mcp/executors/shell/BashOutputExecutor';
import { KillBashExecutor } from '../mcp/executors/shell/KillBashExecutor';
import { ExitPlanModeExecutor } from '../mcp/executors/workflow/ExitPlanModeExecutor';
import { TodoWriteExecutor } from '../mcp/executors/workflow/TodoWriteExecutor';
import { WebFetchExecutor } from '../mcp/executors/web/WebFetchExecutor';
import { WebSearchExecutor } from '../mcp/executors/web/WebSearchExecutor';
import { CreateDiagramExecutor } from '../mcp/executors/visualization/CreateDiagramExecutor';
import { TaskAgentExecutor } from '../mcp/executors/agent/TaskAgentExecutor';

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
    private toolsAvailable = false;
    private toolDefinitions: ToolDefinition[] = [];
    private extensionVersion: string;
    private registeredCapabilities: Map<string, CapabilityRegistrationResponse> = new Map();
    private toolIntersectionCache: Map<string, Map<string, string>> = new Map();

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
        
        try {
            await this.loadToolDefinitions();
            this.registerExecutors();
            this.toolsAvailable = true;
            console.log(`✅ McpCapability: Initialized successfully with ${this.toolDefinitions.length} tools`);
        } catch (error) {
            console.warn('⚠️ McpCapability: Failed to initialize MCP tools, running in chat-only mode:', error);
            this.toolsAvailable = false;
            // Don't throw - allow extension to continue in chat-only mode
        }
    }

    /**
     * Check if MCP tools are available
     */
    public isToolsAvailable(): boolean {
        return this.toolsAvailable;
    }

    /**
     * Load tool definitions from bundled alphanetix-mcp-tools-enhanced.json
     */
    public async loadToolDefinitions(): Promise<void> {
        if (this.toolsLoaded) {
            console.log('🔧 McpCapability: Tools already loaded');
            return;
        }

        try {
            // Get the extension path
            const extension = vscode.extensions.getExtension('alphanetix.alphanetix-code-assistant');
            if (!extension) {
                throw new Error('Extension not found - cannot load tool definitions');
            }

            const extensionPath = extension.extensionPath;
            
            // Load from bundled resources
            const toolsJsonPath = path.join(extensionPath, 'resources', 'alphanetix-mcp-tools-enhanced.json');

            if (!fs.existsSync(toolsJsonPath)) {
                throw new Error(`Tool definitions file not found at: ${toolsJsonPath}`);
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

            console.log(`✅ McpCapability: Loaded ${this.toolDefinitions.length} tool definitions`);
        } catch (error) {
            console.error('❌ McpCapability: Failed to load tool definitions:', error);
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
        registry.register('delete_file', new DeleteFileExecutor());
        registry.register('multi_edit', new MultiEditExecutor());
        registry.register('reapply', new ReapplyExecutor());
        registry.register('edit_notebook', new EditNotebookExecutor());

        // Register search executors
        registry.register('glob', new GlobExecutor());
        registry.register('grep_search', new GrepSearchExecutor());
        registry.register('codebase_search', new CodebaseSearchExecutor());

        // Register shell executors
        registry.register('bash', new BashExecutor());
        registry.register('bash_output', new BashOutputExecutor());
        registry.register('kill_bash', new KillBashExecutor());

        // Register workflow executors
        registry.register('exit_plan_mode', new ExitPlanModeExecutor());
        registry.register('todo_write', new TodoWriteExecutor());

        // Register web executors
        registry.register('web_fetch', new WebFetchExecutor());
        registry.register('web_search', new WebSearchExecutor());

        // Register visualization executors
        registry.register('create_diagram', new CreateDiagramExecutor());

        // Register agent executors
        registry.register('task', new TaskAgentExecutor());

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
     * Results are cached per session-mode combination
     */
    public async getAvailableTools(
        sessionId: string,
        agentId: string,
        mode: 'ask' | 'agent' | 'ASK' | 'AGENT'
    ): Promise<Map<string, string>> {
        // Create cache key combining sessionId and mode
        const cacheKey = `${sessionId}_${mode}`;
        
        // Check if already cached for this session and mode
        if (this.toolIntersectionCache.has(cacheKey)) {
            console.log(`🔧 McpCapability: Using cached tool intersection for session ${sessionId}, mode ${mode}`);
            return this.toolIntersectionCache.get(cacheKey)!;
        }

        try {
            const apiClient = ApiClient.getInstance();
            console.log(`🔧 McpCapability: Fetching tool intersection for session ${sessionId}, mode ${mode}`);
            
            const response = await apiClient.get<Record<string, string>>(
                `/api/mcp/capabilities/intersection`,
                { sessionId, agentId, mode }
            );

            const toolsMap = new Map(Object.entries(response));
            
            // Cache the result
            this.toolIntersectionCache.set(cacheKey, toolsMap);
            console.log(`🔧 McpCapability: Cached ${toolsMap.size} tools for session ${sessionId}, mode ${mode}`);

            return toolsMap;
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
        mode: 'ask' | 'agent' | 'ASK' | 'AGENT',
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
     * Clear registered capabilities and tool intersection cache (for testing or re-initialization)
     */
    public clearRegistrations(): void {
        this.registeredCapabilities.clear();
        this.toolIntersectionCache.clear();
        console.log('🔧 McpCapability: Cleared all registrations and tool intersection cache');
    }

    /**
     * Clear cache for a specific session
     */
    public clearSessionCache(sessionId: string): void {
        // Remove capability registration
        this.registeredCapabilities.delete(sessionId);
        
        // Remove all tool intersection cache entries for this session
        const keysToDelete: string[] = [];
        for (const key of this.toolIntersectionCache.keys()) {
            if (key.startsWith(`${sessionId}_`)) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.toolIntersectionCache.delete(key);
        }
        
        console.log(`🔧 McpCapability: Cleared cache for session ${sessionId}`);
    }
}
