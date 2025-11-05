import * as vscode from 'vscode';
import { StateManager } from '../state/StateManager';
import { UserService } from '../services/UserService';
import { TeamService } from '../services/TeamService';
import { ModelService } from '../services/ModelService';

/**
 * Compact status popup provider - shows when clicking status bar (GitHub Copilot style)
 */
export class StatusPopupProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private userService: UserService;
    private teamService: TeamService;
    private modelService: ModelService;

    constructor(private readonly _extensionUri: vscode.Uri) {
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
                case 'selectModel':
                    vscode.commands.executeCommand('alphanetix.selectModel');
                    break;
                case 'selectAgent':
                    vscode.commands.executeCommand('alphanetix.selectAgent');
                    break;
                case 'switchTeam':
                    vscode.commands.executeCommand('alphanetix.switchTeam');
                    break;
                case 'managePremium':
                    vscode.window.showInformationMessage('Premium management coming soon!');
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', '@ext:alphanetix.alphanetix-code-assistant');
                    break;
                case 'refresh':
                    await this.refresh();
                    break;
            }
        });
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

        // Get all data
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

        this._view.webview.html = this.getPopupHtml({
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
                ${this.getStyles()}
            </style>
        </head>
        <body>
            <div class="popup-content">
                <div class="auth-message">
                    <p>Not signed in</p>
                    <button class="action-link" onclick="vscode.postMessage({ command: 'login' })">Sign In</button>
                </div>
            </div>
        </body>
        </html>`;
    }

    private getPopupHtml(data: any): string {
        const available = data.quotaInfo?.available !== undefined ? data.quotaInfo.available : data.quotaInfo?.userCredits || 0;
        const selectedModel = data.models.find((m: any) => m.id === data.selectedModelId);
        const selectedAgent = data.agents.find((a: any) => a.id === data.selectedAgentId);
        const selectedTeam = data.teams.find((t: any) => t.id === data.selectedTeamId);

        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                ${this.getStyles()}
            </style>
        </head>
        <body>
            <div class="popup-content">
                <!-- Account Section -->
                <div class="section">
                    <div class="section-header">Account</div>
                    <div class="section-item">
                        <div class="item-row">
                            <span class="item-label">User</span>
                            <span class="item-value">${data.userInfo?.username || 'Unknown'}</span>
                        </div>
                        <div class="item-row">
                            <span class="item-label">Type</span>
                            <span class="item-value">${data.userInfo?.userType || 'Individual'}</span>
                        </div>
                    </div>
                </div>

                <!-- Usage Section -->
                <div class="section">
                    <div class="section-header">
                        <span>Credits</span>
                        <button class="icon-btn" onclick="refresh()" title="Refresh">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="section-item">
                        <div class="item-row">
                            <span class="item-label">${data.quotaInfo?.teamCredits !== undefined ? 'Team Credits' : 'Your Credits'}</span>
                            <span class="item-value highlight">${available}</span>
                        </div>
                        ${data.quotaInfo?.teamCredits !== undefined ? `
                        <div class="item-row">
                            <span class="item-label">Allocated</span>
                            <span class="item-value">${data.quotaInfo.teamCredits}</span>
                        </div>
                        <div class="item-row">
                            <span class="item-label">Used</span>
                            <span class="item-value">${data.quotaInfo.used || 0}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- AI Configuration Section -->
                <div class="section">
                    <div class="section-header">AI Configuration</div>
                    <div class="section-item">
                        <div class="item-row clickable" onclick="selectModel()">
                            <span class="item-label">Model</span>
                            <span class="item-value">${selectedModel?.displayName || 'Default Model'}</span>
                        </div>
                        <div class="item-row clickable" onclick="selectAgent()">
                            <span class="item-label">Agent</span>
                            <span class="item-value">${selectedAgent?.displayName || 'Default Agent'}</span>
                        </div>
                        ${selectedTeam ? `
                        <div class="item-row clickable" onclick="switchTeam()">
                            <span class="item-label">Team</span>
                            <span class="item-value">${selectedTeam.teamName}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Actions -->
                <div class="section">
                    <button class="action-link" onclick="openSettings()">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.292-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.292c.415.764-.42 1.6-1.185 1.184l-.292-.159a1.873 1.873 0 0 0-2.692 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.693-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.292A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
                        </svg>
                        Extension Settings
                    </button>
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

                function managePremium() {
                    vscode.postMessage({ command: 'managePremium' });
                }

                function openSettings() {
                    vscode.postMessage({ command: 'openSettings' });
                }

                function refresh() {
                    vscode.postMessage({ command: 'refresh' });
                }
            </script>
        </body>
        </html>`;
    }

    private getStyles(): string {
        return `
            body {
                margin: 0;
                padding: 0;
                font-family: var(--vscode-font-family);
                font-size: 11px;
                color: var(--vscode-foreground);
                background: var(--vscode-menu-background);
                min-width: 260px;
                max-width: 320px;
            }

            .popup-content {
                padding: 4px 0;
            }

            .section {
                padding: 6px 0;
                border-bottom: 1px solid var(--vscode-menu-separatorBackground);
            }

            .section:last-child {
                border-bottom: none;
            }

            .section-header {
                padding: 4px 12px;
                font-size: 10px;
                font-weight: 600;
                color: var(--vscode-descriptionForeground);
                text-transform: uppercase;
                letter-spacing: 0.3px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .section-item {
                padding: 2px 0;
            }

            .item-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 12px;
                min-height: 24px;
            }

            .item-row.clickable {
                cursor: pointer;
            }

            .item-row.clickable:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .item-label {
                color: var(--vscode-descriptionForeground);
                font-size: 11px;
            }

            .item-value {
                color: var(--vscode-foreground);
                font-size: 11px;
                font-weight: 400;
                max-width: 150px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .item-value.highlight {
                color: var(--vscode-charts-blue);
                font-weight: 600;
                font-size: 12px;
            }

            .action-link {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                width: 100%;
                background: transparent;
                border: none;
                color: var(--vscode-textLink-foreground);
                cursor: pointer;
                font-size: 11px;
                text-align: left;
            }

            .action-link:hover {
                background: var(--vscode-list-hoverBackground);
                color: var(--vscode-textLink-activeForeground);
            }

            .action-link svg {
                opacity: 0.8;
            }

            .icon-btn {
                background: transparent;
                border: none;
                color: var(--vscode-foreground);
                cursor: pointer;
                padding: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 2px;
                opacity: 0.7;
            }

            .icon-btn:hover {
                background: var(--vscode-toolbar-hoverBackground);
                opacity: 1;
            }

            .auth-message {
                padding: 12px;
                text-align: center;
            }

            .auth-message p {
                margin: 0 0 8px 0;
                color: var(--vscode-descriptionForeground);
            }
        `;
    }
}
