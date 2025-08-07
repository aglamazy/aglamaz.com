import { GmailService } from './GmailService';
import { notificationRepository, AdminNotification } from '../repositories/NotificationRepository';

export type NotificationEventType = 'contact_form' | 'pending_member';

export class AdminNotificationService {
  private gmail = new GmailService();

  private async queueNotification(eventType: NotificationEventType, payload: any) {
    return notificationRepository.addNotification({ eventType, payload });
  }

  private async sendImmediate(notification: AdminNotification) {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('ADMIN_EMAIL not configured, skipping email');
      return;
    }

    const subject = `New ${notification.eventType.replace('_', ' ')}`;
    const html = `<p>A new ${notification.eventType.replace('_', ' ')} event occurred.</p><pre>${JSON.stringify(notification.payload, null, 2)}</pre>`;
    await this.gmail.sendEmail({ to: adminEmail, subject, html });
  }

  async notify(eventType: NotificationEventType, payload: any) {
    const notification = await this.queueNotification(eventType, payload);
    await this.sendImmediate(notification);
    return notification;
  }
}

export const adminNotificationService = new AdminNotificationService();
