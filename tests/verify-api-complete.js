#!/usr/bin/env node
/**
 * Complete test script for Notion API 2025-09-03 integration
 * Verifies all key API endpoints used by Notion Clipper
 */

const https = require('https');

// Configuration
const config = {
  apiKey: process.env.NOTION_TEST_API_KEY || '',
  apiVersion: '2025-09-03',
  baseUrl: 'api.notion.com',
};

// Helper to make HTTPS requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.baseUrl,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Notion-Version': config.apiVersion,
        'Content-Type': 'application/json',
        'User-Agent': 'Notion-Clipper/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, body: parsedBody, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test cases
async function runTests() {
  console.log('🧪 Notion Clipper Complete API Integration Tests\n');

  if (!config.apiKey) {
    console.log(
      '❌ SKIPPED: Set NOTION_TEST_API_KEY environment variable to run tests\n' +
        'Example: export NOTION_TEST_API_KEY=secret_abc123def456...\n'
    );
    return;
  }

  // Test 1: Verify API Key
  console.log('📋 Test 1: Verify API Key');
  try {
    const result = await makeRequest('GET', '/v1/users/me');
    if (result.status === 200) {
      console.log('✅ API Key is valid');
      console.log(`   Workspace: ${result.body.workspace_name || 'N/A'}`);
      console.log(`   User ID: ${result.body.id}\n`);
    } else {
      console.log(`❌ API Key validation failed (${result.status})`);
      console.log(`   ${result.body?.message || 'Unknown error'}\n`);
      return;
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}\n`);
    return;
  }

  // Test 2: List Data Sources
  console.log('📋 Test 2: List Data Sources');
  let dataSourceId = null;
  try {
    const result = await makeRequest('POST', '/v1/search', {
      filter: { value: 'data_source', property: 'object' },
      page_size: 10,
    });

    if (result.status === 200) {
      const count = result.body.results?.length || 0;
      console.log(`✅ Found ${count} data source(s)`);

      if (count > 0) {
        result.body.results.forEach((ds, idx) => {
          const title = ds.title?.[0]?.plain_text || 'Untitled';
          console.log(`   ${idx + 1}. ${title} (${ds.id.substring(0, 8)}...)`);
        });
        console.log('');

        // Store first data source ID for next tests
        dataSourceId = result.body.results[0].id;
      }
    } else {
      console.log(`❌ Failed to list data sources (${result.status})`);
      console.log(`   Error: ${result.body?.message || 'Unknown error'}\n`);
      return;
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}\n`);
    return;
  }

  if (!dataSourceId) {
    console.log('⚠️  No data sources found. Skipping remaining tests.\n');
    return;
  }

  // Test 3: Get Data Source Schema
  console.log('📋 Test 3: Get Data Source Schema');
  try {
    const result = await makeRequest('GET', `/v1/data_sources/${dataSourceId}`);

    if (result.status === 200) {
      const properties = result.body.properties || {};
      const propCount = Object.keys(properties).length;
      console.log(`✅ Retrieved schema with ${propCount} properties`);
      
      Object.entries(properties).slice(0, 3).forEach(([key, prop]) => {
        console.log(`   - ${prop.name} (${prop.type})`);
      });
      if (propCount > 3) {
        console.log(`   ... and ${propCount - 3} more`);
      }
      console.log('');
    } else {
      console.log(`❌ Failed to get schema (${result.status})`);
      console.log(`   Error: ${result.body?.message || 'Unknown error'}\n`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}\n`);
  }

  // Test 4: Create Test Page
  console.log('📋 Test 4: Create Test Page');
  try {
    const testPageTitle = `Test from API (${new Date().toISOString()})`;
    
    const result = await makeRequest('POST', '/v1/pages', {
      parent: {
        type: 'data_source_id',
        data_source_id: dataSourceId,
      },
      properties: {
        title: {
          title: [
            {
              type: 'text',
              text: {
                content: testPageTitle,
              },
            },
          ],
        },
      },
    });

    if (result.status === 200) {
      console.log('✅ Successfully created test page');
      console.log(`   Page ID: ${result.body.id}`);
      console.log(`   Title: ${testPageTitle}\n`);
    } else {
      console.log(`❌ Failed to create page (${result.status})`);
      console.log(`   Error: ${result.body?.message || 'Unknown error'}\n`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}\n`);
  }

  // Test 5: Query Data Source
  console.log('📋 Test 5: Query Data Source');
  try {
    const result = await makeRequest('POST', `/v1/data_sources/${dataSourceId}/query`, {
      page_size: 5,
    });

    if (result.status === 200) {
      const pageCount = result.body.results?.length || 0;
      console.log(`✅ Successfully queried data source`);
      console.log(`   Found ${pageCount} page(s)`);
      
      if (pageCount > 0) {
        result.body.results.slice(0, 2).forEach((page, idx) => {
          const title = page.properties?.title?.title?.[0]?.plain_text || 'Untitled';
          console.log(`   ${idx + 1}. ${title}`);
        });
      }
      console.log('');
    } else {
      console.log(`❌ Failed to query data source (${result.status})`);
      console.log(`   Error: ${result.body?.message || 'Unknown error'}\n`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}\n`);
  }

  console.log('✨ Test suite completed!\n');
}

// Run tests
runTests().catch(console.error);
