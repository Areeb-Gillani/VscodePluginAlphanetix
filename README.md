# Alphanetix Code Assistant

> AI-powered code completion and assistance integrated with the AlphanetixAI Platform

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Areeb-Gillani/AlphanetixAI)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🚀 Features

### 🤖 Intelligent Code Completion
- **Inline Suggestions**: Get AI-powered code completions as you type, similar to GitHub Copilot
- **Context-Aware**: Understands your project context and coding patterns
- **Multi-Language Support**: Works with all programming languages

### 💬 Interactive Chat
- **Coding Assistant**: Ask questions about your code directly in VS Code
- **Persistent Sessions**: Chat history maintained across sessions
- **Team Context**: Leverage team-specific system prompts and settings

### 👥 Team Collaboration
- **Multi-Team Support**: Switch between different teams seamlessly
- **Team Quotas**: Monitor team credit allocation and usage
- **Shared Context**: Access team-level system prompts and configurations

### 🎯 Context Menu Actions
Right-click on selected code to:
- **Explain Code**: Get detailed explanations of complex code
- **Fix/Improve Code**: AI-powered bug fixes and improvements
- **Refactor Code**: Smart refactoring suggestions
- **Generate Tests**: Automatically create unit tests
- **Generate Documentation**: Create comprehensive code documentation

### 📊 Quota Management
- **Real-time Monitoring**: View available credits in status bar
- **Low Quota Warnings**: Get notified when credits are running low
- **Team vs Personal**: See both team and personal credit balances

### 🎨 Customizable Settings
- **API Configuration**: Connect to your AlphanetixAI instance
- **Completion Preferences**: Adjust delay, max lines, and more
- **Team Context**: Configure automatic team context switching
- **Warning Thresholds**: Set custom low-quota alert levels

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Alphanetix Code Assistant"
4. Click Install

### From VSIX File
1. Download the `.vsix` file from releases
2. Open VS Code
3. Go to Extensions
4. Click on the `...` menu → "Install from VSIX..."
5. Select the downloaded file

## 🔧 Setup

### 1. Sign In
After installation:
1. Click the Alphanetix icon in the Activity Bar (left sidebar)
2. Click "Sign In" in the Status view
3. Choose your login method:
   - **Browser Login** (Recommended): Authenticate via your browser
   - **Username/Password**: Enter credentials directly

### 2. Configure API URL (Optional)
By default, the extension connects to `http://localhost:9100`. To change this:
1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "Alphanetix"
3. Update "Api Url" to your server address

### 3. Select Your Team (If Applicable)
1. Open the Status view in the Alphanetix sidebar
2. Click "Select Team" button
3. Choose your active team from the list

### 4. Choose AI Model
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Alphanetix: Select AI Model"
3. Pick your preferred model

## 🎯 Usage

### Inline Code Completion
Just start typing! The extension will automatically suggest completions after a short delay.

- **Accept**: Press `Tab` or `→` (Right Arrow)
- **Reject**: Press `Esc` or continue typing
- **Disable**: Uncheck "Enable Inline Completion" in Settings view

### Chat Assistant
1. Click the Chat tab in Alphanetix sidebar
2. Type your question in the input box
3. Press `Enter` or click "Send"
4. Get AI-powered responses instantly

Example questions:
- "How do I read a file in Python?"
- "Explain this function"
- "Write a regex to validate email"

### Code Actions
1. Select code in your editor
2. Right-click to open context menu
3. Choose an Alphanetix AI action:
   - 🤖 Explain with Alphanetix AI
   - 🔧 Fix/Improve with Alphanetix AI
   - ♻️ Refactor with Alphanetix AI
   - 🧪 Generate Tests
   - 📝 Generate Documentation

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| Open Chat | `Ctrl+Alt+C` (customizable) |
| Explain Code | Right-click → Alphanetix |
| Refresh Quota | Click status bar quota item |

## ⚙️ Configuration

### Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `alphanetix.apiUrl` | `http://localhost:9100` | AlphanetixAI API base URL |
| `alphanetix.enableInlineCompletion` | `true` | Enable inline code completion |
| `alphanetix.completionDelay` | `500` | Delay (ms) before showing completions |
| `alphanetix.maxCompletionLines` | `5` | Max lines in completion suggestions |
| `alphanetix.autoSwitchTeamContext` | `true` | Auto-load team context on switch |
| `alphanetix.showQuotaWarnings` | `true` | Show low quota warnings |
| `alphanetix.lowQuotaThreshold` | `100` | Credits threshold for warnings |

### Access Settings
1. Click Settings tab in Alphanetix sidebar, OR
2. Open VS Code Settings → Search "Alphanetix"

## 📋 Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `Alphanetix: Sign In` - Authenticate with your account
- `Alphanetix: Sign Out` - Logout and clear session
- `Alphanetix: Switch Team` - Change active team
- `Alphanetix: Select AI Model` - Choose AI model
- `Alphanetix: Select AI Agent` - Choose AI agent
- `Alphanetix: Open Chat` - Open chat interface
- `Alphanetix: Refresh Quota` - Update quota information
- `Alphanetix: Show Settings` - Open settings panel

## 🏢 Team Features

### For Team Members
- View team quota allocation and usage
- Access team-specific AI agents and prompts
- Collaborate using shared configurations

### For Team Leaders
- Monitor team credit consumption
- Manage team context and prompts
- View member usage statistics (via web platform)

### For Corporate Admins
- Allocate credits to teams
- Create corporate-specific AI agents
- Manage multiple teams

## 🔒 Security

- **Secure Storage**: Authentication tokens stored in VS Code's secure secret storage
- **JWT Tokens**: Automatic token refresh and session management
- **No Plain Text**: Passwords never stored locally
- **HTTPS Ready**: Supports secure API connections

## 🐛 Troubleshooting

### "Session expired" Error
**Solution**: Click "Sign In" again to re-authenticate

### No Code Completions Appearing
**Checks**:
1. Ensure you're signed in
2. Check "Enable Inline Completion" is ON in settings
3. Verify you have available credits
4. Try increasing "Completion Delay" in settings

### "Insufficient credits" Error
**Solution**: 
- Individual users: Purchase more credits via web platform
- Team members: Request quota from team leader
- Contact your admin if corporate employee

### Connection Errors
**Checks**:
1. Verify API URL in settings
2. Ensure backend server is running
3. Check network connectivity
4. Look for firewall/proxy issues

### Low Quota Warnings
**Actions**:
- View detailed quota in Status view
- Click status bar quota item to refresh
- Contact team leader/admin for more credits

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/Areeb-Gillani/AlphanetixAI/issues)
- **Documentation**: [Full Docs](https://github.com/Areeb-Gillani/AlphanetixAI/docs)
- **Email**: support@alphanetixai.com

## 📝 Changelog

### Version 1.0.0
- ✨ Initial release
- 🤖 Inline code completion
- 💬 Interactive chat interface
- 👥 Team management
- 📊 Quota monitoring
- 🎯 Context menu actions
- ⚙️ Customizable settings

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

Built with ❤️ for the developer community by the Alphanetix team.

---

**Enjoy coding with AI assistance!** 🚀
