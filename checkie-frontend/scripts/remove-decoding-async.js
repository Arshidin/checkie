#!/usr/bin/env node
/**
 * Remove decoding="async" from all images
 * This attribute can interfere with Webflow slider initialization
 *
 * Run: node scripts/remove-decoding-async.js
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
  const original = html;

  // Remove decoding="async" from images
  html = html.replace(/ decoding="async"/gi, '');

  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    return true;
  }

  return false;
}

function main() {
  console.log('Removing decoding="async" from all images...\n');

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
