#!/usr/bin/env node

/**
 * Script to run only backend tests, excluding React component tests
 * This avoids hanging issues with React Testing Library and userEvent
 */

const { spawn } = require('child_process');

// Test patterns to include (backend tests)
const includePatterns = [
  'tests/controllers',
  'tests/services',
  'tests/models',
  'tests/middleware',
  'tests/utils',
  'tests/routes',
  'tests/integration',
  'tests/examples',
  'tests/server.test.js'
];

// Build Jest command - use testMatch for inclusion
const jestArgs = [
  '--forceExit',
  '--testTimeout=10000',
  '--maxWorkers=2',
  '--testMatch',
  '**/tests/(controllers|services|models|middleware|utils|routes|integration|examples)/**/*.test.js',
  '--testMatch',
  '**/tests/server.test.js',
  '--verbose'
];

console.log('🧪 Running backend tests only...');
console.log('📋 Test patterns: backend tests in tests/ directory');
console.log('');

// Run Jest with the specified arguments
const jest = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test'
  }
});

jest.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ Backend tests completed successfully!');
  } else {
    console.log(`\n❌ Backend tests failed with code ${code}`);
  }
  process.exit(code);
});