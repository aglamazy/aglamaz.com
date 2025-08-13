import { GmailService } from './GmailService';
import path from 'path';
import pug from 'pug';
import type { IMember } from '@/entities/Member';

export class UserNotificationService {
  private renderTemplate(template: string, data: any) {
    const templateDir = path.join(process.cwd(), 'src', 'templates', 'user-notification');
    const file = path.join(templateDir, `${template}.pug`);
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'http://localhost:3000';
    return pug.renderFile(file, { ...data, siteUrl });
  }

  async sendWelcomeEmail(member: Pick<IMember, 'firstName' | 'email'>) {
    if (!member.email) {
      console.warn('Member email missing, skipping welcome email');
      return;
    }
    const html = this.renderTemplate('welcome', { firstName: member.firstName });
    const gmail = await GmailService.init();
    await gmail.sendEmail({
      to: member.email,
      subject: 'Welcome to FamilyCircle',
      html,
    });
  }
}

export const userNotificationService = new UserNotificationService();
