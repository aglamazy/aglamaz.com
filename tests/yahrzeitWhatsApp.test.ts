import assert from 'node:assert/strict';
import { YahrzeitWhatsAppService } from '../src/services/YahrzeitWhatsAppService';

function testBuildMessageHebrew() {
  const msg = YahrzeitWhatsAppService.buildMessage({
    eventName: 'סבא אברהם',
    familyName: 'כהן',
    siteUrl: 'https://famcircle.org',
    lang: 'he',
  });
  assert.ok(msg.includes('🕯️'), 'Hebrew message should include candle emoji');
  assert.ok(msg.includes('סבא אברהם'), 'Hebrew message should include event name');
  assert.ok(msg.includes('כהן'), 'Hebrew message should include family name');
  assert.ok(msg.includes('famcircle.org'), 'Hebrew message should include site URL');
  assert.ok(msg.length <= 400, 'Message should stay within WhatsApp limits');
}

function testBuildMessageEnglish() {
  const msg = YahrzeitWhatsAppService.buildMessage({
    eventName: 'Grandpa Avi',
    familyName: 'Cohen',
    siteUrl: 'https://famcircle.org',
    lang: 'en',
  });
  assert.ok(msg.includes('🕯️'), 'English message should include candle emoji');
  assert.ok(msg.includes("Grandpa Avi's yahrzeit"), 'English message should include yahrzeit phrase');
  assert.ok(msg.includes('together today'), 'English message should emphasize togetherness');
  assert.ok(msg.includes('Cohen'), 'English message should include family name');
}

function testBuildMessageTurkish() {
  const msg = YahrzeitWhatsAppService.buildMessage({
    eventName: 'Büyükbaba Avi',
    familyName: 'Cohen',
    siteUrl: 'https://famcircle.org',
    lang: 'tr',
  });
  assert.ok(msg.includes('🕯️'), 'Turkish message should include candle emoji');
  assert.ok(msg.includes('yahrzeiti'), 'Turkish message should include yahrzeit term');
  assert.ok(msg.includes('birlikte'), 'Turkish message should include together phrase');
}

function testBuildMessageDefaultsToHebrew() {
  const msgDefault = YahrzeitWhatsAppService.buildMessage({
    eventName: 'סבא',
    familyName: 'לוי',
    siteUrl: 'https://famcircle.org',
  });
  const msgHe = YahrzeitWhatsAppService.buildMessage({
    eventName: 'סבא',
    familyName: 'לוי',
    siteUrl: 'https://famcircle.org',
    lang: 'he',
  });
  assert.equal(msgDefault, msgHe, 'Default locale should produce Hebrew message');
}

testBuildMessageHebrew();
testBuildMessageEnglish();
testBuildMessageTurkish();
testBuildMessageDefaultsToHebrew();

console.log('yahrzeitWhatsApp: all tests passed');
