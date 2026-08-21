import assert from 'node:assert/strict';
import { formatCalVer } from '../scripts/stamp-version';

async function testRendersUnpaddedMonthZeroPaddedRest() {
  assert.equal(formatCalVer(new Date(2026, 7, 19, 15, 52)), '26.8.19-1552');
  console.log('formatCalVer renders YY.M.DD-HHmm, unpadded month, zero-padded day/hour/minute passed');
}

async function testZeroPadsSingleDigitHourAndMinute() {
  assert.equal(formatCalVer(new Date(2026, 0, 5, 3, 7)), '26.1.05-0307');
  console.log('formatCalVer zero-pads a single-digit hour and minute passed');
}

async function testDoesNotZeroPadMonth() {
  assert.equal(formatCalVer(new Date(2026, 11, 1, 0, 0)), '26.12.01-0000');
  console.log('formatCalVer does not zero-pad the month passed');
}

async function run() {
  await testRendersUnpaddedMonthZeroPaddedRest();
  await testZeroPadsSingleDigitHourAndMinute();
  await testDoesNotZeroPadMonth();
}

run();
