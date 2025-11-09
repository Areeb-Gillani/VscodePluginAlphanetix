# MCP Tool Executors

## Overview

This directory contains all tool executor implementations for the Model Context Protocol. Each executor is responsible for executing a specific tool and handling its validation, execution, and error management.

## Directory Structure

```
executors/
├── BaseExecutor.ts           # Abstract base class
├── ExecutorRegistry.ts       # Executor registry singleton
├── filesystem/               # File operations
│   ├── ReadFileExecutor.ts
│   ├── WriteFileExecutor.ts
│   ├── EditFileExecutor.ts
│   ├── MultiEditExecutor.ts
│   ├── DeleteFileExecutor.ts
│   ├── ReapplyExecutor.ts
│   ├── EditNotebookExecutor.ts
│   └── ListDirectoryExecutor.ts
├── search/                   # Search operations
│   ├── GlobExecutor.ts
│   ├── GrepSearchExecutor.ts
│   └── CodebaseSearchExecutor.ts
├── shell/                    # Shell operations
│   ├── BashExecutor.ts
│   ├── BashOutputExecutor.ts
│   └── KillBashExecutor.ts
├── workflow/                 # Workflow management
│   ├── ExitPlanModeExecutor.ts
│   └── TodoWriteExecutor.ts
├── web/                      # Web operations
│   ├── WebFetchExecutor.ts
│   └── WebSearchExecutor.ts
├── visualization/            # Visualization tools
│   └── CreateDiagramExecutor.ts
└── agent/                    # Agent delegation
    └── TaskAgentExecutor.ts
```

## Base Executor

All executors inherit from `BaseExecutor` which provides:

### Core Features
- **Argument Validation**: Type checking and required field validation
- **Mode Checking**: Automatic ask/agent mode compatibility
- **Error Handling**: Standardized error types and messages
- **Context Management**: Session, user, and tool metadata
- **Logging**: Comprehensive execution logging

### Validation Helpers
```typescript
validateRequired(args, fields)     // Check required fields
validateType(value, type, name)    // Type validation
validateEnum(value, options, name) // Enum validation
```

### Error Types
- `ValidationError` - Invalid arguments
- `PermissionError` - Mode incompatibility
- `FileNotFoundError` - Missing resources
- `ExecutionTimeoutError` - Timeout exceeded

## Executor Categories

### 1. Filesystem Executors

#### ReadFileExecutor
- **Tool**: `read_file`
- **Risk**: Low
- **Modes**: ask, agent
- **Features**:
  - Cat -n format with line numbers
  - Offset and limit support
  - Automatic truncation (2000 lines)
  - Image and PDF support

#### WriteFileExecutor
- **Tool**: `write_file`
- **Risk**: High
- **Modes**: agent only
- **Features**:
  - Read-first validation
  - Directory auto-creation
  - File overwrite protection
  - Diff preview

#### EditFileExecutor
- **Tool**: `edit_file`
- **Risk**: High
- **Modes**: agent only
- **Features**:
  - String replacement
  - Uniqueness validation
  - Replace-all mode
  - Context preservation

#### MultiEditExecutor
- **Tool**: `multi_edit`
- **Risk**: High
- **Modes**: agent only
- **Features**:
  - Batch edits (sequential)
  - Atomic operation (rollback on failure)
  - Per-edit validation
  - Transaction safety

#### DeleteFileExecutor
- **Tool**: `delete_file`
- **Risk**: High
- **Modes**: agent only
- **Features**:
  - User confirmation prompt
  - File existence check
  - Directory protection
  - Error handling

#### ReapplyExecutor
- **Tool**: `reapply`
- **Risk**: Medium
- **Modes**: agent only
- **Status**: Placeholder
- **Requirements**: LLM service integration

#### EditNotebookExecutor
- **Tool**: `edit_notebook`
- **Risk**: High
- **Modes**: agent only
- **Features**:
  - Cell-level editing
  - Cell ID or index lookup
  - String replacement in cells
  - Full cell replacement
  - Jupyter format preservation

#### ListDirectoryExecutor
- **Tool**: `ls`
- **Risk**: Low
- **Modes**: ask, agent
- **Features**:
  - Recursive listing
  - Glob ignore patterns
  - File metadata (size, type, modified)
  - Directory filtering

### 2. Search Executors

#### GlobExecutor
- **Tool**: `glob`
- **Risk**: Low
- **Modes**: ask, agent
- **Features**:
  - Glob pattern matching
  - Fuzzy file search
  - Relevance scoring
  - Modification time sorting
  - Result limit (10)

#### GrepSearchExecutor
- **Tool**: `grep_search`
- **Risk**: Low
- **Modes**: ask, agent
- **Features**:
  - Regex pattern search
  - Glob/type filtering
  - Output modes (content/files/count)
  - Case sensitivity control
  - Result limit (50)

#### CodebaseSearchExecutor
- **Tool**: `codebase_search`
- **Risk**: Low
- **Modes**: ask, agent
- **Features**:
  - Semantic code search
  - Symbol search (workspace symbols)
  - Text search fallback
  - Relevance scoring
  - Target directory filtering
  - Context lines

### 3. Shell Executors

#### BashExecutor
- **Tool**: `bash`
- **Risk**: High
- **Modes**: agent only
- **Features**:
  - PowerShell on Windows
  - Timeout control (2-10 min)
  - Background process support
  - Output truncation (30KB)
  - High-risk command detection
  - User confirmation prompts
  - Command translation (ls → Get-ChildItem)

#### BashOutputExecutor
- **Tool**: `bash_output`
- **Risk**: Low
- **Modes**: ask, agent
- **Status**: Placeholder
- **Requirements**: Shared process registry

#### KillBashExecutor
- **Tool**: `kill_bash`
- **Risk**: Medium
- **Modes**: agent only
- **Status**: Placeholder
- **Requirements**: Shared process registry

### 4. Workflow Executors

#### ExitPlanModeExecutor
- **Tool**: `exit_plan_mode`
- **Risk**: Low
- **Modes**: ask, agent
- **Features**:
  - User prompt for mode change
  - Plan review option
  - Mode transition confirmation

#### TodoWriteExecutor
- **Tool**: `todo_write`
- **Risk**: Low
- **Modes**: ask, agent
- **Features**:
  - Session-based task lists
  - Status tracking (pending/in_progress/completed)
  - Single in-progress validation
  - Duplicate ID detection
  - Session statistics

### 5. Web Executors

#### WebFetchExecutor
- **Tool**: `web_fetch`
- **Risk**: Low
- **Modes**: ask, agent
- **Status**: Placeholder
- **Requirements**: HTTP client, AI processing

#### WebSearchExecutor
- **Tool**: `web_search`
- **Risk**: Low
- **Modes**: ask, agent
- **Status**: Placeholder
- **Requirements**: Search API integration

### 6. Visualization Executors

#### CreateDiagramExecutor
- **Tool**: `create_diagram`
- **Risk**: Low
- **Modes**: ask, agent
- **Features**:
  - Mermaid diagram syntax validation
  - Diagram type detection
  - Prohibited feature checking
  - Webview preview rendering
  - CDN-based rendering

### 7. Agent Executors

#### TaskAgentExecutor
- **Tool**: `task`
- **Risk**: Medium
- **Modes**: ask, agent
- **Status**: Placeholder
- **Features**:
  - Agent type validation
  - Progress reporting
  - Tool access mapping
  - Timeout handling
- **Requirements**: Backend agent system

## Executor Registry

### Registration
```typescript
const registry = ExecutorRegistry.getInstance();
registry.register('tool_name', new ToolExecutor());
```

### Execution
```typescript
const result = await registry.execute('tool_name', args, context);
```

### Filtering
```typescript
// Get tools for specific mode
const askTools = registry.getToolsForMode('ask');

// Get compatible tool names
const compatibleNames = registry.getCompatibleToolNames(mode, riskLevel);
```

### Statistics
```typescript
const stats = registry.getStats();
// Returns: toolsByCategory, toolsByRisk, toolsByExecution, toolsByMode
```

## Development Workflow

### Adding a New Executor

1. **Create Executor File**
```typescript
// executors/category/MyExecutor.ts
import { BaseExecutor, ExecutionContext, ValidationError } from '../BaseExecutor';

interface MyArgs {
    param1: string;
    param2?: number;
}

interface MyResult {
    output: string;
}

export class MyExecutor extends BaseExecutor {
    constructor() {
        super('my_tool', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: MyArgs): void {
        this.validateRequired(args, ['param1']);
        this.validateType(args.param1, 'string', 'param1');
    }

    protected async executeInternal(
        args: MyArgs,
        context: ExecutionContext
    ): Promise<MyResult> {
        // Implementation
        return { output: 'success' };
    }
}
```

2. **Register in McpCapabilityService**
```typescript
registry.register('my_tool', new MyExecutor());
```

3. **Add Tool Definition** to `alphanetix-mcp-tools-enhanced.json`

4. **Write Tests**

## Best Practices

### Validation
- Always validate required fields first
- Use type validation helpers
- Provide clear error messages
- Validate ranges and constraints

### Error Handling
- Use appropriate error types
- Log errors with context
- Provide actionable error messages
- Clean up resources on failure

### User Experience
- Show progress for long operations
- Confirm destructive operations
- Provide clear success/failure feedback
- Log meaningful console messages

### Performance
- Truncate large outputs
- Use timeouts for operations
- Cache when appropriate
- Clean up resources

### Security
- Validate all inputs
- Check mode compatibility
- Confirm high-risk operations
- Sanitize command arguments

## Testing Guidelines

### Unit Tests
- Test validation logic
- Test error conditions
- Test edge cases
- Mock external dependencies

### Integration Tests
- Test with ExecutorRegistry
- Test mode filtering
- Test error propagation
- Test logging

### End-to-End Tests
- Test with real tool calls
- Test with LLM integration
- Test multi-tool workflows
- Test error recovery

## Troubleshooting

### Common Issues

**Validation Errors**
- Check argument types match schema
- Verify required fields present
- Validate enum values

**Permission Errors**
- Check mode compatibility
- Verify risk level appropriate
- Confirm user authorization

**Execution Errors**
- Check resource availability
- Verify file paths absolute
- Ensure proper permissions
- Check timeout settings

## Performance Metrics

Track for each executor:
- Execution time
- Success/failure rate
- Resource usage
- Error frequency
- User cancellations

## Future Improvements

- [ ] Shared process registry for bash tools
- [ ] HTTP client integration for web tools
- [ ] LLM service integration for reapply
- [ ] Agent orchestration backend
- [ ] Caching layer for search results
- [ ] Parallel execution support
- [ ] Resource pooling
- [ ] Advanced logging and metrics
