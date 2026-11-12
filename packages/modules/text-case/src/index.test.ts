import { describe, expect, it } from 'vitest';
import {
  assertPlanCurrent,
  convertTextCase,
  createTextChangePlan,
  createTextRestorePlan,
} from './index';
import type { TextScan } from './index';

describe('ascii-latin-safe text case', () => {
  it('converts ASCII runs while preserving other scripts and accented words', () => {
    expect(convertTextCase('Hello Café 世界 Привет 日本語 English', 'upper')).toBe(
      'HELLO Café 世界 Привет 日本語 ENGLISH',
    );
    expect(convertTextCase('HELLO cafe\u0301 한국어 WORLD', 'lower')).toBe(
      'hello cafe\u0301 한국어 world',
    );
  });

  it('keeps UTF-16 length stable', () => {
    const input = 'Hello 世界 Café WORLD';
    expect(convertTextCase(input, 'lower')).toHaveLength(input.length);
  });

  it('protects accented runs and combining marks without spaces', () => {
    expect(convertTextCase('你好Hello日本語Cafe\u0301WORLD한글', 'upper')).toBe(
      '你好HELLO日本語Cafe\u0301WORLD한글',
    );
    expect(convertTextCase('Straße WORLD e\u0301xample', 'lower')).toBe(
      'Straße world e\u0301xample',
    );
  });

  it('applies experimental sentence case across punctuation and lines while protecting URLs', () => {
    expect(convertTextCase('HELLO WORLD. NEXT LINE!\n"GOOD DAY?"', 'sentence')).toBe(
      'Hello world. Next line!\n"Good day?"',
    );
    expect(convertTextCase('VISIT https://EXAMPLE.com NOW. EMAIL A@EXAMPLE.COM', 'sentence')).toBe(
      'Visit https://EXAMPLE.com now. Email A@EXAMPLE.COM',
    );
    expect(convertTextCase('CAFÉ HELLO 世界 NASA iPhone', 'sentence')).toBe(
      'CAFÉ hello 世界 NASA iPhone',
    );
  });

  it('deduplicates targets, reports skips, and rejects a stale selection or style', () => {
    const scan: TextScan = {
      documentId: 'doc-1',
      revision: '4',
      scope: 'selected',
      includeHidden: false,
      selectionFingerprint: 'group|text',
      targets: [
        { id: 'a', name: 'A', text: 'Hello 世界', styleFingerprint: 'font-1' },
        { id: 'a', name: 'A', text: 'Hello 世界', styleFingerprint: 'font-1' },
        { id: 'b', name: 'B', text: 'WORLD', styleFingerprint: 'font-2', skipReason: 'locked' },
        { id: 'c', name: 'C', text: '123', styleFingerprint: 'font-3' },
      ],
    };
    const plan = createTextChangePlan(scan, 'upper');
    expect(plan).toMatchObject({ scanned: 3, unchanged: 1 });
    expect(plan.changes).toHaveLength(1);
    expect(plan.skipped).toEqual([{ id: 'b', name: 'B', reason: 'locked' }]);
    expect(() => assertPlanCurrent(plan, scan)).not.toThrow();
    expect(() => assertPlanCurrent(plan, { ...scan, selectionFingerprint: 'other' })).toThrow(
      'Document or selection changed',
    );
    expect(() =>
      assertPlanCurrent(plan, {
        ...scan,
        targets: [{ ...scan.targets[0]!, styleFingerprint: 'font-changed' }],
      }),
    ).toThrow('Text or styles changed');
  });

  it('restores only a completed conversion and checks the changed text first', () => {
    const scan: TextScan = {
      documentId: 'doc-1',
      revision: '1',
      scope: 'selected',
      includeHidden: false,
      selectionFingerprint: 'text-1',
      targets: [{ id: 'text-1', name: 'A', text: 'Hello', styleFingerprint: 'style-1' }],
    };
    const plan = createTextChangePlan(scan, 'upper');
    const restore = createTextRestorePlan(plan);
    expect(restore.changes[0]).toMatchObject({ before: 'HELLO', after: 'Hello' });
    expect(() => assertPlanCurrent(restore, scan)).toThrow('Text or styles changed');
    expect(() =>
      assertPlanCurrent(restore, {
        ...scan,
        targets: [{ ...scan.targets[0]!, text: 'HELLO' }],
      }),
    ).not.toThrow();
  });
});
