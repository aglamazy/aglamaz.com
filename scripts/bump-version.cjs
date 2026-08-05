#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pkgPath = path.join(root, 'package.json')
const lockPath = path.join(root, 'package-lock.json')

const bumpPatch = version => {
  const parts = version.split('.').map(n => parseInt(n, 10))
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid semver: ${version}`)
  }
  const now = new Date()
  const year = now.getFullYear() % 100 // 2026 -> 26
  const month = now.getMonth() + 1     // 1-12
  // buddy_infra#1018 (2026-08-04): a version at-or-ahead of the current
  // calendar month must just keep incrementing its patch, not reset — the
  // old `!==` check regressed an already-published version (e.g. 26.9.1,
  // bumped ahead by a parallel merge) back down to 26.<thisMonth>.0.
  const isBehindCalendar = parts[0] < year || (parts[0] === year && parts[1] < month)
  if (isBehindCalendar) {
    return `${year}.${month}.0`
  }
  parts[2] += 1
  return parts.join('.')
}

const updateLockVersion = (lock, newVersion) => {
  lock.version = newVersion
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVersion
  }
  return lock
}

const main = () => {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const currentVersion = pkg.version
  const nextVersion = bumpPatch(currentVersion)

  pkg.version = nextVersion
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    const updatedLock = updateLockVersion(lock, nextVersion)
    fs.writeFileSync(lockPath, JSON.stringify(updatedLock, null, 2) + '\n')
  }

  console.log(`Version bumped: ${currentVersion} -> ${nextVersion}`)
}

main()
