import assert from 'node:assert/strict';
import { checkReferencedScriptsExist } from '../scripts/lib/referencedScriptsCheck';

async function testHealthyWhenEveryReferencedScriptExists() {
  const result = await checkReferencedScriptsExist({
    findReferencedScriptPaths: async () => [
      { scriptPath: 'scripts/uptime-check.ts', referencedIn: 'docs/monitoring-runbook.md' },
    ],
    fileExists: () => true,
  });
  assert.equal(result.healthy, true);
  assert.deepEqual(result.missing, []);
  console.log('referenced-scripts healthy when everything exists test passed');
}

// The exact famcircle#144/#159/#161 shape: a script real docs point at that simply
// isn't in this checkout - not a wrong path, the file genuinely never shipped here.
async function testDetectsAReferencedButAbsentScript() {
  const result = await checkReferencedScriptsExist({
    findReferencedScriptPaths: async () => [
      { scriptPath: 'scripts/uptime-check.ts', referencedIn: 'docs/monitoring-runbook.md' },
      { scriptPath: 'scripts/check-email-volume.ts', referencedIn: 'docs/monitoring-runbook.md' },
    ],
    fileExists: (p) => p !== 'scripts/check-email-volume.ts',
  });
  assert.equal(result.healthy, false);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].scriptPath, 'scripts/check-email-volume.ts');
  console.log('referenced-scripts detects a doc-referenced-but-absent script test passed');
}

async function run() {
  await testHealthyWhenEveryReferencedScriptExists();
  await testDetectsAReferencedButAbsentScript();
}

run();
