import { describe, expect, it } from 'vitest';
import { ModuleRegistry } from './index';

describe('ModuleRegistry', () => {
  const module = {
    id: 'text.case',
    version: '0.1.0',
    name: 'Text Case',
    description: 'Convert text',
    category: 'text' as const,
    requiredCapabilities: ['text.read', 'text.write'] as const,
  };

  it('registers modules and reports missing host capabilities', () => {
    const registry = new ModuleRegistry([module]);
    expect(registry.get('text.case')?.name).toBe('Text Case');
    expect(registry.missingCapabilities('text.case', new Set(['text.read']))).toEqual([
      'text.write',
    ]);
    expect(() => registry.register(module)).toThrow(/duplicate/);
  });
});
