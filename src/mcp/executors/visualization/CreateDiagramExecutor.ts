import * as vscode from 'vscode';
import { BaseExecutor, ExecutionContext, ValidationError } from '../BaseExecutor';

interface CreateDiagramArgs {
    content: string;
}

interface CreateDiagramResult {
    syntax_valid: boolean;
    error_message?: string;
}

/**
 * Executor for creating Mermaid diagrams
 * Generates diagrams for rendering in chat UI with syntax validation
 */
export class CreateDiagramExecutor extends BaseExecutor {
    constructor() {
        super('create_diagram', '1.0.0', 'low', 'fetch');
    }

    protected validateArgs(args: CreateDiagramArgs): void {
        this.validateRequired(args, ['content']);
        this.validateType(args.content, 'string', 'content');

        if (!args.content.trim()) {
            throw new ValidationError('content cannot be empty');
        }
    }

    protected async executeInternal(args: CreateDiagramArgs, _context: ExecutionContext): Promise<CreateDiagramResult> {
        console.log(`🎨 CreateDiagram: Generating Mermaid diagram`);

        // Basic Mermaid syntax validation
        const content = args.content.trim();

        // Check for common Mermaid diagram types
        const validDiagramTypes = [
            'graph',
            'flowchart',
            'sequenceDiagram',
            'classDiagram',
            'stateDiagram',
            'erDiagram',
            'gantt',
            'pie',
            'journey',
            'gitGraph',
            'mindmap',
            'timeline'
        ];

        const firstLine = content.split('\n')[0].trim();
        const hasValidType = validDiagramTypes.some(type => 
            firstLine.startsWith(type) || firstLine.includes(type)
        );

        if (!hasValidType) {
            console.warn('⚠️ CreateDiagram: No recognized Mermaid diagram type found');
            return {
                syntax_valid: false,
                error_message: `Diagram must start with a valid Mermaid diagram type. Supported types: ${validDiagramTypes.join(', ')}`
            };
        }

        // Check for prohibited features
        const prohibitedFeatures = [':::', 'color:', 'fill:', 'stroke:'];
        for (const feature of prohibitedFeatures) {
            if (content.includes(feature)) {
                console.warn(`⚠️ CreateDiagram: Prohibited feature detected: ${feature}`);
                return {
                    syntax_valid: false,
                    error_message: `Prohibited feature "${feature}" found. Please remove custom colors and beta features.`
                };
            }
        }

        // Check for line breaks formatting
        if (!content.includes('<br/>') && content.length > 200 && content.split('\n').length < 5) {
            console.warn('⚠️ CreateDiagram: Consider using <br/> for line breaks in long text');
        }

        // TODO: Full Mermaid syntax validation would require mermaid-js library
        // For now, we'll do basic checks and assume the diagram is valid

        console.log(`✅ CreateDiagram: Diagram appears valid (${content.length} characters)`);

        // Show the diagram in a webview
        this.showDiagramPreview(content);

        return {
            syntax_valid: true
        };
    }

    /**
     * Show Mermaid diagram in a webview panel
     */
    private showDiagramPreview(mermaidCode: string): void {
        const panel = vscode.window.createWebviewPanel(
            'mermaidPreview',
            'Mermaid Diagram',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this.getMermaidHTML(mermaidCode);
    }

    /**
     * Generate HTML for Mermaid diagram rendering
     */
    private getMermaidHTML(mermaidCode: string): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mermaid Diagram</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        #diagram {
            background: white;
            padding: 20px;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div id="diagram">
        <pre class="mermaid">
${mermaidCode}
        </pre>
    </div>
    <script>
        mermaid.initialize({ 
            startOnLoad: true,
            theme: 'default'
        });
    </script>
</body>
</html>`;
    }
}
