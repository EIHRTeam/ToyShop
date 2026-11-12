import { describe, expect, it } from 'vitest';
import { createTextChangePlan, createTextRestorePlan } from '@toyshop/module-text-case';
import { PhotoshopTextCaseHost } from './text-case';
import type { PhotoshopRuntime, PsDocument, PsLayer } from './runtime';

function fixture(textStyleRange?: unknown[], paragraphStyleRange?: unknown[]) {
  const text = {
    id: 2,
    name: 'Greeting',
    opacity: 100,
    visible: true,
    locked: false,
    textItem: { contents: 'Hello 世界' },
  } as PsLayer;
  const group = {
    id: 1,
    name: 'Group',
    opacity: 100,
    visible: true,
    locked: false,
    layers: [text],
  } as PsLayer;
  text.parent = group;
  const doc = {
    id: 7,
    activeLayers: [group, text],
    layers: [group],
  } as PsDocument;
  let committed = false;
  const ps = {
    app: { documents: [doc], activeDocument: doc },
    action: {
      batchPlay: async () => [
        {
          textKey: {
            textStyleRange: textStyleRange ?? [
              { from: 0, to: text.textItem!.contents.length, font: 'Inter' },
            ],
            paragraphStyleRange: paragraphStyleRange ?? [
              { from: 0, to: text.textItem!.contents.length, align: 'left' },
            ],
          },
        },
      ],
    },
    core: {
      executeAsModal: async (callback: (context: unknown) => Promise<unknown>) =>
        callback({
          isCancelled: false,
          hostControl: {
            suspendHistory: async () => 1,
            resumeHistory: async (_id: number, commit: boolean) => {
              committed = commit;
            },
          },
        }),
    },
  } as unknown as PhotoshopRuntime;
  const host = new PhotoshopTextCaseHost(ps, () => ({ documentId: '7', revision: 1 }));
  return { host, text, group, getCommitted: () => committed };
}

describe('Photoshop text case host', () => {
  it('deduplicates selected parent and child, then commits one history state', async () => {
    const { host, text, getCommitted } = fixture();
    const scan = await host.scan('selected', false);
    expect(scan.targets).toHaveLength(1);
    const plan = createTextChangePlan(scan, 'upper');
    expect(await host.apply(plan)).toMatchObject({ changed: 1, undoGrouped: true });
    expect(text.textItem?.contents).toBe('HELLO 世界');
    expect(getCommitted()).toBe(true);
    expect(await host.apply(createTextRestorePlan(plan))).toMatchObject({ changed: 1 });
    expect(text.textItem?.contents).toBe('Hello 世界');
  });

  it('skips hidden descendants and rejects changed text', async () => {
    const { host, text, group } = fixture();
    group.visible = false;
    expect((await host.scan('selected', false)).targets[0]?.skipReason).toBe('hidden');
    group.visible = true;
    const plan = createTextChangePlan(await host.scan('selected', false), 'lower');
    text.textItem!.contents = 'Changed';
    await expect(host.apply(plan)).rejects.toThrow('文档、选区、文字或样式已变化');
  });

  it('accepts line-break ranges with the same styles, but skips truly mixed styles', async () => {
    const same = fixture(
      [
        { from: 0, to: 20, textStyle: { font: 'Inter', size: 12 } },
        { from: 20, to: 34, textStyle: { font: 'Inter', size: 12 } },
      ],
      [
        { from: 0, to: 20, paragraphStyle: { align: 'left' } },
        { from: 20, to: 34, paragraphStyle: { align: 'left' } },
      ],
    );
    same.text.textItem!.contents = 'najkcaksckajkdcdsak\rsdadadadHJKJKK';
    const scan = await same.host.scan('selected', false);
    expect(scan.targets[0]?.skipReason).toBeUndefined();
    const plan = createTextChangePlan(scan, 'upper');
    expect((await same.host.apply(plan)).changed).toBe(1);
    expect(same.text.textItem!.contents).toBe('NAJKCAKSCKAJKDCDSAK\rSDADADADHJKJKK');

    const mixed = fixture([
      { from: 0, to: 20, textStyle: { font: 'Inter', size: 12 } },
      { from: 20, to: 34, textStyle: { font: 'Inter', size: 14 } },
    ]);
    expect((await mixed.host.scan('selected', false)).targets[0]?.skipReason).toBe('rich-text');
  });
});
