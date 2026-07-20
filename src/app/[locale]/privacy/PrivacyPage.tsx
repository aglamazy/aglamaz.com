'use client';

import { useTranslation } from 'react-i18next';
import styles from './page.module.css';

interface PrivacyPageProps {
  contactEmail: string | null;
  lastUpdatedIso: string;
}

const processorKeys = [
  'privacyProcessorMeta',
  'privacyProcessorFirebase',
  'privacyProcessorVercel',
  'privacyProcessorOpenAI',
] as const;

export default function PrivacyPage({ contactEmail, lastUpdatedIso }: PrivacyPageProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.split('-')[0];
  const lastUpdated = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(lastUpdatedIso));

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>{t('privacyPolicy')}</p>
          <h1 className={styles.title}>{t('privacyHeroTitle')}</h1>
          <p className={styles.intro}>{t('privacyHeroBody')}</p>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>{t('privacyLastUpdated')}</span>
            <span className={styles.metaValue}>{lastUpdated}</span>
          </div>
        </header>

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('privacyOperatorTitle')}</h2>
            <p className={styles.cardText}>{t('privacyOperatorBody')}</p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('privacyCollectedTitle')}</h2>
            <p className={styles.cardText}>{t('privacyCollectedBody')}</p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('privacyPurposeTitle')}</h2>
            <p className={styles.cardText}>{t('privacyPurposeBody')}</p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('privacyProcessorsTitle')}</h2>
            <ul className={styles.list}>
              {processorKeys.map((key) => (
                <li key={key} className={styles.listItem}>
                  {t(key)}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('privacyRetentionTitle')}</h2>
            <p className={styles.cardText}>{t('privacyRetentionBody')}</p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('privacyRightsTitle')}</h2>
            <p className={styles.cardText}>{t('privacyRightsBody')}</p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('privacyContactTitle')}</h2>
            {contactEmail ? (
              <p className={styles.cardText}>
                {t('privacyContactBody', { email: contactEmail })}
              </p>
            ) : (
              <p className={styles.cardText}>{t('privacyContactUnavailable')}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
