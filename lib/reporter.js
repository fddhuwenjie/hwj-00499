const { CHANGE_TYPE, CHANGE_CATEGORY } = require('./diff');
const { RISK_LEVEL } = require('./impact');

function generateMigrationAdvice(change) {
  const advices = [];

  if (change.category === CHANGE_CATEGORY.ENDPOINT) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      advices.push({
        title: '接口删除: ' + change.method + ' ' + change.path,
        action: '替换或移除接口调用',
        details: [
          '检查代码中所有对该接口的调用',
          '查找替代接口或调整业务逻辑',
          '确认后端兼容期内逐步下线相关功能',
          '在代码中移除或替换所有调用'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      advices.push({
        title: '新增接口: ' + change.method + ' ' + change.path,
        action: '了解新接口',
        details: [
          '接口说明: ' + (change.endpoint ? change.endpoint.summary : ''),
          '可根据业务需要接入新功能'
        ]
      });
    }
  }

  if (change.category === CHANGE_CATEGORY.PARAMETER) {
    if (change.type === CHANGE_TYPE.ADDED && change.parameter.required) {
      advices.push({
        title: '新增必填参数: ' + change.parameter.name + ' (' + change.parameter.in + ')',
        action: '补充参数',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '参数名: ' + change.parameter.name,
          '参数位置: ' + change.parameter.in,
          '参数类型: ' + (change.parameter.schema ? change.parameter.schema.type : 'unknown'),
          '描述: ' + (change.parameter.description || ''),
          '需要在所有调用处补充该参数'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.ADDED && !change.parameter.required) {
      advices.push({
        title: '新增可选参数: ' + change.parameter.name + ' (' + change.parameter.in + ')',
        action: '可选优化',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '参数名: ' + change.parameter.name,
          '描述: ' + (change.parameter.description || ''),
          '可根据业务需要选择使用'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.REMOVED) {
      advices.push({
        title: '删除参数: ' + change.parameter.name + ' (' + change.parameter.in + ')',
        action: '移除参数使用',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '检查代码中是否使用了该参数',
          '移除该参数不再生效，需确认是否影响业务逻辑',
          '从调用代码中移除该参数'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.MODIFIED && change.field === 'type') {
      advices.push({
        title: '参数类型变更: ' + change.parameter.name,
        action: '更新参数类型',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '原类型: ' + change.oldValue,
          '新类型: ' + change.newValue,
          '检查调用时需要转换参数格式',
          '更新类型转换和类型校验逻辑'
        ]
      });
    }
  }

  if (change.category === CHANGE_CATEGORY.REQUEST_BODY) {
    if (change.property && change.type === CHANGE_TYPE.ADDED && change.required) {
      advices.push({
        title: '新增必填字段: ' + change.property,
        action: '补充请求字段',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '字段名: ' + change.property,
          '需要在请求体中补充该字段',
          '字段类型: ' + (change.newSchema ? change.newSchema.type : 'unknown')
        ]
      });
    }
    if (change.property && change.type === CHANGE_TYPE.ADDED && !change.required) {
      advices.push({
        title: '新增可选字段: ' + change.property,
        action: '可选使用新字段',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '字段名: ' + change.property,
          '可根据业务需要补充该字段'
        ]
      });
    }
    if (change.property && change.type === CHANGE_TYPE.REMOVED) {
      advices.push({
        title: '删除请求字段: ' + change.property,
        action: '移除字段使用',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '字段名: ' + change.property,
          '检查代码中是否使用了该字段',
          '从请求体中移除该字段'
        ]
      });
    }
    if (change.property && change.type === CHANGE_TYPE.MODIFIED && change.field === 'type') {
      advices.push({
        title: '请求字段类型变更: ' + change.property,
        action: '更新字段类型',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '字段名: ' + change.property,
          '原类型: ' + change.oldValue,
          '新类型: ' + change.newValue,
          '更新请求体中的字段格式'
        ]
      });
    }
  }

  if (change.category === CHANGE_CATEGORY.STATUS_CODE) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      advices.push({
        title: '删除状态码: ' + change.statusCode,
        action: '更新错误处理',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '状态码: ' + change.statusCode,
          '检查代码中是否有处理该状态码的逻辑',
          '移除或调整相关错误处理代码'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      advices.push({
        title: '新增状态码: ' + change.statusCode,
        action: '处理新状态码',
        details: [
          '接口: ' + change.method + ' ' + change.path,
          '状态码: ' + change.statusCode,
          '建议添加对新状态码的处理逻辑'
        ]
      });
    }
  }

  if (change.category === CHANGE_CATEGORY.RESPONSE && change.property) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      advices.push({
        title: '删除响应字段: ' + change.property,
        action: '移除字段依赖',
        details: [
          '接口: ' + change.method + ' ' + change.path + ' (' + change.statusCode + ')',
          '字段名: ' + change.property,
          '检查代码中是否使用了该响应字段',
          '移除或替代该字段的使用'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      advices.push({
        title: '新增响应字段: ' + change.property,
        action: '利用新字段',
        details: [
          '接口: ' + change.method + ' ' + change.path + ' (' + change.statusCode + ')',
          '字段名: ' + change.property,
          '可根据业务需要使用新字段'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.MODIFIED && change.field === 'type') {
      advices.push({
        title: '响应字段类型变更: ' + change.property,
        action: '更新字段解析',
        details: [
          '接口: ' + change.method + ' ' + change.path + ' (' + change.statusCode + ')',
          '字段名: ' + change.property,
          '原类型: ' + change.oldValue,
          '新类型: ' + change.newValue,
          '更新响应解析和类型处理逻辑'
        ]
      });
    }
  }

  if (change.category === CHANGE_CATEGORY.SCHEMA_PROPERTY) {
    if (change.type === CHANGE_TYPE.ADDED && change.required) {
      advices.push({
        title: 'Schema新增必填字段: ' + change.property,
        action: '补充数据字段',
        details: [
          'Schema: ' + (change.schemaName || ''),
          '字段名: ' + change.property,
          '确保数据需补充该必填字段'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.REMOVED) {
      advices.push({
        title: 'Schema删除字段: ' + change.property,
        action: '移除字段依赖',
        details: [
          'Schema: ' + (change.schemaName || ''),
          '字段名: ' + change.property,
          '检查并移除对该字段的依赖'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.MODIFIED && change.field === 'type') {
      advices.push({
        title: 'Schema字段类型变更: ' + change.property,
        action: '更新类型处理',
        details: [
          'Schema: ' + (change.schemaName || ''),
          '字段名: ' + change.property,
          '原类型: ' + change.oldValue,
          '新类型: ' + change.newValue
        ]
      });
    }
  }

  if (change.category === CHANGE_CATEGORY.SECURITY) {
    if (change.type === CHANGE_TYPE.ADDED) {
      advices.push({
        title: '新增安全方案: ' + change.securityName,
        action: '配置认证方式',
        details: [
          '安全方案: ' + change.securityName,
          '需确认是否需要更新认证逻辑'
        ]
      });
    }
    if (change.type === CHANGE_TYPE.REMOVED) {
      advices.push({
        title: '删除安全方案: ' + change.securityName,
        action: '移除认证配置',
        details: [
          '安全方案: ' + change.securityName,
          '检查并移除相关认证配置'
        ]
      });
    }
  }

  return advices;
}

function generateAllAdvices(classifiedResult) {
  const allAdvices = {
    high: [],
    medium: [],
    low: []
  };

  for (const change of classifiedResult.changes) {
    const advices = generateMigrationAdvice(change);
    if (change.risk === RISK_LEVEL.HIGH) {
      allAdvices.high.push(...advices);
    } else if (change.risk === RISK_LEVEL.MEDIUM) {
      allAdvices.medium.push(...advices);
    } else if (change.risk === RISK_LEVEL.LOW) {
      allAdvices.low.push(...advices);
    }
  }

  return allAdvices;
}

function generateMarkdownReport(diffResult, scanResult, outputPath) {
  if (scanResult === undefined) scanResult = null;
  if (outputPath === undefined) outputPath = null;

  const { oldSummary, newSummary, riskStats, classified } = diffResult;
  const advices = generateAllAdvices(diffResult);

  const lines = [];

  lines.push('# API 变更影响分析报告');
  lines.push('');
  lines.push('**生成时间**: ' + new Date().toLocaleString('zh-CN'));
  lines.push('');

  lines.push('## 1. 基本信息');
  lines.push('');
  lines.push('| 项目 | 旧版本 | 新版本 |');
  lines.push('|------|--------|--------|');
  lines.push('| API名称 | ' + (oldSummary.info.title || 'N/A') + ' | ' + (newSummary.info.title || 'N/A') + ' |');
  lines.push('| 版本号 | ' + (oldSummary.info.version || 'N/A') + ' | ' + (newSummary.info.version || 'N/A') + ' |');
  lines.push('| 接口数 | ' + oldSummary.stats.totalEndpoints + ' | ' + newSummary.stats.totalEndpoints + ' |');
  lines.push('| Schema数 | ' + oldSummary.stats.totalSchemas + ' | ' + newSummary.stats.totalSchemas + ' |');
  lines.push('');

  lines.push('## 2. 变更统计');
  lines.push('');
  lines.push('### 2.1 按变更类型统计');
  lines.push('');
  lines.push('| 类型 | 数量 |');
  lines.push('|------|------|');
  lines.push('| 新增 | ' + diffResult.stats.added + ' |');
  lines.push('| 删除 | ' + diffResult.stats.removed + ' |');
  lines.push('| 修改 | ' + diffResult.stats.modified + ' |');
  lines.push('| **总计** | **' + diffResult.stats.totalChanges + '** |');
  lines.push('');

  lines.push('### 2.2 风险等级统计');
  lines.push('');
  lines.push('| 风险等级 | 数量 | 说明 |');
  lines.push('|----------|------|------|');
  lines.push('| 🔴 高风险 | ' + riskStats.high + ' | 破坏性变更，必须处理 |');
  lines.push('| 🟡 中风险 | ' + riskStats.medium + ' | 半破坏性，建议处理 |');
  lines.push('| 🟢 低风险 | ' + riskStats.low + ' | 兼容变更 |');
  lines.push('| 🔵 信息 | ' + riskStats.info + ' | 描述性变更 |');
  lines.push('');
  lines.push('- **总破坏性变更**: ' + riskStats.breaking);
  lines.push('- **总兼容变更**: ' + riskStats.compatible);
  lines.push('');

  lines.push('## 3. 详细变更');
  lines.push('');

  if (classified.high.length > 0) {
    lines.push('### 3.1 🔴 高风险变更');
    lines.push('');
    for (const ch of classified.high) {
      var location = '';
      if (ch.method && ch.path) {
        location = '`' + ch.method + ' ' + ch.path + '`';
      } else if (ch.schemaName) {
        location = '`' + ch.schemaName + '`';
      } else if (ch.securityName) {
        location = '`' + ch.securityName + '`';
      }
      lines.push('- **' + ch.description + '**');
      lines.push('  - 位置: ' + location);
      lines.push('  - 原因: ' + ch.riskReason);
      lines.push('');
    }
  }

  if (classified.medium.length > 0) {
    lines.push('### 3.2 🟡 中风险变更');
    lines.push('');
    for (const ch of classified.medium) {
      var location = '';
      if (ch.method && ch.path) {
        location = '`' + ch.method + ' ' + ch.path + '`';
      } else if (ch.schemaName) {
        location = '`' + ch.schemaName + '`';
      } else if (ch.securityName) {
        location = '`' + ch.securityName + '`';
      }
      lines.push('- **' + ch.description + '**');
      lines.push('  - 位置: ' + location);
      lines.push('  - 原因: ' + ch.riskReason);
      lines.push('');
    }
  }

  if (classified.low.length > 0) {
    lines.push('### 3.3 🟢 低风险变更');
    lines.push('');
    for (const ch of classified.low) {
      var location = '';
      if (ch.method && ch.path) {
        location = '`' + ch.method + ' ' + ch.path + '`';
      } else if (ch.schemaName) {
        location = '`' + ch.schemaName + '`';
      } else if (ch.securityName) {
        location = '`' + ch.securityName + '`';
      }
      lines.push('- **' + ch.description + '**');
      lines.push('  - 位置: ' + location);
      lines.push('');
    }
  }

  lines.push('## 4. 迁移建议');
  lines.push('');

  if (advices.high.length > 0) {
    lines.push('### 4.1 高风险迁移建议');
    lines.push('');
    for (const advice of advices.high) {
      lines.push('#### ' + advice.title);
      lines.push('');
      lines.push('**操作**: ' + advice.action);
      lines.push('');
      lines.push('**详细说明**:');
      lines.push('');
      for (const detail of advice.details) {
        lines.push('- ' + detail);
      }
      lines.push('');
    }
  }

  if (advices.medium.length > 0) {
    lines.push('### 4.2 中风险迁移建议');
    lines.push('');
    for (const advice of advices.medium) {
      lines.push('#### ' + advice.title);
      lines.push('');
      lines.push('**操作**: ' + advice.action);
      lines.push('');
      lines.push('**详细说明**:');
      lines.push('');
      for (const detail of advice.details) {
        lines.push('- ' + detail);
      }
      lines.push('');
    }
  }

  if (scanResult && scanResult.stats.totalMatches > 0) {
    lines.push('## 5. 客户端代码影响');
    lines.push('');
    lines.push('- 扫描文件总数: ' + scanResult.stats.totalFiles);
    lines.push('- 受影响文件数: ' + scanResult.stats.matchedFiles);
    lines.push('- 匹配次数: ' + scanResult.stats.totalMatches);
    lines.push('');

    const fileMap = {};
    for (const match of scanResult.matches) {
      if (!fileMap[match.file]) {
        fileMap[match.file] = [];
      }
      fileMap[match.file].push(match);
    }

    lines.push('### 5.1 受影响文件列表');
    lines.push('');
    for (const file in fileMap) {
      if (fileMap.hasOwnProperty(file)) {
        const matches = fileMap[file];
        lines.push('- **' + file + '**');
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i];
          lines.push('  - 第 ' + m.line + ' 行: `' + m.endpoint.method + ' ' + m.endpoint.path + '`');
        }
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*此报告由 apidiff 工具自动生成*');

  const content = lines.join('\n');

  if (outputPath) {
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  return content;
}

function formatAdvices(advices) {
  const lines = [];

  lines.push('');
  lines.push('📋 迁移建议');
  lines.push('='.repeat(50));

  if (advices.high.length > 0) {
    lines.push('');
    lines.push('🔴 高风险迁移建议:');
    lines.push('-'.repeat(40));
    for (let i = 0; i < advices.high.length; i++) {
      const advice = advices.high[i];
      lines.push('   📌 ' + advice.title);
      lines.push('      操作: ' + advice.action);
      lines.push('      详情:');
      for (let j = 0; j < advice.details.length; j++) {
        lines.push('        - ' + advice.details[j]);
      }
      lines.push('');
    }
  }

  if (advices.medium.length > 0) {
    lines.push('');
    lines.push('🟡 中风险迁移建议:');
    lines.push('-'.repeat(40));
    for (let i = 0; i < advices.medium.length; i++) {
      const advice = advices.medium[i];
      lines.push('   📌 ' + advice.title);
      lines.push('      操作: ' + advice.action);
    }
  }

  return lines.join('\n');
}

module.exports = {
  generateMigrationAdvice,
  generateAllAdvices,
  generateMarkdownReport,
  formatAdvices
};
