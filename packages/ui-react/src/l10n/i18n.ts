import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, zhCN } from './messages';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof zhCN };
    enableSelector: true;
  }
}

export type Locale = 'zh-CN' | 'en';

/** Each panel owns its language state, so separate host panels cannot change one another. */
export function createI18n(locale: Locale) {
  const i18n = createInstance();
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, 'zh-CN': { translation: zhCN } },
    lng: locale,
    fallbackLng: 'zh-CN',
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return i18n;
}
