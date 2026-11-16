import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AstMatrixApplicationService } from '@astmatrix/application';
import { lazyBwipProvider } from '@astmatrix/barcode-core/lazy';
import { AstMatrixPanel, AstMatrixProviders } from '@astmatrix/ui-react';
import { ToyshopPanel } from '@toyshop/ui-react';
import '@astmatrix/ui-react/styles.css';
import '@toyshop/ui-react/styles.css';

const service = new AstMatrixApplicationService(lazyBwipProvider);
const container = document.getElementById('root');
if (!container) throw new Error('ToyShop requires #root');
createRoot(container).render(
  <StrictMode>
    <AstMatrixProviders service={service}>
      <ToyshopPanel astmatrix={AstMatrixPanel} />
    </AstMatrixProviders>
  </StrictMode>,
);
