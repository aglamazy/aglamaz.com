import assert from 'node:assert/strict';
import { shouldAutoApprove } from '../src/services/SignupPolicyService';

function testDemoSiteAutoApproves() {
  assert.equal(shouldAutoApprove({ isDemo: true }), true);
  console.log('demo site auto-approves passed');
}

function testNonDemoSiteDoesNotAutoApprove() {
  assert.equal(shouldAutoApprove({ isDemo: false }), false);
  assert.equal(shouldAutoApprove({}), false);
  console.log('non-demo site does not auto-approve passed');
}

function testMissingSiteDoesNotAutoApprove() {
  assert.equal(shouldAutoApprove(null), false);
  assert.equal(shouldAutoApprove(undefined), false);
  console.log('missing site does not auto-approve passed');
}

testDemoSiteAutoApproves();
testNonDemoSiteDoesNotAutoApprove();
testMissingSiteDoesNotAutoApprove();
