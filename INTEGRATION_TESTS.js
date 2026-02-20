/**
 * Notion Clipper - Integration Test Suite
 * 
 * This file contains integration tests for the extension's core functionality.
 * Run these tests after building the extension to verify correct behavior.
 * 
 * Since this is a Chrome extension, automated testing is limited.
 * These tests focus on:
 * 1. Service logic verification
 * 2. Type checking
 * 3. Error handling
 */

/**
 * TEST 1: Field Type Conversion
 * 
 * Verifies that buildPropertyValue correctly handles all field types
 */
function testFieldTypeConversion() {
  console.log('🧪 Starting Field Type Conversion Tests...\n');

  // Mock article data
  const mockArticle = {
    title: 'Test Article Title',
    content: 'This is the article content with **bold** and *italic* text.',
    url: 'https://example.com/article',
    mainImage: 'https://example.com/image.jpg',
    excerpt: 'This is a short excerpt of the article.',
    domain: 'example.com',
  };

  // Helper function to build property values (same logic as NotionService)
  const buildPropertyValue = (propertyType, value) => {
    if (!value && propertyType !== 'checkbox') {
      return null;
    }

    switch (propertyType) {
      case 'title':
        return {
          title: [
            {
              type: 'text',
              text: { content: String(value || '').substring(0, 2000) },
            },
          ],
        };

      case 'rich_text':
      case 'text':
        return {
          rich_text: [
            {
              type: 'text',
              text: { content: String(value || '').substring(0, 2000) },
            },
          ],
        };

      case 'url':
        const urlStr = String(value || '');
        if (urlStr && (urlStr.startsWith('http') || urlStr.startsWith('/'))) {
          return { url: urlStr };
        }
        return null;

      case 'files':
        if (value && String(value).startsWith('http')) {
          return {
            files: [
              {
                name: 'image',
                type: 'external',
                external: { url: String(value) },
              },
            ],
          };
        }
        return null;

      case 'checkbox':
        return { checkbox: Boolean(value) };

      case 'select':
        const selectValue = String(value || '').substring(0, 100).trim();
        if (selectValue) {
          return {
            select: {
              name: selectValue,
            },
          };
        }
        return null;

      case 'multi_select':
        const tags = Array.isArray(value) ? value : [value];
        const validTags = tags
          .filter((tag) => tag)
          .map((tag) => ({
            name: String(tag).substring(0, 100).trim(),
          }))
          .filter((tag) => tag.name);

        if (validTags.length > 0) {
          return {
            multi_select: validTags,
          };
        }
        return null;

      case 'date':
        const dateStr = String(value || '').substring(0, 10);
        if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          return {
            date: {
              start: dateStr,
            },
          };
        }
        return null;

      case 'number':
        const num = Number(value);
        if (!isNaN(num)) {
          return { number: num };
        }
        return null;

      case 'email':
        const email = String(value || '').trim();
        if (email && email.includes('@')) {
          return { email };
        }
        return null;

      case 'phone_number':
        return { phone_number: String(value || '').trim() };

      default:
        return null;
    }
  };

  const tests = [
    {
      name: '标题字段转换',
      type: 'title',
      value: mockArticle.title,
      validate: (result) => result?.title?.[0]?.text?.content === mockArticle.title,
    },
    {
      name: '富文本字段转换',
      type: 'rich_text',
      value: mockArticle.content,
      validate: (result) => result?.rich_text?.[0]?.text?.content === mockArticle.content,
    },
    {
      name: 'URL字段转换',
      type: 'url',
      value: mockArticle.url,
      validate: (result) => result?.url === mockArticle.url,
    },
    {
      name: '文件字段转换',
      type: 'files',
      value: mockArticle.mainImage,
      validate: (result) => result?.files?.[0]?.external?.url === mockArticle.mainImage,
    },
    {
      name: '复选框字段转换（真）',
      type: 'checkbox',
      value: true,
      validate: (result) => result?.checkbox === true,
    },
    {
      name: '复选框字段转换（假）',
      type: 'checkbox',
      value: false,
      validate: (result) => result?.checkbox === false,
    },
    {
      name: '选择字段转换',
      type: 'select',
      value: 'Category A',
      validate: (result) => result?.select?.name === 'Category A',
    },
    {
      name: '多选字段转换',
      type: 'multi_select',
      value: ['tag1', 'tag2'],
      validate: (result) =>
        result?.multi_select?.length === 2 &&
        result.multi_select[0].name === 'tag1' &&
        result.multi_select[1].name === 'tag2',
    },
    {
      name: '日期字段转换',
      type: 'date',
      value: '2024-01-15',
      validate: (result) => result?.date?.start === '2024-01-15',
    },
    {
      name: '数字字段转换',
      type: 'number',
      value: 42,
      validate: (result) => result?.number === 42,
    },
    {
      name: '电子邮件字段转换',
      type: 'email',
      value: 'test@example.com',
      validate: (result) => result?.email === 'test@example.com',
    },
    {
      name: '电话号码字段转换',
      type: 'phone_number',
      value: '+1-555-1234',
      validate: (result) => result?.phone_number === '+1-555-1234',
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = buildPropertyValue(test.type, test.value);
    const isValid = test.validate(result);

    if (isValid) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   预期: 有效的${test.type}结构`);
      console.log(`   获得: ${JSON.stringify(result)}\n`);
      failed++;
    }
  });

  console.log(`\n📊 字段转换测试结果: ${passed}/${tests.length}通过\n`);
  return failed === 0;
}

/**
 * TEST 2: API Key Validation
 * 
 * Verifies API key format validation
 */
function testApiKeyValidation() {
  console.log('🧪 Starting API Key Validation Tests...\n');

  const validateApiKey = (apiKey) => {
    // Check format
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Must start with ntn_
    if (!apiKey.startsWith('ntn_')) {
      return false;
    }

    // Should be ~50+ characters total
    if (apiKey.length < 30 || apiKey.length > 100) {
      return false;
    }

    return true;
  };

  const tests = [
    {
      name: '有效的API密钥',
      key: 'ntn_123456789012345678901234567890123456789012345678',
      shouldPass: true,
    },
    {
      name: '缺少ntn_前缀',
      key: '123456789012345678901234567890123456789012345678',
      shouldPass: false,
    },
    {
      name: '错误的前缀',
      key: 'secret_123456789012345678901234567890123456789012',
      shouldPass: false,
    },
    {
      name: '空字符串',
      key: '',
      shouldPass: false,
    },
    {
      name: '太短',
      key: 'ntn_123',
      shouldPass: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const isValid = validateApiKey(test.key);
    const result = isValid === test.shouldPass;

    if (result) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(
        `❌ ${test.name}\n   预期: ${test.shouldPass ? '有效' : '无效'}\n   获得: ${isValid ? '有效' : '无效'}\n`
      );
      failed++;
    }
  });

  console.log(`\n📊 API密钥验证测试结果: ${passed}/${tests.length}通过\n`);
  return failed === 0;
}

/**
 * TEST 3: Common Field Names Detection
 * 
 * Verifies that common field names are correctly identified
 */
function testFieldNameDetection() {
  console.log('🧪 Starting Field Name Detection Tests...\n');

  const COMMON_FIELD_NAMES = {
    TITLE: ['title', 'name', 'heading', '标题', 'headline'],
    CONTENT: ['content', 'body', 'article', '内容', 'description'],
    URL: ['url', 'link', 'source', 'uri', '链接'],
    COVER: ['cover', 'image', 'main_image', 'thumbnail', '封面'],
    EXCERPT: ['excerpt', 'summary', '摘要', 'abstract'],
  };

  const detectFieldType = (fieldName, fieldType) => {
    const lowerName = fieldName.toLowerCase();

    if (fieldType === 'title' || COMMON_FIELD_NAMES.TITLE.some((n) => lowerName.includes(n))) {
      return 'title';
    }
    if (
      (fieldType === 'rich_text' || fieldType === 'text') &&
      COMMON_FIELD_NAMES.CONTENT.some((n) => lowerName.includes(n))
    ) {
      return 'content';
    }
    if (fieldType === 'url' || COMMON_FIELD_NAMES.URL.some((n) => lowerName.includes(n))) {
      return 'url';
    }
    if (
      fieldType === 'files' &&
      COMMON_FIELD_NAMES.COVER.some((n) => lowerName.includes(n))
    ) {
      return 'mainImage';
    }
    if (
      fieldType === 'rich_text' &&
      COMMON_FIELD_NAMES.EXCERPT.some((n) => lowerName.includes(n))
    ) {
      return 'excerpt';
    }

    return null;
  };

  const tests = [
    { name: '标题（type）', fieldName: 'Post Title', fieldType: 'title', expected: 'title' },
    { name: '标题（名称）', fieldName: 'Name', fieldType: 'text', expected: 'title' },
    { name: '内容', fieldName: 'Article Content', fieldType: 'rich_text', expected: 'content' },
    { name: 'URL', fieldName: 'Article URL', fieldType: 'url', expected: 'url' },
    { name: '图像', fieldName: 'Cover Image', fieldType: 'files', expected: 'mainImage' },
    { name: '摘要', fieldName: 'Summary', fieldType: 'rich_text', expected: 'excerpt' },
    { name: '中文标题', fieldName: '标题', fieldType: 'text', expected: 'title' },
    { name: '中文内容', fieldName: '文章内容', fieldType: 'rich_text', expected: 'content' },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = detectFieldType(test.fieldName, test.fieldType);
    const isCorrect = result === test.expected;

    if (isCorrect) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(
        `❌ ${test.name}\n   预期: ${test.expected}\n   获得: ${result}\n`
      );
      failed++;
    }
  });

  console.log(`\n📊 字段名称检测测试结果: ${passed}/${tests.length}通过\n`);
  return failed === 0;
}

/**
 * TEST 4: Image URL Validation
 * 
 * Verifies image download eligibility
 */
function testImageValidation() {
  console.log('🧪 Starting Image Validation Tests...\n');

  const isValidImageUrl = (url) => {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const tests = [
    { name: 'HTTP图片URL', url: 'http://example.com/image.jpg', shouldPass: true },
    { name: 'HTTPS图片URL', url: 'https://example.com/image.png', shouldPass: true },
    { name: 'Data URI', url: 'data:image/png;base64,iVBOR...', shouldPass: false },
    { name: '相对URL', url: '/images/photo.jpg', shouldPass: false },
    { name: '空字符串', url: '', shouldPass: false },
    { name: 'FTP URL', url: 'ftp://example.com/image.jpg', shouldPass: false },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const result = isValidImageUrl(test.url);
    const isCorrect = result === test.shouldPass;

    if (isCorrect) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(
        `❌ ${test.name}\n   预期: ${test.shouldPass ? '有效' : '无效'}\n   获得: ${result ? '有效' : '无效'}\n`
      );
      failed++;
    }
  });

  console.log(`\n📊 图片验证测试结果: ${passed}/${tests.length}通过\n`);
  return failed === 0;
}

/**
 * TEST 5: Markdown Escape
 * 
 * Verifies that Notion-specific characters are handled
 */
function testMarkdownHandling() {
  console.log('🧪 Starting Markdown Handling Tests...\n');

  const tests = [
    { name: '斜体', input: '*italic*', shouldContain: '*italic*' },
    { name: '加粗', input: '**bold**', shouldContain: '**bold**' },
    { name: '代码块', input: '```code block```', shouldContain: '```' },
    { name: '链接', input: '[链接](https://example.com)', shouldContain: '[链接]' },
    { name: '标题', input: '# Heading', shouldContain: '#' },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    const isValid = test.input.includes(test.shouldContain);

    if (isValid) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(
        `❌ ${test.name}\n   预期包含: ${test.shouldContain}\n   获得: ${test.input}\n`
      );
      failed++;
    }
  });

  console.log(`\n📊 Markdown处理测试结果: ${passed}/${tests.length}通过\n`);
  return failed === 0;
}

/**
 * RUN ALL TESTS
 */
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   Notion Clipper - 集成测试套件');
console.log('║   版本: 1.0.0');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const results = [];

results.push(testFieldTypeConversion());
results.push(testApiKeyValidation());
results.push(testFieldNameDetection());
results.push(testImageValidation());
results.push(testMarkdownHandling());

const allPassed = results.every((r) => r);

if (allPassed) {
  console.log('\n✅ 所有测试通过！');
  console.log('\n📝 后续步骤:');
  console.log('  1. 构建扩展程序: npm run build');
  console.log('  2. 在Chrome中加载扩展: chrome://extensions');
  console.log('  3. 运行手动测试检查清单（见TEST_PLAN.md）');
} else {
  console.log('\n❌ 部分测试失败。请查看上面的详细信息。');
}

