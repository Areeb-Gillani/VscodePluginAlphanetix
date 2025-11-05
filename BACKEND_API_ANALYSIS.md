# Backend API Analysis for VS Code Plugin

## Overview
This document analyzes the AlphanetixAI backend API endpoints and their compatibility with the VS Code plugin.

## ✅ **SUPPORTED ENDPOINTS**

### 1. Authentication Endpoints (`/api/auth`)
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/auth/login` | POST | ✅ **Available** | Accepts username/email + password |
| `/api/auth/register` | POST | ✅ **Available** | User registration |
| `/api/auth/refresh-token` | POST | ✅ **Available** | Token refresh |
| `/api/auth/validate-token` | POST | ✅ **Available** | Token validation |

**Response Format (Login/Register):**
```json
{
  "userId": "uuid",
  "username": "string",
  "fullName": "string",
  "email": "string",
  "userType": "INDIVIDUAL/CORPORATE",
  "accountTier": "FREE/BASIC/PREMIUM/ENTERPRISE",
  "creditBalance": 0,
  "token": "jwt-token",
  "refreshToken": "refresh-token"
}
```

### 2. User Endpoints (`/api/users`)
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/users/profile` | GET | ✅ **Available** | Get current user profile |
| `/api/users/{id}` | GET | ✅ **Available** | Get user by ID |
| `/api/users/preferences` | GET | ✅ **Available** | Get user preferences |

### 3. Team Endpoints (`/api/teams`)
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/teams` | GET | ✅ **Available** | Get user's teams |
| `/api/teams/{id}` | GET | ✅ **Available** | Get team details |
| `/api/teams/{teamId}/members` | GET | ✅ **Available** | Get team members with quota |
| `/api/teams` | POST | ✅ **Available** | Create team |
| `/api/teams/{teamId}/members` | POST | ✅ **Available** | Add team member |

**Plugin Usage:** Team dropdown, quota display

### 4. AI Model Endpoints (`/api/models`)
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/models` | GET | ✅ **Available** | Get models for user's tier |
| `/api/models/{id}` | GET | ✅ **Available** | Get model details |
| `/api/models/provider/{provider}` | GET | ✅ **Available** | Get models by provider |

**Response Format:**
```json
[
  {
    "id": "uuid",
    "displayName": "GPT-4",
    "modelName": "gpt-4",
    "provider": "OPENAI",
    "modelType": "CHAT",
    "tier": "PREMIUM",
    "contextLength": 8192,
    "isActive": true
  }
]
```

**Plugin Usage:** Model selection dropdown

### 5. AI Agent Endpoints (`/api/agents`)
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/agents` | GET | ✅ **Available** | Get agents for user's tier |
| `/api/agents/{id}` | GET | ✅ **Available** | Get agent details |
| `/api/agents/corporate/{corporateAccountId}` | GET | ✅ **Available** | Get corporate agents |

**Response Format:**
```json
[
  {
    "id": "uuid",
    "name": "Code Assistant",
    "description": "AI coding assistant",
    "systemPrompt": "You are a helpful coding assistant...",
    "tier": "FREE",
    "isPublic": true,
    "isActive": true
  }
]
```

**Plugin Usage:** Agent/Mode selection

### 6. Chat/Completion Endpoints (`/api/chat`)
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/chat/completion` | POST | ✅ **Available** | AI completion (inline coding) |
| `/api/chat/sessions` | POST | ✅ **Available** | Create chat session |
| `/api/chat/sessions` | GET | ✅ **Available** | Get user sessions |
| `/api/chat/sessions/{id}/messages` | GET | ✅ **Available** | Get chat messages |

**Completion Request Format:**
```json
{
  "prompt": "string",
  "modelId": "uuid",
  "agentId": "uuid",
  "sessionId": "uuid",
  "teamId": "uuid",
  "maxTokens": 2000,
  "temperature": 0.7,
  "stream": false
}
```

**Completion Response Format:**
```json
{
  "content": "AI generated response",
  "model": "gpt-4",
  "tokensUsed": 150,
  "sessionId": "uuid",
  "messageId": "uuid"
}
```

**Plugin Usage:** 
- Inline code completion (InlineCompletionProvider)
- Chat panel

---

## ❌ **MISSING ENDPOINT**

### Browser-Based OAuth Flow for VS Code

**Issue:** The plugin uses a browser-based authentication flow where:
1. User clicks "Login" in VS Code
2. Opens browser at `/auth/vscode-login`
3. User logs in via web UI
4. Token is sent back to VS Code via callback URL

**Required Endpoint:**
```
GET /auth/vscode-login
```

**Expected Behavior:**
1. Generate a unique state parameter
2. Redirect to login page with state
3. After successful login, redirect to `vscode://alphanetix-code-assistant/auth-callback?token=<jwt>&refreshToken=<refresh-jwt>&state=<state>`

**Implementation Required:** ✅ Will create `VsCodeAuthController.java`

---

## 🔧 **PLUGIN COMPATIBILITY SUMMARY**

| Feature | Backend Support | Status |
|---------|----------------|--------|
| **Browser-based login** | ❌ Missing `/auth/vscode-login` | **NEEDS IMPLEMENTATION** |
| **Credential-based login** | ✅ `/api/auth/login` works | **READY** |
| **Token refresh** | ✅ `/api/auth/refresh-token` | **READY** |
| **Token validation** | ✅ `/api/auth/validate-token` | **READY** |
| **User profile** | ✅ `/api/users/profile` | **READY** |
| **Team listing** | ✅ `/api/teams` | **READY** |
| **Team quota** | ✅ `/api/teams/{id}/members` | **READY** |
| **Model listing** | ✅ `/api/models` | **READY** |
| **Agent listing** | ✅ `/api/agents` | **READY** |
| **Inline completion** | ✅ `/api/chat/completion` | **READY** |
| **Chat sessions** | ✅ `/api/chat/sessions` | **READY** |
| **Chat messages** | ✅ `/api/chat/sessions/{id}/messages` | **READY** |

---

## 📊 **QUOTA TRACKING**

The backend supports team-level quota tracking via the teams system:
- **Individual users:** Use personal credit balance (`user.creditBalance`)
- **Team users:** Use team quota (`team.quotaUsed / team.quotaLimit`)

**Plugin Integration:**
- StatusViewProvider displays quota percentage
- Updates after each completion request
- Supports both individual and team quotas

---

## 🔐 **SECURITY**

### JWT Token Flow:
1. User authenticates → receives `token` + `refreshToken`
2. Plugin stores tokens in VS Code Secret Storage
3. All API requests include `Authorization: Bearer <token>`
4. Auto-refresh when token expires (interceptor in ApiClient.ts)

### Current Security Config:
- **Permitted endpoints (no auth):** `/api/auth/**`, `/api/health/**`, `/api/keys/validate`
- **Protected endpoints:** All others require JWT authentication
- **Token validation:** `JwtTokenProvider.validateToken()`

---

## 🚀 **RECOMMENDED ACTIONS**

1. ✅ **Implement VS Code OAuth endpoint** (`/auth/vscode-login`)
2. ⚠️ **Optional:** Add CORS configuration for VS Code extension origins
3. ⚠️ **Optional:** Add rate limiting for completion endpoint
4. ✅ **Test:** Full authentication flow from VS Code plugin

---

## 📝 **NEXT STEPS**

1. Create `VsCodeAuthController.java` with browser OAuth flow
2. Add redirect logic to existing login page
3. Implement callback URL handling
4. Test complete VS Code plugin authentication flow
5. Document the OAuth flow in plugin README
