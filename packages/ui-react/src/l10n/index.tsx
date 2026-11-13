import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { parseLocaleTag, supportedLocale } from '@astmatrix/shared';
import { createI18n } from './i18n';
import type { Locale } from './i18n';
export type LanguagePreference = 'auto' | Locale;
export const LANGUAGE_STORAGE_KEY = 'astmatrix.language';
export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'auto' || value === 'zh-CN' || value === 'en';
}
export function resolveLocale(preference: LanguagePreference, hostLocale?: string): Locale {
  if (preference !== 'auto') return preference;
  if (hostLocale?.trim()) {
    const locale = parseLocaleTag(hostLocale);
    if (locale) return supportedLocale(locale) ?? 'en';
  }
  if (typeof navigator === 'undefined') return 'en';
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const locale = parseLocaleTag(tag);
    if (!locale) continue;
    const supported = supportedLocale(locale);
    if (supported) return supported;
  }
  return 'en';
}
function readPreference(): LanguagePreference {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguagePreference(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}
const LocaleContext = createContext({
  locale: 'zh-CN' as Locale,
  preference: 'auto' as LanguagePreference,
  setPreference: (_value: LanguagePreference) => {},
});
export function LocaleProvider({
  hostLocale,
  children,
}: {
  hostLocale?: string;
  children: ReactNode;
}) {
  const [preference, setLanguage] = useState(readPreference);
  const locale = resolveLocale(preference, hostLocale);
  const [i18n] = useState(() => createI18n(locale));
  useEffect(() => {
    document.documentElement.lang = locale;
    void i18n.changeLanguage(locale);
  }, [i18n, locale]);
  const setPreference = useCallback((value: LanguagePreference) => {
    setLanguage(value);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    } catch {
      // The language still works for this panel when storage is unavailable.
    }
  }, []);
  const value = useMemo(
    () => ({
      locale,
      preference,
      setPreference,
    }),
    [locale, preference, setPreference],
  );
  return (
    <I18nextProvider i18n={i18n}>
      <LocaleContext value={value}>{children}</LocaleContext>
    </I18nextProvider>
  );
}
export const useLocale = () => useContext(LocaleContext);
