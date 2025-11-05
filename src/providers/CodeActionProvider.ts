import * as vscode from 'vscode';
import { CompletionService } from '../services/CompletionService';

/**
 * Provides code actions for selected code
 */
export class CodeActionProvider implements vscode.CodeActionProvider {
    private completionService: CompletionService;

    constructor() {
        this.completionService = CompletionService.getInstance();
    }

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const selection = range as vscode.Selection;
        if (selection.isEmpty) {
            return [];
        }

        const actions: vscode.CodeAction[] = [];

        // Explain code action
        const explainAction = new vscode.CodeAction(
            '🤖 Explain with Alphanetix AI',
            vscode.CodeActionKind.Empty
        );
        explainAction.command = {
            command: 'alphanetix.explainCode',
            title: 'Explain Code',
        };
        actions.push(explainAction);

        // Fix/improve code action
        const fixAction = new vscode.CodeAction(
            '🔧 Fix/Improve with Alphanetix AI',
            vscode.CodeActionKind.QuickFix
        );
        fixAction.command = {
            command: 'alphanetix.fixCode',
            title: 'Fix Code',
        };
        actions.push(fixAction);

        // Refactor code action
        const refactorAction = new vscode.CodeAction(
            '♻️ Refactor with Alphanetix AI',
            vscode.CodeActionKind.Refactor
        );
        refactorAction.command = {
            command: 'alphanetix.refactorCode',
            title: 'Refactor Code',
        };
        actions.push(refactorAction);

        return actions;
    }
}
