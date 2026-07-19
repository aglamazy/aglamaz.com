#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

const now = new Date();
const year = String(now.getFullYear()).slice(-2);
const month = now.getMonth() + 1;

const versionParts = packageJson.version.split('.').map(Number);

if (versionParts.length !== 3 || versionParts.some(Number.isNaN)) {
  throw new Error(`Unsupported version format: ${packageJson.version}`);
}

const [, , patch] = versionParts;
const [currentYear, currentMonth] = versionParts;

const nextPatch = currentYear === Number(year) && currentMonth === month ? patch + 1 : 0;
const newVersion = `${year}.${month}.${nextPatch}`;

packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version incremented: ${currentVersion} → ${newVersion}`);
