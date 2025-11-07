import * as vscode from 'vscode';
import { StateManager } from './state/StateManager';
import { AuthService } from './services/AuthService';
import { TeamService } from './services/TeamService';
import { ModelService } from './services/ModelService';
import { UserService } from './services/UserService';
import { CompletionService } from './services/CompletionService';
import { InlineCompletionProvider } from './providers/InlineCompletionProvider';
import { MainViewProvider } from './views/MainViewProvider';
import { CodeActionProvider } from './providers/CodeActionProvider';
import { MCPService } from './mcp/MCPService';

let statusBarItem: vscode.StatusBarItem;
let statusPopupPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Alphanetix Code Assistant is now active!');

    // Initialize state manager
    StateManager.initialize(context);

    // Register URI handler for authentication callback
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            handleUri: async (uri: vscode.Uri) => {
                console.log('🔗 URI Handler: Received callback:', uri.toString());
                console.log('🔗 URI Handler: Active window:', vscode.window.activeTextEditor?.document.fileName || 'No active editor');
                console.log('🔗 URI Handler: Extension context available:', !!context);
                
                // Show immediate feedback that URI was received
                vscode.window.showInformationMessage('🔗 VS Code received authentication callback, processing...');
                
                await handleAuthCallback(uri);
            }
        })
    );

    // Register services
    const authService = AuthService.getInstance();
    const teamService = TeamService.getInstance();
    const modelService = ModelService.getInstance();
    const userService = UserService.getInstance();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'alphanetix.showStatusPopup';
    context.subscriptions.push(statusBarItem);

    // Update status bar
    updateStatusBar();

    // Register inline completion provider
    const inlineProvider = new InlineCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**' },
            inlineProvider
        )
    );

    // Register webview provider
    const mainViewProvider = new MainViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('alphanetix.mainView', mainViewProvider)
    );

    // Register fallback refresh commands for the main view provider
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.mainView.refresh', async () => {
            try {
                if (typeof (mainViewProvider as any)?.refresh === 'function') {
                    await (mainViewProvider as any).refresh();
                    console.log('🔧 mainView.refresh invoked (provider)');
                } else {
                    console.log('🔧 mainView.refresh invoked (no-op)');
                }
            } catch (err) {
                console.log('🔧 mainView.refresh handler error', err);
            }
        })
    );

    // Keep old refresh commands for backward compatibility
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.statusView.refresh', async () => {
            try {
                if (typeof (mainViewProvider as any)?.refresh === 'function') {
                    await (mainViewProvider as any).refresh();
                    console.log('🔧 statusView.refresh invoked (delegated to mainView)');
                } else {
                    console.log('🔧 statusView.refresh invoked (no-op)');
                }
            } catch (err) {
                console.log('🔧 statusView.refresh handler error', err);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.chatView.refresh', async () => {
            try {
                if (typeof (mainViewProvider as any)?.refresh === 'function') {
                    await (mainViewProvider as any).refresh();
                    console.log('🔧 chatView.refresh invoked (delegated to mainView)');
                } else {
                    console.log('🔧 chatView.refresh invoked (no-op)');
                }
            } catch (err) {
                console.log('🔧 chatView.refresh handler error', err);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.settingsView.refresh', async () => {
            try {
                if (typeof (mainViewProvider as any)?.refresh === 'function') {
                    await (mainViewProvider as any).refresh();
                    console.log('🔧 settingsView.refresh invoked (delegated to mainView)');
                } else {
                    console.log('🔧 settingsView.refresh invoked (no-op)');
                }
            } catch (err) {
                console.log('🔧 settingsView.refresh handler error', err);
            }
        })
    );

    // Register code action provider
    const codeActionProvider = new CodeActionProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('*', codeActionProvider)
    );

    // Register commands
    registerCommands(context);

    // Check authentication status on startup
    checkAuthenticationStatus();
}

function registerCommands(context: vscode.ExtensionContext) {
    // Authentication commands
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.login', async () => {
            const choice = await vscode.window.showQuickPick(
                ['Browser Login (Recommended)', 'Username/Password'],
                { placeHolder: 'Choose login method' }
            );

            if (choice === 'Browser Login (Recommended)') {
                const success = await AuthService.getInstance().login();
                if (success) {
                    await updateStatusBar();
                    await refreshAllViews();
                }
            } else if (choice === 'Username/Password') {
                const success = await AuthService.getInstance().loginWithCredentials();
                if (success) {
                    await updateStatusBar();
                    await refreshAllViews();
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.logout', async () => {
            await AuthService.getInstance().logout();
            await updateStatusBar();
            await refreshAllViews();
        })
    );

    // Debug command
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.debugExtension', async () => {
            const authService = AuthService.getInstance();
            const stateManager = StateManager.getInstance();
            const isAuthenticated = await authService.isAuthenticated();
            const currentUser = await stateManager.getUserInfo();
            const authToken = await stateManager.getAuthToken();
            const refreshToken = await stateManager.getRefreshToken();
            
            const debugInfo = {
                extensionActive: true,
                isAuthenticated,
                hasAuthToken: !!authToken,
                hasRefreshToken: !!refreshToken,
                authTokenLength: authToken?.length || 0,
                currentUser: currentUser ? {
                    id: currentUser.userId,
                    username: currentUser.username,
                    userType: currentUser.userType
                } : null,
                vscodeVersion: vscode.version,
                extensionVersion: vscode.extensions.getExtension('alphanetix.alphanetix-code-assistant')?.packageJSON?.version || 'unknown',
                activeWindows: vscode.window.visibleTextEditors.length,
                hasActiveEditor: !!vscode.window.activeTextEditor,
                workspaceFolders: vscode.workspace.workspaceFolders?.length || 0
            };

            console.log('🔍 Extension Debug Info:', debugInfo);

            const message = `Extension Debug Info:
• Extension Active: ${debugInfo.extensionActive}
• Authenticated: ${debugInfo.isAuthenticated}
• Has Auth Token: ${debugInfo.hasAuthToken}
• Has Refresh Token: ${debugInfo.hasRefreshToken}
• Auth Token Length: ${debugInfo.authTokenLength}
• User: ${debugInfo.currentUser?.username || 'None'}
• VS Code Version: ${debugInfo.vscodeVersion}
• Extension Version: ${debugInfo.extensionVersion}
• Active Editors: ${debugInfo.activeWindows}
• Has Active Editor: ${debugInfo.hasActiveEditor}
• Workspace Folders: ${debugInfo.workspaceFolders}`;

            vscode.window.showInformationMessage(
                message,
                'Copy to Clipboard',
                'Show in Console',
                'Force Status Update',
                'Manual Status Check'
            ).then(selection => {
                if (selection === 'Copy to Clipboard') {
                    vscode.env.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                } else if (selection === 'Show in Console') {
                    console.log('🔍 Full Debug Info:', JSON.stringify(debugInfo, null, 2));
                } else if (selection === 'Force Status Update') {
                    updateStatusBar().then(() => {
                        vscode.window.showInformationMessage('Status bar update completed');
                    });
                } else if (selection === 'Manual Status Check') {
                    // Manual check of all status bar related state
                    checkAuthAndUpdateStatus();
                }
            });
        })
    );

    // Team commands
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.switchTeam', async () => {
            const teams = await TeamService.getInstance().getMyTeams();
            
            if (teams.length === 0) {
                vscode.window.showInformationMessage('You are not a member of any teams');
                return;
            }

            const items = teams.map(team => ({
                label: team.teamName,
                description: team.companyName,
                detail: `${team.memberCount} members`,
                teamId: team.id,
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a team',
            });

            if (selected) {
                await TeamService.getInstance().switchTeam(selected.teamId);
                vscode.window.showInformationMessage(`Switched to team: ${selected.label}`);
                await updateStatusBar();
                await refreshAllViews();
            }
        })
    );

    // Model/Agent commands
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.selectModel', async () => {
            const models = await ModelService.getInstance().getAvailableModels();
            
            const items = models.map(model => ({
                label: model.displayName,
                description: model.provider,
                detail: model.description,
                modelId: model.id,
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select AI model',
            });

            if (selected) {
                await StateManager.getInstance().setSelectedModel(selected.modelId);
                vscode.window.showInformationMessage(`Selected model: ${selected.label}`);
                await updateStatusBar();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.selectAgent', async () => {
            const agents = await ModelService.getInstance().getAvailableAgents();
            
            const items = agents.map(agent => ({
                label: agent.name,
                description: agent.isPublic ? 'Public' : 'Private',
                detail: agent.description,
                agentId: agent.id,
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select AI agent',
            });

            if (selected) {
                await StateManager.getInstance().setSelectedAgent(selected.agentId);
                vscode.window.showInformationMessage(`Selected agent: ${selected.label}`);
                await updateStatusBar();
            }
        })
    );

    // Chat command
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.openChat', () => {
            vscode.commands.executeCommand('alphanetix.mainView.focus');
        })
    );

    // Code action commands
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.explainCode', async () => {
            await executeCodeAction('explain');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.fixCode', async () => {
            await executeCodeAction('fix');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.generateTests', async () => {
            await executeCodeAction('test');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.generateDocs', async () => {
            await executeCodeAction('docs');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.refactorCode', async () => {
            await executeCodeAction('refactor');
        })
    );

    // MCP debug commands
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.mcpDebug', async () => {
            const mcpService = MCPService.getInstance();
            const completionService = CompletionService.getInstance();
            
            const mcpInfo = {
                availableTools: mcpService.getAvailableTools().length,
                toolStats: mcpService.getToolStats(),
                recentActions: mcpService.getRecentActions().slice(-5),
                workspaceContext: await mcpService.getWorkspaceContext()
            };

            console.log('🔧 MCP Debug Info:', mcpInfo);

            const message = `MCP Debug Information:
• Available Tools: ${mcpInfo.availableTools}
• Tool Usage Stats: ${JSON.stringify(mcpInfo.toolStats, null, 2)}
• Recent Actions: ${mcpInfo.recentActions.length}
• Workspace Folders: ${mcpInfo.workspaceContext.workspaceInfo.folders.length}
• Open Editors: ${mcpInfo.workspaceContext.workspaceInfo.openEditors.length}`;

            vscode.window.showInformationMessage(
                message,
                'Copy to Clipboard',
                'Show Tools',
                'Test File Tool',
                'Test Workspace Tool'
            ).then(async selection => {
                if (selection === 'Copy to Clipboard') {
                    vscode.env.clipboard.writeText(JSON.stringify(mcpInfo, null, 2));
                } else if (selection === 'Show Tools') {
                    const tools = mcpService.getAvailableTools();
                    const toolList = tools.map(tool => `${tool.name}: ${tool.description}`).join('\n');
                    vscode.window.showInformationMessage(`Available MCP Tools:\n${toolList}`);
                } else if (selection === 'Test File Tool') {
                    try {
                        const result = await completionService.executeMCPTool({
                            name: 'get_active_editor',
                            arguments: { includeContent: false }
                        });
                        vscode.window.showInformationMessage(`Tool Result: ${result.content?.[0]?.text || 'No content'}`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Tool Error: ${error}`);
                    }
                } else if (selection === 'Test Workspace Tool') {
                    try {
                        const result = await completionService.executeMCPTool({
                            name: 'get_workspace_info',
                            arguments: {}
                        });
                        vscode.window.showInformationMessage(`Tool Result: ${result.content?.[0]?.text || 'No content'}`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Tool Error: ${error}`);
                    }
                }
            });
        })
    );

    // Quota command
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.refreshQuota', async () => {
            await updateStatusBar();
            vscode.window.showInformationMessage('Status refreshed');
        })
    );

    // Settings command
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.showSettings', () => {
            vscode.commands.executeCommand('alphanetix.mainView.focus');
        })
    );

    // Status popup command
    context.subscriptions.push(
        vscode.commands.registerCommand('alphanetix.showStatusPopup', async () => {
            // If panel already exists, just reveal it
            if (statusPopupPanel) {
                statusPopupPanel.reveal(vscode.ViewColumn.Beside, true);
                return;
            }

            const panel = vscode.window.createWebviewPanel(
                'alphanetixStatus',
                'Alphanetix AI Status',
                {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: true
                },
                {
                    enableScripts: true,
                    localResourceRoots: [context.extensionUri],
                    retainContextWhenHidden: false
                }
            );

            // Store the panel reference
            statusPopupPanel = panel;

            // Clear the reference when panel is disposed
            panel.onDidDispose(() => {
                statusPopupPanel = undefined;
            });

            // Get status data
            const isAuthenticated = await StateManager.getInstance().isAuthenticated();
            
            if (!isAuthenticated) {
                panel.webview.html = getStatusPopupHtml({}, false);
                return;
            }

            const [userInfo, quotaInfo, teams, models, agents, selectedTeamId, selectedModelId, selectedAgentId] = await Promise.allSettled([
                StateManager.getInstance().getUserInfo(),
                UserService.getInstance().getQuotaInfo().catch(() => null),
                TeamService.getInstance().getMyTeams().catch(() => []),
                ModelService.getInstance().getAvailableModels().catch(() => []),
                ModelService.getInstance().getAvailableAgents().catch(() => []),
                StateManager.getInstance().getSelectedTeam(),
                StateManager.getInstance().getSelectedModel(),
                StateManager.getInstance().getSelectedAgent(),
            ]);

            panel.webview.html = getStatusPopupHtml({
                userInfo: userInfo.status === 'fulfilled' ? userInfo.value : null,
                quotaInfo: quotaInfo.status === 'fulfilled' ? quotaInfo.value : null,
                teams: teams.status === 'fulfilled' ? teams.value : [],
                models: models.status === 'fulfilled' ? models.value : [],
                agents: agents.status === 'fulfilled' ? agents.value : [],
                selectedTeamId: selectedTeamId.status === 'fulfilled' ? selectedTeamId.value : null,
                selectedModelId: selectedModelId.status === 'fulfilled' ? selectedModelId.value : null,
                selectedAgentId: selectedAgentId.status === 'fulfilled' ? selectedAgentId.value : null,
            }, true);

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'selectModel':
                        vscode.commands.executeCommand('alphanetix.selectModel');
                        panel.dispose();
                        break;
                    case 'selectAgent':
                        vscode.commands.executeCommand('alphanetix.selectAgent');
                        panel.dispose();
                        break;
                    case 'switchTeam':
                        vscode.commands.executeCommand('alphanetix.switchTeam');
                        panel.dispose();
                        break;
                    case 'openSettings':
                        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:alphanetix.alphanetix-code-assistant');
                        panel.dispose();
                        break;
                    case 'refresh':
                        await updateStatusBar();
                        panel.dispose();
                        vscode.commands.executeCommand('alphanetix.showStatusPopup');
                        break;
                    case 'close':
                        panel.dispose();
                        break;
                }
            });
        })
    );
}

async function executeCodeAction(actionType: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('Please select some code first');
        return;
    }

    // This will be handled by CodeActionProvider
    // For now, show a message
    vscode.window.showInformationMessage(`${actionType} action will be implemented in CodeActionProvider`);
}

async function checkAuthAndUpdateStatus() {
    console.log('🔍 Manual auth check starting...');
    
    const stateManager = StateManager.getInstance();
    
    // Check tokens directly
    const authToken = await stateManager.getAuthToken();
    const refreshToken = await stateManager.getRefreshToken();
    const userInfo = await stateManager.getUserInfo();
    
    console.log('🔍 Direct token check:', {
        hasAuthToken: !!authToken,
        authTokenLength: authToken?.length || 0,
        hasRefreshToken: !!refreshToken,
        refreshTokenLength: refreshToken?.length || 0,
        hasUserInfo: !!userInfo,
        username: userInfo?.username
    });
    
    // Check isAuthenticated method
    const isAuth1 = await stateManager.isAuthenticated();
    const isAuth2 = await AuthService.getInstance().isAuthenticated();
    
    console.log('🔍 Authentication checks:', {
        stateManagerAuth: isAuth1,
        authServiceAuth: isAuth2
    });
    
    // Check current status bar state
    console.log('🔍 Current status bar:', {
        text: statusBarItem.text,
        tooltip: statusBarItem.tooltip,
        visible: statusBarItem.text !== ''
    });
    
    // Force update and check again
    console.log('🔍 Forcing status bar update...');
    await updateStatusBar();
    
    console.log('🔍 Status bar after update:', {
        text: statusBarItem.text,
        tooltip: statusBarItem.tooltip
    });
    
    vscode.window.showInformationMessage(
        `Auth Check: StateManager=${isAuth1}, AuthService=${isAuth2}, StatusBar="${statusBarItem.text}"`,
        'OK'
    );
}

async function updateStatusBar() {
    console.log('🔗 updateStatusBar: Starting status bar update...');
    
    const isAuthenticated = await StateManager.getInstance().isAuthenticated();
    console.log('🔗 updateStatusBar: isAuthenticated:', isAuthenticated);
    
    if (!isAuthenticated) {
        console.log('🔗 updateStatusBar: User not authenticated, showing sign in');
        statusBarItem.text = '$(rocket) αAI';
        const tooltip = new vscode.MarkdownString('**Alphanetix AI**\n\n_Click to sign in_', true);
        tooltip.isTrusted = true;
        statusBarItem.tooltip = tooltip;
        statusBarItem.show();
        return;
    }

    console.log('🔗 updateStatusBar: User authenticated, updating UI...');
    
    // Fetch all data for comprehensive tooltip
    const [userInfo, quotaInfo, teams, models, agents, selectedTeamId, selectedModelId, selectedAgentId] = await Promise.allSettled([
        StateManager.getInstance().getUserInfo(),
        UserService.getInstance().getQuotaInfo().catch(() => null),
        TeamService.getInstance().getMyTeams().catch(() => []),
        ModelService.getInstance().getAvailableModels().catch(() => []),
        ModelService.getInstance().getAvailableAgents().catch(() => []),
        StateManager.getInstance().getSelectedTeam(),
        StateManager.getInstance().getSelectedModel(),
        StateManager.getInstance().getSelectedAgent(),
    ]);

    const user = userInfo.status === 'fulfilled' ? userInfo.value : null;
    const quota = quotaInfo.status === 'fulfilled' ? quotaInfo.value : null;
    const teamsList = teams.status === 'fulfilled' ? teams.value : [];
    const modelsList = models.status === 'fulfilled' ? models.value : [];
    const agentsList = agents.status === 'fulfilled' ? agents.value : [];
    const teamId = selectedTeamId.status === 'fulfilled' ? selectedTeamId.value : null;
    const modelId = selectedModelId.status === 'fulfilled' ? selectedModelId.value : null;
    const agentId = selectedAgentId.status === 'fulfilled' ? selectedAgentId.value : null;

    const selectedTeam = teamsList.find((t: any) => t.id === teamId);
    const selectedModel = modelsList.find((m: any) => m.id === modelId);
    const selectedAgent = agentsList.find((a: any) => a.id === agentId);

    const metrics = computeUsageSnapshot({ quotaInfo: quota, userInfo: user });
    const tooltipHtml = getStatusTooltipContent({
        user,
        team: selectedTeam,
        model: selectedModel,
        agent: selectedAgent,
        metrics
    });

    const tooltip = new vscode.MarkdownString(tooltipHtml, true);
    tooltip.isTrusted = true;
    tooltip.supportHtml = true;

    statusBarItem.text = '$(rocket) αAI';
    statusBarItem.tooltip = tooltip;
    statusBarItem.show();
    console.log('🔗 updateStatusBar: Status bar updated with rich HTML tooltip');
}

async function checkAuthenticationStatus() {
    const isAuthenticated = await StateManager.getInstance().isAuthenticated();
    
    if (!isAuthenticated) {
        const choice = await vscode.window.showInformationMessage(
            'Welcome to Alphanetix Code Assistant! Please sign in to get started.',
            'Sign In',
            'Later'
        );

        if (choice === 'Sign In') {
            vscode.commands.executeCommand('alphanetix.login');
        }
    }
}

async function refreshAllViews() {
    // Trigger refresh for the main view provider (with error handling)
    try {
        await vscode.commands.executeCommand('alphanetix.mainView.refresh');
    } catch (error) {
        console.log('🔧 mainView.refresh command not available');
    }
}

async function handleAuthCallback(uri: vscode.Uri) {
    console.log('🔗 Auth Callback: Starting authentication process');
    console.log('🔗 Auth Callback: URI:', uri.toString());
    console.log('🔗 Auth Callback: Scheme:', uri.scheme);
    console.log('🔗 Auth Callback: Authority:', uri.authority);
    console.log('🔗 Auth Callback: Path:', uri.path);
    console.log('🔗 Auth Callback: Query:', uri.query);
    
    try {
        const query = new URLSearchParams(uri.query);
        const token = query.get('token');
        const refreshToken = query.get('refreshToken');
        const userId = query.get('userId');
        const username = query.get('username');
        const state = query.get('state');

        console.log('🔗 Auth Callback: Parsed parameters:', {
            hasToken: !!token,
            hasRefreshToken: !!refreshToken,
            userId,
            username,
            state
        });

        if (!token || !refreshToken) {
            const errorMsg = 'Authentication failed: Missing tokens in callback';
            console.error('🔗 Auth Callback: Error -', errorMsg);
            vscode.window.showErrorMessage(errorMsg);
            return;
        }

        console.log('🔗 Auth Callback: Tokens received, storing...');

        // Store the tokens using AuthService
        const authService = AuthService.getInstance();
        await authService.storeTokens({
            token,
            refreshToken,
            userId: userId || undefined,
            username: username || undefined,
            userType: 'INDIVIDUAL', // Will be updated from user profile
            accountTier: 'FREE'      // Will be updated from user profile
        });

        console.log('🔗 Auth Callback: Tokens stored successfully');

        // Update UI
        console.log('🔗 Auth Callback: Updating status bar...');
        await updateStatusBar();
        console.log('🔗 Auth Callback: Status bar updated');
        
        console.log('🔗 Auth Callback: Refreshing views...');
        await refreshAllViews();
        console.log('🔗 Auth Callback: Views refreshed');

        // Show success message with more details
        const successMsg = `✅ Successfully logged in as ${username || 'user'}! Extension is ready to use.`;
        vscode.window.showInformationMessage(successMsg);

        // Show additional success notification
        vscode.window.showInformationMessage(
            '🚀 Alphanetix Code Assistant is now connected! Try inline completions by typing in any file.',
            'Open Settings',
            'Test Connection'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('alphanetix.showSettings');
            } else if (selection === 'Test Connection') {
                vscode.commands.executeCommand('alphanetix.refreshQuota');
            }
        });

        console.log('🔗 Auth Callback: Authentication completed successfully');

    } catch (error) {
        console.error('🔗 Auth Callback: Error handling callback:', error);
        const errorMsg = `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        vscode.window.showErrorMessage(errorMsg);
        
        // Show additional help
        vscode.window.showErrorMessage(
            'Authentication failed. Try closing all VS Code windows and using only the Extension Development Host.',
            'Show Help',
            'Retry'
        ).then(selection => {
            if (selection === 'Show Help') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/troubleshooting'));
            } else if (selection === 'Retry') {
                vscode.commands.executeCommand('alphanetix.login');
            }
        });
    }
}

type UsageSnapshot = {
    availableCredits: number;
    consumedCredits: number;
    teamCredits?: number;
    totalCredits?: number;
    requestsUsed?: number;
    requestsLimit?: number;
    chatUsed?: number;
    chatLimit?: number;
    completionsUsed?: number;
    completionsLimit?: number;
    sessionCount?: number;
};

const toNumber = (value: any): number | undefined => {
    if (value === undefined || value === null) {
        return undefined;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const pickNumber = (...values: any[]): number | undefined => {
    for (const value of values) {
        const parsed = toNumber(value);
        if (parsed !== undefined) {
            return parsed;
        }
    }
    return undefined;
};

const formatNumber = (value?: number): string => {
    if (value === undefined) {
        return '—';
    }

    if (value >= 1000) {
        return Math.round(value).toLocaleString();
    }

    return value.toLocaleString(undefined, {
        maximumFractionDigits: value < 10 ? 2 : 0
    });
};

const computeUsageSnapshot = (data: any): UsageSnapshot => {
    const availableCredits = pickNumber(
        data?.quotaInfo?.available,
        data?.quotaInfo?.userCredits,
        data?.quotaInfo?.creditBalance
    ) ?? 0;

    const consumedCredits = pickNumber(
        data?.quotaInfo?.used,
        data?.quotaInfo?.creditsUsed,
        data?.quotaInfo?.burned
    ) ?? 0;

    const teamCredits = pickNumber(
        data?.quotaInfo?.teamCredits,
        data?.quotaInfo?.allocated
    );

    const totalCredits = teamCredits ?? (availableCredits + consumedCredits);

    const requestsUsed = pickNumber(
        data?.quotaInfo?.requestUsage?.used,
        data?.quotaInfo?.requestsUsed
    );

    const requestsLimit = pickNumber(
        data?.quotaInfo?.requestUsage?.limit,
        data?.quotaInfo?.requestsLimit,
        teamCredits
    );

    const chatUsed = pickNumber(
        data?.quotaInfo?.chatUsage?.used,
        data?.quotaInfo?.messagesUsed
    );

    const chatLimit = pickNumber(
        data?.quotaInfo?.chatUsage?.limit,
        data?.quotaInfo?.messagesLimit
    );

    const completionsUsed = pickNumber(
        data?.quotaInfo?.completionUsage?.used,
        data?.quotaInfo?.completionsUsed,
        consumedCredits
    );

    const completionsLimit = pickNumber(
        data?.quotaInfo?.completionUsage?.limit,
        data?.quotaInfo?.completionsLimit,
        totalCredits
    );

    const sessionCount = pickNumber(
        data?.userInfo?.activeSessions,
        data?.quotaInfo?.activeSessions
    );

    return {
        availableCredits,
        consumedCredits,
        teamCredits,
        totalCredits,
        requestsUsed,
        requestsLimit,
        chatUsed,
        chatLimit,
        completionsUsed,
        completionsLimit,
        sessionCount
    };
};

const buildPercentage = (used?: number, limit?: number): number => {
    if (limit && limit > 0 && used !== undefined) {
        return Math.min((used / limit) * 100, 100);
    }

    if (used !== undefined) {
        return Math.min(used > 0 ? 100 : 0, 100);
    }

    return 0;
};

function getStatusPopupHtml(data: any, isAuthenticated: boolean): string {
    if (!isAuthenticated) {
        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>${getStatusPopupStyles()}</style>
        </head>
        <body>
            <div class="popup-wrapper">
                <div class="status-card">
                    <header class="card-header">
                        <div class="card-title">
                            <div class="card-title-row">
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                    <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Z" />
                                    <path d="M6.27 5.06a.5.5 0 0 1 .52.04l3.5 2.5a.5.5 0 0 1 0 .8l-3.5 2.5A.5.5 0 0 1 6 10.5v-5a.5.5 0 0 1 .27-.44Z" />
                                </svg>
                                <span>Alphanetix AI</span>
                            </div>
                        </div>
                        <button class="icon-button" onclick="closePanel()" title="Close">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path d="M2.15 2.85a.5.5 0 1 1 .7-.7L8 7.3l5.15-5.15a.5.5 0 0 1 .7.7L8.7 8l5.15 5.15a.5.5 0 0 1-.7.7L8 8.7l-5.15 5.15a.5.5 0 0 1-.7-.7L7.3 8 2.15 2.85Z" />
                            </svg>
                        </button>
                    </header>
                    <div class="card-content">
                        <div class="auth-message">
                            <h2>Not signed in</h2>
                            <p>Sign in to access Alphanetix AI features</p>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                function closePanel() {
                    vscode.postMessage({ command: 'close' });
                }
            </script>
        </body>
        </html>`;
    }

    const metrics = computeUsageSnapshot(data);
    const { availableCredits, consumedCredits, teamCredits, totalCredits, requestsUsed, requestsLimit, chatUsed, chatLimit, completionsUsed, completionsLimit, sessionCount } = metrics;

    const buildUsageBlock = (options: {
        title: string;
        badge?: string;
        used?: number;
        limit?: number;
        status?: string;
        accentClass: string;
    }): string => {
        const { title, badge, used, limit, status, accentClass } = options;
        const hasLimit = limit !== undefined && limit > 0;
        const valueLabel = hasLimit && used !== undefined
            ? `${formatNumber(used)} of ${formatNumber(limit)}`
            : formatNumber(used);
        const percent = buildPercentage(used, limit);
        const statusLabel = status ?? (hasLimit && used !== undefined
            ? `${formatNumber(Math.max(limit - used, 0))} remaining`
            : 'Included');

        return `
            <div class="usage-block">
                <div class="usage-line">
                    <span class="usage-title">${title}</span>
                    ${badge ? `<span class="usage-badge">${badge}</span>` : ''}
                </div>
                <div class="usage-value">${valueLabel}</div>
                <div class="progress-track">
                    <div class="progress-fill ${accentClass}" style="width: ${percent}%;"></div>
                </div>
                <div class="usage-status">${statusLabel}</div>
            </div>
        `;
    };

    const getChevronSvg = (): string => `
        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden="true">
            <path d="M1.3 1.3a.5.5 0 0 1 .7 0l4 4a.5.5 0 0 1 0 .7l-4 4a.5.5 0 1 1-.7-.7L4.65 6 1.3 2.65a.5.5 0 0 1 0-.7Z" />
        </svg>
    `;

    const usageOverview = [
        buildUsageBlock({
            title: 'Credit budget',
            badge: teamCredits !== undefined ? 'Team' : 'Personal',
            used: consumedCredits,
            limit: totalCredits,
            status: totalCredits !== undefined
                ? `${formatNumber(Math.max(totalCredits - consumedCredits, 0))} credits remaining`
                : `${formatNumber(availableCredits)} credits available`,
            accentClass: 'accent-blue'
        }),
        buildUsageBlock({
            title: 'Code completions',
            badge: completionsLimit !== undefined ? 'Metered' : 'Included',
            used: completionsUsed,
            limit: completionsLimit,
            accentClass: 'accent-teal'
        }),
        buildUsageBlock({
            title: 'Chat messages',
            badge: chatLimit !== undefined ? 'Metered' : 'Included',
            used: chatUsed,
            limit: chatLimit,
            accentClass: 'accent-purple'
        }),
        buildUsageBlock({
            title: 'Tool requests',
            badge: requestsLimit !== undefined ? 'Metered' : 'Included',
            used: requestsUsed,
            limit: requestsLimit,
            accentClass: 'accent-amber'
        })
    ].join('');

    const selectedModel = data.models.find((m: any) => m.id === data.selectedModelId);
    const selectedAgent = data.agents.find((a: any) => a.id === data.selectedAgentId);
    const selectedTeam = data.teams.find((t: any) => t.id === data.selectedTeamId);
    const sessionLabel = sessionCount !== undefined
        ? `${formatNumber(sessionCount)} active session${sessionCount === 1 ? '' : 's'}`
        : 'No active sessions detected';

    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${getStatusPopupStyles()}</style>
    </head>
    <body>
        <div class="popup-wrapper">
            <div class="status-card">
                <header class="card-header">
                    <div class="card-title">
                        <div class="card-title-row">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Z" />
                                <path d="M6.27 5.06a.5.5 0 0 1 .52.04l3.5 2.5a.5.5 0 0 1 0 .8l-3.5 2.5A.5.5 0 0 1 6 10.5v-5a.5.5 0 0 1 .27-.44Z" />
                            </svg>
                            <span>Alphanetix AI</span>
                        </div>
                        <div class="card-subtitle">${data.userInfo?.username || 'Unknown user'}</div>
                        <div class="card-meta">
                            <span class="tier-chip">${data.userInfo?.accountTier || 'ECONOMY'}</span>
                            ${selectedTeam ? `<span class="meta-pill">${selectedTeam.teamName}</span>` : ''}
                        </div>
                    </div>
                    <button class="icon-button" onclick="closePanel()" title="Close">
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d="M2.15 2.85a.5.5 0 1 1 .7-.7L8 7.3l5.15-5.15a.5.5 0 0 1 .7.7L8.7 8l5.15 5.15a.5.5 0 0 1-.7.7L8 8.7l-5.15 5.15a.5.5 0 0 1-.7-.7L7.3 8 2.15 2.85Z" />
                        </svg>
                    </button>
                </header>

                <div class="card-content">
                    <section class="section">
                        <div class="section-heading">
                            <span>Usage Overview</span>
                            <span class="heading-meta">${totalCredits ? `${formatNumber(totalCredits)} total` : `${formatNumber(availableCredits)} available`}</span>
                        </div>
                        <div class="usage-grid">${usageOverview}</div>
                        <div class="info-pill">
                            ${sessionLabel}
                        </div>
                    </section>

                    <section class="section">
                        <div class="section-heading">
                            <span>Configuration</span>
                        </div>
                        <div class="control-column">
                            <div class="control-row ${selectedTeam ? 'clickable' : 'disabled'}" ${selectedTeam ? 'onclick="switchTeam()"' : ''}>
                                <div class="control-text">
                                    <div class="control-label">Active Team</div>
                                    <div class="control-value">${selectedTeam ? selectedTeam.teamName : 'Personal workspace'}</div>
                                </div>
                                ${selectedTeam ? `<div class="chevron">${getChevronSvg()}</div>` : ''}
                            </div>
                            <div class="control-row clickable" onclick="selectModel()">
                                <div class="control-text">
                                    <div class="control-label">Model</div>
                                    <div class="control-value">${selectedModel?.displayName || 'Default model'}</div>
                                    ${selectedModel?.provider ? `<div class="control-hint">${selectedModel.provider}</div>` : ''}
                                </div>
                                <div class="chevron">${getChevronSvg()}</div>
                            </div>
                            <div class="control-row clickable" onclick="selectAgent()">
                                <div class="control-text">
                                    <div class="control-label">Agent</div>
                                    <div class="control-value">${selectedAgent?.displayName || selectedAgent?.name || 'Default agent'}</div>
                                    ${selectedAgent?.description ? `<div class="control-hint">${selectedAgent.description}</div>` : ''}
                                </div>
                                <div class="chevron">${getChevronSvg()}</div>
                            </div>
                        </div>
                    </section>
                </div>

                <footer class="card-footer">
                    <button class="secondary-button" onclick="refresh()">Refresh</button>
                    <button class="primary-button" onclick="openSettings()">Settings</button>
                </footer>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function selectModel() {
                vscode.postMessage({ command: 'selectModel' });
            }

            function selectAgent() {
                vscode.postMessage({ command: 'selectAgent' });
            }

            function switchTeam() {
                vscode.postMessage({ command: 'switchTeam' });
            }

            function openSettings() {
                vscode.postMessage({ command: 'openSettings' });
            }

            function refresh() {
                vscode.postMessage({ command: 'refresh' });
            }

            function closePanel() {
                vscode.postMessage({ command: 'close' });
            }

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    closePanel();
                }
            });
        </script>
    </body>
    </html>`;
}

function getStatusPopupStyles(): string {
    return `
        :root {
            color-scheme: var(--vscode-color-scheme);
        }

        * {
            box-sizing: border-box;
        }

        html, body {
            height: 100%;
            overflow: hidden;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            font-size: 11px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }

        .popup-wrapper {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .status-card {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editor-background);
            flex-shrink: 0;
        }

        .card-title {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .card-title-row {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.1px;
        }

        .card-title-row svg {
            opacity: 0.7;
            flex-shrink: 0;
        }

        .card-subtitle {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            font-weight: normal;
        }

        .card-meta {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            margin-top: 2px;
        }

        .tier-chip {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            font-size: 8px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 1px 4px;
            border-radius: 2px;
        }

        .meta-pill {
            background: var(--vscode-input-background);
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-panel-border);
            font-size: 9px;
            border-radius: 2px;
            padding: 1px 4px;
        }

        .icon-button {
            border: none;
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border-radius: 2px;
            padding: 4px;
            cursor: pointer;
            transition: background 0.1s ease, color 0.1s ease;
            flex-shrink: 0;
        }

        .icon-button:hover {
            background: var(--vscode-toolbar-hoverBackground);
            color: var(--vscode-foreground);
        }

        .card-content {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }

        .section {
            padding: 12px;
        }

        .section:not(:last-of-type) {
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .section-heading {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }

        .heading-meta {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            font-weight: normal;
        }

        .usage-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .usage-block {
            background: transparent;
            border: none;
            border-radius: 0;
            padding: 0;
        }

        .usage-line {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3px;
        }

        .usage-title {
            font-size: 10px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        .usage-badge {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            padding: 1px 5px;
            border-radius: 2px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .usage-value {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 3px;
            color: var(--vscode-foreground);
        }

        .progress-track {
            height: 3px;
            border-radius: 2px;
            background: var(--vscode-input-background);
            overflow: hidden;
            margin-bottom: 2px;
        }

        .progress-fill {
            height: 100%;
            border-radius: inherit;
            background: var(--vscode-progressBar-background);
            transition: width 0.3s ease;
        }

        .progress-fill.accent-blue {
            background: var(--vscode-charts-blue);
        }

        .progress-fill.accent-teal {
            background: var(--vscode-charts-green);
        }

        .progress-fill.accent-purple {
            background: var(--vscode-charts-purple);
        }

        .progress-fill.accent-amber {
            background: var(--vscode-charts-orange);
        }

        .usage-status {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
        }

        .info-pill {
            margin-top: 8px;
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            background: transparent;
            border: none;
            border-radius: 0;
            padding: 0;
        }

        .control-column {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }

        .control-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            padding: 8px 0;
            background: transparent;
            border: none;
            border-bottom: 1px solid transparent;
            border-radius: 0;
            min-height: 36px;
        }

        .control-row.clickable {
            cursor: pointer;
            transition: background 0.1s ease;
        }

        .control-row.clickable:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .control-row:not(:last-child) {
            border-bottom-color: var(--vscode-panel-border);
        }

        .control-row.disabled {
            opacity: 0.6;
        }

        .control-text {
            display: flex;
            flex-direction: column;
            gap: 1px;
            flex: 1;
            min-width: 0;
        }

        .control-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.2px;
            color: var(--vscode-descriptionForeground);
        }

        .control-value {
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .control-hint {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .chevron {
            flex-shrink: 0;
        }

        .chevron svg {
            opacity: 0.5;
        }

        .card-footer {
            display: flex;
            gap: 6px;
            padding: 8px 12px;
            background: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            flex-shrink: 0;
        }

        .card-footer button {
            flex: 1;
        }

        button {
            font-family: var(--vscode-font-family);
            font-size: 10px;
            border-radius: 2px;
            border: 1px solid transparent;
            padding: 5px 8px;
            cursor: pointer;
            transition: background 0.1s ease, border 0.1s ease, color 0.1s ease;
        }

        .primary-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: var(--vscode-button-border, transparent);
        }

        .primary-button:hover {
            background: var(--vscode-button-hoverBackground, var(--vscode-button-background));
        }

        .secondary-button {
            background: var(--vscode-input-background);
            color: var(--vscode-foreground);
            border-color: var(--vscode-panel-border);
        }

        .secondary-button:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .auth-message {
            border: none;
            border-radius: 0;
            padding: 24px 12px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            background: transparent;
            margin: 0;
        }

        .auth-message h2 {
            margin: 0 0 6px 0;
            font-size: 12px;
            color: var(--vscode-foreground);
        }

        .auth-message p {
            margin: 0;
            font-size: 10px;
        }

        ::-webkit-scrollbar {
            width: 10px;
        }

        ::-webkit-scrollbar-track {
            background: var(--vscode-editor-background);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 5px;
            border: 2px solid var(--vscode-editor-background);
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }
        }
    `;
}

const getStatusTooltipContent = (options: {
    user?: any;
    team?: any;
    model?: any;
    agent?: any;
    metrics: UsageSnapshot;
}): string => {
    const { user, team, model, agent, metrics } = options;

    const sections = [];

    // Header with user info
    sections.push(`**Alphanetix AI** · ${user?.username || 'User'}`);
    sections.push('');
    sections.push(`${user?.accountTier || 'ECONOMY'}${team ? ` · Team: ${team.teamName}` : ' · Personal'}`);
    sections.push('');

    // Credits - Two rows: label with value, then progress bar
    const creditLabel = metrics.totalCredits !== undefined
        ? `${formatNumber(Math.max((metrics.totalCredits ?? 0) - metrics.consumedCredits, 0))} of ${formatNumber(metrics.totalCredits)}`
        : formatNumber(metrics.availableCredits);
    sections.push('Credits');//buildMetricLabel('Credits', creditLabel));
    sections.push('');
    sections.push(buildCompactProgressBar(metrics.consumedCredits, metrics.totalCredits));
    sections.push('');
    
    // Code completions - Two rows
    sections.push('Code completions');//buildMetricLabel('Code completions', formatUsage(metrics.completionsUsed, metrics.completionsLimit)));
    sections.push('');
    sections.push(buildCompactProgressBar(metrics.completionsUsed, metrics.completionsLimit));
    sections.push('');
    
    // Chat messages - Two rows
    sections.push('Chat messages');//buildMetricLabel('Chat messages', formatUsage(metrics.chatUsed, metrics.chatLimit)));
    sections.push('');
    sections.push(buildCompactProgressBar(metrics.chatUsed, metrics.chatLimit));
    sections.push('');
    
    // Requests - Two rows
    sections.push('Requests');//buildMetricLabel('Requests', formatUsage(metrics.requestsUsed, metrics.requestsLimit)));
    sections.push('');
    sections.push(buildCompactProgressBar(metrics.requestsUsed, metrics.requestsLimit));
    sections.push('');

    // Configuration section
    sections.push(`Model: **${model?.displayName || 'Default'}**`);
    sections.push('');
    sections.push(`Agent: **${agent?.name || 'Default'}**`);
    if (metrics.sessionCount !== undefined && metrics.sessionCount > 0) {
        sections.push('');
        sections.push(`Sessions: **${formatNumber(metrics.sessionCount)}**`);
    }
    sections.push('');
    
    // Settings hint with gear icon
    sections.push(`$(gear) Click to configure`);

    return sections.join('\n');
};

const buildMetricLabel = (label: string, value: string): string => {
    // Two-column layout: label on left, value on right
    const paddedLabel = label.padEnd(18, ' ');
    return `${paddedLabel}**${value}**`;
};

const formatUsage = (used: number | undefined, limit: number | undefined): string => {
    if (limit !== undefined && limit > 0) {
        return `${formatNumber(used)} / ${formatNumber(limit)}`;
    }
    if (used !== undefined) {
        return formatNumber(used);
    }
    return '—';
};

const buildCompactProgressBar = (used: number | undefined, limit: number | undefined): string => {
    const percent = buildPercentage(used, limit);
    const barLength = 25; // Compact length like Copilot
    const filledLength = Math.round((percent / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    // Using solid Unicode blocks for sleek appearance
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    // Wrap in code block for monospaced font and alignment
    return `\`${filled}${empty}\` ${Math.round(percent)}%`;
};

export function deactivate() {
    console.log('Alphanetix Code Assistant deactivated');
}
