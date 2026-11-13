import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { AstMatrixApplicationService } from '@astmatrix/application';
import type { FigmaPluginAdapter, FigmaTransport } from '@astmatrix/host-adapter-figma-plugin';
import { AstMatrixPanel, AstMatrixProviders } from '@astmatrix/ui-react';
import { ToyshopPanel } from '@toyshop/ui-react';
import { createRemoteTextCaseHost } from '@toyshop/module-text-case';

export function FigmaPanel({
  service,
  adapter,
  transport,
  debounceMs,
  showDiagnostics = false,
}: {
  service: AstMatrixApplicationService;
  adapter: FigmaPluginAdapter;
  transport: FigmaTransport;
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
  const { t } = useTranslation();
  return (
    <aside className="figma-connection-diagnostic" role="alert">
      <details open>
        <summary>{t(($) => $.host.figma.connectionDiagnostics)}</summary>
        <pre>{details}</pre>
      </details>
    </aside>
  );
}
