import type { TFunction } from 'i18next';
import { zhCN } from './messages';

export function indexSourceText(tree: Record<string, unknown>): {
  keys: Record<string, string>;
  duplicates: string[];
} {
  const keys: Record<string, string> = Object.create(null);
  const duplicates: string[] = [];
  const visit = (node: Record<string, unknown>, prefix: string) => {
    for (const [part, value] of Object.entries(node)) {
      if (!prefix && part === 'hostError') continue;
      const path = prefix ? `${prefix}.${part}` : part;
      if (typeof value === 'string') {
        if (part.endsWith('_one') || part.endsWith('_other')) continue;
        if (keys[value]) duplicates.push(`${keys[value]} / ${path}`);
        else keys[value] = path;
      } else if (value && typeof value === 'object') {
        visit(value as Record<string, unknown>, path);
      }
    }
  };
  visit(tree, '');
  return { keys, duplicates };
}

const sourceKeys = indexSourceText(zhCN).keys;

/** Exact source strings only; errors use this before falling back to their stable code. */
export function translateKnownMessage(t: TFunction, source: string): string | null {
  const key = sourceKeys[source];
  return key ? (t as unknown as (key: string) => string)(key) : null;
}

/** Resolve framework-independent display text to semantic keys and parameterized messages. */
export function translateMessage(t: TFunction, source: string): string {
  let match = /^请输入(\d+) 位数字（(不含|含)校验位）$/.exec(source);
  if (match)
    return t(($) => $.dynamic.digitsWithCheckDigitPolicy, {
      length: match[1]!,
      policy: match[2] === '不含' ? t(($) => $.dynamic.excluding) : t(($) => $.dynamic.including),
    });
  match = /^请输入以 0 或 1 开头的 (\d+) 位数字（(不含|含)校验位）$/.exec(source);
  if (match)
    return t(($) => $.dynamic.upceDigitsWithCheckDigitPolicy, {
      length: match[1]!,
      policy: match[2] === '不含' ? t(($) => $.dynamic.excluding) : t(($) => $.dynamic.including),
    });
  match = /^需要 (\d+) 位数字$/.exec(source);
  if (match) return t(($) => $.dynamic.requiredDigits, { length: match[1]! });
  match = /^数值范围为 (\d+)–(\d+)$/.exec(source);
  if (match) return t(($) => $.dynamic.numericRange, { min: match[1]!, max: match[2]! });
  match = /^附加码（(\d+) 位数字）$/.exec(source);
  if (match) return t(($) => $.dynamic.addOnDigits, { length: match[1]! });
  match = /^自动补位模式需要 (\d+) 位数字$/.exec(source);
  if (match) return t(($) => $.dynamic.generatedCheckDigitDigits, { length: match[1]! });
  match = /^需要 (\d+) 位数字且校验位正确$/.exec(source);
  if (match) return t(($) => $.dynamic.digitsWithValidCheckDigit, { length: match[1]! });
  // Framework-independent packages still emit display text; this is the sole legacy lookup.
  return translateKnownMessage(t, source) ?? source;
}
