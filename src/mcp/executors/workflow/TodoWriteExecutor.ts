import { BaseExecutor, ExecutionContext, ValidationError } from '../BaseExecutor';

interface TodoItem {
    id: number;
    title: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'completed';
}

interface TodoWriteArgs {
    todos: TodoItem[];
}

interface TodoWriteResult {
    todos: TodoItem[];
}

/**
 * Executor for managing a structured task list for the coding session
 * Helps track progress and organize complex tasks
 */
export class TodoWriteExecutor extends BaseExecutor {
    private sessionTodos: Map<string, TodoItem[]> = new Map();

    constructor() {
        super('todo_write', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: TodoWriteArgs): void {
        this.validateRequired(args, ['todos']);

        if (!Array.isArray(args.todos)) {
            throw new ValidationError('todos must be an array');
        }

        // Validate each todo item
        for (let i = 0; i < args.todos.length; i++) {
            const todo = args.todos[i];

            if (typeof todo.id !== 'number') {
                throw new ValidationError(`todos[${i}].id must be a number`);
            }

            if (typeof todo.title !== 'string' || !todo.title.trim()) {
                throw new ValidationError(`todos[${i}].title must be a non-empty string`);
            }

            if (todo.description !== undefined && typeof todo.description !== 'string') {
                throw new ValidationError(`todos[${i}].description must be a string`);
            }

            if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
                throw new ValidationError(
                    `todos[${i}].status must be one of: pending, in_progress, completed`
                );
            }
        }

        // Check for duplicate IDs
        const ids = args.todos.map(t => t.id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
            throw new ValidationError('Duplicate todo IDs found');
        }

        // Validate only one in_progress task
        const inProgressCount = args.todos.filter(t => t.status === 'in_progress').length;
        if (inProgressCount > 1) {
            throw new ValidationError('Only one todo can be in_progress at a time');
        }
    }

    protected async executeInternal(args: TodoWriteArgs, context: ExecutionContext): Promise<TodoWriteResult> {
        const sessionId = context.sessionId || 'default';
        
        console.log(`📝 TodoWrite: Updating ${args.todos.length} todo(s) for session ${sessionId}`);

        // Store todos for this session
        this.sessionTodos.set(sessionId, args.todos);

        // Log summary
        const pendingCount = args.todos.filter(t => t.status === 'pending').length;
        const inProgressCount = args.todos.filter(t => t.status === 'in_progress').length;
        const completedCount = args.todos.filter(t => t.status === 'completed').length;

        console.log(
            `📊 TodoWrite: Status - Pending: ${pendingCount}, In Progress: ${inProgressCount}, Completed: ${completedCount}`
        );

        return {
            todos: args.todos
        };
    }

    /**
     * Get todos for a specific session
     */
    public getTodos(sessionId: string): TodoItem[] {
        return this.sessionTodos.get(sessionId) || [];
    }

    /**
     * Clear todos for a session
     */
    public clearTodos(sessionId: string): void {
        this.sessionTodos.delete(sessionId);
    }
}
