const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function loadSpec(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, 'utf-8');

  if (ext === '.yaml' || ext === '.yml') {
    return yaml.load(content);
  } else if (ext === '.json') {
    return JSON.parse(content);
  } else {
    try {
      return yaml.load(content);
    } catch (e) {
      return JSON.parse(content);
    }
  }
}

function resolveRef(spec, ref) {
  if (!ref || !ref.startsWith('#/')) return ref;
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

function getSchemaProperties(spec, schema) {
  if (!schema) return { properties: {}, required: [] };

  if (schema.$ref) {
    const resolved = resolveRef(spec, schema.$ref);
    return getSchemaProperties(spec, resolved);
  }

  if (schema.allOf) {
    const combined = { properties: {}, required: [] };
    for (const sub of schema.allOf) {
      const subProps = getSchemaProperties(spec, sub);
      Object.assign(combined.properties, subProps.properties);
      combined.required = [...new Set([...combined.required, ...subProps.required])];
    }
    return combined;
  }

  return {
    properties: schema.properties || {},
    required: schema.required || []
  };
}

function parseEndpoints(spec) {
  const endpoints = [];
  const paths = spec.paths || {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
    for (const method of methods) {
      if (pathItem[method]) {
        const operation = pathItem[method];
        const parameters = [
          ...(pathItem.parameters || []),
          ...(operation.parameters || [])
        ];

        const requestBody = operation.requestBody;
        let requestSchema = null;
        if (requestBody && requestBody.content) {
          const jsonContent = requestBody.content['application/json'];
          if (jsonContent) {
            requestSchema = jsonContent.schema;
          }
        }

        const responses = {};
        for (const [statusCode, response] of Object.entries(operation.responses || {})) {
          const respContent = response.content;
          let responseSchema = null;
          if (respContent && respContent['application/json']) {
            responseSchema = respContent['application/json'].schema;
          }
          responses[statusCode] = {
            description: response.description,
            schema: responseSchema
          };
        }

        endpoints.push({
          path: pathKey,
          method: method.toUpperCase(),
          summary: operation.summary || '',
          description: operation.description || '',
          parameters: parameters.map(p => ({
            name: p.name,
            in: p.in,
            required: p.required || false,
            schema: p.schema,
            description: p.description || ''
          })),
          requestBody: requestBody ? {
            required: requestBody.required || false,
            schema: requestSchema
          } : null,
          responses: responses,
          security: operation.security || spec.security || [],
          deprecated: operation.deprecated || false
        });
      }
    }
  }

  return endpoints;
}

function parseSchemas(spec) {
  const schemas = {};
  const components = spec.components || {};
  const schemaDefs = components.schemas || {};

  for (const [name, schema] of Object.entries(schemaDefs)) {
    const { properties, required } = getSchemaProperties(spec, schema);
    schemas[name] = {
      type: schema.type,
      description: schema.description || '',
      properties: properties,
      required: required
    };
  }

  return schemas;
}

function parseSecurity(spec) {
  const securitySchemes = {};
  const components = spec.components || {};
  const schemes = components.securitySchemes || {};

  for (const [name, scheme] of Object.entries(schemes)) {
    securitySchemes[name] = {
      type: scheme.type,
      description: scheme.description || '',
      ...scheme
    };
  }

  return securitySchemes;
}

function generateSummary(spec) {
  const endpoints = parseEndpoints(spec);
  const schemas = parseSchemas(spec);
  const securitySchemes = parseSecurity(spec);

  const methodCounts = {};
  for (const ep of endpoints) {
    methodCounts[ep.method] = (methodCounts[ep.method] || 0) + 1;
  }

  return {
    info: spec.info || {},
    servers: spec.servers || [],
    endpoints: endpoints,
    schemas: schemas,
    securitySchemes: securitySchemes,
    stats: {
      totalEndpoints: endpoints.length,
      totalSchemas: Object.keys(schemas).length,
      totalSecuritySchemes: Object.keys(securitySchemes).length,
      methodCounts: methodCounts
    }
  };
}

function formatSummaryTable(summary) {
  const lines = [];
  const { info, stats, endpoints } = summary;

  lines.push('');
  lines.push(`📋 API 总览: ${info.title || 'Unknown'} (v${info.version || '0.0.0'})`);
  lines.push(`   ${info.description || ''}`);
  lines.push('');
  lines.push(`📊 统计信息:`);
  lines.push(`   接口总数: ${stats.totalEndpoints}`);
  lines.push(`   Schema总数: ${stats.totalSchemas}`);
  lines.push(`   安全方案: ${stats.totalSecuritySchemes}`);
  lines.push(`   HTTP方法分布: ${Object.entries(stats.methodCounts).map(([m, c]) => `${m}: ${c}`).join(', ')}`);
  lines.push('');
  lines.push('🔗 接口列表:');

  const maxPathLen = Math.max(...endpoints.map(e => e.path.length), 10);
  const maxMethodLen = 7;

  lines.push(`   ${'方法'.padEnd(maxMethodLen)} ${'路径'.padEnd(maxPathLen)} ${'描述'}`);
  lines.push(`   ${'-'.repeat(maxMethodLen)} ${'-'.repeat(maxPathLen)} ${'-'.repeat(30)}`);

  for (const ep of endpoints) {
    const method = ep.method.padEnd(maxMethodLen);
    const pathStr = ep.path.padEnd(maxPathLen);
    const desc = ep.summary || ep.description || '';
    lines.push(`   ${method} ${pathStr} ${desc.slice(0, 50)}`);
  }

  lines.push('');
  return lines.join('\n');
}

module.exports = {
  loadSpec,
  resolveRef,
  getSchemaProperties,
  parseEndpoints,
  parseSchemas,
  parseSecurity,
  generateSummary,
  formatSummaryTable
};
