#!/usr/bin/env node
/**
 * Bootstrap script: download npm tarball and install it locally
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const zlib = require('zlib');
const tar = require('tar'); // might not be available

const NPM_VERSION = '10.8.2'; // LTS-friendly version
const INSTALL_DIR = path.join(process.env.HOME, '.local-npm');
const NPM_TARBALL_URL = `https://registry.npmjs.org/npm/-/npm-${NPM_VERSION}.tgz`;

console.log('Downloading npm', NPM_VERSION, '...');

function download(url, dest, cb) {
  const proto = url.startsWith('https') ? https : http;
  const file = fs.createWriteStream(dest);
  proto.get(url, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      file.close();
      fs.unlinkSync(dest);
      return download(res.headers.location, dest, cb);
    }
    res.pipe(file);
    file.on('finish', () => file.close(cb));
  }).on('error', (err) => {
    fs.unlinkSync(dest);
    cb(err);
  });
}

const tarballPath = '/tmp/npm.tgz';
download(NPM_TARBALL_URL, tarballPath, (err) => {
  if (err) {
    console.error('Download failed:', err);
    process.exit(1);
  }
  console.log('Downloaded. Extracting...');
  
  if (!fs.existsSync(INSTALL_DIR)) {
    fs.mkdirSync(INSTALL_DIR, { recursive: true });
  }

  // Extract using system tar
  try {
    execSync(`tar -xzf ${tarballPath} -C ${INSTALL_DIR} --strip-components=1`, { stdio: 'inherit' });
    console.log('Extracted to', INSTALL_DIR);
    console.log('npm installed at:', path.join(INSTALL_DIR, 'bin', 'npm'));
  } catch (e) {
    console.error('Extraction failed:', e.message);
    process.exit(1);
  }
});
