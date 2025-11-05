import * as vscode from 'vscode';
import { 
    MCPTool, 
    MCPToolCall, 
    MCPToolResult, 
    MCPContent,
    WorkspaceInfo,
    EditorInfo,
    Position,
    SymbolInfo,
    SymbolKind,
    DependencyInfo
} from './types';

/**
 * Workspace context tools for MCP
 * Provides access to VS Code workspace information and active editor state
 */
export class WorkspaceTools {
    
    /**
     * Get all available workspace tools
     */
    public static getTools(): MCPTool[] {
        return [
            this.getWorkspaceInfoTool(),
            this.getActiveEditorTool(),
            this.getOpenEditorsTool(),
            this.getSelectionTool(),
            this.getCursorPositionTool(),
            this.getSymbolsTool(),
            this.getDefinitionTool(),
            this.getReferencesTool(),
            this.getHoverInfoTool(),
            this.getProblemsToolP(),
            this.getWorkspaceSymbolsTool()
        ];
    }

    /**
     * Execute a workspace tool
     */
    public static async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
        try {
            switch (toolCall.name) {
                case 'get_workspace_info':
                    return await this.getWorkspaceInfo(toolCall.arguments);
                case 'get_active_editor':
                    return await this.getActiveEditor(toolCall.arguments);
                case 'get_open_editors':
                    return await this.getOpenEditors(toolCall.arguments);
                case 'get_selection':
                    return await this.getSelection(toolCall.arguments);
                case 'get_cursor_position':
                    return await this.getCursorPosition(toolCall.arguments);
                case 'get_symbols':
                    return await this.getSymbols(toolCall.arguments);
                case 'get_definition':
                    return await this.getDefinition(toolCall.arguments);
                case 'get_references':
                    return await this.getReferences(toolCall.arguments);
                case 'get_hover_info':
                    return await this.getHoverInfo(toolCall.arguments);
                case 'get_problems':
                    return await this.getProblems(toolCall.arguments);
                case 'get_workspace_symbols':
                    return await this.getWorkspaceSymbols(toolCall.arguments);
                default:
                    return {
                        isError: true,
                        content: [{
                            type: 'text',
                            text: `Unknown workspace tool: ${toolCall.name}`
                        }]
                    };
            }
        } catch (error) {
            return {
                isError: true,
                content: [{
                    type: 'text',
                    text: `Error executing ${toolCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
            };
        }
    }

    // Tool Definitions
    private static getWorkspaceInfoTool(): MCPTool {
        return {
            name: 'get_workspace_info',
            description: 'Get comprehensive information about the current workspace including folders, settings, and structure.',
            inputSchema: {
                type: 'object',
                properties: {
                    includeSettings: {
                        type: 'boolean',
                        description: 'Include workspace settings in the response',
                        default: false
                    },
                    includeExtensions: {
                        type: 'boolean',
                        description: 'Include installed extensions information',
                        default: false
                    }
                }
            }
        };
    }

    private static getActiveEditorTool(): MCPTool {
        return {
            name: 'get_active_editor',
            description: 'Get detailed information about the currently active editor including content, language, and state.',
            inputSchema: {
                type: 'object',
                properties: {
                    includeContent: {
                        type: 'boolean',
                        description: 'Include the full file content',
                        default: true
                    },
                    maxContentLength: {
                        type: 'number',
                        description: 'Maximum content length to include (0 = no limit)',
                        default: 50000
                    }
                }
            }
        };
    }

    private static getOpenEditorsTool(): MCPTool {
        return {
            name: 'get_open_editors',
            description: 'Get information about all currently open editors in the workspace.',
            inputSchema: {
                type: 'object',
                properties: {
                    includeContent: {
                        type: 'boolean',
                        description: 'Include file content for each editor',
                        default: false
                    },
                    onlyVisible: {
                        type: 'boolean',
                        description: 'Only include visible editors',
                        default: false
                    }
                }
            }
        };
    }

    private static getSelectionTool(): MCPTool {
        return {
            name: 'get_selection',
            description: 'Get the current text selection in the active editor.',
            inputSchema: {
                type: 'object',
                properties: {
                    includeContext: {
                        type: 'boolean',
                        description: 'Include surrounding context lines',
                        default: true
                    },
                    contextLines: {
                        type: 'number',
                        description: 'Number of context lines before and after selection',
                        default: 3
                    }
                }
            }
        };
    }

    private static getCursorPositionTool(): MCPTool {
        return {
            name: 'get_cursor_position',
            description: 'Get the current cursor position and surrounding context in the active editor.',
            inputSchema: {
                type: 'object',
                properties: {
                    includeContext: {
                        type: 'boolean',
                        description: 'Include surrounding context',
                        default: true
                    },
                    contextLines: {
                        type: 'number',
                        description: 'Number of context lines around cursor',
                        default: 5
                    }
                }
            }
        };
    }

    private static getSymbolsTool(): MCPTool {
        return {
            name: 'get_symbols',
            description: 'Get document symbols (classes, functions, variables) from the specified file.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file (uses active editor if not specified)'
                    },
                    symbolKind: {
                        type: 'string',
                        description: 'Filter by symbol kind (class, function, variable, etc.)'
                    },
                    includeLocation: {
                        type: 'boolean',
                        description: 'Include location information for each symbol',
                        default: true
                    }
                }
            }
        };
    }

    private static getDefinitionTool(): MCPTool {
        return {
            name: 'get_definition',
            description: 'Get the definition location of the symbol at the specified position.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file (uses active editor if not specified)'
                    },
                    line: {
                        type: 'number',
                        description: 'Line number (0-based)'
                    },
                    character: {
                        type: 'number',
                        description: 'Character position (0-based)'
                    },
                    includeContent: {
                        type: 'boolean',
                        description: 'Include content at definition location',
                        default: true
                    }
                },
                required: ['line', 'character']
            }
        };
    }

    private static getReferencesTool(): MCPTool {
        return {
            name: 'get_references',
            description: 'Find all references to the symbol at the specified position.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file (uses active editor if not specified)'
                    },
                    line: {
                        type: 'number',
                        description: 'Line number (0-based)'
                    },
                    character: {
                        type: 'number',
                        description: 'Character position (0-based)'
                    },
                    includeDeclaration: {
                        type: 'boolean',
                        description: 'Include the declaration in results',
                        default: true
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of references to return',
                        default: 100
                    }
                },
                required: ['line', 'character']
            }
        };
    }

    private static getHoverInfoTool(): MCPTool {
        return {
            name: 'get_hover_info',
            description: 'Get hover information (type, documentation) for the symbol at the specified position.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file (uses active editor if not specified)'
                    },
                    line: {
                        type: 'number',
                        description: 'Line number (0-based)'
                    },
                    character: {
                        type: 'number',
                        description: 'Character position (0-based)'
                    }
                },
                required: ['line', 'character']
            }
        };
    }

    private static getProblemsToolP(): MCPTool {
        return {
            name: 'get_problems',
            description: 'Get diagnostic problems (errors, warnings) for the specified file or entire workspace.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Path to the file (all files if not specified)'
                    },
                    severity: {
                        type: 'string',
                        enum: ['error', 'warning', 'information', 'hint'],
                        description: 'Filter by problem severity'
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of problems to return',
                        default: 50
                    }
                }
            }
        };
    }

    private static getWorkspaceSymbolsTool(): MCPTool {
        return {
            name: 'get_workspace_symbols',
            description: 'Search for symbols across the entire workspace.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Symbol name or pattern to search for'
                    },
                    symbolKind: {
                        type: 'string',
                        description: 'Filter by symbol kind'
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of symbols to return',
                        default: 100
                    }
                },
                required: ['query']
            }
        };
    }

    // Tool Implementations
    private static async getWorkspaceInfo(args: any): Promise<MCPToolResult> {
        const { includeSettings = false, includeExtensions = false } = args;
        
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const activeEditor = vscode.window.activeTextEditor;
        const openEditors = vscode.window.visibleTextEditors;

        const workspaceInfo: WorkspaceInfo = {
            name: vscode.workspace.name,
            rootPath: workspaceFolders[0]?.uri.fsPath || '',
            folders: workspaceFolders.map(folder => folder.uri.fsPath),
            activeEditor: activeEditor ? await this.getEditorInfo(activeEditor, false) : undefined,
            openEditors: await Promise.all(openEditors.map(editor => this.getEditorInfo(editor, false)))
        };

        let content = `Workspace: ${workspaceInfo.name || 'Untitled'}
Root Path: ${workspaceInfo.rootPath}
Folders: ${workspaceInfo.folders.length}
  ${workspaceInfo.folders.join('\n  ')}
Active Editor: ${workspaceInfo.activeEditor?.fileName || 'None'}
Open Editors: ${workspaceInfo.openEditors.length}`;

        if (includeSettings) {
            const config = vscode.workspace.getConfiguration();
            content += '\n\nWorkspace Settings:\n' + JSON.stringify(config, null, 2);
        }

        if (includeExtensions) {
            const extensions = vscode.extensions.all.filter(ext => ext.isActive);
            content += `\n\nActive Extensions: ${extensions.length}`;
            content += '\n' + extensions.map(ext => `  ${ext.id} (${ext.packageJSON.version})`).join('\n');
        }

        return {
            content: [{
                type: 'text',
                text: content,
                annotations: [{
                    type: 'source_location',
                    workspaceFolders: workspaceInfo.folders.length,
                    openEditors: workspaceInfo.openEditors.length
                }]
            }]
        };
    }

    private static async getActiveEditor(args: any): Promise<MCPToolResult> {
        const { includeContent = true, maxContentLength = 50000 } = args;
        
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return {
                content: [{
                    type: 'text',
                    text: 'No active editor'
                }]
            };
        }

        const editorInfo = await this.getEditorInfo(activeEditor, includeContent, maxContentLength);
        
        let content = `Active Editor: ${editorInfo.fileName}
Language: ${editorInfo.languageId}
Lines: ${editorInfo.lineCount}
Is Dirty: ${editorInfo.isDirty}`;

        if (editorInfo.selection) {
            content += `\nSelection: Line ${editorInfo.selection.start.line + 1}-${editorInfo.selection.end.line + 1}`;
            content += `\nSelected Text: "${editorInfo.selection.text}"`;
        }

        if (editorInfo.cursorPosition) {
            content += `\nCursor: Line ${editorInfo.cursorPosition.line + 1}, Column ${editorInfo.cursorPosition.character + 1}`;
        }

        if (includeContent && editorInfo.content) {
            content += '\n\n--- File Content ---\n' + editorInfo.content;
        }

        return {
            content: [{
                type: 'text',
                text: content,
                annotations: [{
                    type: 'source_location',
                    filePath: editorInfo.fileName,
                    languageId: editorInfo.languageId,
                    lineCount: editorInfo.lineCount
                }]
            }]
        };
    }

    private static async getOpenEditors(args: any): Promise<MCPToolResult> {
        const { includeContent = false, onlyVisible = false } = args;
        
        const editors = onlyVisible ? vscode.window.visibleTextEditors : vscode.window.tabGroups.all.flatMap(group => 
            group.tabs.map(tab => tab.input).filter(input => 
                input instanceof vscode.TabInputText
            ).map(input => vscode.window.visibleTextEditors.find(editor => 
                editor.document.uri.toString() === (input as vscode.TabInputText).uri.toString()
            )).filter(Boolean)
        ) as vscode.TextEditor[];

        const editorInfos = await Promise.all(
            editors.map(editor => this.getEditorInfo(editor, includeContent))
        );

        const content = editorInfos.map(info => 
            `${info.fileName} (${info.languageId}) - ${info.lineCount} lines${info.isDirty ? ' [modified]' : ''}`
        ).join('\n');

        return {
            content: [{
                type: 'text',
                text: content || 'No open editors',
                annotations: [{
                    type: 'source_location',
                    editorCount: editorInfos.length
                }]
            }]
        };
    }

    private static async getSelection(args: any): Promise<MCPToolResult> {
        const { includeContext = true, contextLines = 3 } = args;
        
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return {
                content: [{
                    type: 'text',
                    text: 'No active editor'
                }]
            };
        }

        const selection = activeEditor.selection;
        if (selection.isEmpty) {
            return {
                content: [{
                    type: 'text',
                    text: 'No text selected'
                }]
            };
        }

        const selectedText = activeEditor.document.getText(selection);
        let content = `Selection: Line ${selection.start.line + 1}-${selection.end.line + 1}, Characters ${selection.start.character}-${selection.end.character}
Selected Text:
${selectedText}`;

        if (includeContext) {
            const startLine = Math.max(0, selection.start.line - contextLines);
            const endLine = Math.min(activeEditor.document.lineCount - 1, selection.end.line + contextLines);
            
            const contextRange = new vscode.Range(startLine, 0, endLine, activeEditor.document.lineAt(endLine).text.length);
            const contextText = activeEditor.document.getText(contextRange);
            
            content += '\n\n--- Context ---\n' + contextText;
        }

        return {
            content: [{
                type: 'text',
                text: content,
                annotations: [{
                    type: 'source_location',
                    filePath: activeEditor.document.fileName,
                    selectionStart: selection.start,
                    selectionEnd: selection.end
                }]
            }]
        };
    }

    private static async getCursorPosition(args: any): Promise<MCPToolResult> {
        const { includeContext = true, contextLines = 5 } = args;
        
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return {
                content: [{
                    type: 'text',
                    text: 'No active editor'
                }]
            };
        }

        const position = activeEditor.selection.active;
        const line = activeEditor.document.lineAt(position.line);
        
        let content = `Cursor Position: Line ${position.line + 1}, Column ${position.character + 1}
Current Line: ${line.text}`;

        if (includeContext) {
            const startLine = Math.max(0, position.line - contextLines);
            const endLine = Math.min(activeEditor.document.lineCount - 1, position.line + contextLines);
            
            const contextLines_text = [];
            for (let i = startLine; i <= endLine; i++) {
                const prefix = i === position.line ? '>>> ' : '    ';
                contextLines_text.push(`${prefix}${i + 1}: ${activeEditor.document.lineAt(i).text}`);
            }
            
            content += '\n\n--- Context ---\n' + contextLines_text.join('\n');
        }

        return {
            content: [{
                type: 'text',
                text: content,
                annotations: [{
                    type: 'source_location',
                    filePath: activeEditor.document.fileName,
                    cursorPosition: position
                }]
            }]
        };
    }

    private static async getSymbols(args: any): Promise<MCPToolResult> {
        const { filePath, symbolKind, includeLocation = true } = args;
        
        let document: vscode.TextDocument;
        
        if (filePath) {
            document = await vscode.workspace.openTextDocument(filePath);
        } else {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                return {
                    content: [{
                        type: 'text',
                        text: 'No active editor and no file path specified'
                    }]
                };
            }
            document = activeEditor.document;
        }

        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        ) || [];

        const flatSymbols = this.flattenSymbols(symbols);
        
        const filteredSymbols = symbolKind 
            ? flatSymbols.filter(symbol => this.getSymbolKindName(symbol.kind).toLowerCase() === symbolKind.toLowerCase())
            : flatSymbols;

        const content = filteredSymbols.map(symbol => {
            let line = `${this.getSymbolKindName(symbol.kind)}: ${symbol.name}`;
            if (symbol.containerName) {
                line += ` (in ${symbol.containerName})`;
            }
            if (includeLocation) {
                line += ` - Line ${symbol.range.start.line + 1}`;
            }
            return line;
        }).join('\n');

        return {
            content: [{
                type: 'text',
                text: content || 'No symbols found',
                annotations: [{
                    type: 'source_location',
                    filePath: document.fileName,
                    symbolCount: filteredSymbols.length
                }]
            }]
        };
    }

    private static async getDefinition(args: any): Promise<MCPToolResult> {
        const { filePath, line, character, includeContent = true } = args;
        
        let document: vscode.TextDocument;
        
        if (filePath) {
            document = await vscode.workspace.openTextDocument(filePath);
        } else {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                return {
                    content: [{
                        type: 'text',
                        text: 'No active editor and no file path specified'
                    }]
                };
            }
            document = activeEditor.document;
        }

        const position = new vscode.Position(line, character);
        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            document.uri,
            position
        ) || [];

        if (definitions.length === 0) {
            return {
                content: [{
                    type: 'text',
                    text: 'No definition found'
                }]
            };
        }

        const definition = definitions[0];
        let content = `Definition found: ${definition.uri.fsPath}
Line: ${definition.range.start.line + 1}
Character: ${definition.range.start.character + 1}`;

        if (includeContent) {
            const defDocument = await vscode.workspace.openTextDocument(definition.uri);
            const defText = defDocument.getText(definition.range);
            content += '\n\n--- Definition ---\n' + defText;
        }

        return {
            content: [{
                type: 'text',
                text: content,
                annotations: [{
                    type: 'source_location',
                    sourceFile: document.fileName,
                    definitionFile: definition.uri.fsPath,
                    definitionLine: definition.range.start.line + 1
                }]
            }]
        };
    }

    private static async getReferences(args: any): Promise<MCPToolResult> {
        const { filePath, line, character, includeDeclaration = true, maxResults = 100 } = args;
        
        let document: vscode.TextDocument;
        
        if (filePath) {
            document = await vscode.workspace.openTextDocument(filePath);
        } else {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                return {
                    content: [{
                        type: 'text',
                        text: 'No active editor and no file path specified'
                    }]
                };
            }
            document = activeEditor.document;
        }

        const position = new vscode.Position(line, character);
        const references = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            document.uri,
            position,
            { includeDeclaration }
        ) || [];

        const limitedReferences = references.slice(0, maxResults);
        
        const content = limitedReferences.map((ref, index) => 
            `${index + 1}. ${ref.uri.fsPath}:${ref.range.start.line + 1}:${ref.range.start.character + 1}`
        ).join('\n');

        return {
            content: [{
                type: 'text',
                text: content || 'No references found',
                annotations: [{
                    type: 'source_location',
                    sourceFile: document.fileName,
                    referenceCount: limitedReferences.length,
                    totalFound: references.length
                }]
            }]
        };
    }

    private static async getHoverInfo(args: any): Promise<MCPToolResult> {
        const { filePath, line, character } = args;
        
        let document: vscode.TextDocument;
        
        if (filePath) {
            document = await vscode.workspace.openTextDocument(filePath);
        } else {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                return {
                    content: [{
                        type: 'text',
                        text: 'No active editor and no file path specified'
                    }]
                };
            }
            document = activeEditor.document;
        }

        const position = new vscode.Position(line, character);
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
            'vscode.executeHoverProvider',
            document.uri,
            position
        ) || [];

        if (hovers.length === 0) {
            return {
                content: [{
                    type: 'text',
                    text: 'No hover information available'
                }]
            };
        }

        const hoverTexts = hovers.map(hover => 
            hover.contents.map(content => 
                typeof content === 'string' ? content : content.value
            ).join('\n')
        ).join('\n\n');

        return {
            content: [{
                type: 'text',
                text: hoverTexts,
                annotations: [{
                    type: 'source_location',
                    filePath: document.fileName,
                    hoverPosition: position
                }]
            }]
        };
    }

    private static async getProblems(args: any): Promise<MCPToolResult> {
        const { filePath, severity, maxResults = 50 } = args;
        
        let diagnostics: [vscode.Uri, vscode.Diagnostic[]][];
        
        if (filePath) {
            const uri = vscode.Uri.file(filePath);
            const fileDiagnostics = vscode.languages.getDiagnostics(uri);
            diagnostics = [[uri, fileDiagnostics]];
        } else {
            diagnostics = vscode.languages.getDiagnostics();
        }

        const allProblems: Array<{ uri: vscode.Uri; diagnostic: vscode.Diagnostic }> = [];
        
        for (const [uri, fileDiagnostics] of diagnostics) {
            for (const diagnostic of fileDiagnostics) {
                if (!severity || this.getSeverityName(diagnostic.severity) === severity) {
                    allProblems.push({ uri, diagnostic });
                }
            }
        }

        const limitedProblems = allProblems.slice(0, maxResults);
        
        const content = limitedProblems.map((problem, index) => {
            const { uri, diagnostic } = problem;
            const severityName = this.getSeverityName(diagnostic.severity);
            return `${index + 1}. [${severityName}] ${uri.fsPath}:${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1}
   ${diagnostic.message}
   Source: ${diagnostic.source || 'Unknown'}`;
        }).join('\n\n');

        return {
            content: [{
                type: 'text',
                text: content || 'No problems found',
                annotations: [{
                    type: 'source_location',
                    problemCount: limitedProblems.length,
                    totalFound: allProblems.length,
                    severity
                }]
            }]
        };
    }

    private static async getWorkspaceSymbols(args: any): Promise<MCPToolResult> {
        const { query, symbolKind, maxResults = 100 } = args;
        
        const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            query
        ) || [];

        const filteredSymbols = symbolKind 
            ? symbols.filter(symbol => this.getSymbolKindName(symbol.kind).toLowerCase() === symbolKind.toLowerCase())
            : symbols;

        const limitedSymbols = filteredSymbols.slice(0, maxResults);
        
        const content = limitedSymbols.map((symbol, index) => {
            const kindName = this.getSymbolKindName(symbol.kind);
            return `${index + 1}. [${kindName}] ${symbol.name}
   ${symbol.location.uri.fsPath}:${symbol.location.range.start.line + 1}
   Container: ${symbol.containerName || 'None'}`;
        }).join('\n\n');

        return {
            content: [{
                type: 'text',
                text: content || 'No symbols found',
                annotations: [{
                    type: 'source_location',
                    query,
                    symbolCount: limitedSymbols.length,
                    totalFound: filteredSymbols.length
                }]
            }]
        };
    }

    // Helper methods
    private static async getEditorInfo(editor: vscode.TextEditor, includeContent = false, maxContentLength = 50000): Promise<EditorInfo> {
        const document = editor.document;
        const selection = editor.selection;
        
        let content: string | undefined;
        if (includeContent) {
            content = document.getText();
            if (maxContentLength > 0 && content.length > maxContentLength) {
                content = content.substring(0, maxContentLength) + '\n\n... (content truncated)';
            }
        }

        return {
            fileName: document.fileName,
            languageId: document.languageId,
            content,
            selection: selection.isEmpty ? undefined : {
                start: { line: selection.start.line, character: selection.start.character },
                end: { line: selection.end.line, character: selection.end.character },
                text: document.getText(selection)
            },
            cursorPosition: { line: selection.active.line, character: selection.active.character },
            isDirty: document.isDirty,
            lineCount: document.lineCount
        };
    }

    private static flattenSymbols(symbols: vscode.DocumentSymbol[], containerName = ''): Array<vscode.DocumentSymbol & { containerName?: string }> {
        const result: Array<vscode.DocumentSymbol & { containerName?: string }> = [];
        
        for (const symbol of symbols) {
            const symbolWithContainer = { ...symbol, containerName };
            result.push(symbolWithContainer);
            
            if (symbol.children && symbol.children.length > 0) {
                const childSymbols = this.flattenSymbols(symbol.children, symbol.name);
                result.push(...childSymbols);
            }
        }
        
        return result;
    }

    private static getSymbolKindName(kind: vscode.SymbolKind): string {
        const kindNames = [
            'File', 'Module', 'Namespace', 'Package', 'Class', 'Method', 'Property', 'Field',
            'Constructor', 'Enum', 'Interface', 'Function', 'Variable', 'Constant', 'String',
            'Number', 'Boolean', 'Array', 'Object', 'Key', 'Null', 'EnumMember', 'Struct',
            'Event', 'Operator', 'TypeParameter'
        ];
        return kindNames[kind] || 'Unknown';
    }

    private static getSeverityName(severity: vscode.DiagnosticSeverity): string {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error: return 'error';
            case vscode.DiagnosticSeverity.Warning: return 'warning';
            case vscode.DiagnosticSeverity.Information: return 'information';
            case vscode.DiagnosticSeverity.Hint: return 'hint';
            default: return 'unknown';
        }
    }
}