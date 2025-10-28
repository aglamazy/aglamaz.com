import { getFirestore } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { initAdmin } from '@/firebase/admin';

export interface PlatformDescription {
  title: string;
  content: string;
  translations: Record<string, { title: string; content: string }>;
}

interface GetOptions {
  cached?: boolean;
}

export class PlatformRepository {
  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async getDescription(opts?: GetOptions): Promise<PlatformDescription> {
    const fetcher = async (): Promise<PlatformDescription> => {
      try {
        const doc = await this.getDb().collection('platform').doc('description').get();
        if (!doc.exists) {
          return {
            content: '',
            title: '',
            translations: {},
          };
        }

        const data = doc.data() || {};
        return {
          content: (data.content as string) || '',
          title: (data.title as string) || '',
          translations: (data.translations as Record<string, { title: string; content: string }>) || {},
        };
      } catch (error) {
        console.error('[platform] failed to fetch platform description', error);
        return {
          content: '',
          title: '',
          translations: {},
        };
      }
    };

    if (opts?.cached) {
      const cachedFn = unstable_cache(fetcher, ['platform-description'], {
        revalidate: 3600,
        tags: ['platform-description'],
      });
      return cachedFn();
    }

    return fetcher();
  }
}
