import { google } from 'googleapis';

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

  async sendVerificationEmail(to: string, firstName: string, verificationUrl: string): Promise<void> {
    const subject = 'אימות הרשמה למערכת - FamilyCircle';
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>אימות הרשמה</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
          .content { padding: 20px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .text-center { text-align: center; }
          .break-url { word-break: break-all; color: #007bff; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌳 FamilyCircle</h1>
            <p>אימות הרשמה למערכת</p>
          </div>
          
          <div class="content">
            <p>שלום ${firstName},</p>
            
            <p>תודה שנרשמת למערכת FamilyCircle. כדי להשלים את ההרשמה, אנא לחץ על הכפתור למטה:</p>
            
            <div class="text-center">
              <a href="${verificationUrl}" class="button">אמת את האימייל שלך</a>
            </div>
            
            <div class="warning">
              <strong>חשוב:</strong> הקישור תקף ל-24 שעות בלבד. אם לא תאמת את האימייל בזמן, תצטרך להירשם מחדש.
            </div>
            
            <p>אם הכפתור לא עובד, העתק והדבק את הקישור הבא בדפדפן:</p>
            <p class="break-url">${verificationUrl}</p>
            
            <p>אם לא ביקשת להירשם למערכת זו, אנא התעלם מהודעה זו.</p>
          </div>
          
          <div class="footer">
            <p>זהו אימייל אוטומטי, אנא אל תשיב לו</p>
            <p>© 2024 FamilyCircle. כל הזכויות שמורות.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      שלום ${firstName},

      תודה שנרשמת למערכת FamilyCircle. כדי להשלים את ההרשמה, אנא לחץ על הקישור הבא:

      ${verificationUrl}

      הקישור תקף ל-24 שעות בלבד.

      אם לא ביקשת להירשם למערכת זו, אנא התעלם מהודעה זו.

      © 2024 FamilyCircle
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }

  async sendInviteVerificationEmail(to: string, firstName: string, verificationUrl: string): Promise<void> {
    const subject = 'הצטרפות לקהילה - FamilyCircle';

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>אישור הצטרפות</title>
        <style>
          body { font-family: 'Assistant', Arial, sans-serif; line-height: 1.7; color: #1f2d21; background: #f4f7f2; margin: 0; }
          .container { max-width: 640px; margin: 0 auto; padding: 36px 20px 48px; }
          .card { background: #ffffff; border-radius: 18px; border: 1px solid #e5efe7; box-shadow: 0 14px 28px rgba(31, 63, 45, 0.12); overflow: hidden; }
          .header { background: linear-gradient(135deg, #edf4ef 0%, #f7faf6 100%); padding: 40px 32px; text-align: center; }
          .header h1 { margin: 0 0 8px; font-size: 28px; color: #203426; }
          .header p { margin: 0; font-size: 15px; color: #486352; }
          .content { padding: 32px 36px; text-align: right; background: #ffffff; }
          .content p { margin: 0 0 18px; }
          .button-wrap { text-align: center; margin: 32px 0; }
          .button { display: inline-block; background: #3f6f55; color: #ffffff !important; padding: 14px 38px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 12px 20px rgba(63, 111, 85, 0.25); }
          .button:hover { background: #365f49; }
          .warning { background: #fff6e3; border: 1px solid #f1deba; padding: 16px 20px; border-radius: 12px; margin: 28px 0; color: #6a541f; font-size: 14px; }
          .break-url { direction: ltr; display: block; margin-top: 12px; color: #3f6f55; word-break: break-all; }
          .footer { text-align: center; color: #6a8575; font-size: 14px; padding: 26px 0 0; }
          @media (max-width: 600px) { .content { padding: 24px; } .button { width: 100%; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1>🌳 FamilyCircle</h1>
              <p>הזמנה להצטרפות למשפחה שלנו</p>
            </div>
            <div class="content">
              <p>שלום ${firstName},</p>
              <p>קיבלת הזמנה להצטרף לקהילה המשפחתית שלנו ב-FamilyCircle. כדי להשלים את ההצטרפות, אנא אשר/י את כתובת המייל שלך:</p>
              <div class="button-wrap">
                <a href="${verificationUrl}" class="button">אישור הצטרפות</a>
              </div>
              <div class="warning">
                <strong>שימו לב:</strong> הקישור תקף ל-24 שעות. אם לא תאשרו בזמן, ניתן לבקש הזמנה חדשה מהמזמין/ה.
              </div>
              <p>אם הכפתור אינו עובד, ניתן להעתיק את הקישור הבא ולהדביק בדפדפן:</p>
              <span class="break-url">${verificationUrl}</span>
              <p>אם לא ציפיתם להזמנה זו, אפשר להתעלם מההודעה.</p>
            </div>
          </div>
          <div class="footer">
            <p>זהו אימייל אוטומטי, אנא אל תשיבו לו.</p>
            <p>© ${new Date().getFullYear()} FamilyCircle. כל הזכויות שמורות.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      שלום ${firstName},

      קיבלת הזמנה להצטרף לקהילה המשפחתית שלנו ב-FamilyCircle. כדי להשלים את ההצטרפות, אנא אשר את כתובת המייל שלך באמצעות הקישור הבא:

      ${verificationUrl}

      הקישור תקף ל-24 שעות. אם לא ציפית להזמנה זו, ניתן להתעלם מהודעה זו.

      © ${new Date().getFullYear()} FamilyCircle
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  // Method to simulate email failure for testing
  async sendVerificationEmailWithFailure(to: string, firstName: string, verificationUrl: string): Promise<void> {
    // Simulate email failure by throwing an error
    throw new Error('Gmail service not configured - simulating email failure');
  }
} 
