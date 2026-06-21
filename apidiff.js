#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

const { loadSpec, generateSummary, formatSummaryTable } = require('./lib/parser');
const { diffFiles } = require('./lib/diff');
const { classifyChanges, formatRiskSummary, formatRiskList } = require('./lib/impact');
const { scanCodebase, getAffectedEndpoints, formatScanResult } = require('./lib/scanner');
const { generateAllAdvices, generateMarkdownReport, formatAdvices } = require('./lib/reporter');
const { generateTests, formatGenTestResult, generateCurlExample } = require('./lib/testgen');

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

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
