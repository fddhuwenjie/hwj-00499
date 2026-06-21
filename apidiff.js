#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

const { loadSpec, generateSummary, formatSummaryTable } = require('./lib/parser');
const { diffFiles } = require('./lib/diff');
const { classifyChanges, formatRiskSummary, formatRiskList } = require('./lib/impact');
const { scanCodebase, getAffectedEndpoints, formatScanResult } = require('./lib/scanner');
const {
  generateAllAdvices,
  generateMarkdownReport,
  formatAdvices,
  generateMatrixMarkdownReport
} = require('./lib/reporter');
const { generateTests, formatGenTestResult, generateCurlExample } = require('./lib/testgen');
const {
  buildCompatibilityMatrix,
  calculateMigrationPaths,
  aggregateScanByVersionPath,
  formatMatrixConsole,
  formatMigrationPathsConsole,
  formatAggregatedScanConsole
} = require('./lib/matrix');

const program = new Command();

program
  .name('apidiff')
  .description('OpenAPI/Swagger 接口变更影响分析工具')
  .version('1.0.0');

program
  .command('summary <spec>')
  .description('显示OpenAPI规范总览')
  .action((spec) => {
    try {
      const specData = loadSpec(spec);
      const summary = generateSummary(specData);
      console.log(formatSummaryTable(summary));
    } catch (err) {
      console.error(chalk.red(`❌ 错误: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('diff <oldSpec> <newSpec>')
  .description('比较两个OpenAPI规范的差异')
  .option('--scan <dir>', '扫描代码目录，检查受影响文件')
  .option('--report <file>', '生成Markdown报告文件')
  .option('--json', '以JSON格式输出')
  .action((oldSpec, newSpec, options) => {
    try {
      const diffResult = diffFiles(oldSpec, newSpec);
      const classifiedResult = classifyChanges(diffResult);

      if (options.json) {
        const output = {
          stats: classifiedResult.stats,
          riskStats: classifiedResult.riskStats,
          changes: classifiedResult.changes
        };

        if (options.scan) {
          const affectedEndpoints = getAffectedEndpoints(classifiedResult.changes);
          const scanResult = scanCodebase(options.scan, affectedEndpoints);
          output.scan = scanResult;
        }

        console.log(JSON.stringify(output, null, 2));
        return;
      }

      console.log(chalk.bold('📊 API 变更分析报告'));
      console.log('='.repeat(60));
      console.log(`   旧版本: ${chalk.yellow(diffResult.oldSummary.info.version || 'N/A')} (${oldSpec})`);
      console.log(`   新版本: ${chalk.green(diffResult.newSummary.info.version || 'N/A')} (${newSpec})`);
      console.log('');
      console.log(`   总变更数: ${chalk.bold(diffResult.stats.totalChanges)}`);
      console.log(`     新增: ${chalk.green(diffResult.stats.added)}`);
      console.log(`     删除: ${chalk.red(diffResult.stats.removed)}`);
      console.log(`     修改: ${chalk.yellow(diffResult.stats.modified)}`);

      console.log(formatRiskSummary(classifiedResult));
      console.log(formatRiskList(classifiedResult));

      const advices = generateAllAdvices(classifiedResult);
      console.log(formatAdvices(advices));

      if (options.scan) {
        const affectedEndpoints = getAffectedEndpoints(classifiedResult.changes);
        const scanResult = scanCodebase(options.scan, affectedEndpoints);
        console.log(formatScanResult(scanResult));
      }

      if (options.report) {
        let scanResult = null;
        if (options.scan) {
          const affectedEndpoints = getAffectedEndpoints(classifiedResult.changes);
          scanResult = scanCodebase(options.scan, affectedEndpoints);
        }
        generateMarkdownReport(classifiedResult, scanResult, options.report);
        console.log(chalk.green(`✅ Markdown报告已生成: ${options.report}`));
        console.log('');
      }

      if (classifiedResult.riskStats.breaking > 0) {
        console.log(chalk.red.bold(`⚠️  发现 ${classifiedResult.riskStats.breaking} 个破坏性变更，请务必处理！`));
        console.log('');
        process.exitCode = 1;
      }

    } catch (err) {
      console.error(chalk.red(`❌ 错误: ${err.message}`));
      console.error(err.stack);
      process.exit(1);
    }
  });

program
  .command('gen-tests <spec>')
  .description('根据OpenAPI规范生成契约测试')
  .option('-o, --output <dir>', '输出目录', 'tests')
  .action((spec, options) => {
    try {
      const specData = loadSpec(spec);
      const result = generateTests(specData, options.output);
      console.log(formatGenTestResult(result));
    } catch (err) {
      console.error(chalk.red(`❌ 错误: ${err.message}`));
      console.error(err.stack);
      process.exit(1);
    }
  });

program
  .command('curl <spec> [path] [method]')
  .description('生成指定接口的cURL示例')
  .action((spec, pathName, methodName) => {
    try {
      const specData = loadSpec(spec);
      const summary = generateSummary(specData);
      const baseUrl = (specData.servers && specData.servers[0] && specData.servers[0].url) || 'https://api.example.com';

      let endpoints = summary.endpoints;

      if (pathName) {
        endpoints = endpoints.filter(ep =>
          ep.path === pathName || ep.path.includes(pathName)
        );
      }

      if (methodName) {
        endpoints = endpoints.filter(ep =>
          ep.method.toLowerCase() === methodName.toLowerCase()
        );
      }

      if (endpoints.length === 0) {
        console.log(chalk.yellow('⚠️  未找到匹配的接口'));
        return;
      }

      for (const ep of endpoints) {
        console.log(generateCurlExample(ep, specData, baseUrl));
      }

    } catch (err) {
      console.error(chalk.red(`❌ 错误: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('matrix <specs...>')
  .description('多版本兼容矩阵与迁移路径分析')
  .option('--scan <dir>', '扫描代码目录，检查受影响文件')
  .option('--report <file>', '生成Markdown报告文件')
  .option('--json', '以JSON格式输出')
  .action((specs, options) => {
    try {
      if (specs.length < 2) {
        console.error(chalk.red('❌ 错误: 至少需要提供2个版本文件'));
        process.exit(1);
      }

      const matrixResult = buildCompatibilityMatrix(specs);
      const migrationPaths = calculateMigrationPaths(matrixResult);

      let scanResultsByPair = {};
      let aggregatedScan = null;

      if (options.scan) {
        for (const [key, comp] of Object.entries(matrixResult.comparisons)) {
          if (!comp.isUpgrade) continue;
          const affectedEndpoints = getAffectedEndpoints(comp.classified.changes);
          if (affectedEndpoints.length > 0) {
            scanResultsByPair[key] = scanCodebase(options.scan, affectedEndpoints);
          }
        }
        aggregatedScan = aggregateScanByVersionPath(scanResultsByPair);
      }

      if (options.json) {
        const output = {
          versions: matrixResult.versions.map(v => ({
            label: v.label,
            version: v.version,
            path: v.path,
            stats: v.summary ? v.summary.stats : null
          })),
          comparisons: {},
          migrationPaths: migrationPaths,
          aggregatedScan: aggregatedScan
        };

        for (const [key, comp] of Object.entries(matrixResult.comparisons)) {
          output.comparisons[key] = {
            from: comp.from,
            to: comp.to,
            stats: comp.stats,
            riskStats: comp.riskStats,
            topAffectedEndpoints: comp.topAffectedEndpoints.map(ep => ({
              method: ep.method,
              path: ep.path,
              high: ep.high,
              medium: ep.medium,
              low: ep.low
            }))
          };
        }

        if (options.scan) {
          output.scanResultsByPair = {};
          for (const [key, sr] of Object.entries(scanResultsByPair)) {
            output.scanResultsByPair[key] = {
              stats: sr.stats,
              matches: sr.matches.map(m => ({
                file: m.file,
                line: m.line,
                code: m.code,
                endpoint: { method: m.endpoint.method, path: m.endpoint.path }
              }))
            };
          }
        }

        console.log(JSON.stringify(output, null, 2));
        return;
      }

      console.log(chalk.bold('📊 多版本 API 兼容性矩阵分析报告'));
      console.log('='.repeat(70));
      console.log('');
      console.log(`   分析版本数: ${chalk.bold(matrixResult.versions.length)}`);
      for (const v of matrixResult.versions) {
        console.log(`   - ${v.label} (v${v.version}): ${v.path}`);
      }
      console.log('');

      console.log(formatMatrixConsole(matrixResult));
      console.log(formatMigrationPathsConsole(migrationPaths));

      if (options.scan) {
        console.log(formatAggregatedScanConsole(aggregatedScan));
      }

      if (options.report) {
        generateMatrixMarkdownReport(
          matrixResult,
          migrationPaths,
          aggregatedScan,
          scanResultsByPair,
          options.report
        );
        console.log(chalk.green(`✅ Markdown报告已生成: ${options.report}`));
        console.log('');
      }

      let hasBreaking = false;
      for (const comp of Object.values(matrixResult.comparisons)) {
        if (comp.isUpgrade && comp.riskStats.breaking > 0) {
          hasBreaking = true;
          break;
        }
      }
      if (hasBreaking) {
        console.log(chalk.red.bold('⚠️  版本升级路径中存在破坏性变更，请仔细查看迁移建议！'));
        console.log('');
        process.exitCode = 1;
      }

    } catch (err) {
      console.error(chalk.red(`❌ 错误: ${err.message}`));
      console.error(err.stack);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
