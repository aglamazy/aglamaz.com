import { GmailService } from './GmailService';
import path from 'path';
import pug from 'pug';
import type { IMember } from '@/entities/Member';
import type { ISite } from '@/entities/Site';
import { fetchSiteInfo } from '@/firebase/admin';
import { getPlatformName } from '@/utils/platformName';
import { getUrl, AppRoute } from '@/utils/urls';

export class UserNotificationService {
  private async renderTemplate(template: string, data: any, siteId: string) {
    const templateDir = path.join(process.cwd(), 'src', 'templates', 'user-notification');
    const file = path.join(templateDir, `${template}.pug`);
    const appUrl = await getUrl(AppRoute.APP_DASHBOARD, siteId);
    return pug.renderFile(file, { ...data, appUrl });
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

    const html = await this.renderTemplate('welcome', {
      firstName: member.firstName,
      siteName,
    }, member.siteId);
    const gmail = await GmailService.init();
    await gmail.sendEmail({
      to: member.email,
      subject: `Welcome to ${siteName}`,
      html,
    });
  }
}

export const userNotificationService = new UserNotificationService();
