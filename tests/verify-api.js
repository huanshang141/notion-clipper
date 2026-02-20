#!/usr/bin/env node
/**
 * Test script for Notion API integration
 * This script simulates the key workflows to verify API integration
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
  console.log('🧪 Notion Clipper API Integration Tests\n');

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
      console.log(`   Workspace: ${result.body.workspace_name}`);
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

  // Test 2: List Data Sources (formerly databases)
  console.log('📋 Test 2: List Data Sources');
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
        return result.body.results[0].id;
      }
    } else {
      console.log(`❌ Failed to list data sources (${result.status})`);
      console.log(`   Error: ${result.body?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
  }

  return null;
}

// Run tests
runTests().catch(console.error);
