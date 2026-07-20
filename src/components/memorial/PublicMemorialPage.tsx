'use client';

import { useTranslation } from 'react-i18next';
import type { BlessingPage } from '@/entities/BlessingPage';
import type { AnniversaryEvent } from '@/entities/Anniversary';
import type { Blessing } from '@/entities/Blessing';

interface Props {
  blessingPage: BlessingPage;
  event: AnniversaryEvent;
  blessings: Blessing[];
}

export default function PublicMemorialPage({ blessingPage, event, blessings }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={i18n.dir()}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 p-8">
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">{event.name}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
            {t('blessingPageTitle')} - {blessingPage.year}
          </p>
          {event.description && (
            <p className="text-gray-700 dark:text-gray-300 mb-4">{event.description}</p>
          )}
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt={event.name}
              className="w-full max-w-md mx-auto rounded-lg mb-6"
            />
          )}

          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              {t('blessingsCount', { count: blessings.length })}
            </h2>
            {blessings.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                {t('noBlessingsYet')}
              </p>
            ) : (
              <div className="space-y-4">
                {blessings.map((blessing) => (
                  <div
                    key={blessing.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                        {blessing.authorName.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {blessing.authorName}
                      </span>
                    </div>
                    <div
                      className="text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: blessing.content }}
                      dir={i18n.dir()}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
