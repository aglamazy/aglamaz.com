#!/usr/bin/env tsx
/**
 * Admin-provisioned new-family-site creation (famcircle#97).
 *
 * Policy E decision (Buddy, 2026-08-04): onboarding is admin-provisioned, not self-serve -
 * no acquisition funnel exists yet, self-serve adds abuse/moderation surface on family data,
 * and provisioning is ~10 minutes per site at current volume via this script.
 *
 * What it does, in order (all via existing repositories, not raw Firestore writes, per this
 * repo's Architecture Principle):
 *   1. SiteRepository.create() - the site doc, calendarSystems inferred from --country.
 *   2. SiteRepository.createDomainMapping() - refuses to overwrite an already-taken domain.
 *   3. MemberRepository.create() - the owner as an ADMIN member, pre-created with no uid yet
 *      (uid: '') so the invite-accept flow's existing-member-by-email lookup fills it in when
 *      they actually sign up, without downgrading role (acceptInvite only forces role='member'
 *      when the existing record's role is 'pending' - 'admin' is left alone).
 *   4. FamilyRepository.createInvite() - a real invite token the owner uses to complete
 *      signup, reusing the SAME invite/credential-setup flow every other member goes through.
 *      No new Firebase Auth account-creation code needed.
 *
 * NOT automated (deliberately - this script has no DNS/Vercel credentials, matching
 * docs/FAMILYCORE_SITE_CREATION.md's own scope): the actual DNS record + Vercel domain-alias
 * for --domain must already exist / be added separately, or the invite link 404s until it does.
 *
 * Usage:
 *   npx tsx scripts/create-site.ts \
 *     --family-name "Levi Family" \
 *     --owner-email levi@example.com \
 *     --owner-name "David Levi" \
 *     --domain levi.famcircle.org \
 *     --country IL \
 *     --default-locale he
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { initAdmin } from '../src/firebase/admin';
import { SiteRepository } from '../src/repositories/SiteRepository';
import { MemberRepository } from '../src/repositories/MemberRepository';
import { FamilyRepository } from '../src/repositories/FamilyRepository';
import { SUPPORTED_LOCALES } from '../src/constants/i18n';

function parseArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const flag = `--${name}`;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === flag && i + 1 < argv.length) return argv[i + 1];
    if (argv[i].startsWith(`${flag}=`)) return argv[i].split('=').slice(1).join('=');
  }
  return undefined;
}

function requireArg(name: string): string {
  const value = parseArg(name);
  if (!value || !value.trim()) {
    throw new Error(`Missing required argument: --${name}`);
  }
  return value.trim();
}

async function main() {
  const familyName = requireArg('family-name');
  const ownerEmail = requireArg('owner-email').toLowerCase().trim();
  const ownerName = requireArg('owner-name');
  const domain = requireArg('domain').toLowerCase().trim();
  const country = parseArg('country')?.toUpperCase();
  const defaultLocale = parseArg('default-locale') || 'he';

  if (!SUPPORTED_LOCALES.includes(defaultLocale as any)) {
    throw new Error(`--default-locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`);
  }

  initAdmin();
  const siteRepo = new SiteRepository();
  const memberRepo = new MemberRepository();
  const familyRepo = new FamilyRepository();

  console.log(`[create-site] creating site "${familyName}"...`);
  const site = await siteRepo.create({
    ownerUid: '', // No Firebase Auth account exists yet - filled in when the owner accepts the invite.
    name: familyName,
    locale: defaultLocale,
    country,
  });
  console.log(`[create-site] site created: sites/${site.id}`);

  console.log(`[create-site] mapping domain ${domain} -> ${site.id}...`);
  await siteRepo.createDomainMapping(domain, site.id, { isPrimary: true });
  console.log(`[create-site] domain mapping created`);

  console.log(`[create-site] pre-creating owner as admin member (${ownerEmail})...`);
  const member = await memberRepo.create({
    uid: '',
    siteId: site.id,
    role: 'admin',
    displayName: ownerName,
    firstName: ownerName,
    email: ownerEmail,
    defaultLocale,
  }, { kind: 'agent', id: 'create-site-script' });
  console.log(`[create-site] member created: ${member.id}`);

  console.log(`[create-site] creating invite...`);
  const invite = await familyRepo.createInvite(
    site.id,
    { name: 'FamCircle', email: undefined },
    { invitedEmail: ownerEmail, expiresInMs: 7 * 24 * 60 * 60 * 1000 }, // 7 days - an owner may not act on day 1.
  );

  const inviteUrl = `https://${domain}/auth/invite/${invite.token}`;
  console.log('');
  console.log('[create-site] DONE. Send this link to the owner:');
  console.log(inviteUrl);
  console.log('');
  console.log('[create-site] Reminder: this script did NOT set up DNS or the Vercel domain');
  console.log(`[create-site] alias for ${domain} - the invite link 404s until that exists.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[create-site] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
