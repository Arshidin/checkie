#!/usr/bin/env node
/**
 * Fix script - removes defer/async from Webflow-critical scripts
 * Run: node scripts/fix-webflow-scripts.js
 */

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'pages');

function getAllHtmlFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllHtmlFiles(fullPath, files);
    } else if (item.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

function fixHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remove defer from memberstack.js - it's critical for auth
  const memberstackRegex = /(<script[^>]*src="[^"]*memberstack\.js"[^>]*)\s+defer>/gi;
  if (memberstackRegex.test(html)) {
    html = html.replace(memberstackRegex, '$1>');
    modified = true;
  }

  // Remove async from webfont.js - it needs to run before WebFont.load() call
  const webfontRegex = /(<script[^>]*src="[^"]*webfont\.js"[^>]*)\s+async>/gi;
  if (webfontRegex.test(html)) {
    html = html.replace(webfontRegex, '$1>');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, html, 'utf8');
    return true;
  }

  return false;
}

function main() {
  console.log('Fixing Webflow-critical scripts...\n');

  const htmlFiles = getAllHtmlFiles(PAGES_DIR);
  let fixedCount = 0;

  for (const file of htmlFiles) {
    const relativePath = path.relative(PAGES_DIR, file);
    const wasFixed = fixHtml(file);

    if (wasFixed) {
      console.log(`✓ Fixed: ${relativePath}`);
      fixedCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Total files: ${htmlFiles.length}`);
  console.log(`Fixed: ${fixedCount}`);
  console.log(`========================================\n`);
}

main();
