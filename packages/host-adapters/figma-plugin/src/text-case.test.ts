import { describe, expect, it, vi } from 'vitest';
import { createTextChangePlan, createTextRestorePlan } from '@toyshop/module-text-case';
import { stableStringify } from '@astmatrix/shared';
import { applyFigmaText, scanFigmaText } from './text-case';

function fixture() {
  const text = {
    id: 'text-1',
    type: 'TEXT',
    name: 'Greeting',
    characters: 'Hello 世界',
    visible: true,
    locked: false,
    hasMissingFont: false,
    fontName: { family: 'Inter', style: 'Regular' },
    parent: null as unknown,
    getStyledTextSegments: () => [
      {
        characters: text.characters,
        start: 0,
        end: text.characters.length,
        fontName: text.fontName,
        fontSize: 12,
        fills: [],
        boundVariables: {},
      },
    ],
    insertCharacters(start: number, characters: string) {
      this.characters = this.characters.slice(0, start) + characters + this.characters.slice(start);
    },
    deleteCharacters(start: number, end: number) {
      this.characters = this.characters.slice(0, start) + this.characters.slice(end);
    },
  };
  const group = {
    id: 'group-1',
    type: 'GROUP',
    name: 'Group',
    visible: true,
    locked: false,
    parent: null as unknown,
    children: [text],
  };
  const page = {
    id: 'page-1',
    type: 'PAGE',
    children: [group],
    selection: [group, text],
  };
  text.parent = group;
  group.parent = page;
  const api = {
    root: { children: [page] },
    currentPage: page,
    loadAllPagesAsync: vi.fn<() => Promise<void>>(async () => {}),
    loadFontAsync: vi.fn<() => Promise<void>>(async () => {}),
    getNodeByIdAsync: vi.fn<(id: string) => Promise<typeof text | null>>(async (id) =>
      id === text.id ? text : null,
    ),
    commitUndo: vi.fn<() => void>(),
  } as unknown as Parameters<typeof scanFigmaText>[0] & Parameters<typeof applyFigmaText>[0];
  return { api, text, group, page };
}

describe('Figma text case host', () => {
  it('deduplicates a selected parent and child and preserves the style fingerprint', async () => {
    const { api, text } = fixture();
    const scan = await scanFigmaText(api, 'selected', false, 'doc-1', '0');
    expect(scan.targets).toHaveLength(1);
    expect(() => stableStringify(scan)).not.toThrow();
    const plan = createTextChangePlan(scan, 'upper');
    expect(plan.changes[0]?.after).toBe('HELLO 世界');
    expect(await applyFigmaText(api, plan, 'doc-1', '0', () => true)).toMatchObject({
      changed: 1,
      undoGrouped: true,
    });
    expect(text.characters).toBe('HELLO 世界');
    expect(api.commitUndo).toHaveBeenCalledOnce();
    expect(
      await applyFigmaText(api, createTextRestorePlan(plan), 'doc-1', '0', () => true),
    ).toMatchObject({
      changed: 1,
    });
    expect(text.characters).toBe('Hello 世界');
  });

  it('loads all pages and rejects changed text or a hidden selection', async () => {
    const { api, text, group } = fixture();
    const scan = await scanFigmaText(api, 'document', false, 'doc-1', '0');
    expect(api.loadAllPagesAsync).toHaveBeenCalledOnce();
    const plan = createTextChangePlan(scan, 'lower');
    text.characters = 'Changed';
    await expect(applyFigmaText(api, plan, 'doc-1', '0', () => true)).rejects.toThrow(
      '文字、样式或选区已变化',
    );
    group.visible = false;
    const hidden = await scanFigmaText(api, 'selected', false, 'doc-1', '0');
    expect(hidden.targets[0]?.skipReason).toBe('hidden');
  });

  it('limits current area to the active page', async () => {
    const { api } = fixture();
    const area = await scanFigmaText(api, 'area', false, 'doc-1', '0');
    expect(area.targets).toHaveLength(1);
    expect(api.loadAllPagesAsync).not.toHaveBeenCalled();
  });
});
