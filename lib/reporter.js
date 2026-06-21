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

function generateCompatibilityMatrixMarkdown(matrixResult) {
  const { versions, comparisons } = matrixResult;
  const lines = [];

  lines.push('## 1. 版本兼容性矩阵');
  lines.push('');
  lines.push('### 1.1 矩阵总览');
  lines.push('');
  lines.push('单元格格式: `[风险图标] 破坏性变更数 / 风险总分`');
  lines.push('');

  const labels = versions.map(v => v.label);

  let header = '| From \\ To |';
  for (const label of labels) {
    header += ' ' + label + ' |';
  }
  lines.push(header);

  let separator = '|-----------|';
  for (let i = 0; i < labels.length; i++) {
    separator += '-----------|';
  }
  lines.push(separator);

  for (let i = 0; i < versions.length; i++) {
    let row = '| **' + labels[i] + '** |';
    for (let j = 0; j < versions.length; j++) {
      if (i === j) {
        row += ' — |';
      } else {
        const key = versions[i].label + '→' + versions[j].label;
        const comp = comparisons[key];
        if (comp) {
          let icon = '🟢';
          if (comp.riskStats.high > 0) icon = '🔴';
          else if (comp.riskStats.medium > 0) icon = '🟡';
          const score = comp.riskStats.high * 10 + comp.riskStats.medium * 3 + comp.riskStats.low;
          row += ` ${icon} ${comp.riskStats.breaking}/${score} |`;
        } else {
          row += ' N/A |';
        }
      }
    }
    lines.push(row);
  }

  lines.push('');
  lines.push('### 1.2 各版本对比详情');
  lines.push('');

  for (let i = 0; i < versions.length; i++) {
    for (let j = 0; j < versions.length; j++) {
      if (i >= j) continue;
      const key = versions[i].label + '→' + versions[j].label;
      const comp = comparisons[key];
      if (!comp) continue;

      lines.push(`#### ${versions[i].label} → ${versions[j].label}`);
      lines.push('');
      lines.push('| 指标 | 数量 |');
      lines.push('|------|------|');
      lines.push('| 🔴 高风险 | ' + comp.riskStats.high + ' |');
      lines.push('| 🟡 中风险 | ' + comp.riskStats.medium + ' |');
      lines.push('| 🟢 低风险 | ' + comp.riskStats.low + ' |');
      lines.push('| 🔵 信息 | ' + comp.riskStats.info + ' |');
      lines.push('| **总破坏性变更** | **' + comp.riskStats.breaking + '** |');
      lines.push('| **总变更数** | **' + comp.stats.totalChanges + '** |');
      lines.push('');

      if (comp.topAffectedEndpoints && comp.topAffectedEndpoints.length > 0) {
        lines.push('**主要影响接口:**');
        lines.push('');
        for (const ep of comp.topAffectedEndpoints) {
          lines.push(`- \`${ep.method} ${ep.path}\` - 🔴${ep.high} 🟡${ep.medium} 🟢${ep.low}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function generateMigrationPathsMarkdown(migrationPaths, comparisons) {
  const lines = [];

  lines.push('## 2. 推荐迁移路径');
  lines.push('');

  const upgradePaths = migrationPaths.filter(mp => {
    const fromIdx = mp.from;
    const toIdx = mp.to;
    return mp.recommended && mp.recommended.stepCount > 0;
  });

  if (upgradePaths.length === 0) {
    lines.push('暂无迁移路径数据。');
    lines.push('');
    return lines.join('\n');
  }

  for (const mp of upgradePaths) {
    if (!mp.recommended) continue;
    const isUpgradeOnly = mp.recommended.steps.every((step, idx) => {
      if (idx === 0) return true;
      return true;
    });

    lines.push(`### ${mp.from} → ${mp.to}`);
    lines.push('');
    lines.push('**推荐路径:** `' + mp.recommended.pathLabels.join(' → ') + '`');
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    lines.push('| 迁移步数 | ' + mp.recommended.stepCount + ' |');
    lines.push('| 总破坏性变更 | ' + mp.recommended.totalBreaking + ' |');
    lines.push('| 风险总分 | ' + mp.recommended.totalRisk + ' |');
    lines.push('| 🔴 高风险 | ' + mp.recommended.totalHigh + ' |');
    lines.push('| 🟡 中风险 | ' + mp.recommended.totalMedium + ' |');
    lines.push('| 🟢 低风险 | ' + mp.recommended.totalLow + ' |');
    lines.push('');

    lines.push('#### 分步迁移指南');
    lines.push('');

    for (let i = 0; i < mp.recommended.steps.length; i++) {
      const step = mp.recommended.steps[i];
      lines.push(`**步骤 ${i + 1}: ${step.from} → ${step.to}**`);
      lines.push('');
      lines.push('- 风险分布: 🔴' + step.riskStats.high + ' 🟡' + step.riskStats.medium + ' 🟢' + step.riskStats.low);
      lines.push('- 破坏性变更: ' + step.riskStats.breaking);
      lines.push('');

      if (step.topAffectedEndpoints && step.topAffectedEndpoints.length > 0) {
        lines.push('  主要影响接口:');
        lines.push('');
        for (const ep of step.topAffectedEndpoints) {
          lines.push(`  - \`${ep.method} ${ep.path}\``);
        }
        lines.push('');
      }

      const key = step.from + '→' + step.to;
      const comp = comparisons[key];
      if (comp && comp.classified) {
        const stepAdvices = generateAllAdvices(comp.classified);
        if (stepAdvices.high.length > 0 || stepAdvices.medium.length > 0) {
          lines.push('  迁移建议:');
          lines.push('');
          const allStepAdvices = [...stepAdvices.high.slice(0, 3), ...stepAdvices.medium.slice(0, 2)];
          for (const advice of allStepAdvices) {
            lines.push('  - **' + advice.title + '**: ' + advice.action);
            for (const detail of advice.details.slice(0, 2)) {
              lines.push('    - ' + detail);
            }
          }
          lines.push('');
        }
      }
    }

    if (mp.alternatives && mp.alternatives.length > 0) {
      lines.push('#### 备选路径');
      lines.push('');
      for (let i = 0; i < mp.alternatives.length; i++) {
        const alt = mp.alternatives[i];
        lines.push(`${i + 1}. \`${alt.pathLabels.join(' → ')}\``);
        lines.push(`   - 风险总分: ${alt.totalRisk}, 步数: ${alt.stepCount}, 破坏性变更: ${alt.totalBreaking}`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function generateRiskRankingMarkdown(matrixResult) {
  const lines = [];
  const { comparisons } = matrixResult;

  lines.push('## 3. 风险排行');
  lines.push('');

  const allComparisons = Object.values(comparisons).filter(c => c.isUpgrade);
  allComparisons.sort((a, b) => {
    const scoreA = a.riskStats.high * 10 + a.riskStats.medium * 3 + a.riskStats.low;
    const scoreB = b.riskStats.high * 10 + b.riskStats.medium * 3 + b.riskStats.low;
    return scoreB - scoreA;
  });

  if (allComparisons.length === 0) {
    lines.push('暂无风险排行数据。');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| 排名 | 升级路径 | 🔴 高风险 | 🟡 中风险 | 🟢 低风险 | 破坏性 | 风险总分 |');
  lines.push('|------|----------|-----------|-----------|-----------|--------|----------|');

  for (let i = 0; i < allComparisons.length; i++) {
    const comp = allComparisons[i];
    const score = comp.riskStats.high * 10 + comp.riskStats.medium * 3 + comp.riskStats.low;
    lines.push(
      '| ' + (i + 1) +
      ' | `' + comp.from.label + '→' + comp.to.label + '`' +
      ' | ' + comp.riskStats.high +
      ' | ' + comp.riskStats.medium +
      ' | ' + comp.riskStats.low +
      ' | ' + comp.riskStats.breaking +
      ' | ' + score + ' |'
    );
  }

  lines.push('');

  const allEndpointRisks = new Map();
  for (const comp of allComparisons) {
    for (const change of comp.classified.changes) {
      if (change.path && change.method && change.risk !== 'info' && change.risk !== 'low') {
        const key = change.method + ' ' + change.path;
        if (!allEndpointRisks.has(key)) {
          allEndpointRisks.set(key, {
            method: change.method,
            path: change.path,
            high: 0,
            medium: 0,
            affectedIn: []
          });
        }
        const ep = allEndpointRisks.get(key);
        if (change.risk === 'high') ep.high++;
        else if (change.risk === 'medium') ep.medium++;
        const pairKey = comp.from.label + '→' + comp.to.label;
        if (!ep.affectedIn.includes(pairKey)) {
          ep.affectedIn.push(pairKey);
        }
      }
    }
  }

  const endpointList = Array.from(allEndpointRisks.values());
  endpointList.sort((a, b) => {
    const scoreA = a.high * 10 + a.medium * 3;
    const scoreB = b.high * 10 + b.medium * 3;
    return scoreB - scoreA;
  });

  if (endpointList.length > 0) {
    lines.push('### 3.1 高风险接口排行 (Top 10)');
    lines.push('');
    lines.push('| 排名 | 接口 | 🔴 高风险 | 🟡 中风险 | 影响升级次数 |');
    lines.push('|------|------|-----------|-----------|-------------|');
    for (let i = 0; i < Math.min(endpointList.length, 10); i++) {
      const ep = endpointList[i];
      lines.push(
        '| ' + (i + 1) +
        ' | `' + ep.method + ' ' + ep.path + '`' +
        ' | ' + ep.high +
        ' | ' + ep.medium +
        ' | ' + ep.affectedIn.length + ' |'
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateAggregatedScanMarkdown(aggregatedScan, scanResultsByPair) {
  const lines = [];

  lines.push('## 4. 客户端代码影响分析');
  lines.push('');

  if (!aggregatedScan || aggregatedScan.length === 0) {
    lines.push('未扫描到受影响的客户端代码，或未提供 `--scan` 参数。');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('### 4.1 持续受影响的接口调用');
  lines.push('');

  const persistent = aggregatedScan.filter(ep => ep.affectedInPairCount >= 2);

  if (persistent.length === 0) {
    lines.push('✅ 未发现跨多个版本升级持续受影响的接口调用。');
    lines.push('');
  } else {
    lines.push(`⚠️ 发现 **${persistent.length}** 个接口在多个版本升级中持续受影响，需要重点关注：`);
    lines.push('');

    for (const ep of persistent) {
      lines.push(`#### \`${ep.method} ${ep.path}\``);
      lines.push('');
      lines.push('- 影响的版本升级: ' + ep.affectedInPairs.map(p => '`' + p + '`').join(', '));
      lines.push('- 涉及文件数: ' + ep.uniqueFiles.length);
      lines.push('');
      lines.push('**受影响的代码位置:**');
      lines.push('');

      const fileMap = {};
      for (const m of ep.matches) {
        if (!fileMap[m.file]) fileMap[m.file] = [];
        fileMap[m.file].push(m);
      }
      for (const [file, matches] of Object.entries(fileMap)) {
        const linesList = matches.map(m => m.line).join(', ');
        lines.push(`- \`${file}\` (第 ${linesList} 行)`);
      }
      lines.push('');
    }
  }

  lines.push('### 4.2 按版本升级的影响详情');
  lines.push('');

  for (const [pairKey, scanResult] of Object.entries(scanResultsByPair)) {
    if (!scanResult || scanResult.stats.totalMatches === 0) continue;

    lines.push(`#### ${pairKey}`);
    lines.push('');
    lines.push('- 扫描文件总数: ' + scanResult.stats.totalFiles);
    lines.push('- 受影响文件数: ' + scanResult.stats.matchedFiles);
    lines.push('- 匹配次数: ' + scanResult.stats.totalMatches);
    lines.push('');

    const fileMap = {};
    for (const match of scanResult.matches) {
      if (!fileMap[match.file]) fileMap[match.file] = [];
      fileMap[match.file].push(match);
    }

    lines.push('**受影响文件列表:**');
    lines.push('');
    for (const [file, matches] of Object.entries(fileMap)) {
      lines.push('- **' + file + '**');
      for (const m of matches) {
        lines.push('  - 第 ' + m.line + ' 行: `' + m.endpoint.method + ' ' + m.endpoint.path + '`');
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateStepByStepAdviceMarkdown(migrationPaths, comparisons) {
  const lines = [];

  lines.push('## 5. 分步迁移建议详解');
  lines.push('');

  const primaryPath = migrationPaths.find(mp => mp.recommended && mp.recommended.stepCount >= 1);
  if (!primaryPath) {
    lines.push('暂无迁移路径数据。');
    lines.push('');
    return lines.join('\n');
  }

  for (let i = 0; i < primaryPath.recommended.steps.length; i++) {
    const step = primaryPath.recommended.steps[i];
    const key = step.from + '→' + step.to;
    const comp = comparisons[key];

    lines.push(`### 步骤 ${i + 1}: ${step.from} → ${step.to}`);
    lines.push('');

    if (!comp || !comp.classified) {
      lines.push('暂无详细建议。');
      lines.push('');
      continue;
    }

    const advices = generateAllAdvices(comp.classified);

    if (advices.high.length > 0) {
      lines.push('#### 🔴 必须处理（高风险）');
      lines.push('');
      for (let j = 0; j < advices.high.length; j++) {
        const advice = advices.high[j];
        lines.push('**' + (j + 1) + '. ' + advice.title + '**');
        lines.push('');
        lines.push('- **操作**: ' + advice.action);
        lines.push('');
        if (advice.details && advice.details.length > 0) {
          lines.push('**详细步骤**:');
          lines.push('');
          for (const detail of advice.details) {
            lines.push('  1. ' + detail);
          }
          lines.push('');
        }
      }
    }

    if (advices.medium.length > 0) {
      lines.push('#### 🟡 建议处理（中风险）');
      lines.push('');
      for (let j = 0; j < Math.min(advices.medium.length, 5); j++) {
        const advice = advices.medium[j];
        lines.push('**' + (j + 1) + '. ' + advice.title + '**');
        lines.push('');
        lines.push('- **操作**: ' + advice.action);
        lines.push('');
      }
    }

    if (advices.low && advices.low.length > 0) {
      lines.push('#### 🟢 可选优化（低风险）');
      lines.push('');
      lines.push('共 ' + advices.low.length + ' 项兼容变更，可按需处理。');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateMatrixMarkdownReport(matrixResult, migrationPaths, aggregatedScan, scanResultsByPair, outputPath) {
  const lines = [];

  lines.push('# 多版本 API 兼容性与迁移分析报告');
  lines.push('');
  lines.push('**生成时间**: ' + new Date().toLocaleString('zh-CN'));
  lines.push('');

  lines.push('## 0. 版本概览');
  lines.push('');
  lines.push('| 版本标签 | 版本号 | 接口数 | Schema数 | 文件路径 |');
  lines.push('|----------|--------|--------|----------|----------|');
  for (const v of matrixResult.versions) {
    lines.push(
      '| ' + v.label +
      ' | ' + v.version +
      ' | ' + (v.summary ? v.summary.stats.totalEndpoints : 'N/A') +
      ' | ' + (v.summary ? v.summary.stats.totalSchemas : 'N/A') +
      ' | `' + v.path + '` |'
    );
  }
  lines.push('');

  lines.push(generateCompatibilityMatrixMarkdown(matrixResult));
  lines.push('');
  lines.push(generateMigrationPathsMarkdown(migrationPaths, matrixResult.comparisons));
  lines.push('');
  lines.push(generateRiskRankingMarkdown(matrixResult));
  lines.push('');
  lines.push(generateAggregatedScanMarkdown(aggregatedScan, scanResultsByPair));
  lines.push('');
  lines.push(generateStepByStepAdviceMarkdown(migrationPaths, matrixResult.comparisons));
  lines.push('');

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

module.exports = {
  generateMigrationAdvice,
  generateAllAdvices,
  generateMarkdownReport,
  formatAdvices,
  generateMatrixMarkdownReport,
  generateCompatibilityMatrixMarkdown,
  generateMigrationPathsMarkdown,
  generateRiskRankingMarkdown,
  generateAggregatedScanMarkdown,
  generateStepByStepAdviceMarkdown
};
