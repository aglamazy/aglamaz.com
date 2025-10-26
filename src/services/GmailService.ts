import { google } from 'googleapis';
import { EmailTemplateOptions, renderEmailHtml, renderPlainTextEmail } from './emailTemplates';
import { getPlatformName } from '@/utils/platformName';
import type { ISite } from '@/entities/Site';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class GmailService {
  private gmail: any;

  private constructor(gmail: any) {
    this.gmail = gmail;
  }
  static async init(): Promise<GmailService> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });
    oauth2Client.getAccessToken().catch((e) => {
      console.error('Access token probe failed:', e?.response?.data || e);
    });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    return new GmailService(gmail);
  }

  async sendEmail(emailData: EmailData): Promise<void> {
    try {
      const { to, subject, html, text } = emailData;
      const from = process.env.GMAIL_FROM_EMAIL;

      if (!from) {
        throw new Error('GMAIL_FROM_EMAIL not configured');
      }

      // Properly encode non‑ASCII subjects per RFC 2047
      const encodeSubject = (s: string) => `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;

      // Build RFC 5322 message with CRLF line endings
      const headers = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodeSubject(subject)}`,
        'MIME-Version: 1.0',
      ];

      let message: string;
      if (text) {
        // multipart/alternative with text + html for maximum compatibility
        const boundary = `bndry_${Math.random().toString(36).slice(2)}`;
        headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
        message = [
          ...headers,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          text,
          `--${boundary}`,
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          html,
          `--${boundary}--`,
          ''
        ].join('\r\n');
      } else {
        headers.push('Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: 8bit');
        message = [
          ...headers,
          '',
          html
        ].join('\r\n');
      }

      // Encode the message in base64
      const encodedMessage = Buffer.from(message).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send the email
      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log(`Email sent successfully to ${to}`);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendVerificationEmail(to: string, firstName: string, verificationUrl: string, siteInfo?: ISite | Record<string, any> | null): Promise<void> {
    const name = firstName?.trim().split(' ')[0];
    const year = new Date().getFullYear();
    const platformName = getPlatformName(siteInfo);

    const template: EmailTemplateOptions = {
      subject: `אימות הרשמה למערכת - ${platformName}`,
      lang: 'he',
      dir: 'rtl',
      preheader: `אמת את ההרשמה שלך ל-${platformName}`,
      greeting: `שלום${name ? ` ${name}` : ''},`,
      paragraphs: [
        `תודה שנרשמת ל-${platformName}. כדי להשלים את ההרשמה, לחץ על הכפתור למטה.`,
      ],
      button: { label: 'אמת את האימייל שלך', url: verificationUrl },
      note: {
        title: 'הקישור תקף ל-24 שעות בלבד.',
        lines: ['אם לא ביקשת להצטרף, ניתן להתעלם מהודעה זו.'],
      },
      secondary: [
        'אם הכפתור לא עובד, ניתן להעתיק את הקישור הבא ולהדביק בדפדפן:',
      ],
      linkList: [verificationUrl],
      footerLines: [
        'זהו אימייל אוטומטי, אנא אל תשיבו לו.',
        `© ${year} ${platformName}. כל הזכויות שמורות.`,
      ],
    };
    const html = renderEmailHtml(template);
    const text = renderPlainTextEmail(template);
    await this.sendEmail({ to, subject: template.subject, html, text });
  }

  async sendInviteVerificationEmail(to: string, firstName: string, verificationUrl: string, language = 'he', siteInfo?: ISite | Record<string, any> | null): Promise<void> {
    const langKey = (language || '').split('-')[0].toLowerCase();
    const name = (firstName || '').trim();
    const year = new Date().getFullYear();
    const platformName = getPlatformName(siteInfo);

    type InvitePayload = { name: string; url: string };
    const builders: Record<string, (payload: InvitePayload) => EmailTemplateOptions> = {
      he: ({ name, url }) => ({
        subject: `הצטרפות לקהילה - ${platformName}`,
        lang: 'he',
        dir: 'rtl',
        preheader: `אשר את ההזמנה שלך ל-${platformName}`,
        greeting: `שלום${name ? ` ${name}` : ''},`,
        paragraphs: [
          `קיבלת הזמנה להצטרף ל-${platformName}. כדי להשלים את ההצטרפות, לחץ על הכפתור למטה.`,
        ],
        button: { label: 'אישור הצטרפות', url },
        note: {
          title: 'הקישור תקף ל-24 שעות בלבד.',
          lines: ['אם לא ציפית להזמנה זו, ניתן להתעלם מהודעה זו.'],
        },
        secondary: [
          'אם הכפתור לא עובד, ניתן להעתיק את הקישור הבא ולהדביק בדפדפן:',
        ],
        linkList: [url],
        footerLines: [
          'זהו אימייל אוטומטי, אנא אל תשיבו לו.',
          `© ${year} ${platformName}. כל הזכויות שמורות.`,
        ],
      }),
      en: ({ name, url }) => ({
        subject: `Confirm your ${platformName} invitation`,
        lang: 'en',
        dir: 'ltr',
        preheader: `Confirm your invitation to join ${platformName}`,
        greeting: `Hello${name ? ` ${name}` : ''},`,
        paragraphs: [
          `You've been invited to join the ${platformName} space. Click the button below to finish joining.`,
        ],
        button: { label: 'Confirm invitation', url },
        note: {
          title: 'The link expires in 24 hours.',
          lines: ['If you weren\'t expecting this invitation, you can ignore this email.'],
        },
        secondary: [
          'If the button doesn\'t work, copy this link into your browser:',
        ],
        linkList: [url],
        footerLines: [
          'This email was sent automatically — no reply is needed.',
          `© ${year} ${platformName}. All rights reserved.`,
        ],
      }),
      tr: ({ name, url }) => ({
        subject: `${platformName} davetinizi onaylayın`,
        lang: 'tr',
        dir: 'ltr',
        preheader: `${platformName} davetinizi onaylayın`,
        greeting: `Merhaba${name ? ` ${name}` : ''},`,
        paragraphs: [
          `${platformName} aile alanına davet edildiniz. Katılımı tamamlamak için aşağıdaki düğmeye tıklayın.`,
        ],
        button: { label: 'Daveti onayla', url },
        note: {
          title: 'Bağlantı 24 saat boyunca geçerlidir.',
          lines: ['Daveti beklemiyorduysanız bu e-postayı yok sayabilirsiniz.'],
        },
        secondary: [
          'Düğme çalışmıyorsa, bağlantıyı kopyalayıp tarayıcınıza yapıştırın:',
        ],
        linkList: [url],
        footerLines: [
          'Bu e-posta otomatik olarak gönderildi — yanıt vermenize gerek yok.',
          `© ${year} ${platformName}. Tüm hakları saklıdır.`,
        ],
      }),
    };

    const buildTemplate = builders[langKey] ?? builders.en;
    const template = buildTemplate({ name, url: verificationUrl });
    const html = renderEmailHtml(template);
    const text = renderPlainTextEmail(template);
    await this.sendEmail({ to, subject: template.subject, html, text });
  }

  async sendPasswordResetEmail(params: { to: string; resetUrl: string; firstName?: string; language?: string; siteInfo?: ISite | Record<string, any> | null }): Promise<void> {
    const { to, resetUrl, firstName, language, siteInfo } = params;
    const langKey = (language || '').split('-')[0].toLowerCase();
    const name = firstName?.trim().split(' ')[0] || '';
    const year = new Date().getFullYear();
    const platformName = getPlatformName(siteInfo);

    type ResetPayload = { name: string; url: string; platformName: string };
    const builders: Record<string, (payload: ResetPayload) => EmailTemplateOptions> = {
      he: ({ name, url, platformName }) => ({
        subject: `איפוס סיסמה - ${platformName}`,
        lang: 'he',
        dir: 'rtl',
        preheader: `אפס סיסמה לחשבון ${platformName} שלך`,
        greeting: `שלום${name ? ` ${name}` : ''},`,
        paragraphs: [
          'קיבלנו בקשה לאיפוס הסיסמה שלך. אם זו הייתה אתה, לחץ על הכפתור למטה כדי לבחור סיסמה חדשה.',
        ],
        button: { label: 'אפס סיסמה', url },
        note: {
          title: 'הקישור תקף לשעה אחת בלבד.',
          lines: ['אם לא ביקשת לאפס את הסיסמה, ניתן להתעלם מהודעה זו.'],
        },
        secondary: [
          'אם הכפתור לא עובד, ניתן להעתיק את הקישור הבא ולהדביק בדפדפן:',
        ],
        linkList: [url],
        footerLines: [
          'האימייל נשלח אליך אוטומטית - אין צורך להשיב אליו.',
          `© ${year} ${platformName}`,
        ],
      }),
      en: ({ name, url, platformName }) => ({
        subject: `Reset your ${platformName} password`,
        lang: 'en',
        dir: 'ltr',
        preheader: `Choose a new password for your ${platformName} account`,
        greeting: `Hello${name ? ` ${name}` : ''},`,
        paragraphs: [
          'We received a request to reset your password. If this was you, click the button below to pick a new one.',
        ],
        button: { label: 'Reset password', url },
        note: {
          title: 'This link is valid for one hour.',
          lines: ['If you didn\'t request a reset, you can safely ignore this email.'],
        },
        secondary: [
          'If the button doesn\'t work, copy this link into your browser:',
        ],
        linkList: [url],
        footerLines: [
          'This email was sent automatically — no reply is needed.',
          `© ${year} ${platformName}`,
        ],
      }),
      tr: ({ name, url, platformName }) => ({
        subject: `${platformName} şifrenizi sıfırlayın`,
        lang: 'tr',
        dir: 'ltr',
        preheader: `${platformName} şifrenizi sıfırlayın`,
        greeting: `Merhaba${name ? ` ${name}` : ''},`,
        paragraphs: [
          'Şifrenizi sıfırlamak için bir istek aldık. Eğer bu işlem size aitse, yeni bir şifre seçmek için aşağıdaki düğmeye tıklayın.',
        ],
        button: { label: 'Şifreyi sıfırla', url },
        note: {
          title: 'Bağlantı bir saat boyunca geçerlidir.',
          lines: ['Bu isteği siz yapmadıysanız, bu e-postayı yok sayabilirsiniz.'],
        },
        secondary: [
          'Düğme çalışmıyorsa, bağlantıyı kopyalayıp tarayıcınıza yapıştırın:',
        ],
        linkList: [url],
        footerLines: [
          'Bu e-posta otomatik olarak gönderildi — yanıt vermenize gerek yok.',
          `© ${year} ${platformName}`,
        ],
      }),
    };

    const buildTemplate = builders[langKey] ?? builders.he;
    const template = buildTemplate({ name, url: resetUrl, platformName });
    const html = renderEmailHtml(template);
    const text = renderPlainTextEmail(template);
    await this.sendEmail({ to, subject: template.subject, html, text });
  }

  async sendVerificationEmailWithFailure(to: string, firstName: string, verificationUrl: string): Promise<void> {
    // Simulate email failure by throwing an error
    throw new Error('Gmail service not configured - simulating email failure');
  }
} 
