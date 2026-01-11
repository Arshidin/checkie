#!/usr/bin/env node
/**
 * HTML Optimization Script for Checkie Frontend
 *
 * This script optimizes HTML files exported from Webflow:
 * 1. Adds defer to jQuery (safe - loaded before webflow.js)
 * 2. Adds loading="lazy" to images
 * 3. Adds preload="none" to videos
 * 4. Adds preconnect hints for external resources
 *
 * IMPORTANT: Does NOT modify memberstack.js or webfont.js
 * as they are critical for Webflow functionality.
 *
 * Run: node scripts/optimize-html.js
 */

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'pages');

// Only jQuery is safe to defer - it's loaded before webflow.js at the end of body
const DEFER_SCRIPTS = [
  'jquery-3.6.0.min.js',
];

// DO NOT add defer/async to these - they break Webflow functionality:
// - memberstack.js (auth critical)
// - webfont.js (needs sync call to WebFont.load())
// - jetboost.js (already loads async via inline script)

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

function optimizeHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Add defer to jQuery only
  for (const script of DEFER_SCRIPTS) {
    const regex = new RegExp(`<script([^>]*src="[^"]*${script}"[^>]*)>`, 'gi');
    const newHtml = html.replace(regex, (match, attrs) => {
      if (!attrs.includes('defer') && !attrs.includes('async')) {
        modified = true;
        return `<script${attrs} defer>`;
      }
      return match;
    });
    html = newHtml;
  }

  // 2. Add loading="lazy" to images that don't have it
  const imgRegex = /<img([^>]*)>/gi;
  html = html.replace(imgRegex, (match, attrs) => {
    if (!attrs.includes('loading=') && !attrs.includes('data-src')) {
      modified = true;
      return `<img${attrs} loading="lazy">`;
    }
    return match;
  });

  // 3. Add decoding="async" to images
  html = html.replace(/<img([^>]*)>/gi, (match, attrs) => {
    if (!attrs.includes('decoding=')) {
      modified = true;
      return `<img${attrs} decoding="async">`;
    }
    return match;
  });

  // 4. Add preload="none" to background videos
  const videoRegex = /<video([^>]*)>/gi;
  html = html.replace(videoRegex, (match, attrs) => {
    if (!attrs.includes('preload=')) {
      modified = true;
      return `<video${attrs} preload="none">`;
    }
    return match;
  });

  // 5. Add preconnect hints if not present
  if (!html.includes('dns-prefetch')) {
    const preconnectHints = `
  <!-- Performance: DNS Prefetch & Preconnect -->
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://code.jquery.com">
  <link rel="dns-prefetch" href="https://static.memberstack.com">
  <link rel="dns-prefetch" href="https://cdn.jetboost.io">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">`;

    const insertPoint = html.indexOf('<meta charset="utf-8">');
    if (insertPoint !== -1) {
      const insertAfter = html.indexOf('>', insertPoint) + 1;
      html = html.slice(0, insertAfter) + preconnectHints + html.slice(insertAfter);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, html, 'utf8');
    return true;
  }

  return false;
}

function main() {
  console.log('Starting HTML optimization...\n');

  const htmlFiles = getAllHtmlFiles(PAGES_DIR);
  let optimizedCount = 0;

  for (const file of htmlFiles) {
    const relativePath = path.relative(PAGES_DIR, file);
    const wasOptimized = optimizeHtml(file);

    if (wasOptimized) {
      console.log(`✓ Optimized: ${relativePath}`);
      optimizedCount++;
    } else {
      console.log(`- Skipped (already optimized): ${relativePath}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Total files: ${htmlFiles.length}`);
  console.log(`Optimized: ${optimizedCount}`);
  console.log(`========================================\n`);
}

main();
