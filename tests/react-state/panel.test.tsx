import { bwipProvider } from '@astmatrix/barcode-core';
import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AstMatrixApplicationService } from '@astmatrix/application';
import { FakeHostAdapter } from '@astmatrix/host-contract';
import {
  AstMatrixPanel,
  AstMatrixProviders,
  initialSelection,
  selectionReducer,
} from '@astmatrix/ui-react';
import { isCompatible } from '@astmatrix/symbology-catalog';
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  document.body.innerHTML = '<div id="test-root"></div>';
  root = createRoot(document.getElementById('test-root')!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
const button = (label: string) =>
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent === label)!;
async function mount(hostLocale = 'zh_CN', browser = false) {
  const adapter = new FakeHostAdapter(),
    service = new AstMatrixApplicationService(bwipProvider);
  await act(async () =>
    root.render(
      <StrictMode>
        <AstMatrixProviders
          service={service}
          adapter={browser ? undefined : adapter}
          hostLocale={hostLocale}
          debounceMs={0}
        >
          <AstMatrixPanel />
        </AstMatrixProviders>
      </StrictMode>,
    ),
  );
  await change(hostLocale === 'en_US' ? 'Content' : '编码内容', '6901234567892');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  return { adapter, service };
}
async function change(label: string, value: string) {
  const el = document.querySelector(`[aria-label="${label}"]`)! as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement;
  const prototype =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(
      new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    );
  });
}
const tick = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
it('atomically restores valid per-tab and per-symbology profile history', () => {
  let state = selectionReducer(initialSelection, { type: 'tab', tab: 'matrix' });
  state = selectionReducer(state, { type: 'profile', id: 'qr-mobile' });
  state = selectionReducer(state, { type: 'symbology', id: 'datamatrix' });
  expect(state.profileId).toBe('dm-default');
  state = selectionReducer(state, { type: 'symbology', id: 'qrcode' });
  expect(state.profileId).toBe('qr-mobile');
  state = selectionReducer(state, { type: 'tab', tab: 'barcode' });
  expect(state.symbologyId).toBe('ean13');
  state = selectionReducer(state, { type: 'tab', tab: 'matrix' });
  expect(state.profileId).toBe('qr-mobile');
  expect(selectionReducer(state, { type: 'profile', id: 'ean13-default' })).toBe(state);
  expect(selectionReducer(state, { type: 'symbology', id: 'ean13' })).toBe(state);
  expect(isCompatible(state.symbologyId, state.profileId)).toBe(true);
});
it('renders real preview in StrictMode, invalidates ready immediately and recovers', async () => {
  await mount();
  expect(document.querySelector<HTMLImageElement>('.preview-stage img')).not.toBeNull();
  expect(button('模拟插入文档').disabled).toBe(false);
  await change('编码内容', '6901234567893');
  expect(button('模拟插入文档').disabled).toBe(true);
  expect(document.querySelector<HTMLImageElement>('.preview-stage img')).toBeNull();
  expect(document.body.textContent).toContain('校验位正确');
  await change('编码内容', '6901234567892');
  await tick();
  expect(document.querySelector<HTMLImageElement>('.preview-stage img')).not.toBeNull();
  expect(button('模拟插入文档').disabled).toBe(false);
  await act(async () => button('条形码').click());
  expect(document.querySelector<HTMLImageElement>('.preview-stage img')).not.toBeNull();
});
it('switches profiles retaining input, shows unsupported status and restores tab selection', async () => {
  await mount();
  await act(async () => button('二维码').click());
  await tick();
  await change('编码内容', 'https://example.com/preserved');
  await tick();
  await change('业务预设', 'qr-mobile');
  await tick();
  expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
    'https://example.com/preserved',
  );
  expect(document.querySelector<HTMLImageElement>('.preview-stage img')).not.toBeNull();
  await act(async () => button('条形码').click());
  await tick();
  expect((document.querySelector('[aria-label="编码格式"]') as HTMLSelectElement).value).toBe(
    'ean13',
  );
  await act(async () => button('二维码').click());
  await tick();
  expect((document.querySelector('[aria-label="业务预设"]') as HTMLSelectElement).value).toBe(
    'qr-mobile',
  );
  await change('编码内容', 'https://example.com/keep-through-industry');
  await tick();
  await change('编码格式', 'gs1datamatrix');
  await tick();
  expect(document.body.textContent).toContain('NTIN');
  expect(button('模拟插入文档').disabled).toBe(true);
  expect(button('复制 SVG').disabled).toBe(true);
  await change('编码格式', 'qrcode');
  await tick();
  expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
    'https://example.com/keep-through-industry',
  );
});
it('no document still allows SVG copying; insertion is exclusive and reports adapter failures', async () => {
  const { adapter } = await mount();
  await act(async () => adapter.setDocument(null));
  expect(button('复制 SVG').disabled).toBe(false);
  expect(button('模拟插入文档').disabled).toBe(true);
  await act(async () => adapter.setDocument('demo-document'));
  let release!: () => void;
  adapter.waitBeforeCommit = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  await act(async () => {
    button('模拟插入文档').click();
  });
  expect(button('正在模拟插入…').disabled).toBe(true);
  expect(adapter.insertCalls).toBe(1);
  await act(async () => {
    adapter.setDocument('other-document');
    release();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const errorToast = document.querySelector('[data-sonner-toast][data-type="error"]');
  expect(errorToast?.textContent).toContain('DOCUMENT_CHANGED');
  expect(errorToast?.getAttribute('data-rich-colors')).toBe('true');
  expect(document.querySelector('.preview .error')).toBeNull();
  adapter.waitBeforeCommit = () => Promise.resolve();
  adapter.failure = 'rollback-failed';
  await act(async () => button('模拟插入文档').click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(
    Array.from(document.querySelectorAll('[data-sonner-toast][data-type="error"]')).some((toast) =>
      toast.textContent?.includes('ROLLBACK_FAILED'),
    ),
  ).toBe(true);
  expect(document.body.textContent).toContain('残留对象');
});
it('shows a localized English insertion error without raw host text', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { adapter } = await mount('en_US');
  adapter.failure = 'rollback-failed';
  await act(async () => button('Simulate insertion').click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const message = document.querySelector('[data-sonner-toast][data-type="error"]')?.textContent;
  expect(message).toContain('ROLLBACK_FAILED:');
  expect(message).not.toMatch(/\p{Script=Han}/u);
});
it('unmount during a queued insert cancels before commit', async () => {
  const { adapter } = await mount();
  let release!: () => void;
  adapter.waitBeforeCommit = () =>
    new Promise<void>((r) => {
      release = r;
    });
  await act(async () => button('模拟插入文档').click());
  await act(async () => root.unmount());
  await act(async () => release());
  expect(adapter.objects.size).toBe(0);
  root = createRoot(document.getElementById('test-root')!);
});

it('advanced fields survive schema changes without registering NaN defaults', async () => {
  await mount();
  const advanced = document.querySelector('.settings input') as HTMLInputElement;
  await act(async () => advanced.click());
  await act(async () => button('二维码').click());
  await tick();
  expect(
    (document.querySelector('[aria-label="QR 版本（0 自动，1–40）"]') as HTMLInputElement).value,
  ).toBe('0');
  await change('编码格式', 'datamatrix');
  await tick();
  await change('编码内容', 'ABC123');
  await tick();
  await change('编码格式', 'maxicode');
  await change('编码格式', 'qrcode');
  await tick();
  expect(document.querySelector<HTMLImageElement>('.preview-stage img')).not.toBeNull();
  expect(button('模拟插入文档').disabled).toBe(false);
  expect(
    (document.querySelector('[aria-label="QR 版本（0 自动，1–40）"]') as HTMLInputElement).value,
  ).toBe('0');
});

it('copies the current SVG without a document and clears success when the input changes', async () => {
  const { adapter } = await mount();
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  await act(async () => adapter.setDocument(null));
  const svg = decodeURIComponent(
    document.querySelector<HTMLImageElement>('.preview-stage img')!.src.split(',')[1]!,
  );
  expect(
    Array.from(document.querySelectorAll('.preview .actions button'), (el) => el.textContent),
  ).toEqual(['模拟插入文档', '复制 SVG']);
  expect(document.body.textContent).not.toContain('已就绪');
  expect(document.querySelector('footer')).toBeNull();
  await act(async () => button('复制 SVG').click());
  expect(writeText).toHaveBeenCalledExactlyOnceWith(svg);
  expect(document.body.textContent).toContain('SVG 已复制');
  await change('编码内容', 'invalid');
  expect(button('复制 SVG').disabled).toBe(true);
  expect(document.body.textContent).not.toContain('SVG 已复制');
});

it('falls back to a selected textarea, restores focus and reports clipboard failure', async () => {
  await mount();
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => {
    throw new Error('Permission denied');
  });
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  const svg = decodeURIComponent(
    document.querySelector<HTMLImageElement>('.preview-stage img')!.src.split(',')[1]!,
  );
  const execCommand = vi.fn<(command: string) => boolean>(() => {
    const textarea = document.activeElement as HTMLTextAreaElement;
    expect(textarea.value).toBe(svg);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(svg.length);
    return true;
  });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
  try {
    const copy = button('复制 SVG');
    copy.focus();
    await act(async () => copy.click());
    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
    expect(document.activeElement).toBe(copy);
    expect(document.body.textContent).toContain('SVG 已复制');
    execCommand.mockReturnValue(false);
    await act(async () => copy.click());
    expect(document.body.textContent).toContain('复制 SVG 失败');
    expect(document.body.textContent).not.toContain('SVG 已复制');
    expect(copy.disabled).toBe(false);
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
  } finally {
    Reflect.deleteProperty(document, 'execCommand');
  }
});

it('uses a localized clipboard failure when the browser returns Chinese diagnostics', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await mount('en_US');
  vi.stubGlobal('navigator', {
    clipboard: { writeText: async () => Promise.reject(new Error('剪贴板权限不足')) },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: () => false,
  });
  try {
    await act(async () => button('Copy SVG').click());
    const message = document.querySelector('.preview .error')?.textContent;
    expect(message).toContain('Unable to copy SVG:');
    expect(message).not.toMatch(/\p{Script=Han}/u);
  } finally {
    Reflect.deleteProperty(document, 'execCommand');
  }
});

it('ignores a delayed clipboard acknowledgement after a new preview is generated', async () => {
  await mount();
  let release!: () => void;
  const writeText = vi.fn<(text: string) => Promise<void>>(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  await act(async () => button('复制 SVG').click());
  expect(button('复制中…').getAttribute('aria-disabled')).toBe('true');
  await act(async () => button('复制中…').click());
  expect(writeText).toHaveBeenCalledOnce();
  await change('编码内容', '4006381333931');
  await tick();
  await act(async () => release());
  expect(document.querySelector<HTMLImageElement>('.preview-stage img')).not.toBeNull();
  expect(document.body.textContent).not.toContain('SVG 已复制');
  expect(button('复制 SVG').disabled).toBe(false);
});

it.each(['barcode', 'matrix'])(
  'downloads and copies the current %s SVG without a host',
  async (tab) => {
    await mount('zh_CN', true);
    if (tab === 'matrix') {
      await act(async () => button('二维码').click());
      await change('编码内容', 'Hello 世界');
      await tick();
    }
    const svg = decodeURIComponent(
      document.querySelector<HTMLImageElement>('.preview-stage img')!.src.split(',')[1]!,
    );
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:toyshop-svg');
    const revokeObjectURL = vi.fn<(url: string) => void>();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL = createObjectURL;
        static override revokeObjectURL = revokeObjectURL;
      },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.isConnected).toBe(true);
      expect(this.getAttribute('href')).toBe('blob:toyshop-svg');
      expect(this.download).toBe(`astmatrix-${tab === 'matrix' ? 'qrcode' : 'ean13'}.svg`);
    });
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    try {
      expect(
        Array.from(document.querySelectorAll('.preview .actions button'), (el) => el.textContent),
      ).toEqual(['下载 SVG', '复制 SVG']);
      expect(document.body.textContent).not.toContain('请先打开文档');
      await act(async () => button('下载 SVG').click());
      expect(click).toHaveBeenCalledOnce();
      const blob = createObjectURL.mock.calls[0]![0];
      expect(blob.type).toBe('image/svg+xml');
      const downloaded = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(reader.result), { once: true });
        reader.readAsText(blob);
      });
      expect(downloaded).toBe(svg);
      await tick();
      expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:toyshop-svg');
      expect(document.querySelector('a[download]')).toBeNull();
      await act(async () => button('复制 SVG').click());
      expect(writeText).toHaveBeenCalledExactlyOnceWith(svg);
      await change('编码内容', '');
      expect(button('下载 SVG').disabled).toBe(true);
      expect(button('复制 SVG').disabled).toBe(true);
    } finally {
      click.mockRestore();
    }
  },
);

it('cleans up a failed SVG download and reports the error in the selected language', async () => {
  await mount('en_US', true);
  const revokeObjectURL = vi.fn<(url: string) => void>();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL = () => 'blob:failed-svg';
      static override revokeObjectURL = revokeObjectURL;
    },
  );
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    throw new Error('Download blocked');
  });
  try {
    await act(async () => button('Download SVG').click());
    await tick();
    expect(document.body.textContent).toContain('Unable to download SVG. Try again.');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:failed-svg');
  } finally {
    click.mockRestore();
    error.mockRestore();
  }
});
