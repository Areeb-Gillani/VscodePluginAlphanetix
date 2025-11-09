import * as vscode from 'vscode';
import { BaseExecutor, ExecutionContext, ValidationError } from '../BaseExecutor';

interface ExitPlanModeArgs {
    plan: string;
}

interface ExitPlanModeResult {
    mode_changed: boolean;
    user_response?: string;
}

/**
 * Executor for transitioning from plan mode to coding mode
 * Prompts the user to exit plan mode after presenting implementation plan
 */
export class ExitPlanModeExecutor extends BaseExecutor {
    constructor() {
        super('exit_plan_mode', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: ExitPlanModeArgs): void {
        this.validateRequired(args, ['plan']);
        this.validateType(args.plan, 'string', 'plan');

        if (!args.plan.trim()) {
            throw new ValidationError('plan cannot be empty');
        }
    }

    protected async executeInternal(_args: ExitPlanModeArgs, _context: ExecutionContext): Promise<ExitPlanModeResult> {
        console.log(`🎯 ExitPlanMode: Requesting transition from plan mode`);

        // Show plan to user and ask if they want to proceed
        const response = await vscode.window.showInformationMessage(
            `Plan presented. Ready to exit plan mode and begin implementation?`,
            { modal: false },
            'Proceed with Implementation',
            'Stay in Plan Mode',
            'Review Plan'
        );

        if (response === 'Proceed with Implementation') {
            console.log(`✅ ExitPlanMode: User chose to proceed with implementation`);
            
            vscode.window.showInformationMessage('Exiting plan mode - ready to implement!');

            return {
                mode_changed: true,
                user_response: 'proceed'
            };
        } else if (response === 'Review Plan') {
            console.log(`📋 ExitPlanMode: User wants to review plan`);

            return {
                mode_changed: false,
                user_response: 'review'
            };
        } else {
            console.log(`⏸️ ExitPlanMode: User chose to stay in plan mode`);

            return {
                mode_changed: false,
                user_response: 'stay'
            };
        }
    }
}
