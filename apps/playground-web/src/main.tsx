import { StrictMode, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { AstMatrixApplicationService } from '@astmatrix/application';
import { lazyBwipProvider } from '@astmatrix/barcode-core/lazy';
import { FakeHostAdapter } from '@astmatrix/host-contract';
import type { FakeFailure } from '@astmatrix/host-contract';
import { AstMatrixPanel, AstMatrixProviders } from '@astmatrix/ui-react';
import { ToyshopPanel } from '@toyshop/ui-react';
import '@astmatrix/ui-react/styles.css';
import '@toyshop/ui-react/styles.css';
const service = new AstMatrixApplicationService(lazyBwipProvider);
const adapter = new FakeHostAdapter();
function DemoControls() {
  const { t } = useTranslation();
  const host = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);
  const [failure, setFailure] = useState<FakeFailure>('none');
  return (
    <aside className="demo-controls" aria-label={t(($) => $.playground.controls)}>
      <strong>{t(($) => $.playground.simulatedHost)}</strong>
      <button
        onClick={() =>
          adapter.setDocument(
            host.documentId === 'demo-document' ? 'other-document' : 'demo-document',
          )
        }
      >
        {t(($) => $.playground.switchDocument)}
      </button>
      <button onClick={() => adapter.setDocument(host.documentId ? null : 'demo-document')}>
        {host.documentId
          ? t(($) => $.playground.closeDocument)
          : t(($) => $.playground.openDocument)}
      </button>
      <label>
        {t(($) => $.playground.failureScenario)}{' '}
        <select
          aria-label={t(($) => $.playground.failureScenario)}
          value={failure}
          onChange={(e) => {
            const value = e.target.value as FakeFailure;
            adapter.failure = value;
            setFailure(value);
          }}
        >
          <option value="none">{t(($) => $.playground.normalInsertion)}</option>
          <option value="provider-independent-host">
            {t(($) => $.playground.permissionDenied)}
          </option>
          <option value="partial-rollback">{t(($) => $.playground.partialFailureCleaned)}</option>
          <option value="rollback-failed">{t(($) => $.playground.partialFailureUncleaned)}</option>
        </select>
      </label>
      <span>
        {t(($) => $.playground.documentStatus, {
          document: host.documentId ?? t(($) => $.playground.noDocument),
          mode: t(($) => $.playground.memoryOnly),
        })}
      </span>
    </aside>
  );
}
const container = document.getElementById('root');
if (!container) throw new Error('ToyShop playground requires #root');
createRoot(container).render(
  <StrictMode>
    <AstMatrixProviders service={service} adapter={adapter}>
      <ToyshopPanel astmatrix={AstMatrixPanel} />
      <DemoControls />
    </AstMatrixProviders>
  </StrictMode>,
);
