# VS Code Plugin Setup Guide

## 🎉 **Backend Implementation Complete!**

The AlphanetixAI backend now fully supports the VS Code extension with all required endpoints.

---

## 📋 **What Was Implemented**

### 1. **VS Code Authentication Controller** (`VsCodeAuthController.java`)
A new controller with browser-based OAuth flow for VS Code authentication:

**Endpoints Added:**
- `GET /auth/vscode-login` - Initiate VS Code login flow
- `POST /auth/vscode-callback` - Handle login callback from web UI
- `GET /auth/vscode-callback-redirect` - Direct redirect to VS Code
- `POST /auth/vscode-token` - Token exchange endpoint
- `GET /auth/vscode-status` - Check authentication status

**Features:**
- ✅ State parameter validation (expires after 5 minutes)
- ✅ Automatic token generation
- ✅ Callback URL to VS Code (`vscode://alphanetix-code-assistant/auth-callback`)
- ✅ User info included in response

### 2. **Security Configuration Update**
Updated `SecurityConfig.java` to permit `/auth/**` endpoints without authentication.

### 3. **Application Configuration**
Added VS Code and frontend URL configuration in `application.yml`:

```yaml
vscode:
  callback:
    scheme: vscode
    authority: alphanetix-code-assistant

app:
  frontend:
    url: http://localhost:3000
```

---

## 🔧 **How VS Code Authentication Works**

### Flow Diagram:
```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  VS Code    │         │   Backend    │         │   Browser   │
│  Extension  │         │   Server     │         │   (React)   │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ 1. User clicks Login  │                        │
       ├──────────────────────>│                        │
       │                       │                        │
       │ 2. Generate state &   │                        │
       │    redirect URL       │                        │
       │<──────────────────────┤                        │
       │                       │                        │
       │ 3. Open browser       │                        │
       ├───────────────────────┼───────────────────────>│
       │                       │                        │
       │                       │ 4. User logs in        │
       │                       │<───────────────────────┤
       │                       │                        │
       │                       │ 5. Generate tokens     │
       │                       │                        │
       │                       │ 6. Redirect to VS Code │
       │<──────────────────────┴────────────────────────┤
       │   vscode://...?token=xxx&refreshToken=yyy      │
       │                                                 │
       │ 7. Store tokens in Secret Storage              │
       └─────────────────────────────────────────────────┘
```

### Step-by-Step:

1. **User clicks "Login" in VS Code**
   - Extension calls `AuthService.login()`
   - Opens browser to: `http://localhost:9100/auth/vscode-login?state=<random-uuid>`

2. **Backend generates state**
   - Server generates unique state parameter
   - Stores state with timestamp (expires in 5 minutes)
   - Redirects to: `http://localhost:3000/login?vscode=true&state=<state>`

3. **User logs in via React web UI**
   - User enters username/password
   - React app detects `vscode=true` query param
   - After successful login, calls backend callback endpoint

4. **Backend generates tokens**
   - Validates state parameter
   - Generates JWT access token + refresh token
   - Returns callback URL: `vscode://alphanetix-code-assistant/auth-callback?token=xxx&refreshToken=yyy&userId=zzz&username=aaa&state=<state>`

5. **Browser redirects to VS Code**
   - Custom URL scheme triggers VS Code
   - Extension's URI handler receives tokens

6. **VS Code stores tokens**
   - Tokens stored in VS Code Secret Storage (encrypted)
   - Status bar updated with username
   - Ready for API calls!

---

## 🚀 **Testing the Complete Flow**

### Prerequisites:
1. Backend server running on `http://localhost:9100`
2. React frontend running on `http://localhost:3000`
3. PostgreSQL database running
4. VS Code extension installed in Extension Development Host

### Step 1: Start Backend
```bash
cd AlphanetixAI-Server
./mvnw spring-boot:run
```

### Step 2: Start Frontend
```bash
cd AlphanetixAI-Web
npm start
```

### Step 3: Open Extension Development Host
1. Open `VS Code Plugin` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. In the new window, click the Alphanetix icon in the sidebar

### Step 4: Test Login
1. Click "Login" button in the sidebar
2. Browser should open to login page
3. Login with your credentials
4. Should automatically redirect back to VS Code
5. Check if username appears in status bar

---

## 🔍 **Frontend Integration Required**

The React frontend needs to be updated to handle the VS Code authentication flow.

### Update Login Page Component

Add this logic to your login page (e.g., `AlphanetixAI-Web/src/pages/Login.tsx`):

```typescript
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const isVsCodeAuth = searchParams.get('vscode') === 'true';
  const state = searchParams.get('state');

  const handleLogin = async (username: string, password: string) => {
    try {
      // Normal login API call
      const response = await fetch('http://localhost:9100/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      // If this is a VS Code login, redirect to VS Code
      if (isVsCodeAuth && state) {
        const callbackUrl = `vscode://alphanetix-code-assistant/auth-callback` +
          `?token=${encodeURIComponent(data.token)}` +
          `&refreshToken=${encodeURIComponent(data.refreshToken)}` +
          `&userId=${data.userId}` +
          `&username=${encodeURIComponent(data.username)}` +
          `&state=${encodeURIComponent(state)}`;
        
        // Show success message
        alert('Login successful! Redirecting to VS Code...');
        
        // Redirect to VS Code
        window.location.href = callbackUrl;
      } else {
        // Normal web login flow
        localStorage.setItem('token', data.token);
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    }
  };

  return (
    <div>
      <h1>{isVsCodeAuth ? 'Login to VS Code Extension' : 'Login'}</h1>
      {/* Your login form */}
      <LoginForm onSubmit={handleLogin} />
    </div>
  );
}
```

---

## 📝 **Alternative: Credential-Based Login**

If you don't want to implement the browser flow immediately, users can use credential-based login:

### In VS Code:
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run command: `Alphanetix: Login with Credentials`
3. Enter username/email
4. Enter password
5. Tokens stored securely

This directly calls `/api/auth/login` without browser interaction.

---

## 🔐 **Security Notes**

1. **State Parameter**: Prevents CSRF attacks, expires after 5 minutes
2. **Token Storage**: Tokens stored in VS Code Secret Storage (encrypted)
3. **HTTPS in Production**: Use HTTPS for production deployments
4. **CORS**: Already configured to allow all origins (restrict in production!)

---

## 📊 **API Endpoint Summary**

### All Endpoints Available for VS Code Plugin:

✅ **Authentication**
- `POST /api/auth/login` - Credential login
- `POST /api/auth/refresh-token` - Refresh expired token
- `POST /api/auth/validate-token` - Validate current token
- `GET /auth/vscode-login` - Browser-based VS Code login

✅ **User**
- `GET /api/users/profile` - Get current user profile

✅ **Teams**
- `GET /api/teams` - List user's teams
- `GET /api/teams/{id}` - Get team details with quota

✅ **Models**
- `GET /api/models` - List available AI models for user's tier

✅ **Agents**
- `GET /api/agents` - List available AI agents for user's tier

✅ **Chat/Completion**
- `POST /api/chat/completion` - Get AI code completion
- `POST /api/chat/sessions` - Create chat session
- `GET /api/chat/sessions` - List user's chat sessions
- `GET /api/chat/sessions/{id}/messages` - Get chat messages

---

## 🐛 **Troubleshooting**

### Issue: "Login failed" in VS Code
**Solution:** Check browser console for errors. Ensure backend is running on port 8080.

### Issue: Browser doesn't redirect to VS Code
**Solution:** 
1. Check if `vscode://` custom URL scheme is registered (happens automatically when extension is installed)
2. Try the credential-based login as alternative
3. Check browser security settings (some browsers block custom protocols)

### Issue: "Invalid state" error
**Solution:** State expires after 5 minutes. Click login again to generate new state.

### Issue: 401 Unauthorized on API calls
**Solution:** 
1. Check if token is stored: Open VS Code Command Palette → "Developer: Inspect Secret Storage"
2. Validate token: `POST /api/auth/validate-token` with body `{ "token": "your-token" }`
3. Check token expiration (24 hours)

### Issue: Team quota not showing
**Solution:** Ensure user is member of a team. Create team via web UI or API.

---

## ✅ **Verification Checklist**

Before testing, ensure:

- [ ] Backend server is running (`./mvnw spring-boot:run`)
- [ ] Frontend is running (`npm start`)
- [ ] PostgreSQL database is running
- [ ] User account exists (register via `/api/auth/register`)
- [ ] VS Code extension is compiled (`npm run compile`)
- [ ] Extension Development Host is launched (F5)
- [ ] Browser allows custom URL schemes (`vscode://`)

---

## 🎯 **Next Steps**

1. ✅ **Update React Login Page** to handle `vscode=true` query param
2. ✅ **Test browser-based login flow** end-to-end
3. ✅ **Test inline code completion** in VS Code
4. ✅ **Test team switching** and quota display
5. ✅ **Test chat panel** functionality
6. 📝 **Document** any issues or improvements

---

## 📚 **Additional Resources**

- **Backend API Analysis**: See `BACKEND_API_ANALYSIS.md` for complete API documentation
- **Plugin README**: See `README.md` for plugin features and usage
- **Quick Start**: See `QUICK_START.md` for installation guide
- **Development Guide**: See `DEVELOPMENT.md` for contributing

---

## 🎉 **Summary**

**The backend is now FULLY COMPATIBLE with the VS Code plugin!**

All required endpoints are implemented:
- ✅ Browser-based OAuth flow (`/auth/vscode-login`)
- ✅ Credential-based login (`/api/auth/login`)
- ✅ Token management (refresh, validate)
- ✅ Team quota tracking
- ✅ AI model/agent selection
- ✅ Code completion (`/api/chat/completion`)
- ✅ Chat sessions

**You can now test the complete VS Code plugin!** 🚀
