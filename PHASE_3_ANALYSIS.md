# Phase 3: VSCode Extension MCP Server - Implementation Analysis

## Executive Summary

Phase 3 involves transforming the VSCode extension into a full MCP (Model Context Protocol) server capable of:
1. **Capability Reporting**: Registering available tools with the backend
2. **Tool Execution**: Executing file system and workspace operations requested by LLMs
3. **Backend Integration**: Syncing with backend API for tool versions and session management

---

## Current State Analysis

### Existing MCP Infrastructure (✅ Already Built)

#### 1. **MCPService.ts** - Core MCP orchestration
- ✅ Tool registry and management
- ✅ Tool execution pipeline
- ✅ Workspace context gathering
- ✅ Recent action tracking
- ✅ Tool statistics

#### 2. **FileTools.ts & WorkspaceTools.ts** - Tool implementations
- ✅ `read_file`, `write_file`, `list_directory`, `search_workspace`
- ✅ Workspace info, active editor, symbols, definitions

#### 3. **types.ts** - MCP type definitions
- ✅ `MCPTool`, `MCPToolCall`, `MCPToolResult`
- ✅ `MCPContext`, `MCPResource`, `WorkspaceInfo`

#### 4. **ApiClient.ts** - Backend communication
- ✅ Axios instance with auth interceptors
- ✅ Token refresh logic
- ✅ Request/response handling

### Backend API Endpoints (✅ Phase 1 & 2 Complete)

#### Capability Registration
- `POST /api/mcp/capabilities/register?sessionId={sessionId}`
- Request: `{ extensionVersion, tools: [{ name, version, modes }] }`
- Response: `McpClientCapabilityDTO`

#### Tool Transformation
- `POST /api/mcp/capabilities/transform`
- Request: `{ toolNames, toolVersions, provider, mode }`
- Response: `{ provider, mode, tools: [...], cached }`

#### Tool Intersection
- `GET /api/mcp/capabilities/intersection?sessionId={}&agentId={}&mode={}`
- Returns: `Map<toolName, version>` of compatible tools

#### Execution Logging
- `POST /api/mcp/executions/log?sessionId={sessionId}`
- Request: `{ toolName, toolVersion, mode, inputParams, outputResult, status, executionDurationMs }`
- Response: `McpToolExecutionDTO`

---

## Gap Analysis

### What's Missing for Phase 3

#### 1. **Tool Executor Implementations** (🔴 HIGH PRIORITY)
Current state: Basic implementations exist in `FileTools.ts` and `WorkspaceTools.ts`
**Needs**:
- Align with `alphanetix-mcp-tools-enhanced.json` schema
- Implement missing tools: `edit_file`, `bash`, `glob`, `ls`
- Add proper error handling and validation
- Support for risk levels and execution types

#### 2. **Capability Reporter Service** (🔴 HIGH PRIORITY)
**Needs**: New service `McpCapabilityService.ts`
- Load tool definitions from `alphanetix-mcp-tools-enhanced.json`
- Register capabilities with backend on extension activation
- Update capabilities when session starts
- Handle version compatibility checks

#### 3. **Tool Execution Flow Integration** (🟡 MEDIUM PRIORITY)
**Needs**: Updates to `CompletionService.ts`
- Parse LLM responses for tool calls
- Execute tools via `MCPService`
- Log executions to backend
- Return results to LLM for continuation

#### 4. **Session Management** (🟡 MEDIUM PRIORITY)
**Needs**: Updates to `StateManager.ts` and services
- Track active chat session ID
- Register capabilities per session
- Handle session lifecycle (create, resume, end)

#### 5. **Mode-Based Tool Filtering** (🟢 LOW PRIORITY)
**Needs**: Logic in `MCPService.ts`
- Filter tools based on ASK vs AGENT mode
- Enforce risk level restrictions
- Validate execution types

---

## Implementation Strategy

### Phase 3.1: Tool Executor Infrastructure

#### Step 1: Create Base Executor Class
**File**: `src/mcp/executors/BaseExecutor.ts`
```typescript
export abstract class BaseExecutor {
  abstract execute(args: any): Promise<ToolExecutionResult>;
  
  protected validateArgs(args: any, schema: any): void;
  protected handleError(error: Error): ToolExecutionResult;
  protected logExecution(toolName: string, duration: number): void;
}
```

#### Step 2: Implement Filesystem Executors
**Files**: 
- `src/mcp/executors/filesystem/ReadFileExecutor.ts` ✅ (update existing)
- `src/mcp/executors/filesystem/WriteFileExecutor.ts` ✅ (update existing)
- `src/mcp/executors/filesystem/EditFileExecutor.ts` 🆕 (NEW)
- `src/mcp/executors/filesystem/ListDirectoryExecutor.ts` 🆕 (NEW)

#### Step 3: Implement Search & Execution Executors
**Files**:
- `src/mcp/executors/search/GlobExecutor.ts` 🆕 (NEW)
- `src/mcp/executors/shell/BashExecutor.ts` 🆕 (NEW - Windows PowerShell support)

#### Step 4: Create Executor Registry
**File**: `src/mcp/executors/ExecutorRegistry.ts`
```typescript
export class ExecutorRegistry {
  private executors: Map<string, BaseExecutor>;
  
  register(toolName: string, executor: BaseExecutor): void;
  get(toolName: string): BaseExecutor | undefined;
  execute(toolName: string, args: any): Promise<ToolExecutionResult>;
}
```

---

### Phase 3.2: Capability Registration Service

#### Step 1: Create McpCapabilityService
**File**: `src/services/McpCapabilityService.ts`

**Responsibilities**:
1. Load tool definitions from `alphanetix-mcp-tools-enhanced.json`
2. Extract extension version from `package.json`
3. Build capability payload for backend
4. Register capabilities on extension activation
5. Re-register when session changes
6. Cache registered capabilities

**Key Methods**:
```typescript
class McpCapabilityService {
  // Load tools from JSON
  async loadToolDefinitions(): Promise<EnhancedToolDefinition[]>
  
  // Register with backend
  async registerCapabilities(sessionId: string): Promise<void>
  
  // Get tool intersection for session
  async getAvailableTools(sessionId: string, agentId: string, mode: string): Promise<Map<string, string>>
  
  // Get transformed tools for provider
  async getTransformedTools(provider: string, mode: string, toolVersions: Map<string, string>): Promise<any[]>
}
```

#### Step 2: Update Extension Activation
**File**: `src/extension.ts`

```typescript
export function activate(context: vscode.ExtensionContext) {
  // ... existing code ...
  
  // Initialize MCP capability service
  const mcpCapabilityService = McpCapabilityService.getInstance();
  await mcpCapabilityService.loadToolDefinitions();
  
  // Register capabilities when authenticated
  if (await authService.isAuthenticated()) {
    const sessionId = await getOrCreateSession();
    await mcpCapabilityService.registerCapabilities(sessionId);
  }
}
```

---

### Phase 3.3: Tool Execution Flow

#### Step 1: Update CompletionService
**File**: `src/services/CompletionService.ts`

**Add**:
```typescript
class CompletionService {
  // Parse LLM response for tool calls
  private parseToolCalls(response: AICompletionResponse): MCPToolCall[]
  
  // Execute tools and get results
  async executeTools(toolCalls: MCPToolCall[]): Promise<MCPToolResult[]>
  
  // Log execution to backend
  async logToolExecution(sessionId: string, execution: ToolExecutionLog): Promise<void>
  
  // Enhanced completion with tool execution loop
  async completeWithTools(message: string, sessionId: string, maxIterations: number = 3): Promise<string>
}
```

#### Step 2: Tool Execution Loop
```
1. Send message to LLM
2. Parse response for tool calls
3. If tool calls present:
   a. Execute each tool via ExecutorRegistry
   b. Log execution to backend
   c. Append tool results to conversation
   d. Send back to LLM (repeat up to maxIterations)
4. Return final response
```

---

### Phase 3.4: Session Integration

#### Step 1: Add Session Tracking to StateManager
**File**: `src/state/StateManager.ts`

**Add**:
```typescript
class StateManager {
  async getCurrentSessionId(): Promise<string | null>
  async setCurrentSessionId(sessionId: string): Promise<void>
  async clearCurrentSessionId(): Promise<void>
  
  async getOrCreateSession(agentId?: string): Promise<string>
}
```

#### Step 2: Update Chat Session Creation
**File**: `src/services/ChatService.ts` (NEW or update existing)

**Add**:
```typescript
class ChatService {
  async createSession(agentId?: string, modelId?: string): Promise<ChatSessionDTO>
  async resumeSession(sessionId: string): Promise<void>
  async endSession(sessionId: string): Promise<void>
  
  // Register capabilities when session starts
  async startSession(agentId?: string): Promise<string> {
    const session = await this.createSession(agentId);
    await mcpCapabilityService.registerCapabilities(session.id);
    await stateManager.setCurrentSessionId(session.id);
    return session.id;
  }
}
```

---

## Technical Considerations

### 1. **Windows PowerShell Support for Bash Tool**
- Extension runs on Windows (`pwsh.exe`)
- `bash` tool should translate to PowerShell commands
- Alternative: Detect OS and use appropriate shell

### 2. **Tool Version Compatibility**
- Extension version: `1.0.0` (from `package.json`)
- All tools in `alphanetix-mcp-tools-enhanced.json` have `min_extension_version: "1.0.0"`
- ✅ Compatible: No version conflicts

### 3. **Mode-Based Filtering**
- **ASK Mode**: Only tools with `modes.ask: true` (read-only)
  - `read_file`, `glob`, `ls`
- **AGENT Mode**: All tools including `modes.agent: true` (full access)
  - `write_file`, `edit_file`, `bash`

### 4. **Error Handling Strategy**
- Network errors: Retry with exponential backoff
- Tool execution errors: Return structured error to LLM
- Backend unavailable: Queue executions for later sync (optional)

### 5. **Performance Considerations**
- Tool execution logging should be async (fire-and-forget)
- Capability registration should cache results
- Large file reads should stream or chunk data

---

## File Structure After Phase 3

```
VscodePluginAlphanetix/
└── src/
    ├── mcp/
    │   ├── MCPService.ts (✅ update)
    │   ├── types.ts (✅ update)
    │   ├── FileTools.ts (❌ deprecate)
    │   ├── WorkspaceTools.ts (❌ deprecate)
    │   └── executors/
    │       ├── BaseExecutor.ts (🆕)
    │       ├── ExecutorRegistry.ts (🆕)
    │       ├── filesystem/
    │       │   ├── ReadFileExecutor.ts (🆕)
    │       │   ├── WriteFileExecutor.ts (🆕)
    │       │   ├── EditFileExecutor.ts (🆕)
    │       │   └── ListDirectoryExecutor.ts (🆕)
    │       ├── search/
    │       │   └── GlobExecutor.ts (🆕)
    │       └── shell/
    │           └── BashExecutor.ts (🆕)
    ├── services/
    │   ├── McpCapabilityService.ts (🆕)
    │   ├── ChatService.ts (🆕)
    │   ├── CompletionService.ts (✅ update)
    │   └── ... (existing)
    ├── state/
    │   └── StateManager.ts (✅ update)
    └── extension.ts (✅ update)
```

---

## Testing Strategy

### Unit Tests
1. **Executor Tests**: Each executor with mock VSCode APIs
2. **Service Tests**: McpCapabilityService with mock ApiClient
3. **Integration Tests**: Full flow from tool call to execution

### Manual Testing Checklist
- [ ] Extension activates and registers capabilities
- [ ] Capability registration succeeds with backend
- [ ] Tool intersection returns correct tools for ASK mode
- [ ] Tool intersection returns correct tools for AGENT mode
- [ ] Read file executor works with absolute paths
- [ ] Write file executor creates/updates files
- [ ] Edit file executor performs replacements
- [ ] Glob executor matches file patterns
- [ ] Ls executor lists directories
- [ ] Bash executor runs PowerShell commands
- [ ] Tool execution logging persists to backend
- [ ] Error handling gracefully degrades

---

## Implementation Order

### Priority 1 (Core Infrastructure)
1. ✅ Create `BaseExecutor.ts`
2. ✅ Create `ExecutorRegistry.ts`
3. ✅ Implement `ReadFileExecutor.ts`
4. ✅ Implement `WriteFileExecutor.ts`
5. ✅ Implement `EditFileExecutor.ts`

### Priority 2 (Capability System)
6. ✅ Create `McpCapabilityService.ts`
7. ✅ Update `extension.ts` for capability registration
8. ✅ Update `StateManager.ts` for session tracking

### Priority 3 (Additional Executors)
9. ✅ Implement `ListDirectoryExecutor.ts`
10. ✅ Implement `GlobExecutor.ts`
11. ✅ Implement `BashExecutor.ts`

### Priority 4 (Integration)
12. ✅ Update `CompletionService.ts` for tool execution
13. ✅ Create `ChatService.ts` for session management
14. ✅ Test end-to-end flow

---

## Risk Assessment

### High Risk
- **Tool execution security**: Bash executor can run arbitrary commands
  - **Mitigation**: Command validation, whitelist, user confirmation
- **File system operations**: Write/edit can corrupt files
  - **Mitigation**: Backup before write, undo tracking, read-first validation

### Medium Risk
- **Backend unavailability**: Extension depends on backend API
  - **Mitigation**: Graceful degradation, cached capabilities, retry logic
- **Version mismatches**: Extension and backend tool versions differ
  - **Mitigation**: Version negotiation via intersection API

### Low Risk
- **Performance**: Tool execution might slow down AI responses
  - **Mitigation**: Async logging, background execution, timeouts

---

## Success Criteria

### Phase 3.1 Complete ✅
- [ ] All 6 tool executors implemented and tested
- [ ] ExecutorRegistry manages all executors
- [ ] Tools execute successfully with valid inputs
- [ ] Errors are handled and reported properly

### Phase 3.2 Complete ✅
- [ ] McpCapabilityService loads tools from JSON
- [ ] Capability registration succeeds on activation
- [ ] Tool intersection returns correct tools per mode
- [ ] Transformed tools match provider schemas

### Phase 3.3 Complete ✅
- [ ] CompletionService parses and executes tool calls
- [ ] Tool execution loop works (message → tools → results → LLM)
- [ ] Tool executions are logged to backend
- [ ] Error handling prevents infinite loops

### Phase 3 Complete ✅
- [ ] Extension registers capabilities on startup
- [ ] LLM can invoke tools successfully
- [ ] Tool results are returned to LLM correctly
- [ ] All executions are logged to backend
- [ ] ASK mode restricts to read-only tools
- [ ] AGENT mode allows full tool access

---

## Next Steps After Phase 3

**Phase 4: Integration & Tool Execution Flow**
1. End-to-end testing with real LLM providers
2. Multi-turn conversation with tool execution
3. Error recovery and fallback mechanisms
4. User permission prompts for high-risk operations
5. Tool execution analytics dashboard

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-11-09  
**Author**: AI Platform Team
