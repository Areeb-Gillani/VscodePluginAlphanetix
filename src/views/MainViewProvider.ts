import * as vscode from 'vscode';
import { CompletionService } from '../services/CompletionService';
import { UserService } from '../services/UserService';
import { TeamService } from '../services/TeamService';
import { ModelService } from '../services/ModelService';
import { StateManager } from '../state/StateManager';

/**
 * Modern tabbed webview provider for Alphanetix AI
 */
export class MainViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private completionService: CompletionService;
    private userService: UserService;
    private teamService: TeamService;
    private modelService: ModelService;
    private currentSessionId?: string;
    private chatHistory: Array<{ role: string; content: string }> = [];

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.completionService = CompletionService.getInstance();
        this.userService = UserService.getInstance();
        this.teamService = TeamService.getInstance();
        this.modelService = ModelService.getInstance();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        this.updateView();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                // Chat commands
                case 'sendMessage':
                    await this.sendMessage(message.text, message.mode);
                    break;
                case 'newChat':
                    await this.startNewChat();
                    break;
                case 'clearChat':
                    this.chatHistory = [];
                    this.updateView();
                    break;
                
                // Status commands
                case 'refresh':
                    await this.updateView();
                    break;
                case 'switchTeam':
                    vscode.commands.executeCommand('alphanetix.switchTeam');
                    break;
                case 'selectModel':
                    vscode.commands.executeCommand('alphanetix.selectModel');
                    break;
                case 'selectAgent':
                    vscode.commands.executeCommand('alphanetix.selectAgent');
                    break;
                case 'selectMode': {
                    // Map Chat -> agent (full tools), Agent -> ask (read-only tools)
                    // Note: This seems counter-intuitive but 'Chat' mode gives full agent capabilities
                    // while 'Agent' mode limits to ask/read-only operations for safety
                    const uiMode = message.mode; // 'Chat' or 'Agent'
                    const sessionMode: 'ask' | 'agent' = uiMode === 'Agent' ? 'ask' : 'agent';
                    await StateManager.getInstance().setSessionMode(sessionMode);
                    console.log(`Mode changed: UI=${uiMode}, Session=${sessionMode}`);
                    break;
                }
                
                // Settings commands
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', '@ext:alphanetix.alphanetix-code-assistant');
                    break;
                case 'login':
                    vscode.commands.executeCommand('alphanetix.login');
                    break;
                case 'logout':
                    vscode.commands.executeCommand('alphanetix.logout');
                    break;
            }
        });
    }

    private async sendMessage(text: string, mode?: string) {
        if (!text.trim()) {
            return;
        }

        // Add user message to history
        this.chatHistory.push({ role: 'user', content: text });
        this.updateView();

        try {
            // Create session if needed
            if (!this.currentSessionId) {
                const session = await this.completionService.createChatSession({
                    sessionName: 'VS Code Chat',
                });
                this.currentSessionId = session.id;
            }

            // Check if message suggests using MCP features (file operations, workspace analysis)
            const shouldUseMCP = this.shouldUseMCPForMessage(text, mode);

            // Get AI response with MCP tools enabled
            const response = await this.completionService.getCompletion(text, {
                sessionId: this.currentSessionId,
                useMCPTools: shouldUseMCP,
                maxToolIterations: 3
            });

            // Add AI response to history
            this.chatHistory.push({ role: 'assistant', content: response.message });
            this.updateView();
        } catch (error: any) {
            console.error('Chat error:', error);
            this.chatHistory.push({
                role: 'error',
                content: `Error: ${error.message}`,
            });
            this.updateView();
        }
    }

    /**
     * Determine if MCP should be used based on message content and mode
     * Always returns true - mode filtering happens at the tool level
     */
    private shouldUseMCPForMessage(_message: string, _mode?: string): boolean {
        // Always use MCP tools - mode filtering is handled by the backend
        // via StateManager.getSessionMode() which filters tools by 'ask' or 'agent' mode
        return true;
    }

    /**
     * Determine if workspace context should be included
     */
    private shouldIncludeWorkspaceContext(message: string): boolean {
        const workspaceKeywords = [
            'workspace', 'project', 'overview', 'structure', 'all files',
            'entire project', 'codebase', 'repository'
        ];

        const lowerMessage = message.toLowerCase();
        return workspaceKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    /**
     * Determine if active file context should be included
     */
    private shouldIncludeActiveFileContext(message: string): boolean {
        const fileKeywords = [
            'this file', 'current file', 'selected', 'here', 'above',
            'below', 'line', 'function', 'method', 'cursor'
        ];

        const lowerMessage = message.toLowerCase();
        return fileKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    private async startNewChat() {
        this.currentSessionId = undefined;
        this.chatHistory = [];
        this.updateView();
    }

    public async refresh() {
        await this.updateView();
    }

    private async updateView() {
        if (!this._view) {
            return;
        }

        const isAuthenticated = await StateManager.getInstance().isAuthenticated();

        if (!isAuthenticated) {
            this._view.webview.html = this.getUnauthenticatedHtml();
            return;
        }

        // Get all data for the tabs
        const [userInfo, quotaInfo, teams, models, agents, selectedTeamId, selectedModelId, selectedAgentId] = await Promise.allSettled([
            StateManager.getInstance().getUserInfo(),
            this.userService.getQuotaInfo().catch(() => null),
            this.teamService.getMyTeams().catch(() => []),
            this.modelService.getAvailableModels().catch(() => []),
            this.modelService.getAvailableAgents().catch(() => []),
            StateManager.getInstance().getSelectedTeam(),
            StateManager.getInstance().getSelectedModel(),
            StateManager.getInstance().getSelectedAgent(),
        ]);

        this._view.webview.html = this.getMainHtml({
            userInfo: userInfo.status === 'fulfilled' ? userInfo.value : null,
            quotaInfo: quotaInfo.status === 'fulfilled' ? quotaInfo.value : null,
            teams: teams.status === 'fulfilled' ? teams.value : [],
            models: models.status === 'fulfilled' ? models.value : [],
            agents: agents.status === 'fulfilled' ? agents.value : [],
            selectedTeamId: selectedTeamId.status === 'fulfilled' ? selectedTeamId.value : null,
            selectedModelId: selectedModelId.status === 'fulfilled' ? selectedModelId.value : null,
            selectedAgentId: selectedAgentId.status === 'fulfilled' ? selectedAgentId.value : null,
        });
    }

    private getUnauthenticatedHtml(): string {
        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    padding: 0;
                    margin: 0;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    text-align: center;
                }
                .auth-container {
                    padding: 40px 20px;
                    max-width: 300px;
                }
                .logo {
                    font-size: 48px;
                    margin-bottom: 20px;
                }
                h2 {
                    margin: 0 0 10px 0;
                    color: var(--vscode-foreground);
                    font-size: 18px;
                    font-weight: 600;
                }
                p {
                    color: var(--vscode-descriptionForeground);
                    margin: 0 0 30px 0;
                    line-height: 1.5;
                }
                .login-btn {
                    background: linear-gradient(135deg, #007acc, #005a9e);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(0, 122, 204, 0.3);
                }
                .login-btn:hover {
                    background: linear-gradient(135deg, #005a9e, #004578);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 122, 204, 0.4);
                }
            </style>
        </head>
        <body>
            <div class="auth-container">
                <div class="logo">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                </div>
                <h2>Welcome to Alphanetix AI</h2>
                <p>Sign in to start using AI-powered code assistance and chat</p>
                <button class="login-btn" onclick="login()">Sign In</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                function login() {
                    vscode.postMessage({ command: 'login' });
                }
            </script>
        </body>
        </html>`;
    }

    private getMainHtml(data: any): string {
        const messagesHtml = this.chatHistory
            .map((msg) => {
                const isUser = msg.role === 'user';
                const isError = msg.role === 'error';
                return `
                <div class="message ${isUser ? 'user-message' : isError ? 'error-message' : 'ai-message'}">
                    <div class="message-bubble">
                        <div class="message-header">${isUser ? 'You' : isError ? 'Error' : 'Alphanetix'}</div>
                        <div class="message-content">${this.escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            `;
            })
            .join('');

        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    height: 100vh;
                    overflow: hidden;
                }
                
                /* Header with Model/Agent Controls */
                .header-controls {
                    display: flex;
                    align-items: center;
                    padding: 4px 8px;
                    background: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-widget-border);
                    gap: 6px;
                    font-size: 11px;
                    height: 30px;
                }
                .control-group {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    position: relative;
                }
                .control-label {
                    color: var(--vscode-descriptionForeground);
                    font-size: 11px;
                    font-weight: 400;
                }
                .control-selector {
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    padding: 2px 6px;
                    font-size: 11px;
                    cursor: pointer;
                    min-width: 80px;
                    max-width: 150px;
                    text-align: left;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    height: 22px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .control-selector:hover {
                    background: var(--vscode-inputOption-hoverBackground);
                }
                .control-selector:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                    outline-offset: -1px;
                }
                .control-selector svg {
                    margin-left: 4px;
                    opacity: 0.5;
                    flex-shrink: 0;
                }
                .mode-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    background: var(--vscode-menu-background);
                    border: 1px solid var(--vscode-menu-border);
                    border-radius: 0;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
                    z-index: 1000;
                    min-width: 120px;
                    margin-top: 2px;
                    display: none;
                }
                .mode-dropdown.show {
                    display: block;
                }
                .mode-option {
                    display: flex;
                    align-items: center;
                    padding: 6px 12px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: none;
                }
                .mode-option:hover {
                    background: var(--vscode-menu-selectionBackground);
                    color: var(--vscode-menu-selectionForeground);
                }
                .mode-option.selected {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                .divider {
                    width: 1px;
                    height: 16px;
                    background: var(--vscode-widget-border);
                    margin: 0 2px;
                }
                .settings-btn {
                    background: transparent;
                    border: none;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    padding: 3px;
                    border-radius: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: auto;
                    position: relative;
                    opacity: 0.7;
                }
                .settings-btn:hover {
                    background: var(--vscode-toolbar-hoverBackground);
                    opacity: 1;
                }
                
                /* Settings Popup */
                .settings-popup {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    background: var(--vscode-menu-background);
                    border: 1px solid var(--vscode-menu-border);
                    border-radius: 0;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
                    z-index: 1000;
                    min-width: 200px;
                    margin-top: 2px;
                    display: none;
                }
                .settings-popup.show {
                    display: block;
                }
                .popup-section {
                    padding: 0;
                    border-bottom: 1px solid var(--vscode-menu-separatorBackground);
                }
                .popup-section:last-child {
                    border-bottom: none;
                }
                .popup-item {
                    display: flex;
                    align-items: center;
                    padding: 6px 12px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: none;
                }
                .popup-item:hover {
                    background: var(--vscode-menu-selectionBackground);
                    color: var(--vscode-menu-selectionForeground);
                }
                .popup-item svg {
                    margin-right: 6px;
                    opacity: 0.8;
                }
                .popup-item.danger:hover {
                    background: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                }
                
                /* Tab Navigation */
                .tab-container {
                    display: flex;
                    background: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-widget-border);
                    height: 35px;
                }
                .tab {
                    flex: 1;
                    padding: 0 12px;
                    text-align: center;
                    cursor: pointer;
                    transition: none;
                    border-right: 1px solid var(--vscode-widget-border);
                    font-size: 11px;
                    font-weight: 400;
                    background: transparent;
                    color: var(--vscode-foreground);
                    opacity: 0.7;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .tab:last-child {
                    border-right: none;
                }
                .tab.active {
                    opacity: 1;
                    background: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-focusBorder);
                }
                .tab:hover:not(.active) {
                    background: var(--vscode-list-hoverBackground);
                    opacity: 0.9;
                }
                .tab-icon {
                    display: flex;
                    align-items: center;
                }
                .tab-icon svg {
                    vertical-align: middle;
                }
                
                /* Tab Content */
                .tab-content {
                    display: none;
                    height: calc(100vh - 65px);
                    overflow-y: auto;
                }
                .tab-content.active {
                    display: block;
                }
                
                /* Chat Styles */
                .chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    padding: 0;
                }
                .messages-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 8px 12px;
                    background: var(--vscode-sideBar-background);
                }
                .message {
                    margin: 8px 0;
                }
                .user-message .message-bubble {
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px;
                    padding: 8px 10px;
                }
                .ai-message .message-bubble {
                    background: transparent;
                    padding: 8px 0;
                }
                .error-message .message-bubble {
                    background: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    border-radius: 3px;
                    padding: 8px 10px;
                }
                .message-bubble {
                    max-width: 100%;
                }
                .message-header {
                    font-size: 11px;
                    font-weight: 600;
                    margin-bottom: 4px;
                    opacity: 0.9;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .message-header svg {
                    opacity: 0.7;
                }
                .message-content {
                    font-size: 12px;
                    line-height: 1.5;
                    color: var(--vscode-foreground);
                }
                .input-area {
                    padding: 8px 12px;
                    border-top: 1px solid var(--vscode-widget-border);
                    background: var(--vscode-sideBar-background);
                }
                .input-container {
                    display: flex;
                    align-items: center;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    position: relative;
                }
                .input-container:focus-within {
                    outline: 1px solid var(--vscode-focusBorder);
                    outline-offset: -1px;
                }
                .input-field {
                    flex: 1;
                    background: transparent;
                    color: var(--vscode-input-foreground);
                    border: none;
                    padding: 6px 8px;
                    padding-right: 40px;
                    padding-bottom: 32px;
                    font-family: var(--vscode-font-family);
                    font-size: 12px;
                    resize: none;
                    min-height: 18px;
                    max-height: 100px;
                }
                .input-field:focus {
                    outline: none;
                }
                .send-btn {
                    position: absolute;
                    right: 4px;
                    bottom: 4px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 5px 8px;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 11px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 24px;
                    min-width: 24px;
                }
                .send-btn:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .chat-actions {
                    display: flex;
                    gap: 4px;
                    margin-top: 6px;
                }
                .action-btn {
                    background: transparent;
                    color: var(--vscode-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 4px 8px;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 11px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    opacity: 0.8;
                }
                .action-btn:hover {
                    background: var(--vscode-list-hoverBackground);
                    opacity: 1;
                }
                .action-btn svg {
                    flex-shrink: 0;
                }
                .empty-chat {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }
                .empty-chat-icon {
                    margin-bottom: 12px;
                    opacity: 0.5;
                    display: flex;
                    justify-content: center;
                }
                .empty-chat h3 {
                    font-size: 13px;
                    font-weight: 600;
                    margin: 0 0 6px 0;
                }
                .empty-chat p {
                    font-size: 11px;
                    margin: 0;
                    opacity: 0.8;
                }
                
                /* Status Styles */
                .status-actions {
                    display: flex;
                    gap: 6px;
                    margin-top: 8px;
                }
                .refresh-btn, .setting-control {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    padding: 4px 10px;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 11px;
                }
                .refresh-btn:hover, .setting-control:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                .danger-btn {
                    background: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                }
                .danger-btn:hover {
                    background: var(--vscode-inputValidation-errorBorder);
                }
            </style>
        </head>
        <body>
            <!-- Header Controls -->
            <div class="header-controls">
                <div class="control-group">
                    <span class="control-label">Mode:</span>
                    <button class="control-selector" onclick="toggleModeDropdown(event)">
                        <span id="selectedMode">Chat</span>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
                        </svg>
                    </button>
                    
                    <!-- Mode Dropdown (outside button) -->
                    <div class="mode-dropdown" id="modeDropdown">
                        <div class="mode-option selected" onclick="selectMode(event, 'Chat')">Chat</div>
                        <div class="mode-option" onclick="selectMode(event, 'Agent')">Agent</div>
                    </div>
                </div>
                
                <div class="control-group">
                    <span class="control-label">Model:</span>
                    <button class="control-selector" onclick="selectModel()">
                        <span>${data.models.find((m: any) => m.id === data.selectedModelId)?.displayName || 'Select Model'}</span>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
                        </svg>
                    </button>
                </div>
                
                <div class="control-group">
                    <span class="control-label">Agent:</span>
                    <button class="control-selector" onclick="selectAgent()">
                        <span>${data.agents.find((a: any) => a.id === data.selectedAgentId)?.displayName || 'Default Agent'}</span>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
                        </svg>
                    </button>
                </div>
                
                ${data.selectedTeamId ? `
                <div class="divider"></div>
                <div class="control-group">
                    <span class="control-label">Team:</span>
                    <button class="control-selector" onclick="switchTeam()">
                        <span>${data.teams.find((t: any) => t.id === data.selectedTeamId)?.teamName || 'Select Team'}</span>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
                        </svg>
                    </button>
                </div>
                ` : ''}
                
                <button class="settings-btn" onclick="toggleSettings()">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                        <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.292-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.292c.415.764-.42 1.6-1.185 1.184l-.292-.159a1.873 1.873 0 0 0-2.692 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.693-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.292A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
                    </svg>
                    
                    <!-- Settings Popup -->
                    <div class="settings-popup" id="settingsPopup">
                        <div class="popup-section">
                            <div class="popup-item" onclick="refreshStatus()">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                                </svg>
                                Refresh Status
                            </div>
                        </div>
                        <div class="popup-section">
                            <div class="popup-item" onclick="openSettings()">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M1.5 1.5A.5.5 0 0 1 2 1h12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.128.334L10 8.692V13.5a.5.5 0 0 1-.342.474l-3 1A.5.5 0 0 1 6 14.5V8.692L1.628 3.834A.5.5 0 0 1 1.5 3.5v-2z"/>
                                </svg>
                                Extension Settings
                            </div>
                        </div>
                        <div class="popup-section">
                            <div class="popup-item danger" onclick="logout()">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
                                    <path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
                                </svg>
                                Sign Out
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            <!-- Tab Navigation -->
            <div class="tab-container">
                <div class="tab active" data-tab="chat">
                    <div class="tab-icon">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.414L1 14.414V2a1 1 0 0 1 1-1h12zM2 2v10.586l2-2H14V2H2z"/>
                        </svg>
                    </div>
                    <span>Chat</span>
                </div>
            </div>

            <!-- Chat Tab -->
            <div class="tab-content active" id="chat">
                <div class="chat-container">
                    <div class="messages-area" id="messagesArea">
                        ${
                            this.chatHistory.length === 0
                                ? `<div class="empty-chat">
                                     <div class="empty-chat-icon">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                                        </svg>
                                     </div>
                                     <h3>How can I help?</h3>
                                     <p>Ask me anything about your code</p>
                                   </div>`
                                : messagesHtml
                        }
                    </div>
                    <div class="input-area">
                        <div class="input-container">
                            <textarea id="messageInput" class="input-field" placeholder="Ask a question..." rows="1"></textarea>
                            <button class="send-btn" onclick="sendMessage()">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z"/>
                                </svg>
                            </button>
                        </div>
                        <div class="chat-actions">
                            <button class="action-btn" onclick="newChat()">
                                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                                    <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                                </svg>
                                New Chat
                            </button>
                            <button class="action-btn" onclick="clearChat()">
                                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                </svg>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                // Restore mode state
                const state = vscode.getState() || {};
                if (state.chatMode) {
                    const modeSpan = document.getElementById('selectedMode');
                    if (modeSpan) {
                        modeSpan.textContent = state.chatMode;
                    }
                    // Update dropdown selection
                    document.querySelectorAll('.mode-option').forEach(option => {
                        option.classList.remove('selected');
                        if (option.textContent === state.chatMode) {
                            option.classList.add('selected');
                        }
                    });
                } else {
                    // Default to Chat mode
                    const newState = { chatMode: 'Chat' };
                    vscode.setState(newState);
                }
                
                // Tab switching
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        const tabName = tab.dataset.tab;
                        
                        // Update tab appearance
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        
                        tab.classList.add('active');
                        document.getElementById(tabName).classList.add('active');
                    });
                });

                // Settings popup functionality
                function toggleSettings() {
                    const popup = document.getElementById('settingsPopup');
                    popup.classList.toggle('show');
                }

                // Close settings popup when clicking outside
                document.addEventListener('click', (e) => {
                    const settingsBtn = document.querySelector('.settings-btn');
                    const popup = document.getElementById('settingsPopup');
                    
                    if (!settingsBtn.contains(e.target) && !popup.contains(e.target)) {
                        popup.classList.remove('show');
                    }
                });

                // Chat functionality
                const messageInput = document.getElementById('messageInput');
                const messagesArea = document.getElementById('messagesArea');

                if (messageInput) {
                    // Auto-resize textarea
                    messageInput.addEventListener('input', function() {
                        this.style.height = 'auto';
                        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
                    });

                    // Handle Enter key
                    messageInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    });
                }

                // Scroll to bottom of messages
                if (messagesArea) {
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                }

                // Chat functions
                function sendMessage() {
                    const text = messageInput?.value?.trim();
                    if (text) {
                        const state = vscode.getState() || { chatMode: 'Chat' };
                        vscode.postMessage({ 
                            command: 'sendMessage', 
                            text,
                            mode: state.chatMode 
                        });
                        messageInput.value = '';
                        messageInput.style.height = 'auto';
                    }
                }

                function newChat() {
                    vscode.postMessage({ command: 'newChat' });
                }

                function clearChat() {
                    vscode.postMessage({ command: 'clearChat' });
                }

                // Status functions
                function refreshStatus() {
                    vscode.postMessage({ command: 'refresh' });
                    // Close settings popup if open
                    document.getElementById('settingsPopup').classList.remove('show');
                }

                function switchTeam() {
                    vscode.postMessage({ command: 'switchTeam' });
                    // Close settings popup if open
                    document.getElementById('settingsPopup').classList.remove('show');
                }

                function selectModel() {
                    vscode.postMessage({ command: 'selectModel' });
                    // Close settings popup if open
                    document.getElementById('settingsPopup').classList.remove('show');
                }

                function selectAgent() {
                    vscode.postMessage({ command: 'selectAgent' });
                    // Close settings popup if open
                    document.getElementById('settingsPopup').classList.remove('show');
                }

                function toggleModeDropdown(event) {
                    event.stopPropagation();
                    const dropdown = document.getElementById('modeDropdown');
                    dropdown.classList.toggle('show');
                }

                function selectMode(event, mode) {
                    event.stopPropagation();
                    
                    // Update selected mode text
                    const modeSpan = document.getElementById('selectedMode');
                    modeSpan.textContent = mode;
                    
                    // Update dropdown selection state
                    document.querySelectorAll('.mode-option').forEach(option => {
                        option.classList.remove('selected');
                        if (option.textContent === mode) {
                            option.classList.add('selected');
                        }
                    });
                    
                    // Store mode in state
                    const state = vscode.getState() || {};
                    state.chatMode = mode;
                    vscode.setState(state);
                    
                    // Notify backend of mode change
                    vscode.postMessage({ command: 'selectMode', mode: mode });
                    
                    // Close dropdown
                    document.getElementById('modeDropdown').classList.remove('show');
                }

                // Close mode dropdown when clicking outside
                document.addEventListener('click', (e) => {
                    const modeDropdown = document.getElementById('modeDropdown');
                    const controlGroup = e.target.closest('.control-group');
                    
                    // Close dropdown if clicking outside the control group
                    if (modeDropdown && !controlGroup) {
                        modeDropdown.classList.remove('show');
                    }
                });

                // Settings functions
                function openSettings() {
                    vscode.postMessage({ command: 'openSettings' });
                    // Close settings popup
                    document.getElementById('settingsPopup').classList.remove('show');
                }

                function logout() {
                    vscode.postMessage({ command: 'logout' });
                    // Close settings popup
                    document.getElementById('settingsPopup').classList.remove('show');
                }
            </script>
        </body>
        </html>`;
    }

    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
}