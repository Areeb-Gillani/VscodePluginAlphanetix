import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
    MCPTool, 
    MCPToolCall, 
    MCPToolResult, 
    MCPContent,
    FileReadOptions,
    FileWriteOptions,
    DirectoryEntry,
    SearchOptions,
    SearchResult
} from './types';

/**
 * File operation tools for MCP
 * Provides safe file system access for AI interactions
 */
export class FileTools {
    
    /**
     * Get all available file tools
     */
    public static getTools(): MCPTool[] {
        return [
            this.getReadFileTool(),
            this.getWriteFileTool(),
            this.getListDirectoryTool(),
            this.getSearchWorkspaceTool(),
            this.getFileStatsTool(),
            this.getCreateFileTool(),
            this.getDeleteFileTool(),
            this.getMoveFileTool()
        ];
    }

    /**
     * Execute a file tool
     */
    public static async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
        try {
            switch (toolCall.name) {
                case 'read_file':
                    return await this.readFile(toolCall.arguments);
                case 'write_file':
                    return await this.writeFile(toolCall.arguments);
                case 'list_directory':
                    return await this.listDirectory(toolCall.arguments);
                case 'search_workspace':
                    return await this.searchWorkspace(toolCall.arguments);
                case 'get_file_stats':
                    return await this.getFileStats(toolCall.arguments);
                case 'create_file':
                    return await this.createFile(toolCall.arguments);
                case 'delete_file':
                    return await this.deleteFile(toolCall.arguments);
                case 'move_file':
                    return await this.moveFile(toolCall.arguments);
                default:
                    return {
                        isError: true,
                        content: [{
                            type: 'text',
                            text: `Unknown file tool: ${toolCall.name}`
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
    private static getReadFileTool(): MCPTool {
        return {
            name: 'read_file',
            description: 'Read the contents of a file. Supports various encodings and partial reading.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Absolute or workspace-relative path to the file'
                    },
                    encoding: {
                        type: 'string',
                        enum: ['utf8', 'utf16le', 'latin1', 'base64', 'hex', 'ascii', 'binary', 'ucs2'],
                        description: 'Text encoding for reading the file',
                        default: 'utf8'
                    },
                    start: {
                        type: 'number',
                        description: 'Start byte position for partial reading'
                    },
                    end: {
                        type: 'number',
                        description: 'End byte position for partial reading'
                    }
                },
                required: ['filePath']
            }
        };
    }

    private static getWriteFileTool(): MCPTool {
        return {
            name: 'write_file',
            description: 'Write content to a file. Creates the file if it doesn\'t exist.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Absolute or workspace-relative path to the file'
                    },
                    content: {
                        type: 'string',
                        description: 'Content to write to the file'
                    },
                    encoding: {
                        type: 'string',
                        enum: ['utf8', 'utf16le', 'latin1', 'base64', 'hex', 'ascii', 'binary', 'ucs2'],
                        description: 'Text encoding for writing the file',
                        default: 'utf8'
                    },
                    createDirectory: {
                        type: 'boolean',
                        description: 'Create parent directories if they don\'t exist',
                        default: true
                    }
                },
                required: ['filePath', 'content']
            }
        };
    }

    private static getListDirectoryTool(): MCPTool {
        return {
            name: 'list_directory',
            description: 'List contents of a directory with file type and metadata.',
            inputSchema: {
                type: 'object',
                properties: {
                    directoryPath: {
                        type: 'string',
                        description: 'Absolute or workspace-relative path to the directory'
                    },
                    recursive: {
                        type: 'boolean',
                        description: 'List contents recursively',
                        default: false
                    },
                    includeHidden: {
                        type: 'boolean',
                        description: 'Include hidden files and directories',
                        default: false
                    },
                    maxDepth: {
                        type: 'number',
                        description: 'Maximum depth for recursive listing',
                        default: 10
                    }
                },
                required: ['directoryPath']
            }
        };
    }

    private static getSearchWorkspaceTool(): MCPTool {
        return {
            name: 'search_workspace',
            description: 'Search for text patterns across the workspace with advanced filtering.',
            inputSchema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query or pattern'
                    },
                    isRegex: {
                        type: 'boolean',
                        description: 'Treat query as regular expression',
                        default: false
                    },
                    isCaseSensitive: {
                        type: 'boolean',
                        description: 'Case sensitive search',
                        default: false
                    },
                    includePattern: {
                        type: 'string',
                        description: 'Glob pattern for files to include (e.g., "**/*.ts")'
                    },
                    excludePattern: {
                        type: 'string',
                        description: 'Glob pattern for files to exclude'
                    },
                    maxResults: {
                        type: 'number',
                        description: 'Maximum number of results to return',
                        default: 100
                    },
                    contextLines: {
                        type: 'number',
                        description: 'Number of context lines before and after each match',
                        default: 2
                    }
                },
                required: ['query']
            }
        };
    }

    private static getFileStatsTool(): MCPTool {
        return {
            name: 'get_file_stats',
            description: 'Get detailed metadata about a file or directory.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Absolute or workspace-relative path to the file'
                    }
                },
                required: ['filePath']
            }
        };
    }

    private static getCreateFileTool(): MCPTool {
        return {
            name: 'create_file',
            description: 'Create a new file with optional initial content.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Absolute or workspace-relative path for the new file'
                    },
                    content: {
                        type: 'string',
                        description: 'Initial content for the file',
                        default: ''
                    },
                    overwrite: {
                        type: 'boolean',
                        description: 'Overwrite existing file if it exists',
                        default: false
                    }
                },
                required: ['filePath']
            }
        };
    }

    private static getDeleteFileTool(): MCPTool {
        return {
            name: 'delete_file',
            description: 'Delete a file or directory. Use with caution.',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: {
                        type: 'string',
                        description: 'Absolute or workspace-relative path to delete'
                    },
                    recursive: {
                        type: 'boolean',
                        description: 'Delete directories recursively',
                        default: false
                    },
                    force: {
                        type: 'boolean',
                        description: 'Force deletion without confirmation',
                        default: false
                    }
                },
                required: ['filePath']
            }
        };
    }

    private static getMoveFileTool(): MCPTool {
        return {
            name: 'move_file',
            description: 'Move or rename a file or directory.',
            inputSchema: {
                type: 'object',
                properties: {
                    sourcePath: {
                        type: 'string',
                        description: 'Current path of the file or directory'
                    },
                    destinationPath: {
                        type: 'string',
                        description: 'New path for the file or directory'
                    },
                    overwrite: {
                        type: 'boolean',
                        description: 'Overwrite destination if it exists',
                        default: false
                    }
                },
                required: ['sourcePath', 'destinationPath']
            }
        };
    }

    // Tool Implementations
    private static async readFile(args: any): Promise<MCPToolResult> {
        const { filePath, encoding = 'utf8', start, end } = args;
        const absolutePath = this.resolveWorkspacePath(filePath);

        await this.checkFileAccess(absolutePath, 'read');

        const options: FileReadOptions = { encoding };
        if (start !== undefined) options.start = start;
        if (end !== undefined) options.end = end;

        const content = await fs.readFile(absolutePath, options);

        return {
            content: [{
                type: 'text',
                text: content.toString(),
                annotations: [{
                    type: 'source_location',
                    filePath: absolutePath,
                    encoding,
                    size: content.length
                }]
            }]
        };
    }

    private static async writeFile(args: any): Promise<MCPToolResult> {
        const { filePath, content, encoding = 'utf8', createDirectory = true } = args;
        const absolutePath = this.resolveWorkspacePath(filePath);

        // Check if we need to create parent directories
        if (createDirectory) {
            const dir = path.dirname(absolutePath);
            await fs.mkdir(dir, { recursive: true });
        }

        // Check file access (will check directory if file doesn't exist)
        await this.checkFileAccess(absolutePath, 'write');

        await fs.writeFile(absolutePath, content, { encoding });

        // Open the file in VS Code if it's not already open
        try {
            const document = await vscode.workspace.openTextDocument(absolutePath);
            await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
        } catch {
            // Ignore if we can't open the file in editor
        }

        return {
            content: [{
                type: 'text',
                text: `File written successfully: ${filePath}`,
                annotations: [{
                    type: 'source_location',
                    filePath: absolutePath,
                    action: 'write',
                    size: content.length
                }]
            }]
        };
    }

    private static async listDirectory(args: any): Promise<MCPToolResult> {
        const { directoryPath, recursive = false, includeHidden = false, maxDepth = 10 } = args;
        const absolutePath = this.resolveWorkspacePath(directoryPath);

        await this.checkFileAccess(absolutePath, 'read');

        const entries = await this.listDirectoryRecursive(
            absolutePath, 
            recursive, 
            includeHidden, 
            maxDepth, 
            0
        );

        const content = entries.map(entry => 
            `${entry.type === 'directory' ? '📁' : '📄'} ${entry.name} (${entry.path})`
        ).join('\n');

        return {
            content: [{
                type: 'text',
                text: content,
                annotations: [{
                    type: 'source_location',
                    directoryPath: absolutePath,
                    entryCount: entries.length
                }]
            }]
        };
    }

    private static async searchWorkspace(args: any): Promise<MCPToolResult> {
        const { 
            query, 
            isRegex = false, 
            isCaseSensitive = false, 
            includePattern, 
            excludePattern, 
            maxResults = 100,
            contextLines = 2 
        } = args;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder open');
        }

        // Use VS Code's built-in search capabilities
        const results: SearchResult[] = [];
        
        // For now, implement a simple file-based search
        // In a production implementation, you'd want to use ripgrep or similar
        const pattern = isRegex ? new RegExp(query, isCaseSensitive ? 'g' : 'gi') : query;
        
        for (const folder of workspaceFolders) {
            const files = await this.findFiles(folder.uri.fsPath, includePattern, excludePattern);
            
            for (const file of files) {
                if (results.length >= maxResults) break;
                
                try {
                    const content = await fs.readFile(file, 'utf8');
                    const lines = content.split('\n');
                    
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const matches = isRegex 
                            ? Array.from(line.matchAll(pattern as RegExp))
                            : isCaseSensitive 
                                ? line.includes(query) ? [{ index: line.indexOf(query) }] : []
                                : line.toLowerCase().includes(query.toLowerCase()) ? [{ index: line.toLowerCase().indexOf(query.toLowerCase()) }] : [];
                        
                        if (matches.length > 0) {
                            results.push({
                                file: path.relative(folder.uri.fsPath, file),
                                line: i + 1,
                                column: matches[0].index || 0,
                                match: line.trim(),
                                context: {
                                    before: lines.slice(Math.max(0, i - contextLines), i),
                                    after: lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines))
                                }
                            });
                        }
                    }
                } catch {
                    // Skip files we can't read
                }
            }
        }

        const content = results.map(result => 
            `${result.file}:${result.line}:${result.column}\n${result.match}`
        ).join('\n\n');

        return {
            content: [{
                type: 'text',
                text: content || 'No results found',
                annotations: [{
                    type: 'source_location',
                    query,
                    resultCount: results.length,
                    searchOptions: args
                }]
            }]
        };
    }

    private static async getFileStats(args: any): Promise<MCPToolResult> {
        const { filePath } = args;
        const absolutePath = this.resolveWorkspacePath(filePath);

        const stats = await fs.stat(absolutePath);
        
        const content = `File: ${filePath}
Type: ${stats.isFile() ? 'File' : stats.isDirectory() ? 'Directory' : 'Other'}
Size: ${stats.size} bytes
Modified: ${stats.mtime.toISOString()}
Created: ${stats.ctime.toISOString()}
Permissions: ${(stats.mode & parseInt('777', 8)).toString(8)}`;

        return {
            content: [{
                type: 'text',
                text: content,
                annotations: [{
                    type: 'source_location',
                    filePath: absolutePath,
                    stats: {
                        size: stats.size,
                        modified: stats.mtime,
                        created: stats.ctime,
                        isFile: stats.isFile(),
                        isDirectory: stats.isDirectory()
                    }
                }]
            }]
        };
    }

    private static async createFile(args: any): Promise<MCPToolResult> {
        const { filePath, content = '', overwrite = false } = args;
        const absolutePath = this.resolveWorkspacePath(filePath);

        // Check if file exists
        try {
            await fs.access(absolutePath);
            if (!overwrite) {
                throw new Error(`File already exists: ${filePath}. Use overwrite: true to replace it.`);
            }
        } catch {
            // File doesn't exist, which is what we want
        }

        // Create parent directories
        const dir = path.dirname(absolutePath);
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(absolutePath, content, 'utf8');

        // Open the file in VS Code
        try {
            const document = await vscode.workspace.openTextDocument(absolutePath);
            await vscode.window.showTextDocument(document);
        } catch {
            // Ignore if we can't open the file
        }

        return {
            content: [{
                type: 'text',
                text: `File created successfully: ${filePath}`,
                annotations: [{
                    type: 'source_location',
                    filePath: absolutePath,
                    action: 'create',
                    size: content.length
                }]
            }]
        };
    }

    private static async deleteFile(args: any): Promise<MCPToolResult> {
        const { filePath, recursive = false, force = false } = args;
        const absolutePath = this.resolveWorkspacePath(filePath);

        if (!force) {
            // Ask for confirmation
            const answer = await vscode.window.showWarningMessage(
                `Are you sure you want to delete "${filePath}"?`,
                { modal: true },
                'Yes',
                'No'
            );
            
            if (answer !== 'Yes') {
                return {
                    content: [{
                        type: 'text',
                        text: 'Delete operation cancelled by user.'
                    }]
                };
            }
        }

        const stats = await fs.stat(absolutePath);
        
        if (stats.isDirectory()) {
            if (recursive) {
                await fs.rmdir(absolutePath, { recursive: true });
            } else {
                await fs.rmdir(absolutePath);
            }
        } else {
            await fs.unlink(absolutePath);
        }

        return {
            content: [{
                type: 'text',
                text: `Successfully deleted: ${filePath}`,
                annotations: [{
                    type: 'source_location',
                    filePath: absolutePath,
                    action: 'delete',
                    wasDirectory: stats.isDirectory()
                }]
            }]
        };
    }

    private static async moveFile(args: any): Promise<MCPToolResult> {
        const { sourcePath, destinationPath, overwrite = false } = args;
        const absoluteSource = this.resolveWorkspacePath(sourcePath);
        const absoluteDestination = this.resolveWorkspacePath(destinationPath);

        // Check if destination exists
        if (!overwrite) {
            try {
                await fs.access(absoluteDestination);
                throw new Error(`Destination already exists: ${destinationPath}. Use overwrite: true to replace it.`);
            } catch (error) {
                if (error instanceof Error && error.message.includes('already exists')) {
                    throw error;
                }
                // Destination doesn't exist, which is good
            }
        }

        // Create parent directory if needed
        const dir = path.dirname(absoluteDestination);
        await fs.mkdir(dir, { recursive: true });

        await fs.rename(absoluteSource, absoluteDestination);

        return {
            content: [{
                type: 'text',
                text: `Successfully moved "${sourcePath}" to "${destinationPath}"`,
                annotations: [{
                    type: 'source_location',
                    sourcePath: absoluteSource,
                    destinationPath: absoluteDestination,
                    action: 'move'
                }]
            }]
        };
    }

    // Helper methods
    private static resolveWorkspacePath(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder open');
        }

        return path.join(workspaceFolders[0].uri.fsPath, filePath);
    }

    private static async checkFileAccess(filePath: string, operation: 'read' | 'write'): Promise<void> {
        try {
            await fs.access(filePath, operation === 'read' ? fs.constants.R_OK : fs.constants.W_OK);
        } catch (error) {
            if (operation === 'write') {
                // For write operations, check if the parent directory exists and is writable
                const dir = path.dirname(filePath);
                try {
                    await fs.access(dir, fs.constants.W_OK);
                } catch {
                    throw new Error(`Cannot write to directory: ${dir}`);
                }
            } else {
                throw new Error(`Cannot access file for ${operation}: ${filePath}`);
            }
        }
    }

    private static async listDirectoryRecursive(
        dir: string, 
        recursive: boolean, 
        includeHidden: boolean, 
        maxDepth: number, 
        currentDepth: number
    ): Promise<DirectoryEntry[]> {
        if (currentDepth >= maxDepth) {
            return [];
        }

        const entries: DirectoryEntry[] = [];
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
            if (!includeHidden && item.name.startsWith('.')) {
                continue;
            }

            const fullPath = path.join(dir, item.name);
            const stats = await fs.stat(fullPath);

            const entry: DirectoryEntry = {
                name: item.name,
                type: item.isDirectory() ? 'directory' : item.isSymbolicLink() ? 'symlink' : 'file',
                size: stats.size,
                modified: stats.mtime,
                path: fullPath
            };

            entries.push(entry);

            if (recursive && item.isDirectory()) {
                const subEntries = await this.listDirectoryRecursive(
                    fullPath, 
                    recursive, 
                    includeHidden, 
                    maxDepth, 
                    currentDepth + 1
                );
                entries.push(...subEntries);
            }
        }

        return entries;
    }

    private static async findFiles(
        rootPath: string, 
        includePattern?: string, 
        excludePattern?: string
    ): Promise<string[]> {
        const files: string[] = [];
        
        const scanDirectory = async (dir: string) => {
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    
                    if (item.isDirectory()) {
                        // Skip common directories that should be excluded
                        if (!item.name.startsWith('.') && 
                            item.name !== 'node_modules' && 
                            item.name !== 'target' && 
                            item.name !== 'build') {
                            await scanDirectory(fullPath);
                        }
                    } else if (item.isFile()) {
                        const relativePath = path.relative(rootPath, fullPath);
                        
                        // Simple pattern matching (could be enhanced with glob)
                        if (includePattern && !relativePath.includes(includePattern.replace('*', ''))) {
                            continue;
                        }
                        
                        if (excludePattern && relativePath.includes(excludePattern.replace('*', ''))) {
                            continue;
                        }
                        
                        files.push(fullPath);
                    }
                }
            } catch {
                // Skip directories we can't read
            }
        };

        await scanDirectory(rootPath);
        return files;
    }
}