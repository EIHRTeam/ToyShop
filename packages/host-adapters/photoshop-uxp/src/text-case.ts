/* oxlint-disable no-await-in-loop -- Layer reads and modal edits must stay ordered. */
import { HostError } from '@astmatrix/host-contract';
import { assertPlanCurrent } from '@toyshop/module-text-case';
import type {
  TextApplyReport,
  TextCaseScope,
  TextChangePlan,
  TextScan,
  TextTarget,
} from '@toyshop/module-text-case';
import type { PhotoshopRuntime, PsDocument, PsLayer } from './runtime';

type TextDescriptor = {
  textKey?: {
    textStyleRange?: unknown[];
    paragraphStyleRange?: unknown[];
  };
};

function rangeStyle(range: unknown): string | null {
  if (!range || typeof range !== 'object' || Array.isArray(range)) return null;
  const { from: _from, to: _to, ...properties } = range as Record<string, unknown>;
  return JSON.stringify(properties);
}

function hasDifferentStyles(ranges: unknown[]): boolean {
  const first = rangeStyle(ranges[0]);
  return first === null || ranges.some((range) => rangeStyle(range) !== first);
}

export class PhotoshopTextCaseHost {
  private busy = false;
  private readonly ps: PhotoshopRuntime;
  private readonly snapshot: () => { documentId: string | null; revision: number };
  constructor(
    ps: PhotoshopRuntime,
    snapshot: () => { documentId: string | null; revision: number },
  ) {
    this.ps = ps;
    this.snapshot = snapshot;
  }

  private document(): PsDocument {
    if (!this.ps.app.documents.length) throw new HostError('NO_DOCUMENT', '请先打开文档');
    return this.ps.app.activeDocument;
  }

  private async style(layer: PsLayer): Promise<{ fingerprint: string; rich: boolean }> {
    const result = await this.ps.action.batchPlay(
      [{ _obj: 'get', _target: [{ _ref: 'layer', _id: layer.id }] }],
      {},
    );
    const descriptor = result[0] as TextDescriptor | undefined;
    const key = descriptor?.textKey;
    if (!key?.textStyleRange?.length || !key.paragraphStyleRange?.length)
      return { fingerprint: '', rich: true };
    return {
      fingerprint: JSON.stringify([key.textStyleRange, key.paragraphStyleRange]),
      rich: hasDifferentStyles(key.textStyleRange) || hasDifferentStyles(key.paragraphStyleRange),
    };
  }

  async scan(scope: TextCaseScope, includeHidden: boolean): Promise<TextScan> {
    if (scope === 'area')
      throw new HostError('UNSUPPORTED_FEATURE', 'Photoshop 无可靠的当前区域范围');
    const doc = this.document();
    const state = this.snapshot();
    const roots = scope === 'selected' ? [...doc.activeLayers] : [...(doc.layers ?? [])];
    const selectionFingerprint = doc.activeLayers
      .map((layer) => layer.id)
      .sort()
      .join('|');
    const targets: TextTarget[] = [];
    const seen = new Set<number>();
    let characters = 0;
    const visit = async (layer: PsLayer, hidden: boolean, locked: boolean): Promise<void> => {
      if (seen.has(layer.id)) return;
      seen.add(layer.id);
      let parent = layer.parent;
      while (parent) {
        hidden ||= parent.visible === false;
        locked ||= parent.locked === true;
        parent = parent.parent;
      }
      hidden ||= layer.visible === false;
      locked ||= layer.locked === true;
      if (layer.textItem) {
        characters += layer.textItem.contents.length;
        if (targets.length >= 10000 || characters > 1000000)
          throw new HostError('UNSUPPORTED_FEATURE', '文字扫描超过单次处理上限，请缩小选区');
        const style = await this.style(layer);
        const skipReason = locked
          ? 'locked'
          : hidden && !includeHidden
            ? 'hidden'
            : style.rich
              ? 'rich-text'
              : undefined;
        targets.push({
          id: String(layer.id),
          name: layer.name,
          text: layer.textItem.contents,
          styleFingerprint: style.fingerprint,
          ...(skipReason ? { skipReason } : {}),
        });
      }
      for (const child of layer.layers ?? []) await visit(child, hidden, locked);
    };
    for (const root of roots) await visit(root, false, false);
    if (
      this.snapshot().documentId !== state.documentId ||
      this.snapshot().revision !== state.revision ||
      (scope === 'selected' &&
        doc.activeLayers
          .map((layer) => layer.id)
          .sort()
          .join('|') !== selectionFingerprint)
    )
      throw new HostError('DOCUMENT_CHANGED', '扫描期间文档已变化');
    return {
      documentId: state.documentId!,
      revision: String(state.revision),
      scope,
      includeHidden,
      selectionFingerprint,
      targets,
    };
  }

  async apply(plan: TextChangePlan): Promise<TextApplyReport> {
    if (this.busy) throw new HostError('HOST_BUSY', '已有文字修改任务');
    this.busy = true;
    try {
      const before = await this.scan(plan.scope, plan.includeHidden);
      try {
        assertPlanCurrent(plan, before);
      } catch {
        throw new HostError('DOCUMENT_CHANGED', '文档、选区、文字或样式已变化，请重试');
      }
      if (!plan.changes.length) return { changed: 0, failed: [], undoGrouped: true };
      const doc = this.document();
      return await this.ps.core.executeAsModal(
        async (context) => {
          const latest = await this.scan(plan.scope, plan.includeHidden);
          try {
            assertPlanCurrent(plan, latest);
          } catch {
            throw new HostError('DOCUMENT_CHANGED', '文字或样式已变化，请重试');
          }
          const suspension = await context.hostControl.suspendHistory({
            documentID: doc.id,
            name: 'ToyShop 大小写转换',
          });
          try {
            let changed = 0;
            for (const change of plan.changes) {
              if (context.isCancelled) throw new HostError('CANCELLED', '操作已取消');
              const state = this.snapshot();
              if (state.documentId !== plan.documentId || String(state.revision) !== plan.revision)
                throw new HostError('DOCUMENT_CHANGED', '文档已变化');
              const layer = this.findLayer(doc.layers ?? [], Number(change.id));
              if (!layer?.textItem || layer.textItem.contents !== change.before)
                throw new HostError('DOCUMENT_CHANGED', '文字对象已变化');
              let ancestor: PsLayer | undefined = layer;
              while (ancestor) {
                if (ancestor.locked || (ancestor.visible === false && !plan.includeHidden))
                  throw new HostError('DOCUMENT_CHANGED', '文字对象已锁定或隐藏');
                ancestor = ancestor.parent;
              }
              layer.textItem.contents = change.after;
              const style = await this.style(layer);
              if (style.fingerprint !== change.styleFingerprint || style.rich)
                throw new HostError('UNSUPPORTED_FEATURE', '写入后样式发生变化，已回滚');
              changed++;
            }
            await context.hostControl.resumeHistory(suspension, true);
            return { changed, failed: [], undoGrouped: true };
          } catch (error) {
            try {
              await context.hostControl.resumeHistory(suspension, false);
            } catch {
              throw new HostError('ROLLBACK_FAILED', '文字写入失败且历史回滚失败');
            }
            throw error;
          }
        },
        { commandName: 'ToyShop 大小写转换' },
      );
    } finally {
      this.busy = false;
    }
  }

  private findLayer(layers: PsLayer[], id: number): PsLayer | undefined {
    for (const layer of layers) {
      if (layer.id === id) return layer;
      const child = this.findLayer(layer.layers ?? [], id);
      if (child) return child;
    }
    return undefined;
  }
}
