#!/usr/bin/env node

/**
 * Fix Module Buttons Script
 * Automatically fixes all module HTML files to have correct button structure
 * 
 * Usage: node fix-module-buttons.js
 */

const fs = require('fs');
const path = require('path');

// ========================================
// CONFIGURATION
// ========================================

const ROOT_DIR = process.cwd(); // Run from your project root
const DRY_RUN = false; // Set to true to preview changes without modifying files

// Directories to search for module HTML files
const SEARCH_DIRS = [
  './modules',
  './courses',
  './notion-export-clean',
  './the%20arcane%20archives',
  // Add more directories where your module files are located
];

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Convert folder/file name to course ID
 * Example: "productive isolation" -> "PRODUCTIVE-ISOLATION"
 */
function toCourseId(name) {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Spaces to hyphens
    .toUpperCase();
}

/**
 * Generate module ID from filename
 * Example: "module-1.html" -> "module-1"
 */
function toModuleId(filename, courseId) {
  const nameWithoutExt = path.basename(filename, '.html');
  const cleanName = nameWithoutExt
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .toLowerCase();
  
  // Use hash of full path for uniqueness if needed
  const hash = require('crypto')
    .createHash('md5')
    .update(filename)
    .digest('hex')
    .substring(0, 8);
  
  return `${courseId.toLowerCase()}-${cleanName}-${hash}`;
}

/**
 * Find all HTML files recursively
 */
function findHtmlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Detect if HTML file is a module page
 */
function isModulePage(content) {
  // Check for indicators that this is a module page
  const indicators = [
    /complete.?module/i,
    /class=["']aa-pill-button/i,
    /data-module-id/i,
    /<article/i, // Notion exports use article tags
  ];

  return indicators.some(pattern => pattern.test(content));
}

/**
 * Extract course name from file path
 */
function getCourseFromPath(filePath) {
  const parts = filePath.split(path.sep);
  
  // Try to find a parent directory that looks like a course name
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i];
    
    // Skip common directory names
    if (['modules', 'courses', 'html', 'pages', 'notion-export-clean'].includes(part.toLowerCase())) {
      continue;
    }
    
    // This is likely the course name
    if (part.length > 2) {
      return toCourseId(decodeURIComponent(part));
    }
  }
  
  return 'UNKNOWN-COURSE';
}

/**
 * Fix button structure in HTML content
 */
function fixButtonStructure(content, courseId, moduleId) {
  let modified = content;
  let changesMade = false;

  // Pattern 1: Find existing button with complete-module or aa-pill-button class
  const buttonPattern = /<button[^>]*(?:id=["']complete-module-btn["']|class=["'][^"']*aa-pill-button[^"']*["'])[^>]*>[\s\S]*?<\/button>/gi;
  
  modified = modified.replace(buttonPattern, (match) => {
    console.log(`  Found button to fix`);
    changesMade = true;
    
    return `<button 
  class="aa-pill-button" 
  data-module-id="${moduleId}" 
  data-course-id="${courseId}">
  <span class="aa-pill-primary">Complete Module</span>
  <span class="aa-pill-secondary">+75 XP</span>
</button>`;
  });

  // Pattern 2: If no button found, add one before closing body tag
  if (!changesMade && /<\/body>/i.test(modified)) {
    console.log(`  No button found, adding new one`);
    
    const buttonHtml = `
  <!-- Module Completion Button -->
  <button 
    class="aa-pill-button" 
    data-module-id="${moduleId}" 
    data-course-id="${courseId}">
    <span class="aa-pill-primary">Complete Module</span>
    <span class="aa-pill-secondary">+75 XP</span>
  </button>

</body>`;
    
    modified = modified.replace(/<\/body>/i, buttonHtml);
    changesMade = true;
  }

  // Add data-aa-course attribute to body tag if not present
  if (!modified.includes('data-aa-course=')) {
    modified = modified.replace(
      /<body([^>]*)>/i,
      `<body$1 data-aa-course="${courseId}">`
    );
  }

  // Ensure required scripts are loaded (add before </body> if missing)
  const requiredScripts = [
    '<script type="module" src="/universal-auth.js"></script>',
    '<script type="module" src="/xp-system.js"></script>',
    '<script type="module" src="/course-module-tracker.js"></script>',
    '<script type="module" src="/xp-module-listener.js"></script>',
  ];

  const hasScripts = requiredScripts.some(script => modified.includes(script));
  
  if (!hasScripts && changesMade) {
    const scriptsHtml = `
  <!-- XP System Scripts -->
  ${requiredScripts.join('\n  ')}
</body>`;
    
    modified = modified.replace(/<\/body>/i, scriptsHtml);
  }

  return { content: modified, changed: changesMade };
}

/**
 * Process a single HTML file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if not a module page
    if (!isModulePage(content)) {
      return { processed: false, reason: 'Not a module page' };
    }

    const courseId = getCourseFromPath(filePath);
    const moduleId = toModuleId(filePath, courseId);

    const { content: newContent, changed } = fixButtonStructure(content, courseId, moduleId);

    if (changed) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would modify file`);
      } else {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`  ✅ Fixed`);
      }
      return { processed: true, changed: true, courseId, moduleId };
    }

    return { processed: true, changed: false };
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    return { processed: false, error: err.message };
  }
}

// ========================================
// MAIN EXECUTION
// ========================================

console.log('🔧 Module Button Fixer');
console.log('='.repeat(50));
console.log(`Root directory: ${ROOT_DIR}`);
console.log(`Dry run: ${DRY_RUN ? 'YES (no files will be modified)' : 'NO (files will be modified)'}`);
console.log('='.repeat(50));
console.log('');

// Find all HTML files
console.log('📂 Scanning for HTML files...');
let allFiles = [];

SEARCH_DIRS.forEach(dir => {
  const fullPath = path.join(ROOT_DIR, dir);
  const found = findHtmlFiles(fullPath);
  allFiles = allFiles.concat(found);
  console.log(`  Found ${found.length} files in ${dir}`);
});

console.log(`\n📊 Total HTML files found: ${allFiles.length}\n`);

if (allFiles.length === 0) {
  console.log('❌ No HTML files found. Make sure you run this from your project root.');
  console.log('💡 Update SEARCH_DIRS in the script to point to your module folders.');
  process.exit(1);
}

// Process files
let stats = {
  processed: 0,
  modified: 0,
  skipped: 0,
  errors: 0,
};

console.log('🔄 Processing files...\n');

allFiles.forEach((filePath, index) => {
  const relativePath = path.relative(ROOT_DIR, filePath);
  console.log(`[${index + 1}/${allFiles.length}] ${relativePath}`);
  
  const result = processFile(filePath);
  
  if (result.processed) {
    stats.processed++;
    if (result.changed) {
      stats.modified++;
    } else {
      stats.skipped++;
    }
  } else if (result.error) {
    stats.errors++;
  } else {
    stats.skipped++;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 SUMMARY');
console.log('='.repeat(50));
console.log(`Total files scanned: ${allFiles.length}`);
console.log(`Module pages found: ${stats.processed}`);
console.log(`Files modified: ${stats.modified}`);
console.log(`Files skipped: ${stats.skipped}`);
console.log(`Errors: ${stats.errors}`);
console.log('='.repeat(50));

if (DRY_RUN) {
  console.log('\n⚠️  DRY RUN MODE - No files were actually modified');
  console.log('Set DRY_RUN = false in the script to apply changes');
} else {
  console.log('\n✅ All files have been processed!');
  console.log('\n📝 Next steps:');
  console.log('1. Review the changes: git diff');
  console.log('2. Test a few module pages');
  console.log('3. Commit and deploy: git add . && git commit -m "Fixed module buttons" && git push');
}

console.log('');