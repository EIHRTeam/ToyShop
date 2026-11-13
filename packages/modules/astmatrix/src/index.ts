import type { ModuleDefinition } from '@toyshop/core';

// The existing AstMatrix application, renderer and host adapters remain one bounded module.
export const astmatrixModule: ModuleDefinition = {
  id: 'assets.astmatrix',
  version: '0.1.3',
  name: 'Barcode & QR Code',
  description: 'Barcode and QR code generator',
  category: 'assets',
  requiredCapabilities: [],
};
