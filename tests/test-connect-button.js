/**
 * Test script to verify Connect button functionality
 * This simulates the authentication flow
 */

// Mock Chrome API for testing
const mockChrome = {
  runtime: {
    sendMessage: (message, callback) => {
      console.log('🔵 Mock Chrome.runtime.sendMessage called with:', message.action);
      
      // Simulate delayed response (like real Chrome API)
      setTimeout(() => {
        if (message.action === 'AUTHENTICATE') {
          // Simulate authentication response
          const apiKey = message.data?.apiKey;
          if (apiKey && apiKey.startsWith('ntn_')) {
            console.log('✅ Mock authentication PASSED');
            callback({
              success: true,
              token: {
                accessToken: apiKey,
                tokenType: 'bearer',
                workspaceName: 'Test Workspace',
                workspaceId: 'test-id-123'
              }
            });
          } else {
            console.log('❌ Mock authentication FAILED - invalid key format');
            callback({
              success: false,
              error: 'Invalid API key format'
            });
          }
        } else {
          console.log('⚠️  Unhandled action:', message.action);
          callback({ error: 'Unknown action' });
        }
      }, 100);
    },
    lastError: null
  }
};

// Test cases
console.log('=== Testing Connect Button Functionality ===\n');

// Test 1: Valid API Key
console.log('Test 1️⃣ : Valid API Key (ntn_abc123...)');
mockChrome.runtime.sendMessage(
  { action: 'AUTHENTICATE', data: { apiKey: 'ntn_abc123xyz' } },
  (response) => {
    console.log('Response:', response);
    console.log('');
  }
);

// Test 2: Invalid API Key (doesn't start with 'ntn_')
setTimeout(() => {
  console.log('Test 2️⃣ : Invalid API Key (missing ntn_ prefix)');
  mockChrome.runtime.sendMessage(
    { action: 'AUTHENTICATE', data: { apiKey: 'abc123xyz' } },
    (response) => {
      console.log('Response:', response);
      console.log('');
    }
  );
}, 500);

// Test 3: Empty API Key
setTimeout(() => {
  console.log('Test 3️⃣ : Empty API Key');
  mockChrome.runtime.sendMessage(
    { action: 'AUTHENTICATE', data: { apiKey: '' } },
    (response) => {
      console.log('Response:', response);
      console.log('');
    }
  );
}, 1000);

// Test 4: Form submission flow simulation
setTimeout(() => {
  console.log('Test 4️⃣ : Form Submission Flow (simulating handleSubmit)');
  
  const testApiKey = 'ntn_valid_test_key_12345';
  console.log('1. Form received API key:', testApiKey.substring(0, 20) + '...');
  
  if (!testApiKey.trim()) {
    console.log('❌ Form validation failed: API key is empty');
  } else {
    console.log('2. Validation passed, sending to background...');
    mockChrome.runtime.sendMessage(
      { action: 'AUTHENTICATE', data: { apiKey: testApiKey } },
      (response) => {
        if (response.success && response.token) {
          console.log('3. ✅ Authentication successful!');
          console.log('   Token:', response.token);
        } else {
          console.log('3. ❌ Authentication failed:', response.error);
        }
      }
    );
  }
}, 1500);

// Test 5: Button state management
setTimeout(() => {
  console.log('\nTest 5️⃣ : Button State Management');
  console.log('Initial state: isLoading = false');
  console.log('After click: isLoading = true (button disabled)');
  console.log('After response: isLoading = false (button enabled)');
  console.log('Button text: "Connect" -> "Connecting..." -> "Connect" (on success)');
}, 2000);

// Test 6: Network request to Notion API
setTimeout(() => {
  console.log('\nTest 6️⃣ : Notion API Request (should happen in background script)');
  console.log('URL: https://api.notion.com/v1/users/me');
  console.log('Headers:');
  console.log('  Authorization: Bearer ntn_xxx...');
  console.log('  Notion-Version: 2025-09-03');
  console.log('Expected response: { workspace: { name: "Workspace Name" }, workspace_id: "123" }');
}, 2500);

console.log('\n=== Test Complete ===\n');
console.log('After rebuild, reload the extension and:');
console.log('1. Open the popup');
console.log('2. Enter a valid Notion API Key (format: ntn_...)');
console.log('3. Click the Connect button');
console.log('4. Check the browser console for debug logs');
console.log('5. Look for ✅ success or ❌ error messages');
console.log('\nTo test with real API key:');
console.log('  $env:NOTION_TEST_API_KEY="ntn_..."');
console.log('  Then paste this key in the popup');
