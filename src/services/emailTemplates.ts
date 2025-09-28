export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailNote {
  title?: string;
  lines: string[];
}

export interface EmailTemplateOptions {
  subject: string;
  lang?: string;
  dir?: 'ltr' | 'rtl';
  heading?: string;
  preheader?: string;
  greeting?: string;
  paragraphs?: string[];
  button?: EmailButton;
  note?: EmailNote;
  secondary?: string[];
  linkList?: string[];
  footerLines?: string[];
}

const DEFAULT_HEADING = '🌳 FamilyCircle';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/\s+$/g, '');
}

export function renderEmailHtml(options: EmailTemplateOptions): string {
  const {
    subject,
    lang = 'en',
    dir = 'ltr',
    heading = DEFAULT_HEADING,
    preheader,
    greeting,
    paragraphs = [],
    button,
    note,
    secondary = [],
    linkList = [],
    footerLines = [],
  } = options;

  const paragraphsHtml = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('\n');
  const secondaryHtml = secondary.map((paragraph) => `<p>${paragraph}</p>`).join('\n');
  const linkHtml = linkList
    .map((link) => `<p class="inline-link">${escapeHtml(link)}</p>`)
    .join('\n');
  const noteHtml = note
    ? `\n        <div class="note">\n          ${note.title ? `<p class="note-title"><strong>${note.title}</strong></p>` : ''}\n          ${note.lines.map((line) => `<p>${line}</p>`).join('\n')}\n        </div>`
    : '';
  const buttonHtml = button
    ? `<div class="button-row"><a href="${escapeHtml(button.url)}" class="button">${button.label}</a></div>`
    : '';
  const footerHtml = footerLines.map((line) => `<p>${line}</p>`).join('\n');
  const contentStyle = dir === 'rtl'
    ? 'direction: rtl; text-align: right;'
    : 'direction: ltr; text-align: left;';
  const footerStyle = dir === 'rtl'
    ? 'direction: rtl; text-align: right;'
    : 'direction: ltr; text-align: center;';

  const hiddenPreheader = preheader ? `
    <span class="preheader" style="display:none;visibility:hidden;mso-hide:all;font-size:1px;color:#f5f7f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>` : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
    <style>
      body { margin: 0; padding: 0; background: #f5f7f4; color: #1f2d21; font-family: 'Helvetica Neue', Arial, sans-serif; }
      a { color: inherit; }
      .wrapper { padding: 32px 12px; }
      .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e3ede6; box-shadow: 0 16px 40px rgba(20, 45, 29, 0.08); overflow: hidden; }
      .header { padding: 28px 32px; background: linear-gradient(135deg, #eef5f0 0%, #f9fbf8 100%); text-align: center; font-weight: 600; font-size: 20px; color: #295640; }
      .content { padding: 32px; font-size: 16px; line-height: 1.7; }
      .content p { margin: 0 0 18px; }
      .button-row { text-align: center; margin: 28px 0 32px; }
      .button { display: inline-block; padding: 14px 32px; background: #2f6f4d; color: #ffffff !important; text-decoration: none; font-weight: 600; border-radius: 999px; box-shadow: 0 12px 24px rgba(47, 111, 77, 0.25); }
      .button:hover { background: #275d41; }
      .note { background: #fff7e6; border: 1px solid #ffe1a8; padding: 18px 20px; border-radius: 14px; margin: 24px 0; font-size: 15px; color: #624b1f; }
      .note-title { margin: 0 0 8px; }
      .inline-link { word-break: break-word; color: #2f6f4d; font-family: 'Courier New', Courier, monospace; font-size: 15px; margin: 6px 0 0; }
      .footer { padding: 24px 32px 28px; background: #f8faf8; text-align: center; font-size: 13px; color: #6d7f74; line-height: 1.6; }
      @media (max-width: 600px) {
        .content { padding: 24px; font-size: 15px; }
        .button { width: 100%; }
        .footer { padding: 20px 24px; }
      }
    </style>
  </head>
  <body>
    ${hiddenPreheader}
    <div class="wrapper">
      <div class="card">
        <div class="header">${heading}</div>
        <div class="content" style="${contentStyle}">
          ${greeting ? `<p>${greeting}</p>` : ''}
          ${paragraphsHtml}
          ${buttonHtml}
          ${noteHtml}
          ${secondaryHtml}
          ${linkHtml}
        </div>
        <div class="footer" style="${footerStyle}">
          ${footerHtml}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function renderPlainTextEmail(options: EmailTemplateOptions): string {
  const {
    greeting,
    paragraphs = [],
    button,
    note,
    secondary = [],
    linkList = [],
    footerLines = [],
  } = options;

  const sections: string[] = [];
  if (greeting) sections.push(stripHtml(greeting));
  paragraphs.forEach((paragraph) => sections.push(stripHtml(paragraph)));
  if (button) {
    sections.push(`${stripHtml(button.label)}: ${button.url}`);
  }
  if (note) {
    if (note.title) sections.push(stripHtml(note.title));
    note.lines.forEach((line) => sections.push(stripHtml(line)));
  }
  secondary.forEach((paragraph) => sections.push(stripHtml(paragraph)));
  linkList.forEach((link) => sections.push(link));
  footerLines.forEach((line) => sections.push(stripHtml(line)));

  return sections.filter(Boolean).join('\n\n');
}
