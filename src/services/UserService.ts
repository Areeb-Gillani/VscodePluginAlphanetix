import { ApiClient } from '../api/ApiClient';
import { UserDTO, QuotaInfo, TeamDTO } from '../types';
import { StateManager } from '../state/StateManager';
import { TeamService } from './TeamService';

/**
 * Service for user info and quota management
 */
export class UserService {
    private static instance: UserService;
    private apiClient: ApiClient;

    private constructor() {
        this.apiClient = ApiClient.getInstance();
    }

    public static getInstance(): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService();
        }
        return UserService.instance;
    }

    /**
     * Get current user profile
     */
    public async getCurrentUser(): Promise<UserDTO> {
        const userInfo = await StateManager.getInstance().getUserInfo();
        if (!userInfo || !userInfo.userId) {
            throw new Error('User not authenticated');
        }

        return await this.apiClient.get<UserDTO>('/api/users/profile', {
            userId: userInfo.userId,
        });
    }

    /**
     * Get comprehensive quota information
     */
    public async getQuotaInfo(): Promise<QuotaInfo> {
        const user = await this.getCurrentUser();
        const quotaInfo: QuotaInfo = {
            userCredits: user.creditBalance,
        };

        // Get team quota if user has a selected team
        const selectedTeamId = await StateManager.getInstance().getSelectedTeam();
        if (selectedTeamId) {
            try {
                const team = await TeamService.getInstance().getTeamById(selectedTeamId);
                const memberInfo = await TeamService.getInstance().getCurrentMemberInfo(selectedTeamId);

                if (memberInfo) {
                    quotaInfo.teamCredits = memberInfo.allocatedCredits || 0;
                    quotaInfo.used = memberInfo.usedCredits || 0;
                    quotaInfo.available = memberInfo.availableCredits || 0;
                }

                // Get corporate quota if available
                if (team.corporateAccountId) {
                    const corpAccount = await this.apiClient.get<any>(
                        `/api/corporate/${team.corporateAccountId}`
                    );
                    quotaInfo.corporateCredits = corpAccount.currentCreditBalance;
                }
            } catch (error) {
                // Team quota not available, use user credits only
                console.error('Failed to fetch team quota:', error);
            }
        }

        return quotaInfo;
    }

    /**
     * Update user info in state
     */
    public async refreshUserInfo(): Promise<void> {
        const user = await this.getCurrentUser();
        await StateManager.getInstance().setUserInfo({
            userId: user.id,
            username: user.username,
            email: user.email,
            userType: user.userType,
            accountTier: user.accountTier,
            creditBalance: user.creditBalance,
        });
    }
}
