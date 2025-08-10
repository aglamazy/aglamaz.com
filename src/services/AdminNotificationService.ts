import { GmailService } from './GmailService';
import { notificationRepository, AdminNotification } from '../repositories/NotificationRepository';
import { fetchSiteInfo, adminAuth } from '../firebase/admin';

export type NotificationEventType = 'contact_form' | 'pending_member';

export class AdminNotificationService {
  private async queueNotification(eventType: NotificationEventType, payload: any) {
    return notificationRepository.addNotification({ eventType, payload });
  }

  private async getAdminEmail(): Promise<string | null> {
    const siteInfo = await fetchSiteInfo();
    const ownerUid = (siteInfo as any)?.ownerUid;
    if (!ownerUid) {
      console.warn('Site owner UID not found, skipping email');
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

    const subject = `New ${notification.eventType.replace('_', ' ')}`;
    const html = `<p>A new ${notification.eventType.replace('_', ' ')} event occurred.</p><pre>${JSON.stringify(notification.payload, null, 2)}</pre>`;
    const gmail = await GmailService.init();
    await gmail.sendEmail({ to: adminEmail, subject, html });
  }

  async notify(eventType: NotificationEventType, payload: any) {
    const notification = await this.queueNotification(eventType, payload);
    await this.sendImmediate(notification);
    return notification;
  }
}

export const adminNotificationService = new AdminNotificationService();
