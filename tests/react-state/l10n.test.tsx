import { bwipProvider } from '@astmatrix/barcode-core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AstMatrixApplicationService } from '@astmatrix/application';
import { FakeHostAdapter, HostError } from '@astmatrix/host-contract';
import { profiles, profileHint } from '@astmatrix/profiles';
import { AstMatrixPanel, AstMatrixProviders, useLocale } from '@astmatrix/ui-react';
import { LANGUAGE_STORAGE_KEY, resolveLocale } from '../../packages/ui-react/src/l10n';
import { indexSourceText, translateMessage } from '../../packages/ui-react/src/l10n/dynamic';
import { translateError } from '../../packages/ui-react/src/l10n/errors';
import { createI18n } from '../../packages/ui-react/src/l10n/i18n';
import { en as englishMessages, zhCN } from '../../packages/ui-react/src/l10n/messages';
const en = createI18n('en');
const zh = createI18n('zh-CN');
const english = (source: string) => translateMessage(en.t, source);
const chinese = (source: string) => translateMessage(zh.t, source);
function valueAt(tree: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, tree);
}
function leafPaths(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object'
      ? leafPaths(value as Record<string, unknown>, path)
      : [path];
  });
}
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root')!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('uses Intl.Locale to match host language and script in Auto', () => {
  expect(resolveLocale('auto', 'zh_CN')).toBe('zh-CN');
  expect(resolveLocale('auto', 'zh_Hans_SG')).toBe('zh-CN');
  expect(resolveLocale('auto', 'zh-Hans-TW')).toBe('zh-CN');
  expect(resolveLocale('auto', 'zh_TW')).toBe('en');
  expect(resolveLocale('auto', 'zh-Hant-HK')).toBe('en');
  expect(resolveLocale('auto', 'en_US')).toBe('en');
  expect(resolveLocale('auto', 'ja_JP')).toBe('en');
  expect(resolveLocale('en', 'zh_CN')).toBe('en');
  expect(resolveLocale('zh-CN', 'en_US')).toBe('zh-CN');
});
it('uses the first supported browser language when no host locale is available', () => {
  vi.stubGlobal('navigator', {
    language: 'ja-JP',
    languages: ['ja-JP', 'zh-Hant-HK', 'zh-Hans-SG', 'en-US'],
  });
  expect(resolveLocale('auto')).toBe('zh-CN');
  expect(resolveLocale('auto', 'bad_locale_@')).toBe('zh-CN');
  vi.stubGlobal('navigator', { language: 'zh-Hant-TW', languages: ['zh-Hant-TW'] });
  expect(resolveLocale('auto')).toBe('en');
});
it('keeps semantic keys aligned across languages and resolves domain source text', () => {
  expect(leafPaths(englishMessages).sort()).toEqual(leafPaths(zhCN).sort());
  expect(indexSourceText(zhCN).duplicates).toEqual([]);
  for (const path of leafPaths(zhCN)) {
    expect(path).toMatch(/^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+$/);
    const source = valueAt(zhCN, path);
    const target = valueAt(englishMessages, path);
    const placeholders = (value: unknown) =>
      Array.from(String(value).matchAll(/{{\s*([\w.]+)\s*}}/g), (match) => match[1]).sort();
    expect(placeholders(target)).toEqual(placeholders(source));
    if (path.startsWith('hostError.')) continue;
    if (path.endsWith('_one') || path.endsWith('_other')) continue;
    expect(typeof source).toBe('string');
    expect(chinese(source as string)).toBe(source);
    expect(english(source as string)).toBe(target);
  }
});
it('reports duplicate legacy source text without crashing module initialization', () => {
  expect(indexSourceText({ first: '重复', second: '重复' }).duplicates).toEqual(['first / second']);
});
it('uses a translated error code when raw host details have no catalog entry', () => {
  expect(translateError(en.t, new HostError('NO_DOCUMENT', '请先打开文档'))).toBe(
    en.t(($) => $.host.noDocument),
  );
  for (const error of [
    new HostError('DOCUMENT_CHANGED', '文字对象已锁定或隐藏'),
    new HostError('UNKNOWN_HOST_ERROR', 'Shape Layer 未创建'),
    new Error('未知宿主故障'),
  ]) {
    expect(translateError(en.t, error)).not.toMatch(/\p{Script=Han}/u);
    expect(translateError(en.t, error)).not.toContain(error.message);
  }
  expect(translateError(en.t, new HostError('DOCUMENT_CHANGED', '文档或页面已变化'))).toBe(
    en.t(($) => $.hostError.DOCUMENT_CHANGED),
  );
});
it('covers all preset names, dynamic field labels and input guidance in English', () => {
  for (const profile of profiles) {
    for (const source of [
      profile.label,
      profileHint(profile),
      ...profile.fields.map((f) => f.label),
    ]) {
      expect(english(source)).not.toMatch(/\p{Script=Han}/u);
      expect(chinese(source)).toBe(source);
    }
  }
  expect(english('需要 12 位数字')).toBe('Enter 12 digits');
  expect(english('数值范围为 3–131070')).toBe('The value must be between 3 and 131070');
  expect(english('需要 13 位数字且校验位正确')).toBe('Enter 13 digits with a valid check digit');
});
it.each([
  ['请输入12 位数字（不含校验位）', 'Enter 12 digits (excluding the check digit)'],
  ['请输入13 位数字（含校验位）', 'Enter 13 digits (including the check digit)'],
  [
    '请输入以 0 或 1 开头的 7 位数字（不含校验位）',
    'Enter 7 digits starting with 0 or 1 (excluding the check digit)',
  ],
  ['附加码（5 位数字）', 'Add-on (5 digits)'],
  ['自动补位模式需要 11 位数字', 'Check digit generation requires 11 digits'],
])('interpolates domain message %s through i18next', (source, expected) => {
  expect(english(source)).toBe(expected);
  expect(chinese(source)).toBe(source);
});
it('translates whole count messages with English plurals', () => {
  expect(en.t(($) => $.textCase.status.changed, { count: 0 })).toBe('Changed 0 items.');
  expect(en.t(($) => $.textCase.status.changed, { count: 1 })).toBe('Changed 1 item.');
  expect(en.t(($) => $.textCase.status.changed, { count: 2 })).toBe('Changed 2 items.');
  expect(en.t(($) => $.textCase.status.restoredWithFailures, { count: 1, failed: 2 })).toBe(
    'Restored 1 item; 2 failed.',
  );
  expect(zh.t(($) => $.textCase.status.skipped, { count: 2 })).toBe('跳过 2 项。');
});
function LocaleControls() {
  const { setPreference } = useLocale();
  return (
    <>
      <button onClick={() => setPreference('en')}>English test</button>
      <button onClick={() => setPreference('auto')}>Auto test</button>
    </>
  );
}
it('persists a manual choice, follows updated host locale in Auto and preserves edited content', async () => {
  const service = new AstMatrixApplicationService(bwipProvider);
  const adapter = new FakeHostAdapter();
  const render = async (hostLocale: string) => {
    await act(async () =>
      root.render(
        <AstMatrixProviders
          service={service}
          adapter={adapter}
          hostLocale={hostLocale}
          debounceMs={0}
        >
          <AstMatrixPanel />
          <LocaleControls />
        </AstMatrixProviders>,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  };
  await render('zh_CN');
  const content = document.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      content,
      '4006381333931',
    );
    content.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  const svg = document.querySelector('.preview-stage img')!.getAttribute('src');
  await act(async () =>
    document.querySelectorAll('button').forEach((button) => {
      if (button.textContent === 'English test') button.click();
    }),
  );
  expect(document.documentElement.lang).toBe('en');
  expect(content.value).toBe('4006381333931');
  expect(document.querySelector('.preview-stage img')!.getAttribute('src')).toBe(svg);
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  await render('zh_CN');
  expect(document.documentElement.lang).toBe('en');
  await act(async () =>
    document.querySelectorAll('button').forEach((button) => {
      if (button.textContent === 'Auto test') button.click();
    }),
  );
  expect(document.documentElement.lang).toBe('zh-CN');
  await render('en_US');
  expect(document.documentElement.lang).toBe('en');
  expect(content.value).toBe('4006381333931');
});
it('allows language changes when local storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  await act(async () =>
    root.render(
      <AstMatrixProviders
        service={new AstMatrixApplicationService(bwipProvider)}
        adapter={new FakeHostAdapter()}
        hostLocale="zh_CN"
      >
        <LocaleControls />
      </AstMatrixProviders>,
    ),
  );
  await act(async () => (document.querySelector('button') as HTMLButtonElement).click());
  expect(document.documentElement.lang).toBe('en');
});

it('navigates the fixed language menu by keyboard and closes it after selection', async () => {
  await act(async () =>
    root.render(
      <AstMatrixProviders
        service={new AstMatrixApplicationService(bwipProvider)}
        adapter={new FakeHostAdapter()}
        hostLocale="zh_CN"
      >
        <AstMatrixPanel />
      </AstMatrixProviders>,
    ),
  );
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label="语言"]')!;
  await act(async () => trigger.click());
  const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
  const labels = Array.from(menu.querySelectorAll('[role="menuitemradio"]'), (item) =>
    item.textContent!.replace('✓', ''),
  );
  expect(labels).toEqual(['自动', '简体中文', 'English']);
  await act(async () =>
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })),
  );
  expect(document.activeElement?.textContent).toBe('English');
  await act(async () => (document.activeElement as HTMLButtonElement).click());
  expect(document.documentElement.lang).toBe('en');
  expect(document.querySelector('[role="menu"]')).toBeNull();
  await act(async () =>
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })),
  );
  const reopened = document.querySelector<HTMLElement>('[role="menu"]')!;
  expect(
    Array.from(reopened.querySelectorAll('[role="menuitemradio"]'), (item) =>
      item.textContent!.replace('✓', ''),
    ),
  ).toEqual(['Auto', '简体中文', 'English']);
  await act(async () =>
    reopened.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })),
  );
  expect(document.activeElement?.textContent).toContain('Auto');
  await act(async () =>
    reopened.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })),
  );
  expect(document.activeElement?.textContent).toBe('简体中文');
});
