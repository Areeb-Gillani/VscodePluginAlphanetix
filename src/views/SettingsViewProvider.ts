import * as vscode from 'vscode';

/**
 * Webview provider for extension settings
 */
export class SettingsViewProvider implements vscode.WebviewViewProvider {
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
                case 'updateSetting':
                    await this.updateSetting(message.key, message.value);
                    break;
                case 'openVSCodeSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'alphanetix');
                    break;
            }
        });
    }

    private async updateSetting(key: string, value: any) {
        const config = vscode.workspace.getConfiguration('alphanetix');
        await config.update(key, value, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Setting updated: ${key}`);
        this.updateView();
    }

    private async updateView() {
        if (!this._view) {
            return;
        }

        const config = vscode.workspace.getConfiguration('alphanetix');
        
        const settings = {
            apiUrl: config.get<string>('apiUrl'),
            enableInlineCompletion: config.get<boolean>('enableInlineCompletion'),
            completionDelay: config.get<number>('completionDelay'),
            maxCompletionLines: config.get<number>('maxCompletionLines'),
            autoSwitchTeamContext: config.get<boolean>('autoSwitchTeamContext'),
            showQuotaWarnings: config.get<boolean>('showQuotaWarnings'),
            lowQuotaThreshold: config.get<number>('lowQuotaThreshold'),
        };

        this._view.webview.html = this.getSettingsHtml(settings);
    }

    private getSettingsHtml(settings: any): string {
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
                .setting-group {
                    margin-bottom: 25px;
                    padding: 15px;
                    background: var(--vscode-editor-background);
                    border-radius: 6px;
                    border: 1px solid var(--vscode-panel-border);
                }
                .setting-title {
                    font-weight: bold;
                    margin-bottom: 15px;
                    color: var(--vscode-textLink-foreground);
                    font-size: 14px;
                }
                .setting-item {
                    margin: 12px 0;
                }
                .setting-label {
                    display: block;
                    margin-bottom: 5px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }
                input[type="text"],
                input[type="number"] {
                    width: 100%;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px;
                    padding: 6px 8px;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    box-sizing: border-box;
                }
                input[type="checkbox"] {
                    margin-right: 8px;
                }
                .checkbox-label {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    font-size: 13px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 12px;
                    margin: 5px 5px 5px 0;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .description {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
            </style>
        </head>
        <body>
            <div class="setting-group">
                <div class="setting-title">🔗 Connection</div>
                
                <div class="setting-item">
                    <label class="setting-label">API URL</label>
                    <input type="text" id="apiUrl" value="${settings.apiUrl}" onchange="updateSetting('apiUrl', this.value)">
                    <div class="description">The base URL for the AlphanetixAI API</div>
                </div>
            </div>

            <div class="setting-group">
                <div class="setting-title">✨ Code Completion</div>
                
                <div class="setting-item">
                    <label class="checkbox-label">
                        <input type="checkbox" id="enableInlineCompletion" ${settings.enableInlineCompletion ? 'checked' : ''} onchange="updateSetting('enableInlineCompletion', this.checked)">
                        Enable inline code completion
                    </label>
                    <div class="description">Show AI-powered code suggestions as you type</div>
                </div>

                <div class="setting-item">
                    <label class="setting-label">Completion Delay (ms)</label>
                    <input type="number" id="completionDelay" value="${settings.completionDelay}" min="100" max="2000" step="100" onchange="updateSetting('completionDelay', parseInt(this.value))">
                    <div class="description">Wait time before showing completion suggestions</div>
                </div>

                <div class="setting-item">
                    <label class="setting-label">Max Completion Lines</label>
                    <input type="number" id="maxCompletionLines" value="${settings.maxCompletionLines}" min="1" max="20" onchange="updateSetting('maxCompletionLines', parseInt(this.value))">
                    <div class="description">Maximum number of lines in completion suggestions</div>
                </div>
            </div>

            <div class="setting-group">
                <div class="setting-title">👥 Team Context</div>
                
                <div class="setting-item">
                    <label class="checkbox-label">
                        <input type="checkbox" id="autoSwitchTeamContext" ${settings.autoSwitchTeamContext ? 'checked' : ''} onchange="updateSetting('autoSwitchTeamContext', this.checked)">
                        Auto-load team context on switch
                    </label>
                    <div class="description">Automatically apply team system prompts when switching teams</div>
                </div>
            </div>

            <div class="setting-group">
                <div class="setting-title">⚠️ Quota Warnings</div>
                
                <div class="setting-item">
                    <label class="checkbox-label">
                        <input type="checkbox" id="showQuotaWarnings" ${settings.showQuotaWarnings ? 'checked' : ''} onchange="updateSetting('showQuotaWarnings', this.checked)">
                        Show low quota warnings
                    </label>
                    <div class="description">Display warning when credits are running low</div>
                </div>

                <div class="setting-item">
                    <label class="setting-label">Low Quota Threshold</label>
                    <input type="number" id="lowQuotaThreshold" value="${settings.lowQuotaThreshold}" min="0" max="1000" step="10" onchange="updateSetting('lowQuotaThreshold', parseInt(this.value))">
                    <div class="description">Credit amount to trigger low quota warning</div>
                </div>
            </div>

            <div class="setting-group">
                <button onclick="openVSCodeSettings()">📝 Open Full Settings</button>
                <button onclick="window.location.reload()">🔄 Refresh</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                function updateSetting(key, value) {
                    vscode.postMessage({ command: 'updateSetting', key, value });
                }

                function openVSCodeSettings() {
                    vscode.postMessage({ command: 'openVSCodeSettings' });
                }
            </script>
        </body>
        </html>`;
    }
}
