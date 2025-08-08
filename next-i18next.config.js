module.exports = {
  i18n: {
    defaultLocale: 'he',
    locales: ['he', 'en', 'tr'],
    localeDetection: true,
  },
  debug:false,
  localePath: typeof window === 'undefined'
    ? require('path').resolve('./public/locales')
    : '/locales',
};