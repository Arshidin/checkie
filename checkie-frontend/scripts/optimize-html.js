#!/usr/bin/env node
/**
 * HTML Optimization Script for Checkie Frontend
 *
 * This script optimizes HTML files exported from Webflow:
 * 1. Adds loading="lazy" to non-critical images
 * 2. Adds preload="none" to videos
 * 3. Adds preconnect hints for external resources
 *
 * IMPORTANT:
 * - Does NOT modify ANY scripts
 * - Does NOT add decoding="async" (can break Webflow sliders)
 * - Skips images that already have loading attribute
 *
 * Run: node scripts/optimize-html.js
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

function optimizeHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Add loading="lazy" ONLY to images that don't have loading attribute
  // This preserves loading="eager" for critical images
  const imgRegex = /<img([^>]*)>/gi;
  html = html.replace(imgRegex, (match, attrs) => {
    if (!attrs.includes('loading=') && !attrs.includes('data-src')) {
      modified = true;
      return `<img${attrs} loading="lazy">`;
    }
    return match;
  });

  // 2. Add preload="none" to background videos
  const videoRegex = /<video([^>]*)>/gi;
  html = html.replace(videoRegex, (match, attrs) => {
    if (!attrs.includes('preload=')) {
      modified = true;
      return `<video${attrs} preload="none">`;
    }
    return match;
  });

  // 3. Add preconnect hints if not present
  if (!html.includes('dns-prefetch')) {
    const preconnectHints = `
  <!-- Performance: DNS Prefetch & Preconnect -->
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://code.jquery.com">
  <link rel="dns-prefetch" href="https://cdn.jetboost.io">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
  <link rel="dns-prefetch" href="https://checkie-production.up.railway.app">`;

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
  console.log('Starting HTML optimization (images lazy load, videos, DNS prefetch)...\n');

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
