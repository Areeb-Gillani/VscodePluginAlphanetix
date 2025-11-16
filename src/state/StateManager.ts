import * as vscode from 'vscode';

/**
 * Manages global state and authentication tokens for the extension
 */
export class StateManager {
    private static instance: StateManager;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public static initialize(context: vscode.ExtensionContext): StateManager {
        if (!StateManager.instance) {
            StateManager.instance = new StateManager(context);
        }
        return StateManager.instance;
    }

    public static getInstance(): StateManager {
        if (!StateManager.instance) {
            throw new Error('StateManager not initialized');
        }
        return StateManager.instance;
    }

    // Token Management
    async getAuthToken(): Promise<string | undefined> {
        return await this.context.secrets.get('alphanetix.authToken');
    }

    async setAuthToken(token: string): Promise<void> {
        await this.context.secrets.store('alphanetix.authToken', token);
    }

    async getRefreshToken(): Promise<string | undefined> {
        return await this.context.secrets.get('alphanetix.refreshToken');
    }

    async setRefreshToken(token: string): Promise<void> {
        await this.context.secrets.store('alphanetix.refreshToken', token);
    }

    async clearTokens(): Promise<void> {
        await this.context.secrets.delete('alphanetix.authToken');
        await this.context.secrets.delete('alphanetix.refreshToken');
    }

    // User Info
    async getUserInfo(): Promise<any> {
        const userInfoJson = this.context.globalState.get<string>('alphanetix.userInfo');
        return userInfoJson ? JSON.parse(userInfoJson) : undefined;
    }

    async setUserInfo(userInfo: any): Promise<void> {
        await this.context.globalState.update('alphanetix.userInfo', JSON.stringify(userInfo));
    }

    async clearUserInfo(): Promise<void> {
        await this.context.globalState.update('alphanetix.userInfo', undefined);
    }

    async getUserId(): Promise<string | undefined> {
        const userInfo = await this.getUserInfo();
        return userInfo?.userId; // Changed from 'id' to 'userId' to match setUserInfo() calls
    }

    // Selected Team
    async getSelectedTeam(): Promise<string | undefined> {
        return this.context.globalState.get<string>('alphanetix.selectedTeamId');
    }

    async setSelectedTeam(teamId: string): Promise<void> {
        await this.context.globalState.update('alphanetix.selectedTeamId', teamId);
    }

    async clearSelectedTeam(): Promise<void> {
        await this.context.globalState.update('alphanetix.selectedTeamId', undefined);
    }

    // Selected Model
    async getSelectedModel(): Promise<string | undefined> {
        return this.context.globalState.get<string>('alphanetix.selectedModelId');
    }

    async setSelectedModel(modelId: string): Promise<void> {
        await this.context.globalState.update('alphanetix.selectedModelId', modelId);
    }

    async clearSelectedModel(): Promise<void> {
        await this.context.globalState.update('alphanetix.selectedModelId', undefined);
    }

    // Selected Agent
    async getSelectedAgent(): Promise<string | undefined> {
        return this.context.globalState.get<string>('alphanetix.selectedAgentId');
    }

    async setSelectedAgent(agentId: string): Promise<void> {
        await this.context.globalState.update('alphanetix.selectedAgentId', agentId);
    }

    async clearSelectedAgent(): Promise<void> {
        await this.context.globalState.update('alphanetix.selectedAgentId', undefined);
    }

    // Current Session
    async getCurrentSessionId(): Promise<string | undefined> {
        return this.context.globalState.get<string>('alphanetix.currentSessionId');
    }

    async setCurrentSessionId(sessionId: string): Promise<void> {
        await this.context.globalState.update('alphanetix.currentSessionId', sessionId);
    }

    async clearCurrentSessionId(): Promise<void> {
        await this.context.globalState.update('alphanetix.currentSessionId', undefined);
    }

    // Session Mode (ask or agent)
    async getSessionMode(): Promise<'ask' | 'agent'> {
        return this.context.globalState.get<'ask' | 'agent'>('alphanetix.sessionMode') || 'agent';
    }

    /**
     * Get session mode in uppercase for backend API calls
     */
    async getSessionModeUpperCase(): Promise<'ASK' | 'AGENT'> {
        const mode = await this.getSessionMode();
        return mode.toUpperCase() as 'ASK' | 'AGENT';
    }

    async setSessionMode(mode: 'ask' | 'agent'): Promise<void> {
        await this.context.globalState.update('alphanetix.sessionMode', mode);
    }

    // Team Context (System Prompt)
    async getTeamContext(teamId: string): Promise<string | undefined> {
        const contexts = this.context.globalState.get<Record<string, string>>('alphanetix.teamContexts') || {};
        return contexts[teamId];
    }

    async setTeamContext(teamId: string, systemPrompt: string): Promise<void> {
        const contexts = this.context.globalState.get<Record<string, string>>('alphanetix.teamContexts') || {};
        contexts[teamId] = systemPrompt;
        await this.context.globalState.update('alphanetix.teamContexts', contexts);
    }

    async clearAllTeamContexts(): Promise<void> {
        await this.context.globalState.update('alphanetix.teamContexts', undefined);
    }

    // Clear all state
    async clearAll(): Promise<void> {
        await this.clearTokens();
        await this.clearUserInfo();
        await this.clearSelectedTeam();
        await this.clearSelectedModel();
        await this.clearSelectedAgent();
        await this.clearCurrentSessionId();
        await this.clearAllTeamContexts();
    }

    // Check if authenticated
    async isAuthenticated(): Promise<boolean> {
        const token = await this.getAuthToken();
        return !!token;
    }
}
