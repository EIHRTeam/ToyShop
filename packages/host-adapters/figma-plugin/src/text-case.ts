/* oxlint-disable no-await-in-loop -- Fonts and edits are ordered before a single undo boundary. */
import { HostError } from '@astmatrix/host-contract';
import { assertPlanCurrent } from '@toyshop/module-text-case';
import type {
  TextApplyReport,
  TextCaseScope,
  TextChangePlan,
  TextScan,
  TextTarget,
} from '@toyshop/module-text-case';

type TextFigmaAPI = Pick<
  PluginAPI,
  'root' | 'currentPage' | 'loadAllPagesAsync' | 'loadFontAsync' | 'getNodeByIdAsync' | 'commitUndo'
>;

const styleFields = [
  'fontName',
  'fontSize',
  'fontWeight',
  'fills',
  'letterSpacing',
  'lineHeight',
  'textCase',
  'textDecoration',
  'paragraphIndent',
  'paragraphSpacing',
  'indentation',
  'listOptions',
  'openTypeFeatures',
  'textStyleId',
  'fillStyleId',
  'boundVariables',
] as const;

function textTarget(node: TextNode, includeHidden: boolean): TextTarget {
  let ancestor: BaseNode | null = node;
  let hidden = false;
  let locked = false;
  let instance = false;
  while (ancestor) {
    if ('visible' in ancestor && !ancestor.visible) hidden = true;
    if ('locked' in ancestor && ancestor.locked) locked = true;
    if (ancestor.type === 'INSTANCE') instance = true;
    ancestor = ancestor.parent;
  }
  const segments = node.getStyledTextSegments([...styleFields]);
  const hasBindings =
    Boolean(node.boundVariables && Object.keys(node.boundVariables).length) ||
    segments.some((segment) =>
      Boolean(segment.boundVariables && Object.keys(segment.boundVariables).length),
    );
  const skipReason = locked
    ? 'locked'
    : hidden && !includeHidden
      ? 'hidden'
      : instance
        ? 'instance'
        : node.hasMissingFont
          ? 'missing-font'
          : hasBindings
            ? 'bound-variable'
            : segments.length > 1 || typeof node.fontName === 'symbol'
              ? 'rich-text'
              : undefined;
  return {
    id: node.id,
    name: node.name,
    text: node.characters,
    styleFingerprint: JSON.stringify(
      segments.map(({ characters: _characters, ...style }) => style),
    ),
    ...(skipReason ? { skipReason } : {}),
  };
}

/** Insert before the old character using its style, then delete that old character. */
function replaceEqualLength(node: TextNode, before: string, after: string): void {
  if (before.length !== after.length || node.characters !== before)
    throw new HostError('DOCUMENT_CHANGED', '文字已变化，请重试');
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === after[i]) continue;
    node.insertCharacters(i, after[i]!, 'AFTER');
    try {
      node.deleteCharacters(i + 1, i + 2);
    } catch (error) {
      node.deleteCharacters(i, i + 1);
      throw error;
    }
  }
}

export async function scanFigmaText(
  api: TextFigmaAPI,
  scope: TextCaseScope,
  includeHidden: boolean,
  documentId: string,
  revision: string,
): Promise<TextScan> {
  if (scope === 'document') await api.loadAllPagesAsync();
  const roots =
    scope === 'selected'
      ? [...api.currentPage.selection]
      : scope === 'area'
        ? [api.currentPage]
        : [...api.root.children];
  const selectionFingerprint = api.currentPage.selection
    .map((node) => node.id)
    .sort()
    .join('|');
  const targets: TextTarget[] = [];
  const seen = new Set<string>();
  let characters = 0;
  const visit = (node: SceneNode | PageNode) => {
    if (node.type === 'TEXT' && !seen.has(node.id)) {
      seen.add(node.id);
      characters += node.characters.length;
      if (seen.size > 10000 || characters > 1000000)
        throw new HostError('UNSUPPORTED_FEATURE', '文字扫描超过单次处理上限，请缩小选区');
      targets.push(textTarget(node, includeHidden));
    }
    if ('children' in node) for (const child of node.children) visit(child);
  };
  for (const root of roots) visit(root);
  return { documentId, revision, scope, includeHidden, selectionFingerprint, targets };
}

export async function applyFigmaText(
  api: TextFigmaAPI,
  plan: TextChangePlan,
  documentId: string,
  revision: string,
  isCurrent: () => boolean,
): Promise<TextApplyReport> {
  if (!isCurrent() || documentId !== plan.documentId || revision !== plan.revision)
    throw new HostError('DOCUMENT_CHANGED', '文档或页面已变化，请重试');
  const before = await scanFigmaText(api, plan.scope, plan.includeHidden, documentId, revision);
  try {
    assertPlanCurrent(plan, before);
  } catch {
    throw new HostError('DOCUMENT_CHANGED', '文字、样式或选区已变化，请重试');
  }
  const nodes: TextNode[] = [];
  for (const change of plan.changes) {
    const node = await api.getNodeByIdAsync(change.id);
    if (!node || node.type !== 'TEXT' || typeof node.fontName === 'symbol')
      throw new HostError('DOCUMENT_CHANGED', '文字对象已变化，请重试');
    await api.loadFontAsync(node.fontName);
    nodes.push(node);
  }
  const ready = await scanFigmaText(api, plan.scope, plan.includeHidden, documentId, revision);
  if (!isCurrent()) throw new HostError('DOCUMENT_CHANGED', '字体加载期间页面已变化');
  try {
    assertPlanCurrent(plan, ready);
  } catch {
    throw new HostError('DOCUMENT_CHANGED', '字体加载期间文档已变化，请重试');
  }
  const applied: { node: TextNode; before: string }[] = [];
  try {
    for (let i = 0; i < plan.changes.length; i++) {
      if (!isCurrent()) throw new HostError('DOCUMENT_CHANGED', '页面已变化');
      const node = nodes[i]!;
      const change = plan.changes[i]!;
      applied.push({ node, before: change.before });
      replaceEqualLength(node, change.before, change.after);
      if (textTarget(node, plan.includeHidden).styleFingerprint !== change.styleFingerprint)
        throw new HostError('UNSUPPORTED_FEATURE', '转换后样式发生变化，已恢复原文');
    }
  } catch (error) {
    try {
      for (const item of applied.reverse())
        replaceEqualLength(item.node, item.node.characters, item.before);
    } catch {
      throw new HostError('ROLLBACK_FAILED', '文字转换失败且恢复原文失败');
    }
    throw error;
  }
  if (applied.length) api.commitUndo();
  return { changed: applied.length, failed: [], undoGrouped: true };
}
