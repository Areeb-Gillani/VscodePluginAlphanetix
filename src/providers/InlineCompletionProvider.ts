import * as vscode from 'vscode';
import { CompletionService } from '../services/CompletionService';
import { StateManager } from '../state/StateManager';

/**
 * Provides inline code completions (like GitHub Copilot)
 */
export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private completionService: CompletionService;
    private debounceTimer: NodeJS.Timeout | undefined;

    constructor() {
        this.completionService = CompletionService.getInstance();
    }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | undefined> {
        // Check if feature is enabled
        const config = vscode.workspace.getConfiguration('alphanetix');
        if (!config.get<boolean>('enableInlineCompletion', true)) {
            return undefined;
        }

        // Check if authenticated
        const isAuthenticated = await StateManager.getInstance().isAuthenticated();
        if (!isAuthenticated) {
            return undefined;
        }

        // Don't trigger on manual invocation for now
        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke) {
            // User explicitly requested completion
        }

        try {
            // Get context around cursor
            const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
            const lineCount = Math.min(position.line, 20); // Get up to 20 lines of context
            const startLine = Math.max(0, position.line - lineCount);
            
            const contextBefore = document.getText(
                new vscode.Range(startLine, 0, position.line, position.character)
            );

            // Build prompt
            const fileName = document.fileName.split(/[\\/]/).pop() || '';
            const languageId = document.languageId;
            
            const prompt = this.buildCompletionPrompt(
                contextBefore,
                fileName,
                languageId
            );

            // Get completion from AI
            const response = await this.completionService.getCompletion(prompt, {
                estimatedTokens: 500,
            });

            if (!response.message) {
                return undefined;
            }

            // Parse and format completion
            const completionText = this.parseCompletion(response.message, linePrefix);
            
            if (!completionText || completionText.trim().length === 0) {
                return undefined;
            }

            const item = new vscode.InlineCompletionItem(
                completionText,
                new vscode.Range(position, position)
            );

            return [item];
        } catch (error: any) {
            console.error('Inline completion error:', error);
            
            // Show error if quota is low
            if (error.message?.includes('quota') || error.message?.includes('credits')) {
                vscode.window.showWarningMessage(
                    'Low on credits. Please check your quota.',
                    'View Quota'
                ).then(selection => {
                    if (selection === 'View Quota') {
                        vscode.commands.executeCommand('alphanetix.refreshQuota');
                    }
                });
            }
            
            return undefined;
        }
    }

    private buildCompletionPrompt(
        context: string,
        fileName: string,
        languageId: string
    ): string {
        return `You are an expert code completion assistant. Complete the code based on the context provided.

File: ${fileName}
Language: ${languageId}

Code context:
\`\`\`${languageId}
${context}
\`\`\`

Provide ONLY the code completion. Do not include explanations, markdown formatting, or the existing code. Just provide the next few lines that would logically follow.`;
    }

    private parseCompletion(aiResponse: string, linePrefix: string): string {
        // Remove markdown code blocks if present
        let completion = aiResponse.replace(/```[\w]*\n?/g, '').trim();
        
        // Remove any duplicate of what's already typed
        if (completion.startsWith(linePrefix.trim())) {
            completion = completion.substring(linePrefix.trim().length);
        }

        // Limit number of lines
        const config = vscode.workspace.getConfiguration('alphanetix');
        const maxLines = config.get<number>('maxCompletionLines', 5);
        
        const lines = completion.split('\n');
        if (lines.length > maxLines) {
            completion = lines.slice(0, maxLines).join('\n');
        }

        return completion;
    }
}
