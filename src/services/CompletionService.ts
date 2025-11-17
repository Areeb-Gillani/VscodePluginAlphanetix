import { ApiClient } from '../api/ApiClient';
import { 
    AICompletionRequest, 
    AICompletionResponse, 
    ChatSessionDTO,
    ChatMessageDTO 
} from '../types';
import { StateManager } from '../state/StateManager';
import { McpCapabilityService } from './McpCapabilityService';
import { ToolExecutionService } from './ToolExecutionService';

/**
 * Service for AI completions and chat with MCP tool support
 */
export class CompletionService {
    private static instance: CompletionService;
    private apiClient: ApiClient;
    private mcpCapabilityService: McpCapabilityService;
    private toolExecutionService: ToolExecutionService;

    private constructor() {
        this.apiClient = ApiClient.getInstance();
        this.mcpCapabilityService = McpCapabilityService.getInstance();
        this.toolExecutionService = ToolExecutionService.getInstance();
    }

    public static getInstance(): CompletionService {
        if (!CompletionService.instance) {
            CompletionService.instance = new CompletionService();
        }
        return CompletionService.instance;
    }

    /**
     * Get AI completion with MCP tool support
     */
    public async getCompletion(
        message: string,
        options?: {
            sessionId?: string;
            modelId?: string;
            estimatedTokens?: number;
            useMCPTools?: boolean;
            maxToolIterations?: number;
        }
    ): Promise<AICompletionResponse> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        // Use selected model if not specified
        let modelId = options?.modelId;
        if (!modelId) {
            modelId = await StateManager.getInstance().getSelectedModel();
        }

        // Get session mode for tool filtering (uppercase for backend)
        const sessionMode = await StateManager.getInstance().getSessionMode();
        const sessionModeUpper = sessionMode.toUpperCase() as 'ASK' | 'AGENT';
        const useMCPTools = options?.useMCPTools ?? true;
        
        // Standard completion request
        let request: AICompletionRequest = {
            message,
            chatSessionId: options?.sessionId,
            aiModelId: modelId,
            estimatedInputTokens: options?.estimatedTokens || Math.ceil(message.length / 4),
        };

        // Fetch and add MCP tools if enabled
        if (useMCPTools && this.mcpCapabilityService.isToolsAvailable()) {
            try {
                // Ensure capabilities are registered for this session
                if (options?.sessionId) {
                    await this.mcpCapabilityService.registerCapabilities(options.sessionId);
                }

                // Get selected agent ID
                const agentId = await StateManager.getInstance().getSelectedAgent();
                if (!agentId) {
                    console.warn('🔧 MCP: No agent selected, skipping tool intersection');
                    throw new Error('No agent selected for tool intersection');
                }

                // Get available tools for current session and mode (use uppercase for backend)
                const availableTools = await this.mcpCapabilityService.getAvailableTools(
                    options?.sessionId || '',
                    agentId,
                    sessionModeUpper
                );

                // Transform tools for the current provider (use uppercase for backend)
                const provider = await this.getProviderForModel(modelId);
                const transformedToolsResponse = await this.mcpCapabilityService.getTransformedTools(
                    provider,
                    sessionModeUpper,
                    availableTools
                );

                // Extract tools array from response
                const transformedTools = (transformedToolsResponse as any).tools || [];

                // Add tools to request
                request.tools = transformedTools;
                
                console.log(`🔧 MCP: Sending ${transformedTools.length} tools with request`);
            } catch (error) {
                console.warn('🔧 MCP: Failed to fetch tools, continuing without them:', error);
            }
        }

        // Send request to backend
        let response = await this.apiClient.post<AICompletionResponse>(
            '/api/chat/completion',
            request
        );

        // Handle tool calls - iterate up to maxToolIterations times
        const maxIterations = options?.maxToolIterations ?? 3;
        let iteration = 0;

        while (response.toolCalls && response.toolCalls.length > 0 && iteration < maxIterations) {
            iteration++;
            console.log(`🔧 MCP: Tool call iteration ${iteration}/${maxIterations}`);

            // Parse tool calls from OpenAI format to GenericToolCall format
            const genericToolCalls = response.toolCalls.map((tc: any) => {
                // Handle both OpenAI format (with nested function) and already-parsed format
                if (tc.function) {
                    // OpenAI format: {id, type: "function", function: {name, arguments}}
                    return {
                        id: tc.id,
                        name: tc.function.name,
                        arguments: typeof tc.function.arguments === 'string' 
                            ? JSON.parse(tc.function.arguments)
                            : tc.function.arguments
                    };
                } else {
                    // Already in generic format: {id, name, arguments}
                    return tc;
                }
            });

            // Execute tool calls
            const toolResults = await this.toolExecutionService.executeToolCalls(genericToolCalls);

            // Send tool results back to LLM
            request = {
                message: `Tool execution results:\n${JSON.stringify(toolResults, null, 2)}`,
                chatSessionId: options?.sessionId,
                aiModelId: modelId,
                estimatedInputTokens: Math.ceil(JSON.stringify(toolResults).length / 4),
                toolResults: toolResults,
            };

            response = await this.apiClient.post<AICompletionResponse>(
                '/api/chat/completion',
                request
            );
        }

        return response;
    }

    /**
     * Get AI completion with streaming support
     */
    public async getCompletionStream(
        message: string,
        onChunk: (chunk: string) => void,
        options?: {
            sessionId?: string;
            modelId?: string;
            estimatedTokens?: number;
            useMCPTools?: boolean;
            maxToolIterations?: number;
        }
    ): Promise<{message: string; tokensUsed: number; creditsUsed: number}> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        // Use selected model if not specified
        let modelId = options?.modelId;
        if (!modelId) {
            modelId = await StateManager.getInstance().getSelectedModel();
        }

        // Get session mode for tool filtering
        const sessionMode = await StateManager.getInstance().getSessionMode();
        const sessionModeUpper = sessionMode.toUpperCase() as 'ASK' | 'AGENT';
        const useMCPTools = options?.useMCPTools ?? true;
        
        // Standard completion request with stream=true
        const request: AICompletionRequest = {
            message,
            chatSessionId: options?.sessionId,
            aiModelId: modelId,
            estimatedInputTokens: options?.estimatedTokens || Math.ceil(message.length / 4),
            stream: true,
        };

        // Fetch and add MCP tools if enabled
        if (useMCPTools && this.mcpCapabilityService.isToolsAvailable()) {
            try {
                // Ensure capabilities are registered for this session
                if (options?.sessionId) {
                    await this.mcpCapabilityService.registerCapabilities(options.sessionId);
                }

                // Get selected agent ID
                const agentId = await StateManager.getInstance().getSelectedAgent();
                if (!agentId) {
                    console.warn('🔧 MCP: No agent selected, skipping tool intersection');
                    throw new Error('No agent selected for tool intersection');
                }

                // Get available tools for current session and mode
                const availableTools = await this.mcpCapabilityService.getAvailableTools(
                    options?.sessionId || '',
                    agentId,
                    sessionModeUpper
                );

                // Transform tools for the current provider
                const provider = await this.getProviderForModel(modelId);
                const transformedToolsResponse = await this.mcpCapabilityService.getTransformedTools(
                    provider,
                    sessionModeUpper,
                    availableTools
                );

                // Extract tools array from response
                const transformedTools = (transformedToolsResponse as any).tools || [];

                // Add tools to request
                request.tools = transformedTools;
                
                console.log(`🔧 MCP: Sending ${transformedTools.length} tools with streaming request`);
            } catch (error) {
                console.warn('🔧 MCP: Failed to fetch tools, continuing without them:', error);
            }
        }

        // Stream the response
        return new Promise((resolve, reject) => {
            let fullMessage = '';
            let tokensUsed = 0;
            let creditsUsed = 0;

            this.apiClient.streamPost(
                '/api/chat/completion/stream',
                request,
                (event: string, data: string) => {
                    try {
                        if (event === 'content') {
                            // Remove zero-width space marker that was added to preserve formatting
                            const hasMarker = data.startsWith('\u200B');
                            const content = hasMarker ? data.substring(1) : data;
                            console.log(`📦 Content - Has marker: ${hasMarker}, Before: "${data.substring(0, 20).replace(/\u200B/g, '␣')}", After: "${content.substring(0, 20)}", Length: ${data.length} -> ${content.length}`);
                            // Content chunk - append and notify
                            fullMessage += content;
                            onChunk(content);
                        } else if (event === 'done') {
                            // Stream complete - parse final metadata
                            const metadata = JSON.parse(data);
                            tokensUsed = metadata.tokens || 0;
                            creditsUsed = metadata.credits || 0;
                        } else if (event === 'error') {
                            // Error occurred
                            const errorData = JSON.parse(data);
                            reject(new Error(errorData.error || 'Stream error'));
                        } else if (event === 'tool_calls_buffering') {
                            // Tool calls being buffered - notify user
                            onChunk('\n[Tool execution in progress...]\n');
                        } else if (event === 'tool_calls_complete') {
                            // Tool calls executed (future enhancement)
                            console.log('🔧 Tool calls completed:', data);
                        }
                    } catch (error) {
                        console.error('Error processing stream event:', error);
                    }
                },
                (error) => {
                    reject(error);
                },
                () => {
                    // Stream completed successfully
                    resolve({
                        message: fullMessage,
                        tokensUsed,
                        creditsUsed
                    });
                }
            );
        });
    }

    /**
     * Get LLM provider name for a model ID
     */
    private async getProviderForModel(modelId?: string): Promise<string> {
        // TODO: Query backend for model provider, for now use simple heuristic
        if (!modelId) {
            return 'openai'; // Default
        }
        
        // Simple provider detection based on model name patterns
        const modelStr = modelId.toLowerCase();
        if (modelStr.includes('gpt') || modelStr.includes('openai')) {
            return 'openai';
        } else if (modelStr.includes('claude') || modelStr.includes('anthropic')) {
            return 'anthropic';
        } else if (modelStr.includes('gemini') || modelStr.includes('google')) {
            return 'gemini';
        }
        
        return 'openai'; // Default fallback
    }

    /**
     * Create a new chat session
     */
    public async createChatSession(options?: {
        teamId?: string;
        modelId?: string;
        agentId?: string;
        sessionName?: string;
    }): Promise<ChatSessionDTO> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        // Use selected team/model/agent if not specified
        const teamId = options?.teamId || await StateManager.getInstance().getSelectedTeam();
        const modelId = options?.modelId || await StateManager.getInstance().getSelectedModel();
        const agentId = options?.agentId || await StateManager.getInstance().getSelectedAgent();

        const session = await this.apiClient.post<ChatSessionDTO>(
            '/api/chat/sessions',
            {},
            {
                teamId,
                modelId,
                agentId,
                sessionName: options?.sessionName,
            }
        );

        // Register MCP capabilities for this session if tools are available
        if (this.mcpCapabilityService.isToolsAvailable()) {
            try {
                await this.mcpCapabilityService.registerCapabilities(session.id);
                console.log(`🔧 MCP: Registered capabilities for new session ${session.id}`);
            } catch (error) {
                console.warn(`🔧 MCP: Failed to register capabilities for session ${session.id}:`, error);
                // Don't throw - allow session to continue without MCP tools
            }
        }

        return session;
    }

    /**
     * Get user's chat sessions
     */
    public async getChatSessions(includeArchived = false): Promise<ChatSessionDTO[]> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        return await this.apiClient.get<ChatSessionDTO[]>('/api/chat/sessions', {
            userId: userInfo.userId,
            includeArchived,
        });
    }

    /**
     * Get messages for a chat session
     */
    public async getChatMessages(sessionId: string): Promise<ChatMessageDTO[]> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        return await this.apiClient.get<ChatMessageDTO[]>(
            `/api/chat/sessions/${sessionId}/messages/all`,
            {
                userId: userInfo.userId,
            }
        );
    }

    /**
     * Add system prompt to session
     */
    public async addSystemPrompt(
        sessionId: string,
        systemPrompt: string
    ): Promise<ChatMessageDTO> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        return await this.apiClient.post<ChatMessageDTO>(
            `/api/chat/sessions/${sessionId}/system-prompt`,
            {
                userId: userInfo.userId,
                systemPrompt,
            }
        );
    }
}
