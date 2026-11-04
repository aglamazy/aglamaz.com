// famcircle#201: EmailService.send is the ONLY path to an email send, so its record is the
// whole truth. A list of call sites plus discipline goes wrong quietly; this scan fails loudly
// the moment a carrier is reached from anywhere but EmailService.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['src', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

const EMAIL_SERVICE = 'src/services/EmailService.ts';
const RESEND_CARRIER = 'src/services/ResendService.ts';
const GMAIL_CARRIER = 'src/services/GmailService.ts';

/** pattern -> the only files allowed to contain it */
const RULES: Array<{ what: string; pattern: RegExp; allowedIn: string[] }> = [
  { what: 'Resend HTTP API', pattern: /api\.resend\.com/, allowedIn: [RESEND_CARRIER] },
  { what: 'Resend SDK', pattern: /from ['"]resend['"]|require\(['"]resend['"]\)|new Resend\(/, allowedIn: [] },
  { what: 'Gmail send API', pattern: /users\.messages\.send/, allowedIn: [GMAIL_CARRIER] },
  { what: 'nodemailer', pattern: /nodemailer/, allowedIn: [] },
  { what: 'a carrier deliver() call', pattern: /\.deliver\(/, allowedIn: [EMAIL_SERVICE] },
  { what: 'GmailService.init() (a Gmail client)', pattern: /GmailService\.init\(/, allowedIn: [EMAIL_SERVICE] },
];

function walk(dir: string, out: string[]) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
}

function scan(): string[] {
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  assert.ok(files.length > 50, `scan found only ${files.length} files - the walk is broken, not the code clean`);

  const violations: string[] = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const rule of RULES) {
      if (rule.allowedIn.includes(rel)) continue;
      lines.forEach((line, i) => {
        if (rule.pattern.test(line)) violations.push(`${rel}:${i + 1} reaches ${rule.what} outside EmailService`);
      });
    }
  }
  return violations;
}

function testNoBypass() {
  const violations = scan();
  assert.deepEqual(violations, [], `email sends bypassing EmailService:\n${violations.join('\n')}`);
}

/** The scan must actually catch a bypass - a rule that matches nothing proves nothing. */
function testRulesCatchKnownBypasses() {
  const samples: Record<string, string> = {
    'Resend HTTP API': "await fetch('https://api.resend.com/emails', {})",
    'Resend SDK': "import { Resend } from 'resend';",
    'Gmail send API': 'await gmail.users.messages.send({ userId: "me" })',
    nodemailer: "import nodemailer from 'nodemailer';",
    'a carrier deliver() call': 'await ResendService.deliver({ to, subject, html })',
    'GmailService.init() (a Gmail client)': 'const g = await GmailService.init();',
  };
  for (const rule of RULES) {
    const sample = samples[rule.what];
    assert.ok(sample, `no sample for rule ${rule.what}`);
    assert.ok(rule.pattern.test(sample), `rule "${rule.what}" does not match its own bypass sample`);
  }
}

testRulesCatchKnownBypasses();
testNoBypass();
console.log('emailSinglePath.test: ok');
