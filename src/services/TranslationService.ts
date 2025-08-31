export interface TranslationResult {
  title: string;
  content: string;
}

export class TranslationService {
  static isEnabled() {
    return !!process.env.OPENAI_API_KEY;
  }

  static async translateHtml({
    title,
    content,
    from,
    to,
  }: { title: string; content: string; from?: string; to: string }): Promise<TranslationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const sys = `You are a translation engine. Translate to ${to}.
Preserve HTML/Markdown structure; do not translate URLs, code, or proper names; keep the tone; no extra commentary.
Output format: first line is ONLY the translated title. Then a blank line. Then the translated body. Do not include labels like Title: or Content:.`;
    const user = `Source language: ${from || 'auto'}\nTitle:\n${title}\n\n${content}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const raw: string = (data.choices?.[0]?.message?.content || '').trim();

    // Simple rule: first non-empty line is the title; body is lines 2..end.
    const norm = raw.replace(/\r\n/g, '\n');
    const lines = norm.split('\n');
    const firstIdx = lines.findIndex(l => l.trim().length > 0);
    if (firstIdx === -1) {
      return { title, content };
    }
    const newTitle = lines[firstIdx].trim();
    const newContent = lines.slice(firstIdx + 1).join('\n').trim();
    return { title: newTitle || title, content: newContent || content };
  }
}
