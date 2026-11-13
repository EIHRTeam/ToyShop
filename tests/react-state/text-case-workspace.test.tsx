import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AstMatrixApplicationService } from '@astmatrix/application';
import { bwipProvider } from '@astmatrix/barcode-core';
import { FakeHostAdapter, HostError } from '@astmatrix/host-contract';
import { AstMatrixProviders } from '@astmatrix/ui-react';
import { assertPlanCurrent } from '@toyshop/module-text-case';
import type { TextCaseHost, TextScan } from '@toyshop/module-text-case';
import { ToyshopPanel } from '@toyshop/ui-react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

it('converts selected text directly and restores the last conversion', async () => {
  let value = 'Hello 世界';
  let scopeSeen = '';
  const host: TextCaseHost = {
    supportsCurrentArea: true,
    scan: async (scope, includeHidden) => {
      scopeSeen = scope;
      return {
        documentId: 'doc-1',
        revision: '1',
        scope,
        includeHidden,
        selectionFingerprint: 'text-1',
        targets: [{ id: 'text-1', name: 'Greeting', text: value, styleFingerprint: 'style-1' }],
      } satisfies TextScan;
    },
    apply: async (plan) => {
      assertPlanCurrent(plan, await host.scan(plan.scope, plan.includeHidden));
      value = plan.changes[0]!.after;
      return { changed: 1, failed: [], undoGrouped: true };
    },
  };
  render(
    <AstMatrixProviders
      service={new AstMatrixApplicationService(bwipProvider)}
      adapter={new FakeHostAdapter()}
      hostLocale="zh_CN"
    >
      <ToyshopPanel astmatrix={() => null} textCaseHost={host} />
    </AstMatrixProviders>,
  );
  fireEvent.click(screen.getByRole('button', { name: '英文大小写转换' }));
  const selected = screen.getByRole('tab', { name: '选中对象' });
  const entire = screen.getByRole('tab', { name: '整个文档' });
  expect(selected.getAttribute('data-state')).toBe('active');
  expect(entire.getAttribute('data-state')).toBe('inactive');
  const undo = screen.getByRole<HTMLButtonElement>('button', { name: '撤销' });
  expect(undo.disabled).toBe(true);
  expect(screen.queryByText('扫描并预览')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '转换' }));
  await waitFor(() => expect(undo.disabled).toBe(false));
  expect(scopeSeen).toBe('selected');
  expect(value).toBe('HELLO 世界');
  expect(document.querySelector('[data-sonner-toast][data-type="success"]')).toBeTruthy();
  fireEvent.mouseDown(entire, { button: 0 });
  fireEvent.click(screen.getByRole('button', { name: '转换' }));
  await waitFor(() => expect(screen.getByText(/已修改 0 项/)).toBeTruthy());
  expect(scopeSeen).toBe('document');
  expect(entire.getAttribute('data-state')).toBe('active');
  fireEvent.mouseDown(selected, { button: 0 });
  fireEvent.click(undo);
  await waitFor(() => expect(screen.getByText(/已撤销 1 项/)).toBeTruthy());
  expect(value).toBe('Hello 世界');
  expect(undo.disabled).toBe(true);
  host.scan = async () => {
    throw new Error('扫描失败');
  };
  fireEvent.click(screen.getByRole('button', { name: '转换' }));
  await waitFor(() => expect(screen.getByText('宿主操作失败，请重试。')).toBeTruthy());
  const errorToast = document.querySelector('[data-sonner-toast][data-type="error"]');
  expect(errorToast?.getAttribute('data-rich-colors')).toBe('true');
});

it('keeps host conversion and undo diagnostics out of English toasts', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const host: TextCaseHost = {
    scan: async () => ({
      documentId: 'doc-1',
      revision: '1',
      scope: 'selected',
      includeHidden: false,
      selectionFingerprint: 'text-1',
      targets: [{ id: 'text-1', name: 'Greeting', text: 'Hello', styleFingerprint: 'style-1' }],
    }),
    apply: vi
      .fn<TextCaseHost['apply']>()
      .mockResolvedValueOnce({ changed: 1, failed: [], undoGrouped: true })
      .mockRejectedValueOnce(new HostError('DOCUMENT_CHANGED', '文字对象已锁定或隐藏')),
  };
  render(
    <AstMatrixProviders
      service={new AstMatrixApplicationService(bwipProvider)}
      adapter={new FakeHostAdapter()}
      hostLocale="en_US"
    >
      <ToyshopPanel astmatrix={() => null} textCaseHost={host} />
    </AstMatrixProviders>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Text Case Converter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
  const undo = screen.getByRole<HTMLButtonElement>('button', { name: 'Undo' });
  await waitFor(() => expect(undo.disabled).toBe(false));
  fireEvent.click(undo);
  await waitFor(() =>
    expect(document.querySelector('[data-sonner-toast][data-type="error"]')).toBeTruthy(),
  );
  const message = document.querySelector('[data-sonner-toast][data-type="error"]')?.textContent;
  expect(message).toContain('The document or selection changed');
  expect(message).not.toMatch(/\p{Script=Han}/u);
});

it('shows a localized English toast when scanning text fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const host: TextCaseHost = {
    scan: async () => {
      throw new HostError('DOCUMENT_CHANGED', '文字对象已锁定或隐藏');
    },
    apply: async () => ({ changed: 0, failed: [], undoGrouped: false }),
  };
  render(
    <AstMatrixProviders
      service={new AstMatrixApplicationService(bwipProvider)}
      adapter={new FakeHostAdapter()}
      hostLocale="en_US"
    >
      <ToyshopPanel astmatrix={() => null} textCaseHost={host} />
    </AstMatrixProviders>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Text Case Converter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
  await waitFor(() =>
    expect(document.querySelector('[data-sonner-toast][data-type="error"]')).toBeTruthy(),
  );
  const message = document.querySelector('[data-sonner-toast][data-type="error"]')?.textContent;
  expect(message).toContain('The document or selection changed');
  expect(message).not.toMatch(/\p{Script=Han}/u);
});
