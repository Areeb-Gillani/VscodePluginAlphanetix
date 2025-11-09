import { BaseExecutor, ToolExecutionResult, ExecutionContext } from './BaseExecutor';

// Re-export ExecutionContext for convenience
export type { ExecutionContext };

/**
 * Tool definition loaded from JSON
 */
export interface ToolDefinition {
    name: string;
    version: string;
    category: string;
    risk_level: 'low' | 'medium' | 'high';
    execution_type: 'fetch' | 'modify';
    modes: {
        ask: boolean;
        agent: boolean;
    };
    description: string;
    input_schema: any;
    output_schema: any;
}

/**
 * Registry for managing all tool executors
 * Provides centralized access to executors and execution logic
 */
export class ExecutorRegistry {
    private static instance: ExecutorRegistry;
    private executors: Map<string, BaseExecutor>;
    private toolDefinitions: Map<string, ToolDefinition>;

    private constructor() {
        this.executors = new Map();
        this.toolDefinitions = new Map();
    }

    public static getInstance(): ExecutorRegistry {
        if (!ExecutorRegistry.instance) {
            ExecutorRegistry.instance = new ExecutorRegistry();
        }
        return ExecutorRegistry.instance;
    }

    /**
     * Register an executor for a tool
     */
    public register(toolName: string, executor: BaseExecutor): void {
        if (this.executors.has(toolName)) {
            console.warn(`🔧 Registry: Overwriting executor for ${toolName}`);
        }
        
        this.executors.set(toolName, executor);
        console.log(`🔧 Registry: Registered executor for ${toolName}`);
    }

    /**
     * Register a tool definition
     */
    public registerToolDefinition(toolDef: ToolDefinition): void {
        this.toolDefinitions.set(toolDef.name, toolDef);
        console.log(`🔧 Registry: Registered tool definition for ${toolDef.name} v${toolDef.version}`);
    }

    /**
     * Get an executor by tool name
     */
    public get(toolName: string): BaseExecutor | undefined {
        return this.executors.get(toolName);
    }

    /**
     * Get a tool definition by name
     */
    public getToolDefinition(toolName: string): ToolDefinition | undefined {
        return this.toolDefinitions.get(toolName);
    }

    /**
     * Check if an executor exists
     */
    public has(toolName: string): boolean {
        return this.executors.has(toolName);
    }

    /**
     * Execute a tool by name
     */
    public async execute(
        toolName: string,
        args: any,
        context: ExecutionContext
    ): Promise<ToolExecutionResult> {
        const executor = this.executors.get(toolName);
        
        if (!executor) {
            return {
                success: false,
                error: `No executor found for tool: ${toolName}`,
                executionTimeMs: 0
            };
        }

        return executor.execute(args, context);
    }

    /**
     * Get all registered tool names
     */
    public getToolNames(): string[] {
        return Array.from(this.executors.keys());
    }

    /**
     * Get all tool definitions
     */
    public getAllToolDefinitions(): ToolDefinition[] {
        return Array.from(this.toolDefinitions.values());
    }

    /**
     * Get tools filtered by mode
     */
    public getToolsForMode(mode: 'ask' | 'agent'): ToolDefinition[] {
        return this.getAllToolDefinitions().filter(tool => tool.modes[mode]);
    }

    /**
     * Get tools filtered by category
     */
    public getToolsByCategory(category: string): ToolDefinition[] {
        return this.getAllToolDefinitions().filter(tool => tool.category === category);
    }

    /**
     * Get tools filtered by risk level
     */
    public getToolsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): ToolDefinition[] {
        return this.getAllToolDefinitions().filter(tool => tool.risk_level === riskLevel);
    }

    /**
     * Get statistics about registered executors
     */
    public getStats() {
        const definitions = this.getAllToolDefinitions();
        
        return {
            totalExecutors: this.executors.size,
            totalDefinitions: this.toolDefinitions.size,
            byCategory: this.groupBy(definitions, 'category'),
            byRiskLevel: this.groupBy(definitions, 'risk_level'),
            byExecutionType: this.groupBy(definitions, 'execution_type'),
            askTools: this.getToolsForMode('ask').length,
            agentTools: this.getToolsForMode('agent').length
        };
    }

    /**
     * Clear all registered executors (for testing)
     */
    public clear(): void {
        this.executors.clear();
        this.toolDefinitions.clear();
        console.log('🔧 Registry: Cleared all executors and definitions');
    }

    /**
     * Helper method to group tools by a property
     */
    private groupBy(tools: ToolDefinition[], property: keyof ToolDefinition): { [key: string]: number } {
        return tools.reduce((acc, tool) => {
            const key = String(tool[property]);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
    }

    /**
     * Validate tool compatibility with mode
     */
    public isToolCompatibleWithMode(toolName: string, mode: 'ask' | 'agent'): boolean {
        const definition = this.toolDefinitions.get(toolName);
        if (!definition) {
            return false;
        }
        return definition.modes[mode];
    }

    /**
     * Get tool names compatible with a specific mode
     */
    public getCompatibleToolNames(mode: 'ask' | 'agent'): string[] {
        return this.getToolsForMode(mode).map(tool => tool.name);
    }
}
