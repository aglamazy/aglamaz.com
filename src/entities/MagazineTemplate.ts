/**
 * A platform-editor-authored HTML template used to render a site's monthly
 * magazine digest. Stored per site, one document per siteId.
 */
export interface IMagazineTemplate {
  siteId: string;
  html: string;
  updatedAt: any;
  source: 'manual' | 'ai-suggested';
}
