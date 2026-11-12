import type { ModuleDefinition } from '@toyshop/core';
import { HostError, validateResponse } from '@astmatrix/host-contract';
import type { HostEnvelope, HostTransport } from '@astmatrix/host-contract';

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

export type TextCaseOperation = 'upper' | 'lower' | 'sentence';
export type TextCaseScope = 'selected' | 'area' | 'document';
export type TextSkipReason =
  | 'hidden'
  | 'locked'
  | 'read-only'
  | 'rich-text'
  | 'missing-font'
  | 'instance'
  | 'bound-variable';

export interface TextTarget {
  /** Stable within one open document; threaded text shares one ID. */
  id: string;
  name: string;
  text: string;
  /** Host-owned fingerprint of style ranges and other write-sensitive state. */
  styleFingerprint: string;
  skipReason?: TextSkipReason;
}

export interface TextScan {
  documentId: string;
  revision: string;
  scope: TextCaseScope;
  includeHidden: boolean;
  /** Changes whenever the selected roots change. */
  selectionFingerprint: string;
  targets: readonly TextTarget[];
}

export interface TextChange {
  id: string;
  name: string;
  before: string;
  after: string;
  styleFingerprint: string;
}

export interface TextChangePlan {
  documentId: string;
  revision: string;
  scope: TextCaseScope;
  includeHidden: boolean;
  selectionFingerprint: string;
  operation: TextCaseOperation | 'restore';
  sourceOperation?: TextCaseOperation;
  changes: readonly TextChange[];
  skipped: readonly { id: string; name: string; reason: TextSkipReason }[];
  warnings: readonly string[];
  scanned: number;
  unchanged: number;
  createdAt: number;
}

export interface TextApplyReport {
  changed: number;
  failed: readonly { id: string; reason: string }[];
  /** Whether the host committed the changes as one undoable history entry. */
  undoGrouped: boolean;
}

export interface TextCaseHost {
  readonly supportsCurrentArea?: boolean;
  scan(scope: TextCaseScope, includeHidden: boolean): Promise<TextScan>;
  /** Must recheck the document, selection, each original text and style before writing. */
  apply(plan: TextChangePlan): Promise<TextApplyReport>;
}

// Script runs include accents and combining marks. Only all-ASCII runs are changed.
const latinRun = /\p{Script=Latin}[\p{Script=Latin}\p{Mark}]*/gu;
const asciiOnly = /^[A-Za-z]+$/;
const protectedText =
  /(?:https?:\/\/|www\.)[^\s<>()]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:[A-Za-z0-9]+\.)+[A-Za-z0-9]+\b|\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|etc)\./gi;
const commonAcronyms = new Set([
  'API',
  'CMYK',
  'CSS',
  'DNA',
  'HTML',
  'HTTP',
  'NASA',
  'PDF',
  'RGB',
  'SVG',
  'UI',
  'URL',
  'USA',
]);

function sentenceCase(input: string): string {
  const protectedRanges: { start: number; end: number }[] = [];
  for (const match of input.matchAll(protectedText))
    protectedRanges.push({ start: match.index, end: match.index + match[0].length });
  const protectedAt = (index: number) =>
    protectedRanges.some((range) => index >= range.start && index < range.end);
  let previous = 0;
  let startOfSentence = true;
  let output = '';
  for (const match of input.matchAll(latinRun)) {
    const start = match.index;
    const word = match[0];
    const gap = input.slice(previous, start);
    for (let i = previous; i < start; i++) {
      const character = input[i]!;
      if (character === '\n' || character === '\r') startOfSentence = true;
      else if (/[.!?]/.test(character) && !protectedAt(i)) startOfSentence = true;
      else if (/\p{Letter}/u.test(character)) startOfSentence = false;
    }
    output += gap;
    const protectedWord =
      !asciiOnly.test(word) ||
      protectedAt(start) ||
      commonAcronyms.has(word) ||
      /[a-z][A-Z]/.test(word);
    output += protectedWord
      ? word
      : startOfSentence
        ? word[0]!.toUpperCase() + word.slice(1).toLowerCase()
        : word.toLowerCase();
    startOfSentence = false;
    previous = start + word.length;
  }
  return output + input.slice(previous);
}

export function convertTextCase(input: string, operation: TextCaseOperation): string {
  if (operation === 'sentence') return sentenceCase(input);
  if (operation !== 'upper' && operation !== 'lower') throw new Error('Invalid case operation');
  return input.replace(latinRun, (word) => {
    if (!asciiOnly.test(word)) return word;
    return operation === 'upper' ? word.toUpperCase() : word.toLowerCase();
  });
}

export function createTextChangePlan(scan: TextScan, operation: TextCaseOperation): TextChangePlan {
  if (!scan.documentId || !scan.revision || !['selected', 'area', 'document'].includes(scan.scope))
    throw new Error('Invalid text scan');
  const seen = new Set<string>();
  const changes: TextChange[] = [];
  const skipped: { id: string; name: string; reason: TextSkipReason }[] = [];
  let unchanged = 0;
  for (const target of scan.targets) {
    if (!target.id || seen.has(target.id)) continue;
    seen.add(target.id);
    if (target.skipReason) {
      skipped.push({ id: target.id, name: target.name, reason: target.skipReason });
      continue;
    }
    const after = convertTextCase(target.text, operation);
    if (after === target.text) unchanged++;
    else {
      if (after.length !== target.text.length)
        throw new Error('Case conversion changed text length');
      changes.push({
        id: target.id,
        name: target.name,
        before: target.text,
        after,
        styleFingerprint: target.styleFingerprint,
      });
    }
  }
  return {
    documentId: scan.documentId,
    revision: scan.revision,
    scope: scan.scope,
    includeHidden: scan.includeHidden,
    selectionFingerprint: scan.selectionFingerprint,
    operation,
    changes,
    skipped,
    warnings:
      operation === 'sentence'
        ? ['句首大写为实验性功能；缩写、品牌名称和混合语言可能需要人工检查。']
        : [],
    scanned: seen.size,
    unchanged,
    createdAt: Date.now(),
  };
}

/** Restores only the characters changed by a completed conversion. */
export function createTextRestorePlan(plan: TextChangePlan): TextChangePlan {
  if (plan.operation === 'restore') throw new Error('Cannot restore a restoration');
  return {
    ...plan,
    operation: 'restore',
    sourceOperation: plan.operation,
    changes: plan.changes.map((change) => ({
      ...change,
      before: change.after,
      after: change.before,
    })),
    createdAt: Date.now(),
  };
}

export function assertPlanCurrent(plan: TextChangePlan, scan: TextScan): void {
  if (
    plan.documentId !== scan.documentId ||
    plan.revision !== scan.revision ||
    plan.scope !== scan.scope ||
    plan.includeHidden !== scan.includeHidden ||
    (plan.scope === 'selected' && plan.selectionFingerprint !== scan.selectionFingerprint)
  )
    throw new Error('Document or selection changed; try again');
  const targets = new Map(scan.targets.map((target) => [target.id, target]));
  for (const change of plan.changes) {
    const target = targets.get(change.id);
    if (
      !target ||
      target.skipReason ||
      target.text !== change.before ||
      target.styleFingerprint !== change.styleFingerprint ||
      (plan.operation === 'restore'
        ? !plan.sourceOperation ||
          convertTextCase(change.after, plan.sourceOperation) !== change.before
        : convertTextCase(change.before, plan.operation) !== change.after)
    )
      throw new Error('Text or styles changed; try again');
  }
}

/** Uses the existing versioned host bridge without exposing host objects to React. */
export function createRemoteTextCaseHost(
  transport: HostTransport,
  supportsCurrentArea = false,
): TextCaseHost {
  const session = `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let sequence = 0;
  const call = async <T>(operation: 'textScan' | 'textApply', payload: Record<string, unknown>) => {
    const envelope: HostEnvelope = {
      requestId: `${session}-${++sequence}`,
      operation,
      payloadVersion: 1,
      payload,
    };
    const response = validateResponse<T>(await transport.request(envelope), envelope.requestId);
    if (!response.ok)
      throw new HostError(response.error.code as 'UNKNOWN_HOST_ERROR', response.error.message);
    return response.result;
  };
  return {
    supportsCurrentArea,
    scan: (scope, includeHidden) => call<TextScan>('textScan', { scope, includeHidden }),
    apply: (plan) => call<TextApplyReport>('textApply', { plan }),
  };
}
