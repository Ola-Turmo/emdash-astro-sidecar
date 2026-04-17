import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function loadPreviousSummary(repoRoot, reportName, scope = []) {
  const summaryPath = path.join(repoRoot, 'output', reportName, ...scope, 'latest', 'summary.json');
  if (!existsSync(summaryPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(summaryPath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeReportArtifacts(repoRoot, reportName, summary, markdown, scope = []) {
  const rootDir = path.join(repoRoot, 'output', reportName, ...scope);
  const latestDir = path.join(rootDir, 'latest');
  const historyDir = path.join(rootDir, 'history');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  mkdirSync(latestDir, { recursive: true });
  mkdirSync(historyDir, { recursive: true });

  const latestSummaryPath = path.join(latestDir, 'summary.json');
  const latestMarkdownPath = path.join(latestDir, 'SUMMARY.md');
  const historySummaryPath = path.join(historyDir, `${timestamp}.json`);
  const historyMarkdownPath = path.join(historyDir, `${timestamp}.md`);

  writeFileSync(latestSummaryPath, JSON.stringify(summary, null, 2));
  writeFileSync(latestMarkdownPath, `${markdown.trimEnd()}\n`);
  writeFileSync(historySummaryPath, JSON.stringify(summary, null, 2));
  writeFileSync(historyMarkdownPath, `${markdown.trimEnd()}\n`);

  return {
    latestSummaryPath,
    latestMarkdownPath,
    historySummaryPath,
    historyMarkdownPath,
  };
}

export function summarizeTrend(currentValue, previousValue, lowerIsBetter = true) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return null;
  }

  const delta = Number((currentValue - previousValue).toFixed(2));
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const direction = delta === 0 ? 'flat' : improved ? 'improved' : 'regressed';

  return {
    previous: previousValue,
    current: currentValue,
    delta,
    direction,
  };
}

export function toMarkdownList(items, emptyLabel = 'None') {
  if (!items.length) {
    return `- ${emptyLabel}`;
  }
  return items.map((item) => `- ${item}`).join('\n');
}
