"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// Debug Extension - Simple Login Test
const vscode = __importStar(require("vscode"));
function activate(context) {
    console.log('🧪 Debug Extension: Starting login test');
    // Register a simple command to test login
    const loginTestCommand = vscode.commands.registerCommand('debug.testLogin', async () => {
        console.log('🧪 Testing VS Code login flow...');
        // Generate a unique state for this auth session
        const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
        console.log('🔗 Generated state:', state);
        // Create the URL that would be opened
        const frontendUrl = 'http://localhost:3002';
        const loginUrl = `${frontendUrl}/?vscode=true&state=${encodeURIComponent(state)}`;
        console.log('🔗 Opening URL:', loginUrl);
        // Open browser
        const opened = await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
        console.log('🔗 Browser opened:', opened);
        if (opened) {
            vscode.window.showInformationMessage(`🔗 Browser opened with state: ${state}. Check the URL for VS Code parameters.`, 'Copy State', 'Show Console').then(choice => {
                if (choice === 'Copy State') {
                    vscode.env.clipboard.writeText(state);
                    vscode.window.showInformationMessage('State copied to clipboard');
                }
                else if (choice === 'Show Console') {
                    console.log('🔗 Current state in memory:', state);
                    console.log('🔗 Full URL opened:', loginUrl);
                }
            });
        }
        else {
            vscode.window.showErrorMessage('Failed to open browser');
        }
    });
    // Register URI handler to test callback
    const uriHandler = vscode.window.registerUriHandler({
        handleUri: async (uri) => {
            console.log('🔗 URI Handler: Received callback:', uri.toString());
            console.log('🔗 URI Handler: Scheme:', uri.scheme);
            console.log('🔗 URI Handler: Authority:', uri.authority);
            console.log('🔗 URI Handler: Path:', uri.path);
            console.log('🔗 URI Handler: Query:', uri.query);
            // Parse query parameters
            const query = new URLSearchParams(uri.query);
            const params = {
                token: query.get('token'),
                refreshToken: query.get('refreshToken'),
                userId: query.get('userId'),
                username: query.get('username'),
                state: query.get('state')
            };
            console.log('🔗 Parsed parameters:', params);
            if (params.token && params.state) {
                vscode.window.showInformationMessage(`✅ Callback received! User: ${params.username || 'Unknown'}, State: ${params.state}`, 'Show Details', 'Test Complete').then(choice => {
                    if (choice === 'Show Details') {
                        console.log('🔗 Full callback details:', JSON.stringify(params, null, 2));
                        vscode.window.showInformationMessage('Details logged to console');
                    }
                });
            }
            else {
                vscode.window.showErrorMessage('❌ Invalid callback - missing token or state');
            }
        }
    });
    context.subscriptions.push(loginTestCommand, uriHandler);
    // Show welcome message
    vscode.window.showInformationMessage('🧪 Debug Extension loaded. Run "Debug: Test Login" command to test the flow.', 'Test Now').then(choice => {
        if (choice === 'Test Now') {
            vscode.commands.executeCommand('debug.testLogin');
        }
    });
}
function deactivate() {
    console.log('🧪 Debug Extension: Deactivated');
}
//# sourceMappingURL=debug-extension.js.map