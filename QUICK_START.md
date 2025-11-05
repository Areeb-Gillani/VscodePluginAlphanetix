# Alphanetix Code Assistant - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd "VS Code Plugin"
npm install
```

### Step 2: Compile TypeScript
```bash
npm run compile
```

### Step 3: Run in Development Mode
1. Open the "VS Code Plugin" folder in VS Code
2. Press `F5` to start debugging
3. A new VS Code window will open with the extension loaded

### Step 4: Sign In
1. Look for the Alphanetix icon in the Activity Bar (left sidebar)
2. Click on it to open the sidebar
3. Click "Sign In" in the Status view
4. Choose "Username/Password" for quick testing
5. Enter your credentials:
   - Username: `your_username`
   - Password: `your_password`

### Step 5: Start Coding!
- Open any code file
- Start typing and watch for inline completions
- Select code → Right-click → Choose an Alphanetix action
- Open the Chat tab to ask coding questions

## 🎯 Key Features to Try

### 1. Inline Completion
```python
# Start typing a function
def calculate_
# Wait 500ms, AI will suggest completion
```

### 2. Chat Assistant
Open Chat tab and ask:
- "How do I create a REST API in Python?"
- "Explain async/await in JavaScript"
- "Write a binary search function"

### 3. Code Actions
Select this code and right-click:
```javascript
function add(a, b) { return a + b; }
```
Then choose:
- **Explain** - Get detailed explanation
- **Fix/Improve** - Get optimization suggestions
- **Generate Tests** - Create unit tests
- **Generate Docs** - Add JSDoc comments

### 4. Team Features (If you're in a team)
1. Click "Switch Team" in Status view
2. Select your team
3. Your team's quota and context will load automatically

### 5. Monitor Quota
- Check the status bar (bottom right) for credit balance
- Click the quota icon to refresh
- Warning appears when credits are low

## 🔧 Development Commands

### Compile TypeScript
```bash
npm run compile
```

### Watch Mode (Auto-compile on save)
```bash
npm run watch
```

### Run Linter
```bash
npm run lint
```

### Package Extension
```bash
npm run package
```
This creates a `.vsix` file you can distribute or install manually.

## 📝 Configuration Tips

### Change API URL
```json
// settings.json
{
  "alphanetix.apiUrl": "https://your-api-server.com"
}
```

### Adjust Completion Behavior
```json
{
  "alphanetix.enableInlineCompletion": true,
  "alphanetix.completionDelay": 300,
  "alphanetix.maxCompletionLines": 10
}
```

### Disable Quota Warnings
```json
{
  "alphanetix.showQuotaWarnings": false
}
```

## 🐛 Testing Checklist

- [ ] Sign in successfully
- [ ] View quota in status bar
- [ ] Get inline code completion
- [ ] Send chat message
- [ ] Use context menu actions
- [ ] Switch teams (if applicable)
- [ ] Select different AI model
- [ ] Change settings
- [ ] Sign out

## 🚀 Publishing (When Ready)

### 1. Get Publisher Account
Create account at: https://marketplace.visualstudio.com/

### 2. Create Personal Access Token
1. Go to: https://dev.azure.com/
2. User Settings → Personal Access Tokens
3. Create token with **Marketplace (Manage)** scope

### 3. Login to Publisher
```bash
npx vsce login your-publisher-name
```

### 4. Publish
```bash
npx vsce publish
```

Or publish specific version:
```bash
npx vsce publish 1.0.1
```

## 📦 Distribution Options

### Option 1: VS Code Marketplace (Public)
```bash
npm run package
npx vsce publish
```

### Option 2: VSIX File (Private)
```bash
npm run package
# Share the generated .vsix file
# Users install via: Extensions → "..." → Install from VSIX
```

### Option 3: GitHub Releases
1. Create GitHub release
2. Attach `.vsix` file to release
3. Users download and install manually

## 🔒 Security Notes

- Never commit `.env` files
- Don't expose API keys in code
- Use VS Code's secret storage for tokens
- Test with test accounts, not production data

## 📚 Additional Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## 💡 Pro Tips

1. **Fast Testing**: Use `F5` in VS Code to quickly test changes
2. **Hot Reload**: Changes to webviews refresh automatically
3. **Debug Console**: Check "Debug Console" for error logs
4. **Network Inspector**: Monitor API calls in debug console
5. **State Inspection**: View stored state via Developer Tools

## 🆘 Common Issues

### "Cannot find module 'vscode'"
**Fix**: Run `npm install` to install dependencies

### Extension not loading
**Fix**: 
1. Check `out/` folder exists
2. Run `npm run compile`
3. Reload VS Code window (`Ctrl+R`)

### API connection fails
**Fix**:
1. Verify backend is running
2. Check API URL in settings
3. Look for CORS issues in browser console

---

**Happy Coding! 🎉**

Need help? Open an issue on GitHub or contact support.
