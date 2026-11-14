import { expect, it } from 'vitest';
import { findUnsupportedWebApi } from './audit-web-apis.mjs';

const radixCollection = `
  class OrderedDict extends Map {
    at(index) { return this.get(index); }
    keyAt(index) { return index; }
    toSorted(compare) { return new OrderedDict([...this.entries()].sort(compare)); }
    toSpliced(...args) { const entries = [...this.entries()]; entries.splice(...args); return new OrderedDict(entries); }
    from(index) { return this.at(index); }
  }
  function update(setCollection) {
    setCollection((map) => {
      const sorted = map.toSorted(() => 0);
      return sorted.some(([key], index) => map.keyAt(index) !== key) ? sorted : map;
    });
  }
`;

it('rejects unsupported array APIs through ordinary and explicit receivers', () => {
  for (const source of [
    'const items = [1, 2]; items.at(0);',
    'const items = [1, 2]; items.toSorted();',
    'const items = [1, 2]; items.toSpliced(0, 1);',
    'const items = [1, 2]; items["at"](0);',
    'const items = [1, 2]; items[`toSorted`]()',
    'Array.prototype.at([1, 2], 0);',
    'Array.prototype.at.call([1, 2], 0);',
    'Array.prototype.toSorted.call([1, 2]);',
    'Array.prototype.toSpliced.apply([1, 2], [0, 1]);',
    'Object.hasOwn({}, "key");',
  ]) {
    expect(findUnsupportedWebApi(source)).toBeTruthy();
  }
});

it('allows the Radix collection methods while rejecting an added array call', () => {
  expect(findUnsupportedWebApi(radixCollection)).toBeUndefined();
  expect(findUnsupportedWebApi(radixCollection + '\n[1, 2].toSorted();')).toBeTruthy();
  expect(findUnsupportedWebApi(radixCollection + '\n[1, 2].at(0);')).toBeTruthy();
});

it('allows Array.prototype.at only behind a feature guard', () => {
  const guarded = `
    function at(items, index) {
      if ('at' in Array.prototype) return Array.prototype.at.call(items, index);
      return items[index < 0 ? items.length + index : index];
    }
  `;
  expect(findUnsupportedWebApi(guarded)).toBeUndefined();
  expect(findUnsupportedWebApi('Array.prototype.at.call([1], 0);')).toBeTruthy();
});
