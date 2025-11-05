import * as vscode from 'vscode';
import { UserService } from '../services/UserService';
import { TeamService } from '../services/TeamService';
import { ModelService } from '../services/ModelService';
import { StateManager } from '../state/StateManager';

/**
 * Webview provider for status/quota display
 */
export class StatusViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

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
                case 'refresh':
                    await this.updateView();
                    break;
                case 'switchTeam':
                    vscode.commands.executeCommand('alphanetix.switchTeam');
                    break;
                case 'selectModel':
                    vscode.commands.executeCommand('alphanetix.selectModel');
                    break;
            }
        });
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

        try {
            const userInfo = await StateManager.getInstance().getUserInfo();
            const quotaInfo = await UserService.getInstance().getQuotaInfo();
            const selectedTeamId = await StateManager.getInstance().getSelectedTeam();
            const selectedModelId = await StateManager.getInstance().getSelectedModel();

            let teamInfo = null;
            if (selectedTeamId) {
                try {
                    teamInfo = await TeamService.getInstance().getTeamById(selectedTeamId);
                } catch (error) {
                    // Team not found
                }
            }

            let modelInfo = null;
            if (selectedModelId) {
                try {
                    modelInfo = await ModelService.getInstance().getModelById(selectedModelId);
                } catch (error) {
                    // Model not found
                }
            }

            this._view.webview.html = this.getStatusHtml(
                userInfo,
                quotaInfo,
                teamInfo,
                modelInfo
            );
        } catch (error: any) {
            this._view.webview.html = this.getErrorHtml(error.message);
        }
    }

    private getUnauthenticatedHtml(): string {
        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .login-container {
                    text-align: center;
                    padding: 40px 20px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 20px;
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 14px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="login-container">
                <h2>Welcome to Alphanetix AI</h2>
                <p>Please sign in to get started</p>
                <button onclick="login()">Sign In</button>
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

    private getStatusHtml(userInfo: any, quotaInfo: any, teamInfo: any, modelInfo: any): string {
        const quotaPercentage = quotaInfo.teamCredits
            ? ((quotaInfo.available / quotaInfo.teamCredits) * 100)
            : 100;

        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    padding: 15px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .section {
                    margin-bottom: 20px;
                    padding: 15px;
                    background: var(--vscode-editor-background);
                    border-radius: 6px;
                    border: 1px solid var(--vscode-panel-border);
                }
                .section-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 8px 0;
                    font-size: 13px;
                }
                .label {
                    color: var(--vscode-descriptionForeground);
                }
                .value {
                    font-weight: 500;
                }
                .quota-bar {
                    width: 100%;
                    height: 8px;
                    background: var(--vscode-progressBar-background);
                    border-radius: 4px;
                    overflow: hidden;
                    margin: 10px 0;
                }
                .quota-fill {
                    height: 100%;
                    background: var(--vscode-progressBar-background);
                    transition: width 0.3s;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    cursor: pointer;
                    border-radius: 3px;
                    font-size: 12px;
                    margin: 5px 5px 5px 0;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .credits-large {
                    font-size: 24px;
                    font-weight: bold;
                    text-align: center;
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="section">
                <div class="section-title">👤 User Info</div>
                <div class="info-row">
                    <span class="label">Username:</span>
                    <span class="value">${userInfo.username}</span>
                </div>
                <div class="info-row">
                    <span class="label">Tier:</span>
                    <span class="value">${userInfo.accountTier}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">💳 Quota Status</div>
                ${quotaInfo.teamCredits !== undefined ? `
                    <div class="credits-large">${quotaInfo.available || 0}</div>
                    <div style="text-align: center; font-size: 12px; color: var(--vscode-descriptionForeground);">
                        Available Team Credits
                    </div>
                    <div class="quota-bar">
                        <div class="quota-fill" style="width: ${quotaPercentage.toFixed(1)}%; background: ${quotaPercentage > 20 ? '#4CAF50' : '#f44336'};"></div>
                    </div>
                    <div class="info-row">
                        <span class="label">Allocated:</span>
                        <span class="value">${quotaInfo.teamCredits}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Used:</span>
                        <span class="value">${quotaInfo.used || 0}</span>
                    </div>
                ` : `
                    <div class="credits-large">${quotaInfo.userCredits}</div>
                    <div style="text-align: center; font-size: 12px; color: var(--vscode-descriptionForeground);">
                        Your Credits
                    </div>
                `}
                <button onclick="refresh()">🔄 Refresh</button>
            </div>

            ${teamInfo ? `
            <div class="section">
                <div class="section-title">👥 Active Team</div>
                <div class="info-row">
                    <span class="label">Team:</span>
                    <span class="value">${teamInfo.teamName}</span>
                </div>
                <div class="info-row">
                    <span class="label">Company:</span>
                    <span class="value">${teamInfo.companyName}</span>
                </div>
                <button onclick="switchTeam()">Switch Team</button>
            </div>
            ` : `
            <div class="section">
                <div class="section-title">👥 Team</div>
                <p style="font-size: 12px; color: var(--vscode-descriptionForeground);">No team selected</p>
                <button onclick="switchTeam()">Select Team</button>
            </div>
            `}

            ${modelInfo ? `
            <div class="section">
                <div class="section-title">🤖 AI Model</div>
                <div class="info-row">
                    <span class="label">Model:</span>
                    <span class="value">${modelInfo.displayName}</span>
                </div>
                <div class="info-row">
                    <span class="label">Provider:</span>
                    <span class="value">${modelInfo.provider}</span>
                </div>
                <button onclick="selectModel()">Change Model</button>
            </div>
            ` : `
            <div class="section">
                <div class="section-title">🤖 AI Model</div>
                <p style="font-size: 12px; color: var(--vscode-descriptionForeground);">No model selected</p>
                <button onclick="selectModel()">Select Model</button>
            </div>
            `}

            <script>
                const vscode = acquireVsCodeApi();
                function refresh() {
                    vscode.postMessage({ command: 'refresh' });
                }
                function switchTeam() {
                    vscode.postMessage({ command: 'switchTeam' });
                }
                function selectModel() {
                    vscode.postMessage({ command: 'selectModel' });
                }
            </script>
        </body>
        </html>`;
    }

    private getErrorHtml(errorMessage: string): string {
        return `<!DOCTYPE html>
        <html>
        <body style="padding: 20px; font-family: var(--vscode-font-family);">
            <h3 style="color: var(--vscode-errorForeground);">Error</h3>
            <p>${errorMessage}</p>
            <button onclick="refresh()" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; cursor: pointer;">
                Retry
            </button>
            <script>
                const vscode = acquireVsCodeApi();
                function refresh() {
                    vscode.postMessage({ command: 'refresh' });
                }
            </script>
        </body>
        </html>`;
    }
}
