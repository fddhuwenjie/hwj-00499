const { CHANGE_TYPE, CHANGE_CATEGORY } = require('./diff');

const RISK_LEVEL = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

const RISK_LABELS = {
  [RISK_LEVEL.HIGH]: '🔴 高风险',
  [RISK_LEVEL.MEDIUM]: '🟡 中风险',
  [RISK_LEVEL.LOW]: '🟢 低风险',
  [RISK_LEVEL.INFO]: '🔵 信息'
};

function assessRisk(change) {
  if (change.infoOnly) {
    return { level: RISK_LEVEL.INFO, reason: '描述性信息变更，不影响功能' };
  }

  if (change.category === CHANGE_CATEGORY.ENDPOINT) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      return { level: RISK_LEVEL.HIGH, reason: '删除接口会导致现有调用失败' };
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      return { level: RISK_LEVEL.LOW, reason: '新增接口为兼容变更' };
    }
    if (change.type === CHANGE_TYPE.MODIFIED && change.field === 'deprecated') {
      return { level: RISK_LEVEL.MEDIUM, reason: '接口废弃提示，建议尽快迁移' };
    }
  }

  if (change.category === CHANGE_CATEGORY.PARAMETER) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      if (change.parameter.required) {
        return { level: RISK_LEVEL.HIGH, reason: '删除必填参数会导致调用失败' };
      }
      return { level: RISK_LEVEL.MEDIUM, reason: '删除可选参数可能影响部分功能' };
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      if (change.parameter.required) {
        return { level: RISK_LEVEL.HIGH, reason: '新增必填参数会导致现有调用失败' };
      }
      return { level: RISK_LEVEL.LOW, reason: '新增可选参数为兼容变更' };
    }
    if (change.type === CHANGE_TYPE.MODIFIED) {
      if (change.field === 'required' && change.newValue === true) {
        return { level: RISK_LEVEL.HIGH, reason: '参数改为必填会导致现有调用失败' };
      }
      if (change.field === 'type') {
        return { level: RISK_LEVEL.HIGH, reason: '参数类型变更可能导致调用失败' };
      }
      if (change.field === 'required' && change.newValue === false) {
        return { level: RISK_LEVEL.LOW, reason: '参数改为可选是兼容变更' };
      }
    }
  }

  if (change.category === CHANGE_CATEGORY.REQUEST_BODY) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      return { level: RISK_LEVEL.HIGH, reason: '删除请求体会导致现有调用失败' };
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      if (change.endpoint && change.endpoint.requestBody && change.endpoint.requestBody.required) {
        return { level: RISK_LEVEL.HIGH, reason: '新增必填请求体会导致现有调用失败' };
      }
      return { level: RISK_LEVEL.LOW, reason: '新增可选请求体为兼容变更' };
    }
    if (change.type === CHANGE_TYPE.MODIFIED && change.field === 'required') {
      if (change.newValue === true) {
        return { level: RISK_LEVEL.HIGH, reason: '请求体改为必填会导致现有调用失败' };
      }
      return { level: RISK_LEVEL.LOW, reason: '请求体改为可选是兼容变更' };
    }

    if (change.property) {
      if (change.type === CHANGE_TYPE.REMOVED) {
        if (change.required) {
          return { level: RISK_LEVEL.HIGH, reason: '删除请求体必填字段会导致调用失败' };
        }
        return { level: RISK_LEVEL.MEDIUM, reason: '删除请求体可选字段可能影响部分功能' };
      }
      if (change.type === CHANGE_TYPE.ADDED) {
        if (change.required) {
          return { level: RISK_LEVEL.HIGH, reason: '新增请求体必填字段会导致现有调用失败' };
        }
        return { level: RISK_LEVEL.LOW, reason: '新增请求体可选字段为兼容变更' };
      }
      if (change.type === CHANGE_TYPE.MODIFIED) {
        if (change.field === 'type') {
          return { level: RISK_LEVEL.HIGH, reason: '请求体字段类型变更可能导致调用失败' };
        }
        if (change.field === 'required' && change.newValue === true) {
          return { level: RISK_LEVEL.HIGH, reason: '请求体字段改为必填会导致现有调用失败' };
        }
        if (change.field === 'required' && change.newValue === false) {
          return { level: RISK_LEVEL.LOW, reason: '请求体字段改为可选是兼容变更' };
        }
      }
    }
  }

  if (change.category === CHANGE_CATEGORY.STATUS_CODE) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      return { level: RISK_LEVEL.HIGH, reason: '删除状态码可能导致客户端处理逻辑错误' };
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      return { level: RISK_LEVEL.LOW, reason: '新增状态码为兼容变更' };
    }
  }

  if (change.category === CHANGE_CATEGORY.RESPONSE) {
    if (change.property) {
      if (change.type === CHANGE_TYPE.REMOVED) {
        if (change.required) {
          return { level: RISK_LEVEL.HIGH, reason: '删除响应必填字段会导致客户端解析失败' };
        }
        return { level: RISK_LEVEL.MEDIUM, reason: '删除响应可选字段可能影响客户端功能' };
      }
      if (change.type === CHANGE_TYPE.ADDED) {
        return { level: RISK_LEVEL.LOW, reason: '新增响应字段为兼容变更' };
      }
      if (change.type === CHANGE_TYPE.MODIFIED && change.field === 'type') {
        return { level: RISK_LEVEL.HIGH, reason: '响应字段类型变更可能导致客户端解析失败' };
      }
    }
  }

  if (change.category === CHANGE_CATEGORY.SCHEMA) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      return { level: RISK_LEVEL.HIGH, reason: '删除Schema可能影响使用该Schema的接口' };
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      return { level: RISK_LEVEL.LOW, reason: '新增Schema为兼容变更' };
    }
    if (change.type === CHANGE_TYPE.MODIFIED && change.field === 'type') {
      return { level: RISK_LEVEL.HIGH, reason: 'Schema类型变更可能导致解析失败' };
    }
  }

  if (change.category === CHANGE_CATEGORY.SCHEMA_PROPERTY) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      if (change.required) {
        return { level: RISK_LEVEL.HIGH, reason: '删除Schema必填字段可能导致解析失败' };
      }
      return { level: RISK_LEVEL.MEDIUM, reason: '删除Schema可选字段可能影响使用' };
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      if (change.required) {
        return { level: RISK_LEVEL.HIGH, reason: '新增Schema必填字段可能导致数据验证失败' };
      }
      return { level: RISK_LEVEL.LOW, reason: '新增Schema可选字段为兼容变更' };
    }
    if (change.type === CHANGE_TYPE.MODIFIED) {
      if (change.field === 'type') {
        return { level: RISK_LEVEL.HIGH, reason: 'Schema字段类型变更可能导致解析失败' };
      }
      if (change.field === 'required' && change.newValue === true) {
        return { level: RISK_LEVEL.HIGH, reason: 'Schema字段改为必填可能导致数据验证失败' };
      }
      if (change.field === 'required' && change.newValue === false) {
        return { level: RISK_LEVEL.LOW, reason: 'Schema字段改为可选是兼容变更' };
      }
    }
  }

  if (change.category === CHANGE_CATEGORY.SECURITY) {
    if (change.type === CHANGE_TYPE.REMOVED) {
      return { level: RISK_LEVEL.HIGH, reason: '删除安全方案可能影响认证' };
    }
    if (change.type === CHANGE_TYPE.ADDED) {
      return { level: RISK_LEVEL.MEDIUM, reason: '新增安全方案可能需要更新认证逻辑' };
    }
  }

  return { level: RISK_LEVEL.INFO, reason: '一般变更' };
}

function classifyChanges(diffResult) {
  const classified = {
    high: [],
    medium: [],
    low: [],
    info: []
  };

  for (const change of diffResult.changes) {
    const risk = assessRisk(change);
    change.risk = risk.level;
    change.riskReason = risk.reason;
    classified[risk.level].push(change);
  }

  const stats = {
    high: classified.high.length,
    medium: classified.medium.length,
    low: classified.low.length,
    info: classified.info.length,
    breaking: classified.high.length + classified.medium.length,
    compatible: classified.low.length
  };

  return {
    ...diffResult,
    classified,
    riskStats: stats
  };
}

function formatRiskSummary(result) {
  const lines = [];
  const { riskStats } = result;

  lines.push('');
  lines.push('⚠️  风险评估汇总');
  lines.push('='.repeat(50));
  lines.push(`   🔴 高风险 (破坏性): ${riskStats.high}`);
  lines.push(`   🟡 中风险 (半破坏性): ${riskStats.medium}`);
  lines.push(`   🟢 低风险 (兼容): ${riskStats.low}`);
  lines.push(`   🔵 信息: ${riskStats.info}`);
  lines.push('');
  lines.push(`   总破坏性变更: ${riskStats.breaking}`);
  lines.push(`   总兼容变更: ${riskStats.compatible}`);
  lines.push('');

  return lines.join('\n');
}

function formatRiskList(result) {
  const lines = [];
  const { classified } = result;

  if (classified.high.length > 0) {
    lines.push('');
    lines.push('🔴 高风险变更');
    lines.push('-'.repeat(50));
    for (const ch of classified.high) {
      const location = ch.method && ch.path
        ? `${ch.method} ${ch.path}`
        : ch.schemaName || ch.securityName || '';
      lines.push(`   • ${location}`);
      lines.push(`     ${ch.description}`);
      lines.push(`     原因: ${ch.riskReason}`);
    }
  }

  if (classified.medium.length > 0) {
    lines.push('');
    lines.push('🟡 中风险变更');
    lines.push('-'.repeat(50));
    for (const ch of classified.medium) {
      const location = ch.method && ch.path
        ? `${ch.method} ${ch.path}`
        : ch.schemaName || ch.securityName || '';
      lines.push(`   • ${location}`);
      lines.push(`     ${ch.description}`);
      lines.push(`     原因: ${ch.riskReason}`);
    }
  }

  if (classified.low.length > 0) {
    lines.push('');
    lines.push('🟢 低风险变更');
    lines.push('-'.repeat(50));
    for (const ch of classified.low) {
      const location = ch.method && ch.path
        ? `${ch.method} ${ch.path}`
        : ch.schemaName || ch.securityName || '';
      lines.push(`   • ${location}`);
      lines.push(`     ${ch.description}`);
    }
  }

  if (classified.info.length > 0) {
    lines.push('');
    lines.push('🔵 信息变更');
    lines.push('-'.repeat(50));
    for (const ch of classified.info) {
      const location = ch.method && ch.path
        ? `${ch.method} ${ch.path}`
        : ch.schemaName || ch.securityName || '';
      lines.push(`   • ${location}`);
      lines.push(`     ${ch.description}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

module.exports = {
  RISK_LEVEL,
  RISK_LABELS,
  assessRisk,
  classifyChanges,
  formatRiskSummary,
  formatRiskList
};
