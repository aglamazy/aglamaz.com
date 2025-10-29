import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

export interface TranslationResult {
  title: string;
  content: string;
}

export class TranslationService {
  static isEnabled() {
    return !!process.env.OPENAI_API_KEY;
  }

  private static async logGptCall(params: {
    sourceLocale: string;
    targetLocale: string;
    sourceText: string;
    resultText: string;
    success: boolean;
    error?: string;
  }) {
    try {
      initAdmin();
      const db = getFirestore();

      const logData: Record<string, any> = {
        timestamp: Timestamp.now(),
        sourceLocale: params.sourceLocale,
        targetLocale: params.targetLocale,
        sourceText: params.sourceText,
        resultText: params.resultText,
        success: params.success,
      };

      // Only include error field if it exists
      if (params.error) {
        logData.error = params.error;
      }

      await db.collection('gptCalls').add(logData);
    } catch (err) {
      // Don't let logging errors break the translation
      console.error('[TranslationService] Failed to log GPT call:', err);
    }
  }

  /**
   * Translates a single text field from one locale to another
   * Preserves undefined/empty - does not call GPT for empty input
   */
  static async translateText({
    text,
    from,
    to,
  }: { text?: string; from?: string; to: string }): Promise<string | undefined> {
    // Preserve undefined/null
    if (text === undefined || text === null) {
      return undefined;
    }

    // Return empty string for empty input or missing locale
    if (!text.trim() || !from) {
      return text;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const sys = `You are a translation engine. Translate from ${from} to ${to}.
Preserve HTML/Markdown structure; do not translate URLs, code, or proper names; keep the tone.
Output ONLY the translated text, no labels or extra commentary.`;

    try {
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
            { role: 'user', content: text }
          ],
          temperature: 0.2,
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        const error = `OpenAI error ${res.status}: ${errorText}`;

        // Log the failed call
        await this.logGptCall({
          sourceLocale: from,
          targetLocale: to,
          sourceText: text,
          resultText: '',
          success: false,
          error,
        });

        throw new Error(error);
      }

      const data = await res.json();
      const result: string = (data.choices?.[0]?.message?.content || '').trim();

      // Log the successful call
      await this.logGptCall({
        sourceLocale: from,
        targetLocale: to,
        sourceText: text,
        resultText: result,
        success: true,
      });

      return result || text;
    } catch (error) {
      // If error wasn't already logged, log it
      if (error instanceof Error && !error.message.startsWith('OpenAI error')) {
        await this.logGptCall({
          sourceLocale: from,
          targetLocale: to,
          sourceText: text,
          resultText: '',
          success: false,
          error: error.message,
        });
      }
      throw error;
    }
  }

  /**
   * Legacy method for backwards compatibility with blog code
   * @deprecated Use translateText instead
   */
  static async translateHtml({
    title,
    content,
    from,
    to,
  }: { title: string; content: string; from?: string; to: string }): Promise<TranslationResult> {
    const sourceLocale = from || 'auto';

    const translatedTitle = title ? await this.translateText({ text: title, from: sourceLocale, to }) : '';
    const translatedContent = content ? await this.translateText({ text: content, from: sourceLocale, to }) : '';

    return {
      title: translatedTitle,
      content: translatedContent,
    };
  }
}
