import { describe, expect, it } from 'vitest';
import { convertTextCase } from './index';

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
});
