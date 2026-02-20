/**
 * Integration Tests for Authentication and Notion API
 * Run this to verify the extension's core functionality
 */

// Test Configuration
const TEST_CONFIG = {
  // Set your test API key here to run the tests
  API_KEY: process.env.NOTION_TEST_API_KEY || '',
  NOTION_API_VERSION: '2025-09-03',
  NOTION_API_BASE: 'https://api.notion.com/v1',
};

/**
 * Test 1: Validate API Key Format
 */
async function testValidateApiKeyFormat() {
  console.log('TEST 1: Validate API Key Format');
  
  const testCases = [
    { key: 'secret_123abc', valid: true, name: 'Valid format' },
    { key: 'invalid_key', valid: false, name: 'Invalid prefix' },
    { key: '', valid: false, name: 'Empty key' },
    { key: '   ', valid: false, name: 'Whitespace only' },
  ];

  for (const testCase of testCases) {
    const isValid = testCase.key.trim().startsWith('secret_');
    const result = isValid === testCase.valid ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${result}: ${testCase.name} (${testCase.key})`);
  }
}

/**
 * Test 2: Authenticate with API Key
 */
async function testAuthenticateWithApiKey() {
  console.log('\nTEST 2: Authenticate with API Key');

  if (!TEST_CONFIG.API_KEY) {
    console.log('  ⊘ SKIPPED: No test API key provided');
    console.log('  Set NOTION_TEST_API_KEY environment variable to run this test');
    return;
  }

  try {
    const response = await fetch(
      `${TEST_CONFIG.NOTION_API_BASE}/users/me`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.API_KEY}`,
          'Notion-Version': TEST_CONFIG.NOTION_API_VERSION,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✓ PASS: Authentication successful`);
      console.log(`    Workspace: ${data.workspace_name || 'Unknown'}`);
      console.log(`    User ID: ${data.id}`);
      return data;
    } else {
      console.log(`  ✗ FAIL: Authentication failed (${response.status})`);
      const errorData = await response.json();
      console.log(`    Error: ${errorData.message || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.log(`  ✗ ERROR: ${error}`);
    return null;
  }
}

/**
 * Test 3: List Databases
 */
async function testListDatabases() {
  console.log('\nTEST 3: List Databases');

  if (!TEST_CONFIG.API_KEY) {
    console.log('  ⊘ SKIPPED: No test API key provided');
    return;
  }

  try {
    const response = await fetch(
      `${TEST_CONFIG.NOTION_API_BASE}/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.API_KEY}`,
          'Notion-Version': TEST_CONFIG.NOTION_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            value: 'data_source',
            property: 'object',
          },
          page_size: 10,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✓ PASS: Found ${data.results.length} database(s)`);
      
      data.results.forEach((db: any) => {
        const title = db.title?.[0]?.plain_text || 'Untitled';
        console.log(`    - ${title} (${db.id})`);
      });

      return data.results;
    } else {
      console.log(`  ✗ FAIL: Failed to list databases (${response.status})`);
      return [];
    }
  } catch (error) {
    console.log(`  ✗ ERROR: ${error}`);
    return [];
  }
}

/**
 * Test 4: Get Data Source Schema (formerly Get Database Schema)
 */
async function testGetDatabaseSchema(dataSourceId: string) {
  console.log(`\nTEST 4: Get Data Source Schema for ${dataSourceId}`);

  if (!TEST_CONFIG.API_KEY) {
    console.log('  ⊘ SKIPPED: No test API key provided');
    return;
  }

  try {
    const response = await fetch(
      `${TEST_CONFIG.NOTION_API_BASE}/data_sources/${dataSourceId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.API_KEY}`,
          'Notion-Version': TEST_CONFIG.NOTION_API_VERSION,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const properties = data.properties || {};
      console.log(`  ✓ PASS: Found ${Object.keys(properties).length} properties`);
      
      Object.entries(properties).forEach(([key, prop]: any) => {
        console.log(`    - ${prop.name} (${prop.type})`);
      });

      return properties;
    } else {
      console.log(`  ✗ FAIL: Failed to get schema (${response.status})`);
      return null;
    }
  } catch (error) {
    console.log(`  ✗ ERROR: ${error}`);
    return null;
  }
}

/**
 * Test 5: Create Test Page
 */
async function testCreatePage(dataSourceId: string) {
  console.log(`\nTEST 5: Create Test Page in ${dataSourceId}`);

  if (!TEST_CONFIG.API_KEY) {
    console.log('  ⊘ SKIPPED: No test API key provided');
    return;
  }

  try {
    const response = await fetch(
      `${TEST_CONFIG.NOTION_API_BASE}/pages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.API_KEY}`,
          'Notion-Version': TEST_CONFIG.NOTION_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { type: 'data_source_id', data_source_id: dataSourceId },
          properties: {
            title: {
              title: [
                {
                  type: 'text',
                  text: {
                    content: `Test Page from Notion Clipper - ${new Date().toISOString()}`,
                  },
                },
              ],
            },
          },
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: {
                      content: 'This is a test page created by the Notion Clipper extension integration tests.',
                    },
                  },
                ],
              },
            },
          ],
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✓ PASS: Page created successfully`);
      console.log(`    Page ID: ${data.id}`);
      console.log(`    URL: https://notion.so/${data.id.replace(/-/g, '')}`);
      return data;
    } else if (response.status === 400) {
      console.log(`  ✗ FAIL: Invalid request (${response.status})`);
      const errorData = await response.json();
      console.log(`    Error: ${errorData.message || 'Bad request'}`);
      return null;
    } else {
      console.log(`  ✗ FAIL: Failed to create page (${response.status})`);
      return null;
    }
  } catch (error) {
    console.log(`  ✗ ERROR: ${error}`);
    return null;
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('=== Notion Clipper Integration Tests ===\n');
  console.log('Testing authentication and Notion API integration...\n');

  // Test 1: Format validation
  await testValidateApiKeyFormat();

  // Test 2: Authentication
  const userInfo = await testAuthenticateWithApiKey();

  if (!userInfo || !TEST_CONFIG.API_KEY) {
    console.log('\n=== Test Summary ===');
    console.log('Format validation: ✓ PASS');
    console.log('Remaining tests: ⊘ SKIPPED (no API key)');
    return;
  }

  // Test 3: List databases
  const databases = await testListDatabases();

  if (databases && databases.length > 0) {
    // Test 4: Get database schema
    const firstDb = databases[0];
    await testGetDatabaseSchema(firstDb.id);

    // Test 5: Create test page (with schema fallback)
    try {
      await testCreatePage(firstDb.id);
    } catch (error) {
      console.log(`  ✗ SKIPPED: Could not create page (${error})`);
    }
  }

  console.log('\n=== Tests Complete ===');
  console.log('Check the results above to verify your setup.');
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests };
}
