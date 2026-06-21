const fs = require('fs');
const path = require('path');

const SCAN_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.vue'];

function pathToPattern(apiPath) {
  const escaped = apiPath.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return escaped.replace(/\\\{[^}]+\\\}/g, '[^/]+');
}

function buildEndpointRegex(apiPath) {
  const pattern = pathToPattern(apiPath);
  return new RegExp('(?:^|[/?&#=])' + pattern + '(?:[/?&#]|$)', 'g');
}

function matchesPath(urlStr, apiPath) {
  const urlPath = urlStr.split('?')[0].split('#')[0];
  const regex = buildEndpointRegex(apiPath);
  regex.lastIndex = 0;

  if (apiPath.indexOf('{') === -1) {
    if (urlPath === apiPath) return true;
    if (urlPath.indexOf(apiPath + '/') === 0) return false;
    if (urlPath.indexOf(apiPath + '?') === 0) return true;
  }

  const pathPattern = pathToPattern(apiPath);
  const exactRegex = new RegExp('^' + pathPattern + '$');
  if (exactRegex.test(urlPath)) {
    return true;
  }

  return false;
}

function extractUrlStrings(line) {
  const urls = [];
  const stringPatterns = [
    /`([^`]*)`/g,
    /'([^']*)'/g,
    /"([^"]*)"/g
  ];

  for (const pattern of stringPatterns) {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const str = match[1];
      if (str.startsWith('/') || str.startsWith('http')) {
        urls.push(str);
      }
    }
  }

  return urls;
}

function detectHttpMethod(line) {
  const methodPatterns = [
    { method: 'GET', pattern: /\.get\s*\(/ },
    { method: 'POST', pattern: /\.post\s*\(/ },
    { method: 'PUT', pattern: /\.put\s*\(/ },
    { method: 'DELETE', pattern: /\.delete\s*\(/ },
    { method: 'PATCH', pattern: /\.patch\s*\(/ },
    { method: 'GET', pattern: /fetch\s*\(/ },
    { method: 'GET', pattern: /method:\s*['"`]GET['"`]/ },
    { method: 'POST', pattern: /method:\s*['"`]POST['"`]/ },
    { method: 'PUT', pattern: /method:\s*['"`]PUT['"`]/ },
    { method: 'DELETE', pattern: /method:\s*['"`]DELETE['"`]/ },
    { method: 'PATCH', pattern: /method:\s*['"`]PATCH['"`]/ },
    { method: 'GET', pattern: /axios\s*\(\s*\{[^}]*method:\s*['"`]GET['"`]/s },
    { method: 'POST', pattern: /axios\s*\(\s*\{[^}]*method:\s*['"`]POST['"`]/s },
  ];

  for (const { method, pattern } of methodPatterns) {
    if (pattern.test(line)) {
      return method;
    }
  }

  return null;
}

function findFiles(dir, extensions) {
  let results = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build') {
        continue;
      }
      results = results.concat(findFiles(fullPath, extensions));
    } else if (stat.isFile()) {
      const ext = path.extname(fullPath);
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function scanFile(filePath, affectedEndpoints) {
  const matches = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const urls = extractUrlStrings(line);
    const detectedMethod = detectHttpMethod(line);

    for (const urlStr of urls) {
      for (const endpoint of affectedEndpoints) {
        if (matchesPath(urlStr, endpoint.path)) {
          const methodMatch = !detectedMethod || detectedMethod === endpoint.method;
          const key = lineNum + ':' + endpoint.method + ':' + endpoint.path;

          if (!seen.has(key)) {
            seen.add(key);
            matches.push({
              file: filePath,
              line: lineNum,
              code: line.trim(),
              endpoint: endpoint,
              pathPattern: endpoint.path,
              matchedUrl: urlStr,
              methodDetected: detectedMethod,
              methodMatched: methodMatch,
              confidence: methodMatch ? 'high' : 'medium'
            });
          }
        }
      }
    }
  }

  return matches;
}

function scanCodebase(scanDir, affectedEndpoints) {
  if (!fs.existsSync(scanDir)) {
    return { files: [], matches: [], stats: { totalFiles: 0, matchedFiles: 0, totalMatches: 0 } };
  }

  const stat = fs.statSync(scanDir);
  let files = [];

  if (stat.isFile()) {
    const ext = path.extname(scanDir);
    if (SCAN_EXTENSIONS.includes(ext)) {
      files = [scanDir];
    }
  } else {
    files = findFiles(scanDir, SCAN_EXTENSIONS);
  }

  const allMatches = [];
  const matchedFiles = new Set();

  for (const file of files) {
    const fileMatches = scanFile(file, affectedEndpoints);
    if (fileMatches.length > 0) {
      matchedFiles.add(file);
      allMatches.push(...fileMatches);
    }
  }

  const grouped = {};
  for (const match of allMatches) {
    const key = match.endpoint.method + ' ' + match.endpoint.path;
    if (!grouped[key]) {
      grouped[key] = {
        endpoint: match.endpoint,
        matches: []
      };
    }
    grouped[key].matches.push(match);
  }

  return {
    files: files,
    matches: allMatches,
    grouped: grouped,
    stats: {
      totalFiles: files.length,
      matchedFiles: matchedFiles.size,
      totalMatches: allMatches.length
    }
  };
}

function getAffectedEndpoints(changes) {
  const endpointSet = new Map();

  for (const change of changes) {
    if (change.path && change.method) {
      const key = change.method + ' ' + change.path;
      if (!endpointSet.has(key)) {
        endpointSet.set(key, {
          path: change.path,
          method: change.method,
          changes: []
        });
      }
      endpointSet.get(key).changes.push(change);
    }
  }

  return Array.from(endpointSet.values());
}

function formatScanResult(scanResult) {
  const lines = [];
  const { stats, grouped } = scanResult;

  lines.push('');
  lines.push('🔍 客户端代码影响扫描');
  lines.push('='.repeat(50));
  lines.push('   扫描文件总数: ' + stats.totalFiles);
  lines.push('   受影响文件数: ' + stats.matchedFiles);
  lines.push('   匹配次数: ' + stats.totalMatches);
  lines.push('');

  if (stats.totalMatches === 0) {
    lines.push('   ✅ 未发现受影响的代码');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('📁 受影响文件列表:');
  lines.push('-'.repeat(50));

  const fileMap = {};
  for (const match of scanResult.matches) {
    if (!fileMap[match.file]) {
      fileMap[match.file] = [];
    }
    fileMap[match.file].push(match);
  }

  for (const file in fileMap) {
    if (fileMap.hasOwnProperty(file)) {
      const matches = fileMap[file];
      lines.push('   ' + file + ':');
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const icon = m.confidence === 'high' ? '⚡' : '📝';
        const codePreview = m.code.length > 80 ? m.code.slice(0, 80) + '...' : m.code;
        lines.push('     ' + icon + ' 第' + m.line + '行 - ' + m.endpoint.method + ' ' + m.endpoint.path);
        lines.push('        ' + codePreview);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

module.exports = {
  scanCodebase,
  getAffectedEndpoints,
  formatScanResult,
  buildEndpointRegex,
  pathToPattern,
  SCAN_EXTENSIONS
};
