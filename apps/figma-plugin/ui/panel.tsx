import { useState, useSyncExternalStore } from 'react';
import type { AstMatrixApplicationService } from '@astmatrix/application';
import type { FigmaPluginAdapter, FigmaTransport } from '@astmatrix/host-adapter-figma-plugin';
import { AstMatrixPanel, AstMatrixProviders, useLocale } from '@astmatrix/ui-react';
import { ToyshopPanel } from '@toyshop/ui-react';
import { createRemoteTextCaseHost } from '@toyshop/module-text-case';

export function FigmaPanel({
  service,
  adapter,
  transport,
  hostLocale,
  debounceMs,
  showDiagnostics = false,
}: {
  service: AstMatrixApplicationService;
  adapter: FigmaPluginAdapter;
  transport: FigmaTransport;
  hostLocale?: string;
  debounceMs?: number;
  showDiagnostics?: boolean;
}) {
  const [textCaseHost] = useState(() => createRemoteTextCaseHost(transport, true));
  const connection = useSyncExternalStore(
    transport.subscribeConnection,
    transport.getConnectionSnapshot,
  );
  return (
    <AstMatrixProviders
      service={service}
      adapter={adapter}
      hostLocale={hostLocale}
      debounceMs={debounceMs}
      openExternal={(url) => transport.openExternal(url)}
      hostStatusMessage={connection.message}
    >
      <ToyshopPanel astmatrix={AstMatrixPanel} textCaseHost={textCaseHost} />
      {showDiagnostics && connection.status === 'error' ? (
        <ConnectionDiagnostic details={connection.details ?? ''} />
      ) : null}
    </AstMatrixProviders>
  );
}
function ConnectionDiagnostic({ details }: { details: string }) {
  const { t } = useLocale();
  return (
    <aside className="figma-connection-diagnostic" role="alert">
      <details open>
        <summary>{t('Figma 连接诊断')}</summary>
        <pre>{details}</pre>
      </details>
    </aside>
  );
}
