// Simple test to simulate the extension login flow

async function testLogin() {
    console.log('🧪 Testing login flow...');
    
    // Generate a test state
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    console.log('🔗 Generated state:', state);
    
    // Create URL that the extension would open
    const frontendUrl = 'http://localhost:3002';
    const loginUrl = `${frontendUrl}/?vscode=true&state=${encodeURIComponent(state)}`;
    console.log('🔗 Extension would open URL:', loginUrl);
    
    // Test if URL is accessible
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    const parsedUrl = url.parse(loginUrl);
    const module = parsedUrl.protocol === 'https:' ? https : http;
    
    return new Promise((resolve, reject) => {
        const req = module.get(loginUrl, (res) => {
            console.log('🔗 URL Status:', res.statusCode);
            console.log('🔗 URL Headers:', res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('🔗 URL Response length:', data.length);
                console.log('🔗 URL Contains "login":', data.includes('login'));
                console.log('🔗 URL Contains "vscode":', data.includes('vscode'));
                resolve(res.statusCode);
            });
        });
        
        req.on('error', (err) => {
            console.error('🔗 URL Error:', err.message);
            reject(err);
        });
        
        req.setTimeout(5000, () => {
            console.error('🔗 URL Timeout');
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// Test URL that would be generated in a browser callback
async function testCallbackUrl() {
    console.log('🧪 Testing callback URL generation...');
    
    // Simulate what the frontend would generate for a logged-in user
    const state = 'test-state-123';
    const token = 'sample-jwt-token-here';
    const refreshToken = 'sample-refresh-token-here';
    const userId = '12345';
    const username = 'testuser';
    
    const callbackUrl = `vscode://alphanetix-code-assistant/auth-callback` +
        `?token=${encodeURIComponent(token)}` +
        `&refreshToken=${encodeURIComponent(refreshToken)}` +
        `&userId=${userId}` +
        `&username=${encodeURIComponent(username)}` +
        `&state=${encodeURIComponent(state)}`;
    
    console.log('🔗 Frontend would generate callback URL:', callbackUrl);
    console.log('🔗 Callback URL length:', callbackUrl.length);
    
    // Parse URL to verify structure
    const url = require('url');
    const parsed = url.parse(callbackUrl, true);
    console.log('🔗 Parsed scheme:', parsed.protocol);
    console.log('🔗 Parsed host:', parsed.hostname);
    console.log('🔗 Parsed path:', parsed.pathname);
    console.log('🔗 Parsed query:', parsed.query);
}

async function runTests() {
    try {
        await testLogin();
        await testCallbackUrl();
        console.log('✅ All tests completed');
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

runTests();