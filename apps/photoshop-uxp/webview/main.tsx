import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { AstMatrixApplicationService } from '@astmatrix/application';
import { lazyBwipProvider } from '@astmatrix/barcode-core/lazy';
import { AstMatrixPanel, AstMatrixProviders } from '@astmatrix/ui-react';
import { ToyshopPanel } from '@toyshop/ui-react';
import { createRemoteTextCaseHost } from '@toyshop/module-text-case';
import { createWebviewAdapter } from '../src/webview-client';
import type { WebviewClientWindow } from '../src/webview-client';
import '@astmatrix/ui-react/styles.css';
import '@toyshop/ui-react/styles.css';
const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
try {
  RegExp('(?<=a)b');
  if (
    typeof TextEncoder !== 'function' ||
    typeof Promise !== 'function' ||
    typeof URL !== 'function'
  )
    throw new Error('WebView 缺少必需的 Web API，请使用原生面板');
  const { adapter, transport } = createWebviewAdapter(window as unknown as WebviewClientWindow);
  const textCaseHost = createRemoteTextCaseHost(transport);
  void adapter.refresh().catch(console.error);
  const timer = setInterval(() => {
    void adapter.refresh().catch(console.error);
  }, 750);
  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    adapter.dispose();
  });
  const service = new AstMatrixApplicationService(lazyBwipProvider);
  function WebviewPanel() {
    const hostLocale = useSyncExternalStore(transport.subscribeLocale, transport.getLocale);
    return (
      <AstMatrixProviders
        service={service}
        adapter={adapter}
        hostLocale={hostLocale}
        openExternal={(url) => transport.openExternal(url)}
      >
        <ToyshopPanel astmatrix={AstMatrixPanel} textCaseHost={textCaseHost} />
      </AstMatrixProviders>
    );
  }
  createRoot(container).render(<WebviewPanel />);
} catch (error) {
  container.textContent = String(error);
}
