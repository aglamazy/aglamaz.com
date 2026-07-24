/**
 * Parses a WhatsApp "Export chat -> Include media" transcript and correlates
 * media filenames (referenced inline as "IMG-20181207-WA0001.jpg (קובץ מצורף)")
 * back to nearby human-written messages, so a bulk photo import can derive a
 * real event title/caption instead of a bare date.
 */

import * as fs from 'fs';

export interface ChatMessage {
  date: string; // D.M.YYYY as written in the export
  time: string;
  sender: string;
  text: string;
  lineIndex: number;
}

const LINE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4}), (\d{1,2}):(\d{2}) - ([^:]+): (.*)$/;
const ATTACH_RE = /([\w-]+\.(?:jpg|jpeg|png|webp|mp4|opus))\s*\(([^)]*)\)/i;
const SYSTEM_MSG_RE = /<המדיה לא נכללה>|הודעה זו נמחקה|ההודעה הזו נמחקה|מצטרפ.? לקבוצה|יצר.? את הקבוצה|שינה?ה? את נושא הקבוצה/;

export function parseChatFile(path: string): ChatMessage[] {
  const raw = fs.readFileSync(path, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const messages: ChatMessage[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = LINE_RE.exec(line);
    if (m) {
      messages.push({
        date: `${m[1]}.${m[2]}.${m[3]}`,
        time: `${m[4]}:${m[5]}`,
        sender: m[6].trim(),
        text: m[7].trim(),
        lineIndex: messages.length,
      });
    } else if (messages.length > 0 && line.trim()) {
      // Continuation of a multi-line message (no leading "D.M.YYYY, HH:MM - " prefix).
      messages[messages.length - 1].text += '\n' + line.trim();
    }
  }
  return messages;
}

/** filename (as it appears in WhatsApp's own naming, e.g. "IMG-20181207-WA0001.jpg") -> index into messages[] */
export function buildFilenameIndex(messages: ChatMessage[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const msg of messages) {
    const am = ATTACH_RE.exec(msg.text);
    if (am) index.set(am[1], msg.lineIndex);
  }
  return index;
}

// Hebrew holiday/occasion keywords -> canonical display title. Wrapped with
// Hebrew-letter-aware "word boundaries" (plain \b doesn't work on Hebrew) so
// e.g. "פורים" (Purim) doesn't false-positive-match inside "סיפורים" (stories).
const HEB = '\\u05D0-\\u05EA';
function wb(pattern: string): RegExp {
  return new RegExp(`(?<![${HEB}])(?:${pattern})(?![${HEB}])`);
}
const OCCASION_KEYWORDS: Array<[RegExp, string]> = [
  [wb('בר\\s?מצו?ו?ה'), 'בר מצווה'],
  [wb('בת\\s?מצו?ו?ה'), 'בת מצווה'],
  [wb('חתונה|חופה וקידושין|אירוסין'), 'חתונה'],
  [wb('ברית מילה|ברית ל'), 'ברית'],
  [wb('יום ?הולדת'), 'יום הולדת'],
  [wb('חנוכה'), 'חנוכה'],
  [wb('פורים'), 'פורים'],
  [wb('פסח'), 'פסח'],
  [wb('ראש ?השנה'), 'ראש השנה'],
  [wb('יום ?כיפור'), 'יום כיפור'],
  [wb('סוכות'), 'סוכות'],
  [wb('שבועות'), 'שבועות'],
  [wb('ל"ג בעומר|לג בעומר'), "ל\"ג בעומר"],
  [wb('ט"ו בשבט|טו בשבט'), "ט\"ו בשבט"],
  [wb('יום ?העצמאות'), 'יום העצמאות'],
  [wb('יום ?הזיכרון'), 'יום הזיכרון'],
  [wb('גיוס|מתגייס|מתגייסת'), 'גיוס'],
];

function isSubstantiveText(text: string): boolean {
  const t = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}‍❤️]/gu, '').trim();
  if (t.length < 3) return false;
  if (ATTACH_RE.test(text)) return false;
  if (SYSTEM_MSG_RE.test(text)) return false;
  return true;
}

export interface TitleGuess {
  title: string;
  source: 'keyword' | 'caption';
  evidence: string; // the chat line the guess came from, for a human sanity-check
}

/**
 * Given the chat-message indices attached on a given day (from buildFilenameIndex),
 * scan a window around them for an occasion keyword first, else fall back to the
 * first substantive nearby human caption.
 */
export function guessEventTitle(
  messages: ChatMessage[],
  attachedIndices: number[],
  windowSize = 8
): TitleGuess | null {
  if (attachedIndices.length === 0) return null;
  const center = Math.round((Math.min(...attachedIndices) + Math.max(...attachedIndices)) / 2);
  const lo = Math.max(0, Math.min(...attachedIndices) - windowSize);
  const hi = Math.min(messages.length - 1, Math.max(...attachedIndices) + windowSize);

  // Closest-to-the-photos-first, not lexical scan order, so a keyword right
  // next to this burst wins over one that only happens to fall in-window
  // near a neighboring day's conversation.
  const order = [];
  for (let i = lo; i <= hi; i++) order.push(i);
  order.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));

  for (const i of order) {
    const msg = messages[i];
    for (const [re, title] of OCCASION_KEYWORDS) {
      if (re.test(msg.text)) {
        return { title, source: 'keyword', evidence: `${msg.sender}: ${msg.text}` };
      }
    }
  }

  // No keyword hit — fall back to the nearest substantive caption (prefer
  // messages sent AFTER the last photo in the burst, e.g. a wrap-up caption,
  // then messages before the first photo).
  const attachedSet = new Set(attachedIndices);
  const after = [];
  for (let i = Math.max(...attachedIndices) + 1; i <= hi; i++) {
    if (!attachedSet.has(i) && isSubstantiveText(messages[i].text)) after.push(messages[i]);
  }
  if (after.length > 0) {
    return { title: after[0].text.split('\n')[0].slice(0, 60), source: 'caption', evidence: `${after[0].sender}: ${after[0].text}` };
  }
  const before = [];
  for (let i = lo; i < Math.min(...attachedIndices); i++) {
    if (!attachedSet.has(i) && isSubstantiveText(messages[i].text)) before.push(messages[i]);
  }
  if (before.length > 0) {
    const last = before[before.length - 1];
    return { title: last.text.split('\n')[0].slice(0, 60), source: 'caption', evidence: `${last.sender}: ${last.text}` };
  }

  return null;
}
