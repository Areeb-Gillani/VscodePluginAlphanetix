import * as vscode from 'vscode';
import { CompletionService } from '../services/CompletionService';
import { StateManager } from '../state/StateManager';

/**
 * Webview provider for chat interface
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private completionService: CompletionService;
    private currentSessionId?: string;
    private chatHistory: Array<{ role: string; content: string }> = [];

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.completionService = CompletionService.getInstance();
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
                case 'sendMessage':
                    await this.sendMessage(message.text);
                    break;
                case 'newChat':
                    await this.startNewChat();
                    break;
                case 'clearChat':
                    this.chatHistory = [];
                    this.updateView();
                    break;
            }
        });
    }

    private async sendMessage(text: string) {
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

            // Get AI response
            const response = await this.completionService.getCompletion(text, {
                sessionId: this.currentSessionId,
            });

            // Add AI response to history
            this.chatHistory.push({ role: 'assistant', content: response.message });
            this.updateView();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Chat error: ${error.message}`);
            this.chatHistory.push({
                role: 'error',
                content: `Error: ${error.message}`,
            });
            this.updateView();
        }
    }

    private async startNewChat() {
        this.currentSessionId = undefined;
        this.chatHistory = [];
        this.updateView();
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

        this._view.webview.html = this.getChatHtml();
    }

    private getUnauthenticatedHtml(): string {
        return `<!DOCTYPE html>
        <html>
        <body style="padding: 20px; font-family: var(--vscode-font-family); text-align: center;">
            <h3>Chat Unavailable</h3>
            <p style="color: var(--vscode-descriptionForeground);">Please sign in to use chat</p>
        </body>
        </html>`;
    }

    private getChatHtml(): string {
        const messagesHtml = this.chatHistory
            .map((msg) => {
                const isUser = msg.role === 'user';
                const isError = msg.role === 'error';
                return `
                <div class="message ${isUser ? 'user-message' : isError ? 'error-message' : 'ai-message'}">
                    <div class="message-header">${isUser ? '👤 You' : isError ? '⚠️ Error' : '🤖 Alphanetix AI'}</div>
                    <div class="message-content">${this.escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
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
                    padding: 10px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                .chat-container {
                    flex: 1;
                    overflow-y: auto;
                    padding-bottom: 10px;
                }
                .message {
                    margin: 10px 0;
                    padding: 10px;
                    border-radius: 6px;
                }
                .user-message {
                    background: var(--vscode-editor-selectionBackground);
                    margin-left: 20px;
                }
                .ai-message {
                    background: var(--vscode-editor-background);
                    margin-right: 20px;
                    border: 1px solid var(--vscode-panel-border);
                }
                .error-message {
                    background: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                }
                .message-header {
                    font-size: 11px;
                    font-weight: bold;
                    margin-bottom: 5px;
                    opacity: 0.8;
                }
                .message-content {
                    font-size: 13px;
                    line-height: 1.5;
                }
                .input-container {
                    padding: 10px 0;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                .input-row {
                    display: flex;
                    gap: 5px;
                }
                textarea {
                    flex: 1;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 8px;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    resize: none;
                    min-height: 60px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 12px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                button.secondary {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                button.secondary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                .button-row {
                    display: flex;
                    gap: 5px;
                    margin-top: 5px;
                }
                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <div class="chat-container" id="chatContainer">
                ${
                    this.chatHistory.length === 0
                        ? '<div class="empty-state"><h3>👋 Welcome to Alphanetix Chat</h3><p>Ask me anything about coding!</p></div>'
                        : messagesHtml
                }
            </div>
            <div class="input-container">
                <div class="input-row">
                    <textarea id="messageInput" placeholder="Ask me about your code..."></textarea>
                </div>
                <div class="button-row">
                    <button onclick="sendMessage()">Send</button>
                    <button class="secondary" onclick="newChat()">New Chat</button>
                    <button class="secondary" onclick="clearChat()">Clear</button>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const messageInput = document.getElementById('messageInput');
                const chatContainer = document.getElementById('chatContainer');

                // Scroll to bottom
                chatContainer.scrollTop = chatContainer.scrollHeight;

                // Handle Enter key
                messageInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                    }
                });

                function sendMessage() {
                    const text = messageInput.value.trim();
                    if (text) {
                        vscode.postMessage({ command: 'sendMessage', text });
                        messageInput.value = '';
                    }
                }

                function newChat() {
                    vscode.postMessage({ command: 'newChat' });
                }

                function clearChat() {
                    vscode.postMessage({ command: 'clearChat' });
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
