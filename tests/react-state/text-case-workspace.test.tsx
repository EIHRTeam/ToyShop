import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { AstMatrixApplicationService } from '@astmatrix/application';
import { bwipProvider } from '@astmatrix/barcode-core';
import { FakeHostAdapter } from '@astmatrix/host-contract';
import { AstMatrixProviders } from '@astmatrix/ui-react';
import { assertPlanCurrent } from '@toyshop/module-text-case';
import type { TextCaseHost, TextScan } from '@toyshop/module-text-case';
import { ToyshopPanel } from '@toyshop/ui-react';

afterEach(cleanup);

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
  expect(screen.getByRole('option', { name: '当前页面或画板' })).toBeTruthy();
  const undo = screen.getByRole<HTMLButtonElement>('button', { name: '撤销' });
  expect(undo.disabled).toBe(true);
  expect(screen.queryByText('扫描并预览')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '转换' }));
  await waitFor(() => expect(undo.disabled).toBe(false));
  expect(scopeSeen).toBe('selected');
  expect(value).toBe('HELLO 世界');
  expect(document.querySelector('[data-sonner-toast][data-type="success"]')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('处理范围'), { target: { value: 'area' } });
  fireEvent.click(screen.getByRole('button', { name: '转换' }));
  await waitFor(() => expect(screen.getByText(/已修改 0 项/)).toBeTruthy());
  expect(scopeSeen).toBe('area');
  fireEvent.change(screen.getByLabelText('处理范围'), { target: { value: 'selected' } });
  fireEvent.click(undo);
  await waitFor(() => expect(screen.getByText(/已撤销 1 项/)).toBeTruthy());
  expect(value).toBe('Hello 世界');
  expect(undo.disabled).toBe(true);
  host.scan = async () => {
    throw new Error('扫描失败');
  };
  fireEvent.click(screen.getByRole('button', { name: '转换' }));
  await waitFor(() => expect(screen.getByText('扫描失败')).toBeTruthy());
  const errorToast = document.querySelector('[data-sonner-toast][data-type="error"]');
  expect(errorToast?.getAttribute('data-rich-colors')).toBe('true');
});
