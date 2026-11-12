import { bwipProvider } from '@astmatrix/barcode-core';
import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AstMatrixApplicationService } from '@astmatrix/application';
import { FakeHostAdapter } from '@astmatrix/host-contract';
import { mountNativePanel } from '@astmatrix/ui-uxp';
import type { UxpElement } from '@astmatrix/ui-uxp';
import type { TextCaseHost } from '@toyshop/module-text-case';
let panel: { dispose: () => void } | undefined;
afterEach(() => {
  panel?.dispose();
  document.body.innerHTML = '';
});
it('native UXP UI reuses schemas, preserves tab selection, disables stale input and restores selection metadata', async () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const adapter = new FakeHostAdapter(),
    service = new AstMatrixApplicationService(bwipProvider);
  const previewSvg = vi.fn<() => Promise<string>>(async () => 'file:/local-preview.svg'),
    exportSvg = vi.fn<() => Promise<void>>(async () => {});
  panel = mountNativePanel({
    document,
    root: root as unknown as UxpElement,
    service,
    adapter,
    previewSvg,
    exportSvg,
  });
  const buttons = () => Array.from(root.querySelectorAll('button'));
  const button = (text: string) => buttons().find((b) => b.textContent === text)!;
  await waitFor(() => expect(button('插入文档').disabled).toBe(false));
  fireEvent.click(button('插入文档'));
  await waitFor(() => expect(adapter.objects.size).toBe(1));
  const text = root.querySelector('textarea')!;
  fireEvent.input(text, { target: { value: 'invalid' } });
  expect(button('插入文档').disabled).toBe(true);
  await waitFor(() => expect(root.textContent).toContain('EAN 只接受数字'));
  fireEvent.click(button('读取选中对象参数'));
  await waitFor(() => expect(root.querySelector('textarea')!.value).toBe('6901234567892'));
  fireEvent.click(button('二维码'));
  await waitFor(() => expect(root.querySelector('select')!.value).toBe('qrcode'));
  fireEvent.click(button('条形码'));
  await waitFor(() => expect(root.querySelector('select')!.value).toBe('ean13'));
  await waitFor(() => expect(button('导出 SVG').disabled).toBe(false));
  fireEvent.click(button('导出 SVG'));
  await waitFor(() => expect(exportSvg).toHaveBeenCalledOnce());
  expect(previewSvg).toHaveBeenCalled();
  adapter.setDocument(null);
  expect(button('插入文档').disabled).toBe(true);
  panel.dispose();
  expect(root.children).toHaveLength(0);
  panel = undefined;
});

it('native form converts numeric MaxiCode selections and generates both admitted modes', async () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const service = new AstMatrixApplicationService(bwipProvider);
  const generate = vi.spyOn(service, 'generateNormalized');
  panel = mountNativePanel({
    document,
    root: root as unknown as UxpElement,
    service,
    adapter: new FakeHostAdapter(),
    previewSvg: async () => 'file:/preview.svg',
    exportSvg: async () => {},
  });
  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent === text)!;
  fireEvent.click(button('二维码'));
  fireEvent.change(root.querySelector('select')!, { target: { value: 'maxicode' } });
  const mode = root.querySelector('[aria-label="MaxiCode 模式（2/3 物流，4/5 通用）"]')!;
  fireEvent.change(mode, { target: { value: '5' } });
  await waitFor(() => expect(generate.mock.lastCall?.[0].fields.mode).toBe(5));
  await waitFor(() => expect(button('插入文档').disabled).toBe(false));
  expect(root.textContent).toContain('MaxiCode 模式 2/3');
});

it('native text case converts directly, restores, and displays errors in red', async () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  let value = 'Hello 世界';
  let rejectScan = false;
  const textCaseHost: TextCaseHost = {
    scan: async (scope, includeHidden) => {
      if (rejectScan) throw new Error('扫描失败');
      return {
        documentId: 'doc-1',
        revision: '1',
        scope,
        includeHidden,
        selectionFingerprint: 'text-1',
        targets: [{ id: 'text-1', name: 'Greeting', text: value, styleFingerprint: 'style-1' }],
      };
    },
    apply: async (plan) => {
      value = plan.changes[0]!.after;
      return { changed: 1, failed: [], undoGrouped: true };
    },
  };
  panel = mountNativePanel({
    document,
    root: root as unknown as UxpElement,
    service: new AstMatrixApplicationService(bwipProvider),
    adapter: new FakeHostAdapter(),
    textCaseHost,
    previewSvg: async () => 'file:/preview.svg',
    exportSvg: async () => {},
  });
  const button = (label: string) =>
    Array.from(root.querySelectorAll('button')).find((node) => node.textContent === label)!;
  expect(button('撤销').disabled).toBe(true);
  expect(button('扫描并预览')).toBeUndefined();
  fireEvent.click(button('转换'));
  await waitFor(() => expect(value).toBe('HELLO 世界'));
  await waitFor(() => expect(button('撤销').disabled).toBe(false));
  fireEvent.click(button('撤销'));
  await waitFor(() => expect(value).toBe('Hello 世界'));
  await waitFor(() => expect(button('转换').disabled).toBe(false));
  rejectScan = true;
  fireEvent.click(button('转换'));
  await waitFor(() => expect(root.textContent).toContain('扫描失败'));
  expect(root.querySelector('section .field-error')?.textContent).toContain('扫描失败');
});
