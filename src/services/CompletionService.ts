import { ApiClient } from '../api/ApiClient';
import { 
    AICompletionRequest, 
    AICompletionResponse, 
    ChatSessionDTO,
    ChatMessageDTO 
} from '../types';
import { 
    MCPAICompletionRequest,
    MCPAICompletionResponse,
    MCPToolCall,
    MCPToolResult
} from '../mcp/types';
import { StateManager } from '../state/StateManager';
import { MCPService } from '../mcp/MCPService';

/**
 * Service for AI completions and chat
 */
export class CompletionService {
    private static instance: CompletionService;
    private apiClient: ApiClient;
    private mcpService: MCPService;

    private constructor() {
        this.apiClient = ApiClient.getInstance();
        this.mcpService = MCPService.getInstance();
    }

    public static getInstance(): CompletionService {
        if (!CompletionService.instance) {
            CompletionService.instance = new CompletionService();
        }
        return CompletionService.instance;
    }

    /**
     * Get AI completion for code or chat with MCP context
     */
    public async getCompletion(
        message: string,
        options?: {
            sessionId?: string;
            modelId?: string;
            estimatedTokens?: number;
            includeMCPContext?: boolean;
            includeWorkspaceContext?: boolean;
            includeActiveFileContext?: boolean;
            maxContextSize?: number;
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

        // Enhanced request with MCP context
        if (options?.includeMCPContext) {
            return await this.getCompletionWithMCP(message, {
                sessionId: options.sessionId,
                modelId,
                estimatedTokens: options.estimatedTokens,
                includeWorkspaceContext: options.includeWorkspaceContext ?? false,
                includeActiveFileContext: options.includeActiveFileContext ?? true,
                maxContextSize: options.maxContextSize ?? 10000
            });
        }

        // Standard completion request
        const request: AICompletionRequest = {
            message,
            chatSessionId: options?.sessionId,
            aiModelId: modelId,
            estimatedInputTokens: options?.estimatedTokens || Math.ceil(message.length / 4), // Rough estimate: ~4 chars per token
        };

        return await this.apiClient.post<AICompletionResponse>(
            '/api/chat/completion',
            request
        );
    }

    /**
     * Get AI completion with full MCP context and tool support
     */
    public async getCompletionWithMCP(
        message: string,
        options: {
            sessionId?: string;
            modelId?: string;
            estimatedTokens?: number;
            includeWorkspaceContext?: boolean;
            includeActiveFileContext?: boolean;
            maxContextSize?: number;
        }
    ): Promise<AICompletionResponse> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        // Enhance the request with MCP context
        const enhancedRequest = await this.mcpService.enhanceCompletionRequest(
            message,
            options.includeWorkspaceContext ?? false,
            options.includeActiveFileContext ?? true,
            options.maxContextSize ?? 10000
        );

        // Add standard fields
        enhancedRequest.chatSessionId = options.sessionId;
        enhancedRequest.aiModelId = options.modelId;
        if (options.estimatedTokens) {
            enhancedRequest.estimatedInputTokens = options.estimatedTokens;
        }

        // Add available tools to the request
        enhancedRequest.tools = this.mcpService.getAvailableTools();

        try {
            // Send enhanced request to API
            const response = await this.apiClient.post<MCPAICompletionResponse>(
                '/api/chat/completion-mcp', // New endpoint for MCP-enabled completions
                enhancedRequest
            );

            // Process tool calls if the AI wants to use tools
            if (response.toolCalls && response.toolCalls.length > 0) {
                const toolResults = await this.mcpService.processToolCalls(response.toolCalls);
                
                // If tools were executed, we might want to send a follow-up request
                // with the tool results to get the final AI response
                if (toolResults.some(result => !result.isError)) {
                    return await this.getCompletionWithToolResults(
                        message,
                        response,
                        toolResults,
                        enhancedRequest
                    );
                }
            }

            // Convert MCP response back to standard response format
            return this.convertMCPResponseToStandard(response);
            
        } catch (error) {
            // Fallback to standard completion if MCP endpoint fails
            console.warn('🔧 MCP: Enhanced completion failed, falling back to standard:', error);
            
            return await this.getCompletion(message, {
                sessionId: options.sessionId,
                modelId: options.modelId,
                estimatedTokens: options.estimatedTokens,
                includeMCPContext: false
            });
        }
    }

    /**
     * Send follow-up request with tool results
     */
    private async getCompletionWithToolResults(
        originalMessage: string,
        aiResponse: MCPAICompletionResponse,
        toolResults: MCPToolResult[],
        originalRequest: MCPAICompletionRequest
    ): Promise<AICompletionResponse> {
        // Build follow-up message with tool results
        const toolResultsText = toolResults.map((result, index) => {
            const toolCall = aiResponse.toolCalls![index];
            return `Tool: ${toolCall.name}
Result: ${result.isError ? 'ERROR' : 'SUCCESS'}
${result.content?.map(c => c.text).join('\n') || 'No content'}`;
        }).join('\n\n');

        const followUpMessage = `Original request: ${originalMessage}

Tool execution results:
${toolResultsText}

Please provide a response based on the tool results.`;

        // Send follow-up request
        const followUpRequest: MCPAICompletionRequest = {
            ...originalRequest,
            message: followUpMessage,
            estimatedInputTokens: Math.ceil(followUpMessage.length / 4)
        };

        const followUpResponse = await this.apiClient.post<MCPAICompletionResponse>(
            '/api/chat/completion-mcp',
            followUpRequest
        );

        return this.convertMCPResponseToStandard(followUpResponse);
    }

    /**
     * Convert MCP response to standard response format
     */
    private convertMCPResponseToStandard(mcpResponse: MCPAICompletionResponse): AICompletionResponse {
        return {
            id: mcpResponse.id,
            object: mcpResponse.object,
            created: mcpResponse.created,
            model: mcpResponse.model,
            message: mcpResponse.message,
            tokensUsed: mcpResponse.tokensUsed,
            creditsUsed: mcpResponse.creditsUsed,
            chatSessionId: mcpResponse.chatSessionId,
            choices: mcpResponse.choices
        };
    }

    /**
     * Execute MCP tools directly (for testing or manual tool execution)
     */
    public async executeMCPTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
        return await this.mcpService.executeTool(toolCall);
    }

    /**
     * Get available MCP tools
     */
    public getMCPTools(): any[] {
        return this.mcpService.getAvailableTools();
    }

    /**
     * Get MCP tool usage statistics
     */
    public getMCPStats(): { [toolName: string]: number } {
        return this.mcpService.getToolStats();
    }

    /**
     * Get workspace context for debugging
     */
    public async getMCPContext(): Promise<any> {
        return await this.mcpService.getWorkspaceContext();
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
