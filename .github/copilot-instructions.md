## Quick orientation for AI coding agents

This repository contains three main deliverables you should know about:

- `VscodePluginAlphanetix` — the VS Code extension (TypeScript). Primary entry: `src/extension.ts`.
- `AlphanetixAI` — the Java Spring Boot backend (Maven). See `pom.xml`, `mvnw`, and `docker-compose.yml` at the project root.
- `AlphanetixAI-Web` — the React/TypeScript frontend. See `package.json` and `src/`.

Focus for small, high-value changes:

- Extension behavior and UI: `VscodePluginAlphanetix/src/*` (notably `extension.ts`, `state/`, `services/`, `providers/`, `views/`).
- MCP (Model Context Protocol) tooling: `VscodePluginAlphanetix/src/mcp/**` — contains the core executor registry, tool definitions and safety/mode rules. See `src/mcp/README.md` and `src/mcp/executors/README.md` for the design.
- Tool definitions JSON: `AlphanetixAI/alphanetix-mcp-tools-enhanced.json` — authoritative source for tool capabilities and risk/mode settings.

Concrete architecture notes (why things are structured this way):

- The extension initializes a singleton StateManager and McpCapabilityService in `src/extension.ts`. The MCP subsystem is intentionally isolated so LLMs can request tool calls (ask vs agent modes) while the extension mediates execution and safety.
- Mode-based access control: many executors and tools declare `ask` (read-only, safe) vs `agent` (destructive) modes. Executors implement read-first validation and user confirmation for high-risk operations. See `src/mcp/*` to find the validation helpers and executor base classes.
- Token and session state are stored via the extension `StateManager` and VS Code secret storage (see `state/StateManager.ts` referenced from `extension.ts`). Authentication callbacks are handled via a URI handler in `extension.ts` (`handleAuthCallback`).

Developer workflows and exact commands (repo-specific):

- VS Code extension (dev):
  - Install deps and compile: `npm install` then `npm run compile` (see `VscodePluginAlphanetix/package.json`).
  - Watch and iterate: `npm run watch` and use VS Code "Run Extension" (F5) to open an Extension Development Host.
  - Package: `npm run package` (uses `vsce`).
  - Tests: `npm run test` (runs compiled tests under `out/test`).

- Frontend (AlphanetixAI-Web):
  - Install and run: `npm install` then `npm start` (dev server at localhost:3000 by default — see `AlphanetixAI-Web/README.md`).

- Backend (AlphanetixAI):
  - Maven wrapper: `./mvnw spring-boot:run` (or `mvn spring-boot:run`) from the `AlphanetixAI` folder.
  - Or use Docker Compose if you prefer: `docker-compose up -d` from the `AlphanetixAI` folder (repo includes `docker-compose.yml`).

Project-specific conventions and patterns (concrete highlights):

- Singletons by design: many services use `getInstance()` singletons (e.g., `McpCapabilityService`, `AuthService`, `StateManager`). When modifying stateful services, prefer using the existing singleton accessor rather than creating new instances.
- Read-first safety for file-modifying tools: write/edit executors expect the file to be read first; editing flows validate current content before applying changes. See `executors/*` README and `BaseExecutor` helpers for validation functions like `validateRequired` and `validateType`.
- MCP execution flow: LLM => ToolExecutionService.parseToolCalls() => ExecutorRegistry => Executor.executeInternal(). The chain formats results for the LLM and logs executions to the backend. See `src/mcp/README.md` for the sequence diagram and `extension.ts` to see initialization.
- UI/UX: status bar text and webview-based main view are updated via `updateStatusBar()` and `MainViewProvider` in `extension.ts`. Small UI changes often require both TypeScript changes and regenerated build artifacts (`npm run compile`).

Integration points and external dependencies to call out:

- Backend API: default base URL is `http://localhost:9100` configured in extension settings (`alphanetix.apiUrl` in `package.json`). Tests and dev runs usually expect backend at that address.
- Tool definitions file: `AlphanetixAI/alphanetix-mcp-tools-enhanced.json` — change here to add or change tool metadata (modes, risk, schemas). After changing tool JSON you must ensure `McpCapabilityService` picks up the new definitions (it caches after first load).
- Providers for providers/LLM formats: Tool formatting supports multiple LLM providers (OpenAI, Anthropic, Gemini). The transformation templates live near the MCP tooling and are applied by `ToolExecutionService`.

Useful examples the agent can reference when making edits (copy/paste friendly):

- Initialize MCP in the extension: `McpCapabilityService.getInstance().initialize()` (see `src/extension.ts`).
- Check tools available: `mcpCapabilityService.isToolsAvailable()` — used to switch chat-only vs full tool execution mode.
- Debug command that summarizes extension state: command handler `alphanetix.debugExtension` in `src/extension.ts` — shows how to collect state manager, auth, and MCP info.

Small contract (inputs/outputs) for typical edits you may implement:

- Input: TypeScript code changes to `src/*` (extension or MCP) — must compile to `out/` using TypeScript config.
- Output: Updated extension behavior and/or new/modified tool definitions. Success criteria: `npm run compile` completes with no TS errors and extension activation (in Extension Development Host) behaves as expected.

Edge cases to watch for (common failure modes in this repo):

- Changing tool definitions without updating consumers: `McpCapabilityService` caches tool metadata — restart extension host or clear cache after updating JSON.
- Token/auth flows: ensure `handleAuthCallback()` URI parsing matches any changes to how the backend sends tokens.
- File-editing safety: edits must include read-first checks and be atomic when multiple edits are performed.

If you change runtime behavior, prefer adding a short unit or integration test under `src/test` and run `npm run test` after `npm run compile`.

If anything is unclear or you need examples of a specific pattern (executor implementation, tool JSON schema, or auth flow), tell me which area and I will add a short, focused example or expand this doc.
