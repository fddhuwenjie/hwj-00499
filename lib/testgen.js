const fs = require('fs');
const path = require('path');
const { loadSpec, generateSummary, getSchemaProperties } = require('./parser');

function generateSampleValue(schema, spec, depth = 0) {
  if (depth > 3) return null;

  if (!schema) return null;

  if (schema.$ref) {
    const resolved = resolveRef(spec, schema.$ref);
    return generateSampleValue(resolved, spec, depth + 1);
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  const type = schema.type || 'object';

  switch (type) {
    case 'string':
      if (schema.format === 'date-time') {
        return new Date().toISOString();
      }
      if (schema.format === 'date') {
        return new Date().toISOString().split('T')[0];
      }
      if (schema.format === 'email') {
        return 'user@example.com';
      }
      if (schema.format === 'uri') {
        return 'https://example.com';
      }
      return 'string_value';

    case 'integer':
    case 'number':
      if (schema.minimum !== undefined) return schema.minimum;
      return 1;

    case 'boolean':
      return true;

    case 'array':
      const itemSample = generateSampleValue(schema.items, spec, depth + 1);
      return [itemSample];

    case 'object':
      const obj = {};
      const { properties, required } = getSchemaProperties(spec, schema);
      const propsToUse = required.length > 0
        ? required
        : Object.keys(properties).slice(0, 3);

      for (const propName of propsToUse) {
        const propSchema = properties[propName];
        if (propSchema) {
          obj[propName] = generateSampleValue(propSchema, spec, depth + 1);
        }
      }
      return obj;

    default:
      return null;
  }
}

function resolveRef(spec, ref) {
  if (!ref || !ref.startsWith('#/')) return null;
  const parts = ref.replace('#/', '').split('/');
  let current = spec;
  for (const part of parts) {
    if (current && current[part] !== undefined) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

function generateCurlExample(endpoint, spec, baseUrl) {
  if (baseUrl === undefined) baseUrl = 'https://api.example.com';
  const lines = [];

  let url = baseUrl + endpoint.path;

  const pathParams = endpoint.parameters.filter(p => p.in === 'path');
  for (let i = 0; i < pathParams.length; i++) {
    const p = pathParams[i];
    url = url.replace('{' + p.name + '}', generateSampleValue(p.schema, spec) || p.name);
  }

  const queryParams = endpoint.parameters.filter(p => p.in === 'query' && p.required);
  const queryStrings = [];
  for (let i = 0; i < queryParams.length; i++) {
    const p = queryParams[i];
    const value = generateSampleValue(p.schema, spec);
    if (value !== null && value !== undefined) {
      queryStrings.push(encodeURIComponent(p.name) + '=' + encodeURIComponent(String(value)));
    }
  }
  if (queryStrings.length > 0) {
    url += '?' + queryStrings.join('&');
  }

  lines.push('# ' + (endpoint.summary || endpoint.method + ' ' + endpoint.path));
  lines.push('curl -X ' + endpoint.method.toUpperCase() + ' "' + url + '" \\');

  const headerParams = endpoint.parameters.filter(p => p.in === 'header' && p.required);
  for (const p of headerParams) {
    const value = generateSampleValue(p.schema, spec);
    lines.push(`  -H "${p.name}: ${value}" \\`);
  }

  lines.push(`  -H "Content-Type: application/json" \\`);

  if (endpoint.requestBody && endpoint.requestBody.schema) {
    const bodySample = generateSampleValue(endpoint.requestBody.schema, spec);
    if (bodySample !== null) {
      const bodyJson = JSON.stringify(bodySample, null, 2);
      const indentedBody = bodyJson.split('\n').map((line, i) =>
        i === 0 ? `  -d '${line}` : `     ${line}`
      ).join('\n') + "'";
      lines.push(indentedBody);
    }
  } else {
    lines[lines.length - 1] = lines[lines.length - 1].replace(' \\', '');
  }

  lines.push('');

  return lines.join('\n');
}

function buildUrlTemplate(endpoint, pathParams, includeQuery) {
  if (includeQuery === undefined) includeQuery = false;
  let pathTemplate = endpoint.path;
  for (let i = 0; i < pathParams.length; i++) {
    const p = pathParams[i];
    pathTemplate = pathTemplate.replace('{' + p.name + '}', '${' + p.name + '}');
  }
  let urlTemplate = '${BASE_URL}' + pathTemplate;
  if (includeQuery) {
    const queryParams = endpoint.parameters.filter(p => p.in === 'query' && p.required);
    if (queryParams.length > 0) {
      urlTemplate += '?' + queryParams.map(p => '${encodeURIComponent("' + p.name + '")}=${encodeURIComponent(String(params.' + p.name + '))}').join('&');
    }
  }
  return urlTemplate;
}

function generateJestTest(endpoint, spec) {
  const lines = [];
  const testName = endpoint.summary || endpoint.method + ' ' + endpoint.path;

  lines.push("describe('" + endpoint.method + ' ' + endpoint.path + "', () => {");
  lines.push('');
  lines.push("  const BASE_URL = process.env.API_BASE_URL || 'https://api.example.com';");
  lines.push('');

  const allParams = endpoint.parameters || [];
  const pathParams = allParams.filter(p => p.in === 'path');
  const requiredParams = allParams.filter(p => p.required);
  const requiredQueryParams = allParams.filter(p => p.in === 'query' && p.required);
  const hasRequiredParams = requiredParams.length > 0;
  const hasRequestBody = endpoint.requestBody && endpoint.requestBody.required;

  const successStatus = Object.keys(endpoint.responses).find(s => s.startsWith('2')) || '200';
  const errorStatuses = Object.keys(endpoint.responses).filter(s => s.startsWith('4') || s.startsWith('5'));

  lines.push("  test('" + testName + " - 成功响应', async () => {");

  if (pathParams.length > 0 || requiredQueryParams.length > 0 || hasRequestBody) {
    lines.push('');
    for (let i = 0; i < pathParams.length; i++) {
      const p = pathParams[i];
      const sample = generateSampleValue(p.schema, spec);
      lines.push('    const ' + p.name + ' = ' + JSON.stringify(sample) + '; // ' + (p.description || '路径参数'));
    }
    if (requiredQueryParams.length > 0) {
      lines.push('    const params = {');
      for (let i = 0; i < requiredQueryParams.length; i++) {
        const p = requiredQueryParams[i];
        const sample = generateSampleValue(p.schema, spec);
        lines.push('      ' + p.name + ': ' + JSON.stringify(sample) + ', // ' + (p.description || '必填查询参数'));
      }
      lines.push('    };');
    }
    if (hasRequestBody) {
      const bodySample = generateSampleValue(endpoint.requestBody.schema, spec);
      const bodyStr = JSON.stringify(bodySample, null, 2);
      const indentedBody = bodyStr.split('\n').join('\n    ');
      lines.push('    const requestBody = ' + indentedBody + ';');
    }
  }

  const successUrlTemplate = buildUrlTemplate(endpoint, pathParams, true);
  lines.push('');
  lines.push('    const url = `' + successUrlTemplate + '`;');

  lines.push('');
  lines.push('    const response = await fetch(url, {');
  lines.push("      method: '" + endpoint.method + "',");
  lines.push('      headers: {');
  lines.push("        'Content-Type': 'application/json',");
  lines.push('      },');

  if (hasRequestBody) {
    lines.push('      body: JSON.stringify(requestBody),');
  }

  lines.push('    });');
  lines.push('');
  lines.push('    expect(response.status).toBe(' + successStatus + ');');
  lines.push('    const data = await response.json();');
  lines.push('    expect(data).toBeDefined();');

  const respSchema = endpoint.responses[successStatus] ? endpoint.responses[successStatus].schema : null;
  if (respSchema) {
    const schemaProps = getSchemaProperties(spec, respSchema);
    const required = schemaProps.required;
    if (required && required.length > 0) {
      lines.push('    // 验证必填字段');
      for (let i = 0; i < required.slice(0, 5).length; i++) {
        const field = required[i];
        lines.push('    expect(data.' + field + ').toBeDefined();');
      }
    }
  }

  lines.push('  });');
  lines.push('');

  if (errorStatuses.length > 0) {
    for (let i = 0; i < errorStatuses.slice(0, 2).length; i++) {
      const statusCode = errorStatuses[i];
      lines.push("  test('" + testName + ' - ' + statusCode + " 错误响应', async () => {");

      if (pathParams.length > 0) {
        lines.push('');
        for (let j = 0; j < pathParams.length; j++) {
          const p = pathParams[j];
          const sample = generateSampleValue(p.schema, spec);
          lines.push('    const ' + p.name + ' = ' + JSON.stringify(sample) + ';');
        }
      }

      const errorUrlTemplate = buildUrlTemplate(endpoint, pathParams, false);
      lines.push('');
      lines.push('    const url = `' + errorUrlTemplate + '`;');
      lines.push('');
      lines.push('    const response = await fetch(url, {');
      lines.push("      method: '" + endpoint.method + "',");
      lines.push('      headers: {');
      lines.push("        'Content-Type': 'application/json',");
      lines.push('      },');
      lines.push('      body: JSON.stringify({}), // 无效请求');
      lines.push('    });');
      lines.push('');
      lines.push('    expect(response.status).toBe(' + statusCode + ');');
      lines.push('  });');
      lines.push('');
    }
  }

  if (hasRequiredParams) {
    lines.push("  test('" + testName + " - 缺少必填参数', async () => {");

    let missingUrl = endpoint.path;
    for (let i = 0; i < pathParams.length; i++) {
      const p = pathParams[i];
      if (p.required) {
        missingUrl = missingUrl.replace('{' + p.name + '}', '${' + p.name + '}');
      }
    }
    if (pathParams.filter(p => p.required).length > 0) {
      lines.push('');
      const reqPathParams = pathParams.filter(p => p.required);
      for (let i = 0; i < reqPathParams.length; i++) {
        const p = reqPathParams[i];
        const sample = generateSampleValue(p.schema, spec);
        lines.push('    const ' + p.name + ' = ' + JSON.stringify(sample) + ';');
      }
    }
    lines.push('');
    lines.push('    const url = `${BASE_URL}' + missingUrl + '`;');
    lines.push('');
    lines.push('    const response = await fetch(url, {');
    lines.push("      method: '" + endpoint.method + "',");
    lines.push('      headers: {');
    lines.push("        'Content-Type': 'application/json',");
    lines.push('      },');
    lines.push('    });');
    lines.push('');
    lines.push('    expect(response.status).toBeGreaterThanOrEqual(400);');
    lines.push('  });');
    lines.push('');
  }

  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

function generateTests(spec, outputDir, options = {}) {
  const summary = generateSummary(spec);
  const baseUrl = (spec.servers && spec.servers[0] && spec.servers[0].url) || 'https://api.example.com';

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const curlLines = [];
  curlLines.push('# API 接口 cURL 示例');
  curlLines.push('');
  curlLines.push(`> 自动生成于 ${new Date().toLocaleString('zh-CN')}`);
  curlLines.push('');

  const jestTests = {};

  for (const endpoint of summary.endpoints) {
    curlLines.push(`## ${endpoint.method} ${endpoint.path}`);
    curlLines.push('');
    if (endpoint.summary) {
      curlLines.push(`**${endpoint.summary}**`);
      curlLines.push('');
    }
    if (endpoint.description) {
      curlLines.push(endpoint.description);
      curlLines.push('');
    }
    curlLines.push('```bash');
    curlLines.push(generateCurlExample(endpoint, spec, baseUrl).split('\n').slice(1).join('\n'));
    curlLines.push('```');
    curlLines.push('');

    const groupName = endpoint.path.split('/')[1] || 'default';
    if (!jestTests[groupName]) {
      jestTests[groupName] = [];
    }
    jestTests[groupName].push(generateJestTest(endpoint, spec));
  }

  fs.writeFileSync(path.join(outputDir, 'curl-examples.md'), curlLines.join('\n'), 'utf-8');

  const indexLines = [];
  indexLines.push("const { execSync } = require('child_process');");
  indexLines.push("const path = require('path');");
  indexLines.push("");
  indexLines.push("describe('API Contract Tests', () => {");
  indexLines.push("");

  for (const [group, tests] of Object.entries(jestTests)) {
    const fileName = `${group}.test.js`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, tests.join('\n\n'), 'utf-8');
    indexLines.push(`  describe('${group}', () => {`);
    indexLines.push(`    require('./${fileName}');`);
    indexLines.push(`  });`);
    indexLines.push('');
  }

  indexLines.push('});');
  indexLines.push('');

  fs.writeFileSync(path.join(outputDir, 'index.test.js'), indexLines.join('\n'), 'utf-8');

  const readmeLines = [];
  readmeLines.push('# API 契约测试');
  readmeLines.push('');
  readmeLines.push('本目录包含自动生成的 API 契约测试。');
  readmeLines.push('');
  readmeLines.push('## 文件说明');
  readmeLines.push('');
  readmeLines.push('- `curl-examples.md` - 所有接口的 cURL 示例');
  readmeLines.push('- `*.test.js` - Jest 测试骨架');
  readmeLines.push('- `index.test.js` - 测试入口文件');
  readmeLines.push('');
  readmeLines.push('## 运行测试');
  readmeLines.push('');
  readmeLines.push('```bash');
  readmeLines.push('# 设置 API 基础地址');
  readmeLines.push('export API_BASE_URL=https://api.example.com');
  readmeLines.push('');
  readmeLines.push('# 运行测试');
  readmeLines.push('npx jest');
  readmeLines.push('```');
  readmeLines.push('');

  fs.writeFileSync(path.join(outputDir, 'README.md'), readmeLines.join('\n'), 'utf-8');

  return {
    files: Object.keys(jestTests).length + 3,
    outputDir,
    endpoints: summary.endpoints.length
  };
}

function formatGenTestResult(result) {
  const lines = [];
  lines.push('');
  lines.push('✅ 测试生成完成');
  lines.push('='.repeat(50));
  lines.push(`   输出目录: ${result.outputDir}`);
  lines.push(`   生成文件数: ${result.files}`);
  lines.push(`   覆盖接口数: ${result.endpoints}`);
  lines.push('');
  lines.push('   生成的文件:');
  lines.push('   - curl-examples.md  (cURL 示例文档)');
  lines.push('   - *.test.js          (Jest 测试用例)');
  lines.push('   - index.test.js      (测试入口)');
  lines.push('   - README.md          (使用说明)');
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  generateCurlExample,
  generateJestTest,
  generateTests,
  generateSampleValue,
  formatGenTestResult
};
