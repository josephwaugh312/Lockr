#!/usr/bin/env node

/**
 * Check code coverage for changed files in a PR/commit
 * Enforces minimum coverage thresholds for modified files
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Coverage thresholds for changed files
const DIFF_COVERAGE_THRESHOLDS = {
  lines: 90,
  branches: 85,
  functions: 85,
  statements: 90
};

// Per-file minimum thresholds
const FILE_COVERAGE_FLOOR = {
  lines: 70,
  branches: 70,
  functions: 70,
  statements: 70
};

function getChangedFiles() {
  try {
    // Get list of changed files compared to main branch
    const output = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' });
    return output
      .trim()
      .split('\n')
      .filter(file => file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx'))
      .filter(file => file.startsWith('src/'))
      .filter(file => !file.includes('.test.'))
      .filter(file => !file.includes('.spec.'))
      .filter(file => !file.includes('.stories.'))
      .filter(file => !file.includes('.d.ts'))
      .filter(file => !file.includes('/__mocks__/'))
      .filter(file => !file.endsWith('/index.js'))
      .filter(file => !file.endsWith('/index.ts'));
  } catch (error) {
    console.log('No changed files found or not in a git repository');
    return [];
  }
}

function runCoverageForFiles(files) {
  if (files.length === 0) {
    console.log('✅ No source files changed');
    return true;
  }

  console.log(`\n📊 Checking coverage for ${files.length} changed file(s):\n`);
  files.forEach(file => console.log(`  - ${file}`));
  console.log('');

  try {
    // Run Jest with coverage for specific files
    const filePattern = files.map(f => `--collectCoverageFrom="${f}"`).join(' ');
    const command = `npx jest --coverage --coverageReporters=json-summary ${filePattern} --silent`;
    
    execSync(command, { stdio: 'inherit' });
    
    // Read coverage report
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    if (!fs.existsSync(coveragePath)) {
      console.error('❌ Coverage report not found');
      return false;
    }

    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    
    let allPassed = true;
    let totalLines = 0;
    let coveredLines = 0;
    let totalBranches = 0;
    let coveredBranches = 0;

    // Check per-file coverage
    console.log('\n📁 Per-file coverage:\n');
    for (const file of files) {
      const fileCoverage = coverage[file];
      if (!fileCoverage) {
        console.log(`  ⚠️  ${file}: No coverage data`);
        continue;
      }

      const metrics = {
        lines: fileCoverage.lines.pct,
        branches: fileCoverage.branches.pct,
        functions: fileCoverage.functions.pct,
        statements: fileCoverage.statements.pct
      };

      // Accumulate totals
      totalLines += fileCoverage.lines.total;
      coveredLines += fileCoverage.lines.covered;
      totalBranches += fileCoverage.branches.total;
      coveredBranches += fileCoverage.branches.covered;

      let fileStatus = '✅';
      let failedMetrics = [];

      // Check against floor thresholds
      for (const [metric, threshold] of Object.entries(FILE_COVERAGE_FLOOR)) {
        if (metrics[metric] < threshold) {
          fileStatus = '❌';
          failedMetrics.push(`${metric}: ${metrics[metric].toFixed(1)}% < ${threshold}%`);
          allPassed = false;
        }
      }

      console.log(`  ${fileStatus} ${file}`);
      console.log(`     Lines: ${metrics.lines.toFixed(1)}% | Branches: ${metrics.branches.toFixed(1)}% | Functions: ${metrics.functions.toFixed(1)}% | Statements: ${metrics.statements.toFixed(1)}%`);
      
      if (failedMetrics.length > 0) {
        console.log(`     Failed: ${failedMetrics.join(', ')}`);
      }
      console.log('');
    }

    // Calculate and check aggregate diff coverage
    const diffCoverage = {
      lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 100,
      branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 100
    };

    console.log('\n📈 Aggregate diff coverage:\n');
    console.log(`  Lines: ${diffCoverage.lines.toFixed(1)}% (threshold: ${DIFF_COVERAGE_THRESHOLDS.lines}%)`);
    console.log(`  Branches: ${diffCoverage.branches.toFixed(1)}% (threshold: ${DIFF_COVERAGE_THRESHOLDS.branches}%)`);

    if (diffCoverage.lines < DIFF_COVERAGE_THRESHOLDS.lines) {
      console.log(`\n❌ Diff line coverage ${diffCoverage.lines.toFixed(1)}% is below threshold of ${DIFF_COVERAGE_THRESHOLDS.lines}%`);
      allPassed = false;
    }

    if (diffCoverage.branches < DIFF_COVERAGE_THRESHOLDS.branches) {
      console.log(`❌ Diff branch coverage ${diffCoverage.branches.toFixed(1)}% is below threshold of ${DIFF_COVERAGE_THRESHOLDS.branches}%`);
      allPassed = false;
    }

    if (allPassed) {
      console.log('\n✅ All coverage thresholds met!');
    } else {
      console.log('\n❌ Coverage thresholds not met. Please add tests for the changed code.');
    }

    return allPassed;
  } catch (error) {
    console.error('❌ Error running coverage:', error.message);
    return false;
  }
}

function main() {
  console.log('🔍 Checking diff coverage for changed files...\n');
  
  const changedFiles = getChangedFiles();
  const passed = runCoverageForFiles(changedFiles);
  
  process.exit(passed ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { getChangedFiles, runCoverageForFiles };