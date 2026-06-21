const path = require('path');
const { loadSpec, generateSummary } = require('./parser');
const { diffFiles, diffSpecs } = require('./diff');
const { classifyChanges } = require('./impact');

function getVersionLabel(specPath, specData) {
  const baseName = path.basename(specPath, path.extname(specPath));
  const version = (specData.info && specData.info.version) || baseName;
  return version;
}

function loadMultipleSpecs(specPaths) {
  const versions = [];
  for (const specPath of specPaths) {
    const specData = loadSpec(specPath);
    const summary = generateSummary(specData);
    const label = getVersionLabel(specPath, specData);
    versions.push({
      path: specPath,
      label: label,
      version: (specData.info && specData.info.version) || label,
      spec: specData,
      summary: summary
    });
  }
  return versions;
}

function getTopAffectedEndpoints(classifiedResult, limit = 5) {
  const endpointMap = new Map();

  for (const change of classifiedResult.changes) {
    if (change.path && change.method) {
      const key = change.method + ' ' + change.path;
      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          method: change.method,
          path: change.path,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          changes: []
        });
      }
      const ep = endpointMap.get(key);
      if (change.risk) {
        ep[change.risk]++;
      }
      ep.changes.push(change);
    }
  }

  const endpoints = Array.from(endpointMap.values());
  endpoints.sort((a, b) => {
    const scoreA = a.high * 100 + a.medium * 10 + a.low;
    const scoreB = b.high * 100 + b.medium * 10 + b.low;
    return scoreB - scoreA;
  });

  return endpoints.slice(0, limit);
}

function buildCompatibilityMatrix(specPaths) {
  const versions = loadMultipleSpecs(specPaths);
  const n = versions.length;
  const comparisons = {};

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        continue;
      }
      const from = versions[i];
      const to = versions[j];
      const key = from.label + '→' + to.label;

      const diffResult = diffSpecs(from.spec, to.spec);
      const classified = classifyChanges(diffResult);
      const topEndpoints = getTopAffectedEndpoints(classified);

      comparisons[key] = {
        from: {
          label: from.label,
          version: from.version,
          path: from.path
        },
        to: {
          label: to.label,
          version: to.version,
          path: to.path
        },
        stats: classified.stats,
        riskStats: classified.riskStats,
        topAffectedEndpoints: topEndpoints,
        classified: classified,
        isUpgrade: i < j
      };
    }
  }

  return {
    versions: versions.map(v => ({
      label: v.label,
      version: v.version,
      path: v.path,
      summary: v.summary
    })),
    comparisons: comparisons
  };
}

function calculateRiskScore(riskStats) {
  return riskStats.high * 10 + riskStats.medium * 3 + riskStats.low * 1;
}

function findAllPaths(versions, comparisons, fromIdx, toIdx) {
  const n = versions.length;
  const results = [];

  function dfs(current, target, visited, path) {
    if (current === target) {
      results.push([...path]);
      return;
    }
    for (let next = 0; next < n; next++) {
      if (!visited.has(next) && next !== current) {
        visited.add(next);
        path.push(next);
        dfs(next, target, visited, path);
        path.pop();
        visited.delete(next);
      }
    }
  }

  const visited = new Set();
  visited.add(fromIdx);
  dfs(fromIdx, toIdx, visited, [fromIdx]);

  return results;
}

function calculateMigrationPaths(matrixResult) {
  const { versions, comparisons } = matrixResult;
  const n = versions.length;
  const paths = [];

  for (let fromIdx = 0; fromIdx < n; fromIdx++) {
    for (let toIdx = 0; toIdx < n; toIdx++) {
      if (fromIdx === toIdx) {
        continue;
      }
      const allPaths = findAllPaths(versions, comparisons, fromIdx, toIdx);
      const scoredPaths = [];

      for (const idxPath of allPaths) {
        let totalRisk = 0;
        let totalHigh = 0;
        let totalMedium = 0;
        let totalLow = 0;
        let totalBreaking = 0;
        const steps = [];

        for (let k = 0; k < idxPath.length - 1; k++) {
          const a = idxPath[k];
          const b = idxPath[k + 1];
          const key = versions[a].label + '→' + versions[b].label;
          const comp = comparisons[key];

          if (comp) {
            totalRisk += calculateRiskScore(comp.riskStats);
            totalHigh += comp.riskStats.high;
            totalMedium += comp.riskStats.medium;
            totalLow += comp.riskStats.low;
            totalBreaking += comp.riskStats.breaking;
            steps.push({
              from: versions[a].label,
              to: versions[b].label,
              riskStats: comp.riskStats,
              stats: comp.stats,
              topAffectedEndpoints: comp.topAffectedEndpoints
            });
          }
        }

        scoredPaths.push({
          steps: steps,
          totalRisk: totalRisk,
          totalHigh: totalHigh,
          totalMedium: totalMedium,
          totalLow: totalLow,
          totalBreaking: totalBreaking,
          stepCount: steps.length,
          pathLabels: idxPath.map(i => versions[i].label)
        });
      }

      scoredPaths.sort((a, b) => {
        if (a.totalRisk !== b.totalRisk) return a.totalRisk - b.totalRisk;
        return a.stepCount - b.stepCount;
      });

      paths.push({
        from: versions[fromIdx].label,
        to: versions[toIdx].label,
        recommended: scoredPaths[0] || null,
        alternatives: scoredPaths.slice(1, 3)
      });
    }
  }

  return paths;
}

function aggregateScanByVersionPath(scanResultsByPair) {
  const endpointAggregate = new Map();

  for (const [pairKey, scanResult] of Object.entries(scanResultsByPair)) {
    if (!scanResult || scanResult.stats.totalMatches === 0) continue;

    for (const match of scanResult.matches) {
      const endpointKey = match.endpoint.method + ' ' + match.endpoint.path;
      if (!endpointAggregate.has(endpointKey)) {
        endpointAggregate.set(endpointKey, {
          method: match.endpoint.method,
          path: match.endpoint.path,
          affectedInPairs: new Set(),
          matches: [],
          uniqueFiles: new Set()
        });
      }
      const agg = endpointAggregate.get(endpointKey);
      agg.affectedInPairs.add(pairKey);
      agg.matches.push({
        pair: pairKey,
        file: match.file,
        line: match.line,
        code: match.code
      });
      agg.uniqueFiles.add(match.file);
    }
  }

  const result = Array.from(endpointAggregate.values()).map(ep => ({
    ...ep,
    uniqueFiles: Array.from(ep.uniqueFiles),
    affectedInPairs: Array.from(ep.affectedInPairs),
    affectedInPairCount: ep.affectedInPairs.size
  }));

  result.sort((a, b) => b.affectedInPairCount - a.affectedInPairCount);

  return result;
}

function formatMatrixConsole(matrixResult) {
  const { versions, comparisons } = matrixResult;
  const lines = [];

  lines.push('');
  lines.push('📊 版本兼容性矩阵');
  lines.push('='.repeat(70));
  lines.push('');

  const labels = versions.map(v => v.label);
  const cellWidth = 18;

  let header = '   ';
  for (const label of labels) {
    header += label.padStart(cellWidth) + ' ';
  }
  lines.push(header);

  for (let i = 0; i < versions.length; i++) {
    let row = labels[i].padEnd(3) + ' ';
    for (let j = 0; j < versions.length; j++) {
      if (i === j) {
        row += '—'.padStart(cellWidth) + ' ';
      } else {
        const key = versions[i].label + '→' + versions[j].label;
        const comp = comparisons[key];
        if (comp) {
          const score = calculateRiskScore(comp.riskStats);
          let icon = '🟢';
          if (comp.riskStats.high > 0) icon = '🔴';
          else if (comp.riskStats.medium > 0) icon = '🟡';
          const cell = `${icon}${comp.riskStats.breaking}破/${score}`;
          row += cell.padStart(cellWidth) + ' ';
        } else {
          row += 'N/A'.padStart(cellWidth) + ' ';
        }
      }
    }
    lines.push(row);
  }

  lines.push('');
  lines.push('图例: 🔴 高风险 | 🟡 中风险 | 🟢 低风险');
  lines.push('格式: [图标][破坏性变更数]/[风险总分]');
  lines.push('');

  return lines.join('\n');
}

function formatMigrationPathsConsole(migrationPaths) {
  const lines = [];

  lines.push('');
  lines.push('🛤️  推荐迁移路径');
  lines.push('='.repeat(70));

  for (const mp of migrationPaths) {
    if (!mp.recommended) continue;
    lines.push('');
    lines.push(`  ${mp.from} → ${mp.to}:`);
    lines.push(`    推荐路径: ${mp.recommended.pathLabels.join(' → ')}`);
    lines.push(`    步数: ${mp.recommended.stepCount} | 总破坏性变更: ${mp.recommended.totalBreaking} | 风险总分: ${mp.recommended.totalRisk}`);
    lines.push(`    风险分布: 🔴${mp.recommended.totalHigh} 🟡${mp.recommended.totalMedium} 🟢${mp.recommended.totalLow}`);

    for (let i = 0; i < mp.recommended.steps.length; i++) {
      const step = mp.recommended.steps[i];
      lines.push(`      步骤 ${i + 1}: ${step.from} → ${step.to}`);
      lines.push(`        🔴${step.riskStats.high} 🟡${step.riskStats.medium} 🟢${step.riskStats.low} | 破坏性: ${step.riskStats.breaking}`);
    }

    if (mp.alternatives && mp.alternatives.length > 0) {
      lines.push('');
      lines.push('    备选路径:');
      for (let i = 0; i < mp.alternatives.length; i++) {
        const alt = mp.alternatives[i];
        lines.push(`      ${i + 1}. ${alt.pathLabels.join(' → ')} (风险: ${alt.totalRisk}, 步数: ${alt.stepCount})`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

function formatAggregatedScanConsole(aggregatedScan) {
  const lines = [];

  if (!aggregatedScan || aggregatedScan.length === 0) {
    return '';
  }

  lines.push('');
  lines.push('📁 多版本升级持续影响的代码');
  lines.push('='.repeat(70));

  const persistent = aggregatedScan.filter(ep => ep.affectedInPairCount >= 2);

  if (persistent.length === 0) {
    lines.push('  ✅ 未发现跨多个版本持续受影响的接口调用');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`  发现 ${persistent.length} 个接口在多个版本升级中持续受影响:`);
  lines.push('');

  for (const ep of persistent) {
    lines.push(`  ⚠️  ${ep.method} ${ep.path}`);
    lines.push(`     影响版本升级: ${ep.affectedInPairs.join(', ')}`);
    lines.push(`     涉及文件数: ${ep.uniqueFiles.length}`);
    for (const file of ep.uniqueFiles) {
      const matchesInFile = ep.matches.filter(m => m.file === file);
      const linesList = matchesInFile.map(m => m.line).join(', ');
      lines.push(`       📄 ${file} (第 ${linesList} 行)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  loadMultipleSpecs,
  buildCompatibilityMatrix,
  calculateMigrationPaths,
  calculateRiskScore,
  getTopAffectedEndpoints,
  aggregateScanByVersionPath,
  formatMatrixConsole,
  formatMigrationPathsConsole,
  formatAggregatedScanConsole
};
