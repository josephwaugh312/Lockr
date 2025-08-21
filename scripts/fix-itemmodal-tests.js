const fs = require('fs');
const path = require('path');

// Read the test file
const filePath = path.join(__dirname, '../tests/components/ItemModal.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find all async test functions that use 'await user.' but don't have 'const user = userEvent.setup()'
const testPattern = /test\(['"`].*?['"`],\s*async\s*\(\)\s*=>\s*{/g;
let matches = content.matchAll(testPattern);

for (const match of matches) {
  const testStart = match.index;
  const testEnd = content.indexOf('});', testStart);
  const testBody = content.substring(testStart, testEnd + 3);
  
  // Check if this test uses 'await user.' but doesn't have userEvent.setup()
  if (testBody.includes('await user.') && !testBody.includes('const user = userEvent.setup()')) {
    // Find the position right after the opening brace of the test function
    const openBracePos = content.indexOf('{', testStart + match[0].length - 1);
    
    // Insert the user setup line
    const beforeBrace = content.substring(0, openBracePos + 1);
    const afterBrace = content.substring(openBracePos + 1);
    content = beforeBrace + '\n      const user = userEvent.setup();' + afterBrace;
  }
}

// Write the updated content back
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed ItemModal tests with user setup');