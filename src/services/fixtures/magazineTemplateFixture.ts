import type { MagazineSuggestInput } from '@/services/MagazineTemplateSuggesterService';

/**
 * v0 fixture standing in for real historical digest content.
 * No real monthly magazine has been sent yet (famcircle#7 covers wiring
 * the suggester to real sent digests) - this lets the suggester mechanism
 * be built and proven end-to-end ahead of that data existing.
 */
export const FIXTURE_MAGAZINE_SUGGEST_INPUT: MagazineSuggestInput = {
  siteName: 'The Cohen Family Circle',
  priorDigestSamples: [
    `<h1>This Month in the Cohen Family</h1>
<p>Three new photos were added to the gallery, and Grandma Miriam's birthday is coming up on the 14th.</p>
<h2>Recent Photos</h2>
<p>[gallery of 3 photos from the Passover gathering]</p>
<h2>Upcoming Anniversaries</h2>
<ul><li>Miriam Cohen's Birthday - April 14</li></ul>
<h2>Latest Blog Post</h2>
<p><strong>"Our Trip to the Old Neighborhood"</strong> by David Cohen</p>`,
    `<h1>Family Circle Monthly Update</h1>
<p>A quiet month, but two blessings were left on Grandpa Avi's memorial page.</p>
<h2>New Blessings</h2>
<p>[2 blessings from Noa and Yossi]</p>
<h2>Reminder</h2>
<p>Family reunion planning starts next month - stay tuned!</p>`,
  ],
};
