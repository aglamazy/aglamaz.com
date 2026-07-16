export interface MagazineSuggestInput {
  siteName: string;
  // Prior sent digests, or previously-written templates, used as style/content
  // reference. v0 callers pass a fixture (see fixtures/magazineTemplateFixture.ts)
  // since no real digests have been sent yet.
  priorDigestSamples: string[];
}

function stripMarkdownFences(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export class MagazineTemplateSuggesterService {
  static isEnabled() {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Drafts a starting HTML template for a site's monthly magazine digest,
   * given prior digest/template content as style reference. The editor
   * reviews and edits the result before it's used - this is a starting
   * point, not a final template.
   */
  static async suggestTemplate(input: MagazineSuggestInput): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const sys = `You are an expert HTML email template designer. Draft a starting HTML template for a family's monthly "magazine" digest email.
The template will later be edited by hand, so favor a clean, simple structure over cleverness.
Use inline CSS only (no <style> blocks, no external assets) since this renders in email clients.
Use {{placeholders}} (e.g. {{siteName}}, {{month}}, {{photosSection}}, {{anniversariesSection}}, {{blogSection}}) for dynamic content sections instead of inventing fake data.
Output ONLY the raw HTML document, no markdown code fences, no commentary.`;

    const userPrompt = [
      `Site name: ${input.siteName}`,
      '',
      'Prior digests/templates for style reference:',
      ...input.priorDigestSamples.map((sample, i) => `--- Sample ${i + 1} ---\n${sample}`),
    ].join('\n');

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const raw: string = (data.choices?.[0]?.message?.content || '').trim();
    const html = stripMarkdownFences(raw);

    if (!html) {
      throw new Error('OpenAI returned an empty template suggestion');
    }

    return html;
  }
}
