import { GmailService } from './GmailService';
import { notificationRepository, AdminNotification } from '../repositories/NotificationRepository';
import { fetchSiteInfo, adminAuth } from '../firebase/admin';
import { DEFAULT_LOCALE } from '@/i18n';
import { getUrl, AppRoute } from '@/utils/serverUrls';
import path from 'path';
import pug from 'pug';

export type NotificationEventType = 'contact_form' | 'pending_member' | 'new_member';

const subjectByType: Record<NotificationEventType, string> = {
  contact_form: 'New contact form submission',
  pending_member: 'Pending member awaiting approval',
  new_member: 'New member joined!',
};

export class AdminNotificationService {
  private async queueNotification(eventType: NotificationEventType, payload: any, siteUrl?: string) {
    const payloadWithUrl = siteUrl ? { ...payload, siteUrl } : payload;
    return notificationRepository.addNotification({ eventType, payload: payloadWithUrl });
  }

  private async getAdminEmail(siteId?: string): Promise<string | null> {
    // Use provided siteId or fall back to env variable
    const siteInfo = await fetchSiteInfo(siteId, DEFAULT_LOCALE);
    const ownerUid = (siteInfo as any)?.ownerUid;
    if (!ownerUid) {
      console.warn('[AdminNotificationService] Site owner UID not found, skipping email');
      return null;
    }
    try {
      const userRecord = await adminAuth().getUser(ownerUid);
      return userRecord.email || null;
    } catch (error) {
      console.error('Failed to fetch admin user:', error);
      return null;
    }
  }

  private async sendImmediate(notification: AdminNotification) {
    const adminEmail = await this.getAdminEmail();
    if (!adminEmail) {
      console.warn('Admin email not found, skipping email');
      return;
    }

    const subject = subjectByType[notification.eventType] ?? 'New notification';
    let html: string;
    try {
      html = await this.renderTemplate(notification);
    } catch (error) {
      console.error('Failed to render template:', error);
      html = `<p>A new ${notification.eventType.replace('_', ' ')} event occurred.</p><pre>${JSON.stringify(notification.payload, null, 2)}</pre>`;
    }
    const gmail = await GmailService.init();
    await gmail.sendEmail({ to: adminEmail, subject, html });
  }

  private async renderTemplate(notification: AdminNotification) {
    const templateDir = path.join(process.cwd(), 'src', 'templates', 'admin-notifications');
    const file = path.join(templateDir, `${notification.eventType}.pug`);

    const siteId = (notification.payload as any)?.siteId;
    if (!siteId) {
      throw new Error('siteId is required in notification payload for URL generation');
    }

    // Generate URLs using the centralized utility
    const urls = {
      adminSiteMembers: await getUrl(AppRoute.ADMIN_SITE_MEMBERS, siteId),
      adminPendingMembers: await getUrl(AppRoute.ADMIN_PENDING_MEMBERS, siteId),
      adminDashboard: await getUrl(AppRoute.ADMIN_DASHBOARD, siteId),
    };

    const data = { ...notification.payload, ...urls } as any;
    delete data.siteId;
    delete data.userId;
    delete data.siteUrl; // Remove old siteUrl

    return pug.renderFile(file, data);
  }

  async notify(eventType: NotificationEventType, payload: any, siteUrl?: string) {
    const notification = await this.queueNotification(eventType, payload, siteUrl);
    await this.sendImmediate(notification);
    return notification;
  }
}
export const adminNotificationService = new AdminNotificationService();
