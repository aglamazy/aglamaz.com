module.exports = {
  i18n: {
    defaultLocale: 'he',
    locales: ['he', 'en', 'tr'],
    localeDetection: true,
  },
  localePath: typeof window === 'undefined'
    ? require('path').resolve('./public/locales')
    : '/public/locales',
};