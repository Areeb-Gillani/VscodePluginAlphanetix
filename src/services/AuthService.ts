import * as vscode from 'vscode';
import { StateManager } from '../state/StateManager';
import { AuthResponse } from '../types';

/**
 * Handles OAuth-like authentication flow via browser
 */
export class AuthService {
    private static instance: AuthService;
    private authServer: any;

    private constructor() {}

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    /**
     * Initiates browser-based login flow
     */
    public async login(): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration('alphanetix');
            const apiUrl = config.get<string>('apiUrl') || 'http://localhost:9100';
            
            // Generate a unique state for this auth session
            const state = this.generateState();
            
            // Store state in a way the frontend can access it, then open root URL
            // This works around BrowserRouter routing issues in development
            const frontendUrl = 'http://localhost:3002';
            const loginUrl = `${frontendUrl}/?vscode=true&state=${encodeURIComponent(state)}`;
            
            console.log('🔗 VS Code Auth: Generated state:', state);
            console.log('🔗 VS Code Auth: Opening URL via root with params:', loginUrl);
            
            // Open browser for user to login
            const opened = await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
            
            if (!opened) {
                vscode.window.showErrorMessage('Failed to open browser for authentication');
                return false;
            }

            // Show progress message
            vscode.window.showInformationMessage(
                '🔗 Please complete the login in your browser. Click the "Open VS Code Extension" button when it appears.',
                'Cancel'
            ).then(choice => {
                if (choice === 'Cancel') {
                    console.log('🔗 VS Code Auth: User cancelled authentication');
                }
            });

            // Return true immediately - the URI handler will complete the authentication
            return true;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Login failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Generate a unique state parameter for OAuth-like flow
     */
    private generateState(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    /**
     * Alternative: Direct credential login
     */
    public async loginWithCredentials(): Promise<boolean> {
        try {
            const username = await vscode.window.showInputBox({
                prompt: 'Enter your username or email',
                placeHolder: 'username or email',
                ignoreFocusOut: true,
            });

            if (!username) {
                return false;
            }

            const password = await vscode.window.showInputBox({
                prompt: 'Enter your password',
                placeHolder: 'password',
                password: true,
                ignoreFocusOut: true,
            });

            if (!password) {
                return false;
            }

            // Make login request
            const config = vscode.workspace.getConfiguration('alphanetix');
            const apiUrl = config.get<string>('apiUrl') || 'http://localhost:9100';

            const response = await fetch(`${apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    email: username,
                    password,
                }),
            });

            if (!response.ok) {
                throw new Error('Invalid credentials');
            }

            const authData = await response.json() as AuthResponse;

            // Store tokens and user info
            await StateManager.getInstance().setAuthToken(authData.token);
            await StateManager.getInstance().setRefreshToken(authData.refreshToken);
            await StateManager.getInstance().setUserInfo({
                userId: authData.userId,
                username: authData.username,
                email: authData.email,
                userType: authData.userType,
                accountTier: authData.accountTier,
                creditBalance: authData.creditBalance,
            });

            vscode.window.showInformationMessage(`Welcome, ${authData.username}!`);
            return true;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Login failed: ${error.message}`);
            return false;
        }
    }

    private async validateAndStoreToken(token: string): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration('alphanetix');
            const apiUrl = config.get<string>('apiUrl') || 'http://localhost:9100';

            const response = await fetch(`${apiUrl}/api/auth/validate-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ token }),
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json() as any;

            // Store token
            await StateManager.getInstance().setAuthToken(token);
            
            // Get user info
            if (data.userId) {
                await StateManager.getInstance().setUserInfo(data);
            }

            return true;
        } catch (error) {
            console.error('Token validation failed:', error);
            return false;
        }
    }

    /**
     * Store tokens and user info directly (used by URI callback)
     */
    public async storeTokens(authData: {
        token: string;
        refreshToken: string;
        userId?: string;
        username?: string;
        userType?: string;
        accountTier?: string;
    }): Promise<void> {
        try {
            console.log('🔗 AuthService.storeTokens: Starting token storage...', {
                hasToken: !!authData.token,
                hasRefreshToken: !!authData.refreshToken,
                userId: authData.userId,
                username: authData.username
            });

            // Store tokens
            await StateManager.getInstance().setAuthToken(authData.token);
            console.log('🔗 AuthService.storeTokens: Auth token stored');
            
            await StateManager.getInstance().setRefreshToken(authData.refreshToken);
            console.log('🔗 AuthService.storeTokens: Refresh token stored');
            
            // Store user info if provided
            if (authData.userId && authData.username) {
                const userInfo = {
                    userId: authData.userId,
                    username: authData.username,
                    email: '', // Will be fetched from profile
                    userType: authData.userType || 'INDIVIDUAL',
                    accountTier: authData.accountTier || 'FREE',
                    creditBalance: 0, // Will be fetched from profile
                };
                
                await StateManager.getInstance().setUserInfo(userInfo);
                console.log('🔗 AuthService.storeTokens: User info stored', userInfo);
            }

            // Verify tokens were stored correctly
            const storedToken = await StateManager.getInstance().getAuthToken();
            const isAuthenticated = await StateManager.getInstance().isAuthenticated();
            console.log('🔗 AuthService.storeTokens: Verification - stored token exists:', !!storedToken);
            console.log('🔗 AuthService.storeTokens: Verification - isAuthenticated:', isAuthenticated);

            // Fetch complete user profile to get accurate info
            await this.fetchAndStoreUserProfile();
            console.log('🔗 AuthService.storeTokens: Profile fetch completed');
            
        } catch (error) {
            console.error('🔗 AuthService.storeTokens: Failed to store tokens:', error);
            throw error;
        }
    }

    private async fetchAndStoreUserProfile(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('alphanetix');
            const apiUrl = config.get<string>('apiUrl') || 'http://localhost:9100';
            const token = await StateManager.getInstance().getAuthToken();

            if (!token) {
                return;
            }

            const response = await fetch(`${apiUrl}/api/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const profile = await response.json() as any;
                await StateManager.getInstance().setUserInfo({
                    userId: profile.id,
                    username: profile.username,
                    email: profile.email,
                    userType: profile.userType,
                    accountTier: profile.accountTier,
                    creditBalance: profile.creditBalance,
                });
            }
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
            // Don't throw - we can continue with basic info
        }
    }

    /**
     * Logout and clear all stored data
     */
    public async logout(): Promise<void> {
        await StateManager.getInstance().clearAll();
        vscode.window.showInformationMessage('Signed out successfully');
    }

    /**
     * Check if user is authenticated
     */
    public async isAuthenticated(): Promise<boolean> {
        return await StateManager.getInstance().isAuthenticated();
    }
}
