import { ApiClient } from '../api/ApiClient';
import { AiModelDTO, AiAgentDTO, UserPreferenceDTO } from '../types';
import { StateManager } from '../state/StateManager';

/**
 * Service for AI models and agents
 */
export class ModelService {
    private static instance: ModelService;
    private apiClient: ApiClient;

    private constructor() {
        this.apiClient = ApiClient.getInstance();
    }

    public static getInstance(): ModelService {
        if (!ModelService.instance) {
            ModelService.instance = new ModelService();
        }
        return ModelService.instance;
    }

    /**
     * Get available AI models for current user
     */
    public async getAvailableModels(): Promise<AiModelDTO[]> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        return await this.apiClient.get<AiModelDTO[]>('/api/models', {
            userId: userInfo.userId,
        });
    }

    /**
     * Get model by ID
     */
    public async getModelById(modelId: string): Promise<AiModelDTO> {
        return await this.apiClient.get<AiModelDTO>(`/api/models/${modelId}`);
    }

    /**
     * Get available AI agents for current user
     */
    public async getAvailableAgents(): Promise<AiAgentDTO[]> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        return await this.apiClient.get<AiAgentDTO[]>('/api/agents', {
            userId: userInfo.userId,
        });
    }

    /**
     * Get agent by ID
     */
    public async getAgentById(agentId: string): Promise<AiAgentDTO> {
        return await this.apiClient.get<AiAgentDTO>(`/api/agents/${agentId}`);
    }

    /**
     * Get user preferences
     */
    public async getUserPreferences(): Promise<UserPreferenceDTO> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        return await this.apiClient.get<UserPreferenceDTO>('/api/users/preferences', {
            userId: userInfo.userId,
        });
    }

    /**
     * Set default AI model
     */
    public async setDefaultModel(modelId: string): Promise<void> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        await this.apiClient.put<UserPreferenceDTO>(
            `/api/users/preferences/model/${modelId}`,
            userInfo.userId
        );
        
        await StateManager.getInstance().setSelectedModel(modelId);
    }
}
