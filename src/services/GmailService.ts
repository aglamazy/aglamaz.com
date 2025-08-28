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

  // Method to simulate email failure for testing
  async sendVerificationEmailWithFailure(to: string, firstName: string, verificationUrl: string): Promise<void> {
    // Simulate email failure by throwing an error
    throw new Error('Gmail service not configured - simulating email failure');
  }
} 
