#!/usr/bin/env node
/**
 * HTML Optimization Script for Checkie Frontend
 *
 * This script optimizes HTML files exported from Webflow:
 * 1. Adds defer/async to blocking scripts
 * 2. Adds loading="lazy" to images
 * 3. Adds preload="none" to videos
 * 4. Adds preconnect hints for external resources
 *
 * Run: node scripts/optimize-html.js
 */

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'pages');

// Scripts that should be deferred (not block rendering)
const DEFER_SCRIPTS = [
  'jquery-3.6.0.min.js',
  'memberstack.js',
  'owl.carousel.min.js',
  'jquery.counterup',
];

// Scripts that should be async
const ASYNC_SCRIPTS = [
  'webfont.js',
  'jetboost.js',
];

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

  // 1. Add defer to jQuery and other blocking scripts
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

  // 2. Add async to webfont and similar scripts
  for (const script of ASYNC_SCRIPTS) {
    const regex = new RegExp(`<script([^>]*src="[^"]*${script}"[^>]*)>`, 'gi');
    const newHtml = html.replace(regex, (match, attrs) => {
      if (!attrs.includes('defer') && !attrs.includes('async')) {
        modified = true;
        return `<script${attrs} async>`;
      }
      return match;
    });
    html = newHtml;
  }

  // 3. Add loading="lazy" to images that don't have it
  // Skip images with loading="eager" or already lazy
  const imgRegex = /<img([^>]*)>/gi;
  html = html.replace(imgRegex, (match, attrs) => {
    if (!attrs.includes('loading=') && !attrs.includes('data-src')) {
      // Check if this is a critical above-fold image (hero, logo)
      if (attrs.includes('hero') || attrs.includes('logo') || attrs.includes('navbar')) {
        return match; // Keep eager loading for critical images
      }
      modified = true;
      return `<img${attrs} loading="lazy">`;
    }
    return match;
  });

  // 4. Add decoding="async" to images
  html = html.replace(/<img([^>]*)>/gi, (match, attrs) => {
    if (!attrs.includes('decoding=')) {
      modified = true;
      return `<img${attrs} decoding="async">`;
    }
    return match;
  });

  // 5. Add preload="none" to background videos
  const videoRegex = /<video([^>]*)>/gi;
  html = html.replace(videoRegex, (match, attrs) => {
    if (!attrs.includes('preload=')) {
      modified = true;
      return `<video${attrs} preload="none">`;
    }
    return match;
  });

  // 6. Add preconnect hints if not present
  if (!html.includes('dns-prefetch')) {
    const preconnectHints = `
  <!-- Performance: DNS Prefetch & Preconnect -->
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://code.jquery.com">
  <link rel="dns-prefetch" href="https://static.memberstack.com">
  <link rel="dns-prefetch" href="https://cdn.jetboost.io">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">`;

    // Insert after <head> or after charset meta
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
