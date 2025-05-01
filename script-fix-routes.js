const fs = require('fs');
const path = require('path');

// API route directories to modify
const routesToFix = [
  'src/app/api/prices/history/route.ts',
  'src/app/api/hcs-test/route.ts',
  'src/app/api/token-operations/route.ts',
  'src/app/api/governance/vote/route.ts',
  'src/app/api/governance/proposals/route.ts',
  'src/app/api/index/composition/route.ts',
  'src/app/api/debug-message/route.ts',
  'src/app/api/env-check/route.ts',
  'src/app/api/risk/metrics/route.ts'
];

// The export directives to add
const exportsToAdd = `
// Only run on server, not during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
`;

// Process each file
routesToFix.forEach(routePath => {
  try {
    const filePath = path.resolve(routePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }
    
    // Read the file
    let fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Check if the exports are already there
    if (fileContent.includes("export const dynamic = 'force-dynamic'")) {
      console.log(`File already fixed: ${routePath}`);
      return;
    }
    
    // Find import statements
    const importEndIndex = fileContent.lastIndexOf('import');
    if (importEndIndex === -1) {
      // No imports, add at the top
      fileContent = exportsToAdd + fileContent;
    } else {
      // Find the end of import section
      const lines = fileContent.split('\n');
      let lastImportLine = 0;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import')) {
          lastImportLine = i;
        }
      }
      
      // Insert exports after imports
      lines.splice(lastImportLine + 1, 0, exportsToAdd);
      fileContent = lines.join('\n');
    }
    
    // Write the updated content back
    fs.writeFileSync(filePath, fileContent);
    console.log(`Fixed file: ${routePath}`);
  } catch (error) {
    console.error(`Error processing ${routePath}:`, error);
  }
});

console.log('Done fixing API routes.'); 