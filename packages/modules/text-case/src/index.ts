import type { ModuleDefinition } from '@toyshop/core';

export const textCaseModule: ModuleDefinition = {
  id: 'text.case',
  version: '0.1.0',
  name: 'Text Case Converter',
  description: 'Convert ASCII Latin text while preserving other scripts',
  category: 'text',
  requiredCapabilities: [
    'document.read',
    'selection.read',
    'text.enumerate',
    'text.read',
    'text.write',
  ],
};

export type TextCaseOperation = 'upper' | 'lower';

// Script runs include accents and combining marks. Only all-ASCII runs are changed.
const latinRun = /\p{Script=Latin}[\p{Script=Latin}\p{Mark}]*/gu;
const asciiOnly = /^[A-Za-z]+$/;

export function convertTextCase(input: string, operation: TextCaseOperation): string {
  return input.replace(latinRun, (word) => {
    if (!asciiOnly.test(word)) return word;
    return operation === 'upper' ? word.toUpperCase() : word.toLowerCase();
  });
}
