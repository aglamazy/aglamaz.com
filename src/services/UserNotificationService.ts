import { GmailService } from './GmailService';
import path from 'path';
import pug from 'pug';
import type { IMember } from '@/entities/Member';
import type { ISite } from '@/entities/Site';
import { fetchSiteInfo } from '@/firebase/admin';
import { getPlatformName } from '@/utils/platformName';

export class UserNotificationService {
  private renderTemplate(template: string, data: any) {
    const templateDir = path.join(process.cwd(), 'src', 'templates', 'user-notification');
    const file = path.join(templateDir, `${template}.pug`);
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'http://localhost:3000';
    const base = siteUrl.replace(/\/+$/, '');
    const appUrl = `${base}/app`;
    return pug.renderFile(file, { ...data, siteUrl, appUrl });
  }

  async sendWelcomeEmail(member: Pick<IMember, 'firstName' | 'email' | 'siteId'> & { locale?: string }) {
    if (!member.email) {
      console.warn('Member email missing, skipping welcome email');
      return;
    }

    let siteInfo: ISite | null = null;
    if (member.siteId) {
      try {
        // Email template is in English, so fetch site info with English locale
        const fetched = await fetchSiteInfo(member.siteId, 'en');
        siteInfo = (fetched as ISite) ?? null;
      } catch (error) {
        console.error('[UserNotificationService] failed to fetch site info for welcome email', error);
      }
    }

    const siteName = siteInfo?.name?.trim();

    const html = this.renderTemplate('welcome', {
      firstName: member.firstName,
      siteName,
    });
    const gmail = await GmailService.init();
    await gmail.sendEmail({
      to: member.email,
      subject: `Welcome to ${siteName}`,
      html,
    });
  }
}

export const userNotificationService = new UserNotificationService();
