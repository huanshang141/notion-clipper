const fs = require('fs');
const https = require('https');
const path = require('path');

// Configuration
const HTML_FILE_PATH = path.join(__dirname, '大事正在发生，但大多数人还没有意识到.html');
const NOTION_API_KEY = process.env.NOTION_TEST_API_KEY;
const NOTION_VERSION = '2025-09-03';

if (!NOTION_API_KEY) {
  console.error('Error: Please set NOTION_TEST_API_KEY environment variable.');
  process.exit(1);
}

// 1. Read HTML File
console.log(`Reading file: ${HTML_FILE_PATH}`);
let htmlContent = '';
try {
  htmlContent = fs.readFileSync(HTML_FILE_PATH, 'utf8');
  console.log(`File read successfully. Size: ${htmlContent.length} bytes`);
} catch (err) {
  console.error('Error reading file:', err);
  process.exit(1);
}

// 2. Simulate Extraction (Simplified)
console.log('Simulating extraction...');
const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
const title = titleMatch ? titleMatch[1] : 'Untitled Test Page';

// Extract images - broader regex to catch src and data-src
const imgRegex = /<img[^>]+(?:src|data-src)=["']([^"']+)["']/g;
let match;
const images = [];
while ((match = imgRegex.exec(htmlContent)) !== null) {
  // If it's a data URI, it might be very long and was missed by previous simpler regexes?
  // Or maybe it's not base64 encoded standard way?
  // Just push what we found.
  images.push({ src: match[1] });
}
console.log(`Found ${images.length} images (via regex).`);
console.log(`Found ${images.length} images.`);

// Extraction logic simulation
const article = {
  title: title,
  content: "This is a test upload of the extracted content.",
  url: "file://" + HTML_FILE_PATH,
  images: images,
  mainImage: images.length > 0 ? images[0].src : null,
  favicon: "https://www.notion.so/images/favicon.ico" // Mock favicon for test
};

// 3. Prepare Payload (Implementing the FIX logic here to verify it)
const children = [];
children.push({
  object: 'block',
  type: 'paragraph',
  paragraph: {
    rich_text: [{ type: 'text', text: { content: "Content from automated test." } }]
  }
});

let skippedImages = 0;
let addedImages = 0;

// Image validation logic from src/services/notion.ts
if (article.images && article.images.length > 0) {
  const imageLimit = 50; // Increased limit to catching later images
  for (let i = 0; i < Math.min(article.images.length, imageLimit); i++) {
    const img = article.images[i];
    if (img && img.src) {
      const imageUrl = img.src;
      
      // FIX: Check length
      if (imageUrl.length > 2000) {
        // console.warn(`Skipping long image (${imageUrl.length} chars)`);
        skippedImages++;
        continue;
      }

      children.push({
        object: 'block',
        type: 'image',
        image: {
          type: 'external',
          external: {
            url: imageUrl,
          },
        },
      });
      addedImages++;
    }
  }
}

console.log(`Payload prepared: ${addedImages} images added, ${skippedImages} skipped (too long).`);

// 4. Upload to Notion
// First need to find a database to save to
async function upload() {
  try {
    // Step A: Search for a database (Data Source)
    console.log('Searching for a database...');
    // In Notion API 2025-09-03, search for data_source objects
    const searchRes = await makeRequest('POST', '/v1/search', {
      filter: { value: 'data_source', property: 'object' },
      page_size: 1,
    });
    
    if (!searchRes.body.results || searchRes.body.results.length === 0) {
       console.warn('No databases found via search API. This likely means no database is shared with the integration.');
       console.warn('Proceeding with a dummy database ID to test payload validation...');
       // Use a syntactically valid UUID to pass basic validation, expecting 404 Object Not Found from Notion API
       // instead of 400 Validation Error on payload body.
       var databaseId = '11111111-1111-1111-1111-111111111111'; 
    } else {
       var databaseId = searchRes.body.results[0].id;
       console.log(`Found database: ${databaseId}`);
    }

    // Step B: Create Page
    const pagePayload = {
      parent: { 
        type: 'data_source_id',
        data_source_id: databaseId 
      },
      properties: {
        title: {
          title: [{ type: 'text', text: { content: `[TEST] ${article.title}` } }]
        }
      },
      children: children
    };
    
    // Validate cover/icon length
    if (article.favicon && article.favicon.length <= 2000) {
        pagePayload.icon = { type: 'external', external: { url: article.favicon } };
    }
    // We skip cover if mainImage is too long
    if (article.mainImage && article.mainImage.length <= 2000) {
         pagePayload.cover = { type: 'external', external: { url: article.mainImage } };
    } else if (article.mainImage) {
        console.log('Skipping cover (mainImage too long)');
    }

    console.log('Creating page...');
    const createRes = await makeRequest('POST', '/v1/pages', pagePayload);
    
    if (createRes.status === 200) {
      console.log('✅ Page created successfully!');
      console.log(`URL: ${createRes.body.url}`);
    } else {
      console.error('❌ Failed to create page.');
      console.error('Status:', createRes.status);
      console.error('Response:', JSON.stringify(createRes.body, null, 2));
    }

  } catch (err) {
    console.error('Test failed:', err);
  }
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

upload();
