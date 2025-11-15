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
                // Get available tools for current session and mode (use uppercase for backend)
                const availableTools = await this.mcpCapabilityService.getAvailableTools(
                    options?.sessionId || '',
                    '', // agentId - can be empty for now
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

            // Execute tool calls
            const toolResults = await this.toolExecutionService.executeToolCalls(response.toolCalls);

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
        sessionName?: string;
        systemPrompt?: string;
    }): Promise<ChatSessionDTO> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        // Use selected team/model if not specified
        const teamId = options?.teamId || await StateManager.getInstance().getSelectedTeam();
        const modelId = options?.modelId || await StateManager.getInstance().getSelectedModel();

        return await this.apiClient.post<ChatSessionDTO>(
            '/api/chat/sessions',
            userInfo.userId,
            {
                teamId,
                modelId,
                sessionName: options?.sessionName,
                systemPrompt: options?.systemPrompt,
            }
        );
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
