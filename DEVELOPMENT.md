# Alphanetix Code Assistant - Development Setup

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Visual Studio Code** (v1.85.0 or higher) - [Download](https://code.visualstudio.com/)
- **Git** - [Download](https://git-scm.com/)

## 🚀 Installation Steps

### 1. Navigate to Plugin Directory

```powershell
cd "d:\MiniProjects\AlphanetixAI\VS Code Plugin"
```

### 2. Install Dependencies

```powershell
npm install
```

This will install:
- `vscode` - VS Code Extension API types
- `axios` - HTTP client for API calls
- `typescript` - TypeScript compiler
- `eslint` - Code linting
- `@vscode/vsce` - Extension packaging tool

### 3. Compile TypeScript

```powershell
npm run compile
```

This creates the `out/` directory with compiled JavaScript files.

### 4. Open in VS Code

```powershell
code .
```

## 🔧 Development Workflow

### Running the Extension

1. **Press F5** in VS Code
   - This launches a new "Extension Development Host" window
   - The extension is loaded in this new window
   - You can set breakpoints and debug

2. **Make Changes**
   - Edit TypeScript files
   - Save your changes
   - Run `npm run compile` or keep `npm run watch` running

3. **Reload Extension**
   - In the Extension Development Host window
   - Press `Ctrl+R` (Windows) or `Cmd+R` (Mac)
   - Or use Command Palette: "Developer: Reload Window"

### Watch Mode (Recommended)

Run this in a terminal to auto-compile on file changes:

```powershell
npm run watch
```

Leave this running while you develop. It will automatically recompile when you save files.

## 🧪 Testing the Extension

### Manual Testing

1. **Start Extension**: Press `F5`
2. **Open Alphanetix Sidebar**: Click the Alphanetix icon in Activity Bar
3. **Sign In**: 
   - Click "Sign In" button
   - Choose "Username/Password"
   - Enter your AlphanetixAI credentials
4. **Test Features**:
   - Open a code file
   - Type some code and wait for inline suggestions
   - Select code and right-click for context actions
   - Open Chat tab and send a message
   - Check Status view for quota info

### Testing Checklist

- [ ] Extension loads without errors
- [ ] Authentication works (login/logout)
- [ ] Status view displays user info and quota
- [ ] Chat view sends and receives messages
- [ ] Settings view loads and updates
- [ ] Inline completion appears when typing
- [ ] Context menu shows Alphanetix actions
- [ ] Team switching works (if applicable)
- [ ] Model selection works
- [ ] Status bar shows correct info
- [ ] Quota warnings appear when low

## 🏗️ Project Structure

```
VS Code Plugin/
├── .vscode/              # VS Code configuration
│   ├── launch.json       # Debug configuration
│   ├── tasks.json        # Build tasks
│   ├── settings.json     # Editor settings
│   └── extensions.json   # Recommended extensions
├── src/                  # Source code
│   ├── extension.ts      # Main entry point
│   ├── types.ts          # TypeScript type definitions
│   ├── api/              # API client layer
│   │   └── ApiClient.ts
│   ├── services/         # Business logic services
│   │   ├── AuthService.ts
│   │   ├── TeamService.ts
│   │   ├── ModelService.ts
│   │   ├── CompletionService.ts
│   │   └── UserService.ts
│   ├── state/            # State management
│   │   └── StateManager.ts
│   ├── providers/        # VS Code providers
│   │   ├── InlineCompletionProvider.ts
│   │   └── CodeActionProvider.ts
│   └── views/            # Webview providers
│       ├── StatusViewProvider.ts
│       ├── ChatViewProvider.ts
│       └── SettingsViewProvider.ts
├── resources/            # Icons and assets
│   ├── icon.png
│   └── sidebar-icon.svg
├── out/                  # Compiled JavaScript (generated)
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript configuration
├── .eslintrc.json        # ESLint configuration
├── README.md             # Documentation
├── QUICK_START.md        # Quick start guide
├── CHANGELOG.md          # Version history
└── LICENSE               # License file
```

## 🔍 Key Files Explained

### `package.json`
- Extension manifest with metadata
- Commands, views, and configuration
- Dependencies and scripts
- Activation events

### `src/extension.ts`
- Main entry point
- Registers all commands and providers
- Manages status bar items
- Handles extension lifecycle

### `src/services/`
- **AuthService**: Authentication and session management
- **TeamService**: Team operations and switching
- **ModelService**: AI models and agents
- **CompletionService**: AI completions and chat
- **UserService**: User info and quota

### `src/providers/`
- **InlineCompletionProvider**: Copilot-like suggestions
- **CodeActionProvider**: Right-click menu actions

### `src/views/`
- **StatusViewProvider**: User info, quota, team status
- **ChatViewProvider**: Interactive chat interface
- **SettingsViewProvider**: Extension settings

## 🐛 Debugging

### View Logs

1. **Debug Console**: View logs from extension code
   - View → Debug Console (Ctrl+Shift+Y)
   - Shows `console.log()` output

2. **Developer Tools**: Inspect webviews
   - Help → Toggle Developer Tools
   - Check Console tab for errors

3. **Extension Host**: Check extension errors
   - Look for red errors in Debug Console
   - Check VS Code Developer Tools

### Common Debugging Tasks

**Set Breakpoints**:
```typescript
// In any TypeScript file
debugger; // Execution will pause here
```

**Log State**:
```typescript
console.log('Current user:', userInfo);
console.log('Quota:', quotaInfo);
```

**Inspect API Calls**:
```typescript
// In ApiClient.ts, add logging
console.log('API Request:', url, data);
console.log('API Response:', response.data);
```

## 📦 Building for Distribution

### Create VSIX Package

```powershell
npm run package
```

This creates `alphanetix-code-assistant-1.0.0.vsix` in the root directory.

### Install VSIX Locally

1. Open VS Code
2. Extensions view (Ctrl+Shift+X)
3. Click `...` menu → "Install from VSIX..."
4. Select the `.vsix` file

### Share with Others

Send the `.vsix` file to users who can install it manually.

## 🌐 Backend Connection

### Configure API URL

The extension connects to `http://localhost:9100` by default.

To change:
1. Open Settings (Ctrl+,)
2. Search for "Alphanetix"
3. Update "Api Url"

Or via JSON:
```json
{
  "alphanetix.apiUrl": "https://your-server.com"
}
```

### Test Backend Connection

```typescript
// In Debug Console:
fetch('http://localhost:9100/api/models')
  .then(r => r.json())
  .then(console.log)
```

## 🔐 Security Considerations

### Token Storage

Tokens are stored in VS Code's **Secret Storage**:
- Encrypted on disk
- OS-level security (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- Never in plain text

### API Communication

- Uses HTTPS in production
- JWT tokens in Authorization header
- Automatic token refresh
- Secure session management

## 📚 Additional Resources

### VS Code Extension Development
- [Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Playground](https://www.typescriptlang.org/play)

### AlphanetixAI Platform
- Backend API Documentation: Check `open-api-aiplatform-docs.json`
- Team Management: See `docs/TEAM_QUOTA_MANAGEMENT.md`
- Platform Design: See `docs/ai_platform_design.md`

## 🆘 Troubleshooting

### Build Errors

**Error: Cannot find module 'vscode'**
```powershell
# Solution: Install dependencies
npm install
```

**Error: Command failed: tsc**
```powershell
# Solution: Install TypeScript globally
npm install -g typescript
# Or use local version
npx tsc
```

### Runtime Errors

**Extension not activating**
- Check `package.json` for correct `main` entry
- Verify `out/extension.js` exists
- Check activation events

**API calls failing**
- Verify backend is running
- Check API URL in settings
- Look for CORS issues
- Inspect network tab in Developer Tools

**Webviews not loading**
- Check HTML in provider files
- Verify `enableScripts: true`
- Look for CSP violations in console

## 💡 Tips & Tricks

### Fast Development

1. **Keep watch running**: `npm run watch`
2. **Use reload**: `Ctrl+R` instead of restarting
3. **Set breakpoints**: Debug efficiently
4. **Check logs**: Monitor Debug Console

### Code Quality

1. **Run linter**: `npm run lint`
2. **Fix auto-fixable issues**: `npm run lint -- --fix`
3. **Format code**: Use Prettier or ESLint
4. **Type safely**: Leverage TypeScript

### Testing

1. **Test incrementally**: Test each feature as you build
2. **Use real data**: Test with actual API responses
3. **Test edge cases**: Low quota, no team, etc.
4. **Test errors**: What happens when API is down?

## 🎯 Next Steps

1. **Install dependencies**: `npm install`
2. **Compile code**: `npm run compile`
3. **Start developing**: Press `F5`
4. **Read QUICK_START.md**: Follow quick start guide
5. **Explore code**: Understand the structure
6. **Make changes**: Add new features
7. **Test thoroughly**: Ensure everything works
8. **Package**: Create VSIX when ready

## 📞 Support

Need help?
- Check existing issues on GitHub
- Read the documentation
- Ask in team chat
- Contact the development team

---

**Happy Coding! 🚀**

Made with ❤️ by the Alphanetix Team
