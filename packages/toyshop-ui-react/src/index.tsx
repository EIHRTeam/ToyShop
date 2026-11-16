import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { TOYSHOP_ISSUES_URL, TOYSHOP_PROJECT_URL } from '@astmatrix/shared';
import { BrandHeader, translateError, translateMessage } from '@astmatrix/ui-react';
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
  TextChangePlan,
  TextSkipReason,
} from '@toyshop/module-text-case';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';

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
  const { t } = useTranslation();
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [textUndoPlan, setTextUndoPlan] = useState<TextChangePlan | null>(null);
  const lastModuleId = useRef<string | null>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const current = moduleId ? toyshopModules.get(moduleId) : undefined;
  const textCaseName = t(($) => $.textCase.title);
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
              aria-label={t(($) => $.toolbox.back)}
              title={t(($) => $.toolbox.back)}
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
              <TextCaseBrowser />
            )}
          </div>
        </section>
      ) : (
        <main className="toyshop-home">
          <h2>{t(($) => $.toolbox.title)}</h2>
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
                      ? t(($) => $.toolbox.barcodeTool)
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
  const { t } = useTranslation();
  const [operation, setOperation] = useState<TextCaseOperation>('upper');
  const [scope, setScope] = useState<'selected' | 'document'>('selected');
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
        toast.info(t(($) => $.textCase.status.changed, { count: 0 }));
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
        ? t(($) => $.textCase.status.changedWithFailures, {
            count: result.changed,
            failed: result.failed.length,
          })
        : t(($) => $.textCase.status.changed, { count: result.changed });
      if (result.failed.length) toast.error(message);
      else toast.success(message);
      setSkipped(plan.skipped);
    } catch (cause) {
      console.error('[ToyShop] text conversion failed:', cause);
      toast.error(translateError(t, cause));
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
        ? t(($) => $.textCase.status.restoredWithFailures, {
            count: result.changed,
            failed: result.failed.length,
          })
        : t(($) => $.textCase.status.restored, { count: result.changed });
      if (result.failed.length) toast.error(message);
      else toast.success(message);
    } catch (cause) {
      console.error('[ToyShop] text restoration failed:', cause);
      toast.error(translateError(t, cause));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="toyshop-text-case">
      <label className="field" htmlFor="toyshop-operation">
        {t(($) => $.textCase.operationLabel)}
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
          <option value="sentence">{t(($) => $.textCase.sentenceCaseExperimental)}</option>
        </select>
      </label>
      <div className="field">
        <span id="toyshop-scope-label">{t(($) => $.textCase.scopeLabel)}</span>
        <Tabs
          value={scope}
          onValueChange={(value) => {
            clearResult();
            setScope(value === 'document' ? 'document' : 'selected');
          }}
        >
          <TabsList className="toyshop-scope-tabs" aria-labelledby="toyshop-scope-label">
            <TabsTrigger value="selected" disabled={busy}>
              {t(($) => $.textCase.selectedObjects)}
            </TabsTrigger>
            <TabsTrigger value="document" disabled={busy}>
              {t(($) => $.textCase.entireDocument)}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
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
        {t(($) => $.textCase.includeHidden)}
      </label>
      <div className="actions toyshop-actions">
        <button className="primary" type="button" disabled={busy} onClick={() => void convert()}>
          {busy ? t(($) => $.common.working) : t(($) => $.common.convert)}
        </button>
        <button type="button" disabled={busy || !undoPlan} onClick={() => void undo()}>
          {t(($) => $.common.undo)}
        </button>
      </div>
      {skipped.length ? (
        <div className="toyshop-skipped">
          <p>{t(($) => $.textCase.status.skipped, { count: skipped.length })}</p>
          {skipped.slice(0, 10).map((item) => (
            <p key={item.id}>
              {t(($) => $.textCase.skippedItem, {
                name: item.name,
                reason: translateMessage(t, skipLabels[item.reason]),
              })}
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

function TextCaseBrowser() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [operation, setOperation] = useState<TextCaseOperation>('upper');
  const [previous, setPrevious] = useState<string | null>(null);

  return (
    <div className="toyshop-text-case">
      <label className="field" htmlFor="toyshop-operation">
        {t(($) => $.textCase.operationLabel)}
        <select
          id="toyshop-operation"
          aria-label={t(($) => $.textCase.operationLabel)}
          value={operation}
          onChange={(event) => setOperation(event.target.value as TextCaseOperation)}
        >
          <option value="upper">{t(($) => $.textCase.uppercase)}</option>
          <option value="lower">{t(($) => $.textCase.lowercase)}</option>
        </select>
      </label>
      <label className="field" htmlFor="toyshop-input">
        {t(($) => $.textCase.inputText)}
        <textarea
          id="toyshop-input"
          aria-label={t(($) => $.textCase.inputText)}
          rows={4}
          spellCheck={false}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
      </label>
      <div className="actions toyshop-actions">
        <button
          className="primary"
          type="button"
          onClick={() => {
            setPrevious(output);
            setOutput(convertTextCase(input, operation));
            toast.success(t(($) => $.textCase.status.changed, { count: 1 }));
          }}
        >
          {t(($) => $.common.convert)}
        </button>
        <button
          type="button"
          disabled={previous === null}
          onClick={() => {
            setOutput(previous!);
            setPrevious(null);
            toast.success(t(($) => $.textCase.status.restored, { count: 1 }));
          }}
        >
          {t(($) => $.common.undo)}
        </button>
      </div>
      <label className="field" htmlFor="toyshop-output">
        {t(($) => $.textCase.outputText)}
        <textarea id="toyshop-output" rows={4} spellCheck={false} readOnly value={output} />
      </label>
    </div>
  );
}
