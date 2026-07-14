export interface SendTransactionalEmailParams {
  to: string;
  subject: string;
  html: string;
  lang?: string;
}

/**
 * TODO(famcircle#9): replace this stub with the real Resend-backed send (mail.famcircle.org
 * domain, API key from secrets/resend.env, per docs/notifications-reminders-spec.md). Until #9
 * lands, this only logs what would be sent so callers (famcircle#10's reminders cron) aren't
 * blocked on it.
 */
export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<void> {
  console.log('[ResendService STUB] would send email', {
    to: params.to,
    subject: params.subject,
    lang: params.lang,
  });
}
