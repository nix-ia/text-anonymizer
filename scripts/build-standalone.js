#!/usr/bin/env node
'use strict';

/*
 * Builds standalone/anonymiseur.html: one self-contained file (HTML + CSS + JS)
 * that runs by simply opening it in a browser, with no server.
 *
 * Opened from disk, the page gets no CSP header, so the policy is embedded as
 * a <meta> tag. Inline code is allowed by its SHA-256 hash only: any script or
 * style not produced by this build is refused, and connect-src 'none' still
 * blocks every network request.
 *
 * Usage: node scripts/build-standalone.js
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'standalone');
const OUT_FILE = path.join(OUT_DIR, 'anonymiseur.html');

function read(name) {
  return fs.readFileSync(path.join(SRC, name), 'utf8');
}

function sha256(text) {
  return "'sha256-" + crypto.createHash('sha256').update(text, 'utf8').digest('base64') + "'";
}

// Inline code must not close its own element early.
function assertInlineSafe(code, tag, name) {
  if (new RegExp('</' + tag, 'i').test(code)) {
    throw new Error(name + ' contient « </' + tag + ' » : fusion impossible sans risque.');
  }
}

// Replaces exactly one occurrence, so a changed index.html fails loudly.
function replaceOnce(html, search, replacement) {
  const parts = html.split(search);
  if (parts.length !== 2) throw new Error('Motif introuvable ou multiple dans index.html : ' + search);
  return parts[0] + replacement + parts[1];
}

function build() {
  const css = read('style.css');
  const js = '\n' + read('engine.js') + '\n' + read('app.js') + '\n';
  assertInlineSafe(css, 'style', 'style.css');
  assertInlineSafe(js, 'script', 'engine.js / app.js');

  const csp = [
    "default-src 'none'",
    'script-src ' + sha256(js),
    'style-src ' + sha256(css),
    'img-src data:',
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; ');

  let html = read('index.html');
  html = replaceOnce(html, '<meta charset="utf-8">',
    '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">');
  html = replaceOnce(html, '<link rel="stylesheet" href="style.css">', '<style>' + css + '</style>');
  html = replaceOnce(html, '<script src="engine.js"></script>\n<script src="app.js"></script>', '<script>' + js + '</script>');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html, { mode: 0o644 });
  return OUT_FILE;
}

const out = build();
console.log('OK : ' + path.relative(ROOT, out) + ' (' + Math.round(fs.statSync(out).size / 1024) + ' Ko)');
