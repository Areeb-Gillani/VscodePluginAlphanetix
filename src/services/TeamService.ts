import * as vscode from 'vscode';
import { ApiClient } from '../api/ApiClient';
import { TeamDTO, TeamMemberDTO } from '../types';
import { StateManager } from '../state/StateManager';

/**
 * Service for team-related operations
 */
export class TeamService {
    private static instance: TeamService;
    private apiClient: ApiClient;

    private constructor() {
        this.apiClient = ApiClient.getInstance();
    }

    public static getInstance(): TeamService {
        if (!TeamService.instance) {
            TeamService.instance = new TeamService();
        }
        return TeamService.instance;
    }

    /**
     * Get all teams for current user
     */
    public async getMyTeams(): Promise<TeamDTO[]> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        return await this.apiClient.get<TeamDTO[]>('/api/teams', {
            userId: userInfo.userId,
        });
    }

    /**
     * Get team by ID
     */
    public async getTeamById(teamId: string): Promise<TeamDTO> {
        return await this.apiClient.get<TeamDTO>(`/api/teams/${teamId}`);
    }

    /**
     * Get team members
     */
    public async getTeamMembers(teamId: string): Promise<TeamMemberDTO[]> {
        return await this.apiClient.get<TeamMemberDTO[]>(`/api/teams/${teamId}/members`);
    }

    /**
     * Get current team member info (quota, etc.)
     */
    public async getCurrentMemberInfo(teamId: string): Promise<TeamMemberDTO | undefined> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            return undefined;
        }

        const members = await this.getTeamMembers(teamId);
        return members.find(m => m.userId === userInfo.userId);
    }

    /**
     * Switch to a different team
     */
    public async switchTeam(teamId: string): Promise<void> {
        await StateManager.getInstance().setSelectedTeam(teamId);
        
        // Load team context if auto-switch is enabled
        const config = vscode.workspace.getConfiguration('alphanetix');
        const autoSwitch = config.get<boolean>('autoSwitchTeamContext', true);
        
        if (autoSwitch) {
            const context = await StateManager.getInstance().getTeamContext(teamId);
            // Context will be used when making AI requests
        }
    }
}
