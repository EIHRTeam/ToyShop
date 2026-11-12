import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AstMatrixApplicationService } from '@astmatrix/application';
import { bwipProvider } from '@astmatrix/barcode-core';
import { FakeHostAdapter } from '@astmatrix/host-contract';
import {
  LICENSE_URL,
  PROJECT_VERSION,
  TOYSHOP_ISSUES_URL,
  TOYSHOP_PROJECT_URL,
} from '@astmatrix/shared';
import { AstMatrixPanel, AstMatrixProviders } from '@astmatrix/ui-react';
import { ToyshopPanel } from '@toyshop/ui-react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function mountToyshop(hostLocale = 'zh_CN', openExternal?: (url: string) => Promise<void>) {
  return render(
    <AstMatrixProviders
      service={new AstMatrixApplicationService(bwipProvider)}
      adapter={new FakeHostAdapter()}
      hostLocale={hostLocale}
      openExternal={openExternal}
    >
      <ToyshopPanel astmatrix={AstMatrixPanel} />
    </AstMatrixProviders>,
  );
}

it('opens modules from the home cards and returns to the home screen', () => {
  const panel = mountToyshop();
  expect(document.querySelectorAll('.brand')).toHaveLength(1);
  expect(document.querySelector('.toyshop-header h1')?.textContent).toBe('ToyShop');
  expect(document.querySelectorAll('.header-actions')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: '工具箱' })).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: '工具模块' })).toBeNull();
  expect(document.querySelector('.toyshop-workspace')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: '二维码 / 条形码生成' }));
  expect(screen.getByRole('region', { name: 'AstMatrix' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: '条形码' })).toBeTruthy();
  expect(document.querySelector('.astmatrix .brand')).toBeNull();
  expect(document.querySelectorAll('.brand')).toHaveLength(1);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '返回工具箱' }));

  fireEvent.click(screen.getByRole('button', { name: '返回工具箱' }));
  expect(document.querySelector('.toyshop-workspace')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '二维码 / 条形码生成' }));

  fireEvent.click(screen.getByRole('button', { name: '英文大小写转换' }));
  expect(screen.getByRole('region', { name: '英文大小写转换' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: '英文大小写转换', level: 2 })).toBeTruthy();
  expect(document.querySelectorAll('.brand')).toHaveLength(1);
  const back = screen.getByRole('button', { name: '返回工具箱' });
  expect(back.textContent).toBe('');
  expect(back.querySelector('svg')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '返回工具箱' }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '英文大小写转换' }));
  panel.unmount();

  // The reusable AstMatrix panel retains its own title bar outside ToyShop.
  render(
    <AstMatrixProviders
      service={new AstMatrixApplicationService(bwipProvider)}
      adapter={new FakeHostAdapter()}
    >
      <AstMatrixPanel />
    </AstMatrixProviders>,
  );
  expect(document.querySelector('.astmatrix .brand h1')?.textContent).toBe('AstMatrix');
});

it('updates text case labels when the language changes without clearing edited text', () => {
  mountToyshop();
  fireEvent.click(screen.getByRole('button', { name: '英文大小写转换' }));
  expect(screen.getByRole('combobox', { name: '转换方式' })).toBeTruthy();
  expect(screen.getByRole('option', { name: '大写' })).toBeTruthy();
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: '示例文字' });
  fireEvent.change(input, { target: { value: 'hello WORLD' } });
  fireEvent.click(screen.getByRole('button', { name: '转换' }));
  expect(input.value).toBe('HELLO WORLD');

  fireEvent.click(screen.getByRole('button', { name: '语言' }));
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
  expect(screen.getByRole('heading', { name: 'Text Case Converter' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Text Case Converter' })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Conversion type' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'UPPERCASE' })).toBeTruthy();
  expect(screen.getByRole('textbox', { name: 'Sample text' })).toBe(input);
  expect(input.value).toBe('HELLO WORLD');
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(input.value).toBe('hello WORLD');
});

it.each([
  ['zh_CN', '关于 ToyShop', '版本', '无法打开反馈链接'],
  ['en_US', 'About ToyShop', 'Version', 'Unable to open the feedback link'],
])(
  'shows the ToyShop about dialog and host link errors in %s',
  async (locale, title, version, error) => {
    const openExternal = vi
      .fn<(url: string) => Promise<void>>()
      .mockRejectedValue(new Error('blocked'));
    mountToyshop(locale, openExternal);
    expect(screen.getByRole<HTMLAnchorElement>('link', { name: /GitHub/ }).href).toBe(
      TOYSHOP_PROJECT_URL,
    );
    fireEvent.click(screen.getByRole('button', { name: locale === 'zh_CN' ? '关于' : 'About' }));
    expect(screen.getByRole('dialog', { name: title })).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain(`${version} v${PROJECT_VERSION}`);
    expect(document.querySelector<HTMLAnchorElement>('.license-link')?.href).toBe(LICENSE_URL);
    expect(document.querySelector<HTMLAnchorElement>('.about-links a:last-child')?.href).toBe(
      TOYSHOP_ISSUES_URL,
    );
    fireEvent.click(
      screen.getByRole('link', { name: locale === 'zh_CN' ? '反馈问题' : 'Report an issue' }),
    );
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(error));
    expect(openExternal).toHaveBeenCalledWith(TOYSHOP_ISSUES_URL);
    fireEvent.click(screen.getByRole('button', { name: locale === 'zh_CN' ? '关闭' : 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  },
);
