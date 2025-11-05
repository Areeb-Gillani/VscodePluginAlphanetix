// Type definitions for AlphanetixAI API

export interface AuthResponse {
    userId: string;
    username: string;
    email: string;
    userType: 'INDIVIDUAL' | 'CORPORATE_ADMIN' | 'CORPORATE_EMPLOYEE';
    accountTier: 'ECONOMY' | 'BUSINESS' | 'FIRST_CLASS';
    creditBalance: number;
    token: string;
    refreshToken: string;
}

export interface UserDTO {
    id: string;
    username: string;
    email: string;
    userType: 'INDIVIDUAL' | 'CORPORATE_ADMIN' | 'CORPORATE_EMPLOYEE';
    accountTier: 'ECONOMY' | 'BUSINESS' | 'FIRST_CLASS';
    creditBalance: number;
    createdAt: string;
    lastLogin?: string;
    isActive: boolean;
    profilePictureUrl?: string;
}

export interface TeamDTO {
    id: string;
    corporateAccountId: string;
    companyName: string;
    teamName: string;
    description?: string;
    memberCount: number;
    allocatedCredits?: number;
    usedCredits?: number;
    availableCredits?: number;
    createdAt: string;
    updatedAt?: string;
}

export interface TeamMemberDTO {
    id: string;
    teamId: string;
    userId: string;
    username: string;
    email: string;
    role: 'MEMBER' | 'LEADER' | 'VIEWER';
    allocatedCredits?: number;
    usedCredits?: number;
    availableCredits?: number;
    joinedAt: string;
}

export interface AiModelDTO {
    id: string;
    provider: string;
    modelName: string;
    displayName: string;
    description?: string;
    costPer1kTokensInput: number;
    costPer1kTokensOutput: number;
    creditMultiplier?: number;
    isAvailable: boolean;
    minTier: 'ECONOMY' | 'BUSINESS' | 'FIRST_CLASS';
    maxTokens: number;
    createdAt: string;
}

export interface AiAgentDTO {
    id: string;
    name: string;
    description?: string;
    systemPrompt?: string;
    defaultModelId?: string;
    defaultModelName?: string;
    iconUrl?: string;
    isPublic: boolean;
    createdBy?: string;
    createdById?: string;
    createdByName?: string;
    createdByUsername?: string;
    corporateAccountId?: string;
    companyName?: string;
    minTier: 'ECONOMY' | 'BUSINESS' | 'FIRST_CLASS';
    createdAt: string;
}

export interface UserPreferenceDTO {
    userId: string;
    defaultAiModelId?: string;
    defaultModelName?: string;
    theme?: string;
    language?: string;
    emailNotifications?: boolean;
    lowCreditAlerts?: boolean;
    showUsageTips?: boolean;
}

export interface ChatSessionDTO {
    id: string;
    userId: string;
    username: string;
    teamId?: string;
    teamName?: string;
    aiModelId?: string;
    aiModelName?: string;
    sessionName?: string;
    createdAt: string;
    lastActive: string;
    isArchived: boolean;
    systemPrompt?: string;
}

export interface ChatMessageDTO {
    id: string;
    chatSessionId: string;
    message: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    tokensInput?: number;
    tokensOutput?: number;
    creditsUsed?: number;
    createdAt: string;
    aiModelId?: string;
    aiModelName?: string;
}

export interface AICompletionRequest {
    message: string;
    chatSessionId?: string;
    aiModelId?: string;
    estimatedInputTokens: number; // Required field - server expects non-null integer
}

export interface AICompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    message: string;
    tokensUsed: number;
    
    creditsUsed: number;
    chatSessionId?: string;
    choices?: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finishReason: string;
    }>;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface CorporateAccountDTO {
    id: string;
    companyName: string;
    adminUserId: string;
    adminUsername?: string;
    adminEmail?: string;
    totalCreditAllocation: number;
    currentCreditBalance: number;
    renewalDate?: string;
    billingAddress?: string;
    billingEmail?: string;
    maxEmployees?: number;
    currentEmployeeCount?: number;
    createdAt: string;
    updatedAt?: string;
}

export interface QuotaInfo {
    userCredits: number;
    teamCredits?: number;
    corporateCredits?: number;
    allocated?: number;
    used?: number;
    available?: number;
}

export interface ExtensionState {
    isAuthenticated: boolean;
    user?: UserDTO;
    selectedTeam?: TeamDTO;
    selectedModel?: AiModelDTO;
    selectedAgent?: AiAgentDTO;
    quotaInfo?: QuotaInfo;
    teams?: TeamDTO[];
    models?: AiModelDTO[];
    agents?: AiAgentDTO[];
}
