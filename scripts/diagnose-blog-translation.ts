#!/usr/bin/env tsx
/**
 * Diagnoses famcircle#105 (Hebrew lazy-translate never fires for some posts).
 *
 * Checks the two things that could each independently explain "translationMeta
 * was never written": (a) hasLocaleContent() already sees a 'he' entry with
 * non-empty title+content (so shouldRequestBlogTranslation short-circuits to
 * false before markTranslationRequested ever runs), or (b) something else.
 *
 * Usage: npx tsx scripts/diagnose-blog-translation.ts [siteId]
 *        npx tsx scripts/diagnose-blog-translation.ts --detail <postId>
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { initAdmin } from '../src/firebase/admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { IBlogPost } from '../src/entities/BlogPost';

async function main() {
  initAdmin();
  const db = getFirestore();

  if (process.argv[2] === '--detail') {
    const postId = process.argv[3];
    const doc = await db.collection('blogPosts').doc(postId).get();
    console.log(JSON.stringify(doc.data(), null, 2));
    return;
  }

  if (process.argv[2] === '--test-set-merge') {
    // Empirically checks whether ref.set({'a.b': 1}, {merge:true}) with a
    // dotted STRING key nests (Firestore field-path semantics) or writes a
    // literal top-level field named "a.b" (plain-object semantics) - the
    // observed garbage on 0uWUbX12l0YXfodwWnsj matches literal semantics.
    const ref = db.collection('_diagnostic_scratch').doc('set-merge-dotkey-test');
    await ref.set({ 'outer.inner': 'value', updatedAt: Timestamp.now() }, { merge: true });
    const setData = (await ref.get()).data();
    console.log('Result of ref.set({ "outer.inner": "value" }, { merge: true }):');
    console.log(JSON.stringify(setData, null, 2));
    console.log(`Nested (data.outer.inner)    = ${JSON.stringify((setData as any)?.outer?.inner)}`);
    console.log(`Literal (data['outer.inner']) = ${JSON.stringify((setData as any)?.['outer.inner'])}`);
    await ref.delete();

    const ref2 = db.collection('_diagnostic_scratch').doc('update-dotkey-test');
    await ref2.set({ seed: true });
    await ref2.update({ 'outer.inner': 'value2' });
    const updateData = (await ref2.get()).data();
    console.log('\nResult of ref.update({ "outer.inner": "value2" }):');
    console.log(JSON.stringify(updateData, null, 2));
    console.log(`Nested (data.outer.inner)    = ${JSON.stringify((updateData as any)?.outer?.inner)}`);
    console.log(`Literal (data['outer.inner']) = ${JSON.stringify((updateData as any)?.['outer.inner'])}`);
    await ref2.delete();
    return;
  }

  const siteId = process.argv[2];

  let query = db.collection('blogPosts').where('deletedAt', '==', null);
  if (siteId) {
    query = query.where('siteId', '==', siteId) as any;
  }
  const snap = await query.limit(50).get();

  console.log(`Checked ${snap.size} post(s)${siteId ? ` for site ${siteId}` : ''}.\n`);

  for (const doc of snap.docs) {
    const post = { id: doc.id, ...doc.data() } as IBlogPost & { locales?: any; translationMeta?: any };
    const primaryLocale = (post.primaryLocale || 'en').toLowerCase();
    const locales = post.locales || {};
    const heEntry = locales['he'];
    const hasHe = !!(heEntry?.title && heEntry?.content);
    const heMeta = post.translationMeta?.requested?.he;

    if (primaryLocale === 'he') continue; // not a candidate for he-translation

    console.log(`- ${post.id}  primaryLocale=${primaryLocale}  localeKeys=[${Object.keys(locales).join(',')}]  hasHeContent=${hasHe}  translationMeta.requested.he=${JSON.stringify(heMeta) ?? 'unset'}`);
    if (!hasHe && !heMeta) {
      console.log(`    ^ CANDIDATE: no he content, no translation ever requested - should trigger on next he view`);
    }
    if (hasHe) {
      const preview = (heEntry.content || '').replace(/<[^>]+>/g, '').slice(0, 60);
      console.log(`    he content preview: "${preview}..."`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
