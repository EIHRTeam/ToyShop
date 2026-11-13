export type SupportedLocale = 'zh-CN' | 'en';

/** Adobe locales use underscores; Intl.Locale expects BCP 47 separators. */
export function parseLocaleTag(tag: string): Intl.Locale | null {
  try {
    return new Intl.Locale(tag.trim().replaceAll('_', '-'));
  } catch {
    return null;
  }
}

export function supportedLocale(locale: Intl.Locale): SupportedLocale | null {
  if (locale.language === 'en') return 'en';
  if (locale.language === 'zh' && locale.maximize().script === 'Hans') return 'zh-CN';
  return null;
}
