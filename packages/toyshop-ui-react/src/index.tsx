import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { toast } from 'sonner';
import { errorMessage, TOYSHOP_ISSUES_URL, TOYSHOP_PROJECT_URL } from '@astmatrix/shared';
import { BrandHeader, useLocale } from '@astmatrix/ui-react';
import { ModuleRegistry } from '@toyshop/core';
import { astmatrixModule } from '@toyshop/module-astmatrix';
import {
  convertTextCase,
  createTextChangePlan,
  createTextRestorePlan,
  textCaseModule,
} from '@toyshop/module-text-case';
import type {
  TextCaseHost,
  TextCaseOperation,
  TextCaseScope,
  TextChangePlan,
  TextSkipReason,
} from '@toyshop/module-text-case';

const toyshopModules = new ModuleRegistry([textCaseModule, astmatrixModule]);
const toyshopProduct = {
  name: 'ToyShop',
  projectUrl: TOYSHOP_PROJECT_URL,
  issuesUrl: TOYSHOP_ISSUES_URL,
};
const skipLabels: Record<TextSkipReason, string> = {
  hidden: '隐藏对象',
  locked: '锁定对象',
  'read-only': '不可编辑对象',
  'rich-text': '复杂样式文字',
  'missing-font': '缺失字体',
  instance: '组件实例',
  'bound-variable': '变量绑定文字',
};

export function ToyshopPanel({
  astmatrix: AstMatrixContent,
  textCaseHost,
}: {
  astmatrix: ComponentType<{ showHeader?: boolean }>;
  textCaseHost?: TextCaseHost;
}) {
  const { t } = useLocale();
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [textUndoPlan, setTextUndoPlan] = useState<TextChangePlan | null>(null);
  const lastModuleId = useRef<string | null>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const current = moduleId ? toyshopModules.get(moduleId) : undefined;
  const textCaseName = t('英文大小写转换');
  const currentName = current?.id === textCaseModule.id ? textCaseName : current?.name;

  useEffect(() => {
    if (moduleId) backButton.current?.focus();
    else if (lastModuleId.current)
      document.getElementById(`toyshop-module-${lastModuleId.current}`)?.focus();
  }, [moduleId]);

  return (
    <div className="toyshop-shell">
      <BrandHeader product={toyshopProduct} className="toyshop-header" />
      {current ? (
        <section className="toyshop-module-panel" aria-label={currentName}>
          <header className="toyshop-module-toolbar">
            <button
              ref={backButton}
              className="toyshop-back"
              type="button"
              aria-label={t('返回工具箱')}
              title={t('返回工具箱')}
              onClick={() => setModuleId(null)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path
                  d="M19 12H5m7-7-7 7 7 7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <h2>{currentName}</h2>
          </header>
          <div className="toyshop-workspace">
            {moduleId === astmatrixModule.id ? (
              <AstMatrixContent showHeader={false} />
            ) : textCaseHost ? (
              <TextCaseWorkspace
                host={textCaseHost}
                undoPlan={textUndoPlan}
                setUndoPlan={setTextUndoPlan}
              />
            ) : (
              <TextCaseDemo />
            )}
          </div>
        </section>
      ) : (
        <main className="toyshop-home">
          <h2>{t('工具箱')}</h2>
          <div className="toyshop-tool-grid">
            {toyshopModules.list().map((module) => (
              <button
                key={module.id}
                id={`toyshop-module-${module.id}`}
                className="toyshop-tool-card"
                type="button"
                onClick={() => {
                  lastModuleId.current = module.id;
                  setModuleId(module.id);
                }}
              >
                <span className="toyshop-tool-icon" aria-hidden="true">
                  {module.id === astmatrixModule.id ? <BarcodeIcon /> : 'Aa'}
                </span>
                <span className="toyshop-tool-name">
                  {module.id === textCaseModule.id
                    ? textCaseName
                    : module.id === astmatrixModule.id
                      ? t('二维码 / 条形码生成')
                      : module.name}
                </span>
                <span className="toyshop-tool-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}

function TextCaseWorkspace({
  host,
  undoPlan,
  setUndoPlan,
}: {
  host: TextCaseHost;
  undoPlan: TextChangePlan | null;
  setUndoPlan: (plan: TextChangePlan | null) => void;
}) {
  const { t } = useLocale();
  const [operation, setOperation] = useState<TextCaseOperation>('upper');
  const [scope, setScope] = useState<TextCaseScope>('selected');
  const [includeHidden, setIncludeHidden] = useState(false);
  const [skipped, setSkipped] = useState<TextChangePlan['skipped']>([]);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const clearResult = () => {
    setSkipped([]);
  };
  const convert = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    clearResult();
    try {
      const scan = await host.scan(scope, includeHidden);
      const plan = createTextChangePlan(scan, operation);
      if (!plan.changes.length) {
        toast.info(`${t('已修改')} 0 ${t('项。')}`);
        setSkipped(plan.skipped);
        return;
      }
      setUndoPlan(null);
      const result = await host.apply(plan);
      setUndoPlan(
        result.changed === plan.changes.length && !result.failed.length
          ? createTextRestorePlan(plan)
          : null,
      );
      const message = result.failed.length
        ? `${t('已修改')} ${result.changed} ${t('项；失败')} ${result.failed.length} ${t('项。')}`
        : `${t('已修改')} ${result.changed} ${t('项。')}`;
      if (result.failed.length) toast.error(message);
      else toast.success(message);
      setSkipped(plan.skipped);
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const undo = async () => {
    if (!undoPlan || working.current) return;
    working.current = true;
    setBusy(true);
    clearResult();
    try {
      const result = await host.apply(undoPlan);
      setUndoPlan(null);
      const message = result.failed.length
        ? `${t('已撤销')} ${result.changed} ${t('项；失败')} ${result.failed.length} ${t('项。')}`
        : `${t('已撤销')} ${result.changed} ${t('项。')}`;
      if (result.failed.length) toast.error(message);
      else toast.success(message);
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="toyshop-text-case">
      <label className="field" htmlFor="toyshop-operation">
        {t('转换方式')}
        <select
          id="toyshop-operation"
          value={operation}
          disabled={busy}
          onChange={(event) => {
            clearResult();
            setOperation(event.target.value as TextCaseOperation);
          }}
        >
          <option value="upper">UPPERCASE</option>
          <option value="lower">lowercase</option>
          <option value="sentence">{t('句首大写（实验性）')}</option>
        </select>
      </label>
      <label className="field" htmlFor="toyshop-scope">
        {t('处理范围')}
        <select
          id="toyshop-scope"
          value={scope}
          disabled={busy}
          onChange={(event) => {
            clearResult();
            setScope(event.target.value as TextCaseScope);
          }}
        >
          <option value="selected">{t('选中对象')}</option>
          {host.supportsCurrentArea ? <option value="area">{t('当前页面或画板')}</option> : null}
          <option value="document">{t('整个文档')}</option>
        </select>
      </label>
      <label className="toyshop-check">
        <input
          type="checkbox"
          checked={includeHidden}
          disabled={busy}
          onChange={(event) => {
            clearResult();
            setIncludeHidden(event.target.checked);
          }}
        />
        {t('包含隐藏对象')}
      </label>
      <div className="actions toyshop-actions">
        <button className="primary" type="button" disabled={busy} onClick={() => void convert()}>
          {busy ? t('处理中…') : t('转换')}
        </button>
        <button type="button" disabled={busy || !undoPlan} onClick={() => void undo()}>
          {t('撤销')}
        </button>
      </div>
      {skipped.length ? (
        <div className="toyshop-skipped">
          <p>
            {t('跳过')} {skipped.length} {t('项。')}
          </p>
          {skipped.slice(0, 10).map((item) => (
            <p key={item.id}>
              {item.name}：{t(skipLabels[item.reason])}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BarcodeIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="currentColor" aria-hidden="true">
      <path d="M3 4h2v20H3zm4 0h1v20H7zm3 0h3v20h-3zm5 0h1v20h-1zm3 0h2v20h-2zm4 0h1v20h-1zm3 0h1v20h-1z" />
    </svg>
  );
}

function TextCaseDemo() {
  const { t } = useLocale();
  const [input, setInput] = useState('Hello Café 世界 WORLD');
  const [operation, setOperation] = useState<TextCaseOperation>('upper');
  const [previous, setPrevious] = useState<string | null>(null);

  return (
    <div className="toyshop-text-case">
      <label className="field" htmlFor="toyshop-operation">
        {t('转换方式')}
        <select
          id="toyshop-operation"
          aria-label={t('转换方式')}
          value={operation}
          onChange={(event) => setOperation(event.target.value as TextCaseOperation)}
        >
          <option value="upper">{t('大写')}</option>
          <option value="lower">{t('小写')}</option>
        </select>
      </label>
      <label className="field" htmlFor="toyshop-input">
        {t('示例文字')}
        <textarea
          id="toyshop-input"
          aria-label={t('示例文字')}
          rows={4}
          spellCheck={false}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setPrevious(null);
          }}
        />
      </label>
      <div className="actions toyshop-actions">
        <button
          className="primary"
          type="button"
          onClick={() => {
            setPrevious(input);
            setInput(convertTextCase(input, operation));
            toast.success(t('已修改') + ' 1 ' + t('项。'));
          }}
        >
          {t('转换')}
        </button>
        <button
          type="button"
          disabled={previous === null}
          onClick={() => {
            setInput(previous!);
            setPrevious(null);
            toast.success(t('已撤销') + ' 1 ' + t('项。'));
          }}
        >
          {t('撤销')}
        </button>
      </div>
    </div>
  );
}
