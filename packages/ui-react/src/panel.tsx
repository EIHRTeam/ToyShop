import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useMemo,
  useState,
  useRef,
  useCallback,
  useSyncExternalStore,
} from 'react';
import type { Dispatch, ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { FieldErrors, Resolver } from 'react-hook-form';
import { Toaster, toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  AstMatrixApplicationService,
  PreviewController,
  InsertController,
} from '@astmatrix/application';
import { AstMatrixError, errorMessage } from '@astmatrix/shared';
import { migrateFields, normalizeRequest, profiles } from '@astmatrix/profiles';
import type { ProfileDefinition } from '@astmatrix/profiles';
import { catalog, getSymbology } from '@astmatrix/symbology-catalog';
import type { CodeTab } from '@astmatrix/symbology-catalog';
import { insertionReason } from '@astmatrix/host-contract';
import type { HostAdapter } from '@astmatrix/host-contract';
import { initialSelection, selectionReducer } from './selection';
import { copySvgToClipboard } from './clipboard';
import { downloadSvg } from './download';
import { LocaleProvider, useLocale } from './l10n';
import { translateMessage } from './l10n/dynamic';
import { translateError, translateValidationError } from './l10n/errors';
import { BrandHeader, ExternalLinkContext, ProjectLinkContext } from './header-actions';
import { contentPlaceholder } from './input-guidance';
import { engineErrorMessage } from './l10n/engine-errors';
import type { SelectionAction, SelectionState } from './selection';

// Later catalog rows take precedence: GS1-128 belongs to Industrial; EAN-14 stays in Retail.
const symbologyCategories = new Map(
  catalog.flatMap((entry) => entry.symbologyIds.map((id) => [id, entry.category] as const)),
);
const symbologyGroups = [
  { category: 'retail', label: '零售' },
  { category: 'industrial', label: '工业' },
  { category: 'publication', label: '出版' },
  { category: 'matrix', label: '矩阵与堆叠' },
].map(({ category, label }) => ({
  category,
  label,
  symbologies: [
    ...new Set(
      catalog.filter((entry) => entry.category === category).flatMap((entry) => entry.symbologyIds),
    ),
  ]
    .filter((id) => symbologyCategories.get(id) === category)
    .map(getSymbology),
}));

const SelectionStateContext = createContext<SelectionState>(initialSelection);
const SelectionDispatchContext = createContext<Dispatch<SelectionAction>>(() => {});
const HostContext = createContext<HostAdapter | null>(null);
const HostStatusContext = createContext<string | undefined>(undefined);
const ServiceContext = createContext<AstMatrixApplicationService | null>(null);
const SettingsContext = createContext({ advanced: false, debounceMs: 150 });
const SettingsDispatchContext = createContext<Dispatch<boolean>>(() => {});
export function AstMatrixProviders({
  service,
  adapter,
  children,
  debounceMs = 150,
  hostLocale,
  openProject,
  openExternal,
  hostStatusMessage,
}: {
  service: AstMatrixApplicationService;
  adapter?: HostAdapter;
  children: ReactNode;
  debounceMs?: number;
  hostLocale?: string;
  openProject?: () => void | Promise<void>;
  openExternal?: (url: string) => void | Promise<void>;
  hostStatusMessage?: string;
}) {
  const [selection, dispatch] = useReducer(selectionReducer, initialSelection);
  const [advanced, setAdvanced] = useReducer((_previous: boolean, next: boolean) => next, false);
  const settings = useMemo(() => ({ advanced, debounceMs }), [advanced, debounceMs]);
  return (
    <LocaleProvider hostLocale={hostLocale}>
      <ExternalLinkContext value={openExternal}>
        <ProjectLinkContext value={openProject}>
          <ServiceContext value={service}>
            <HostContext value={adapter ?? null}>
              <HostStatusContext value={hostStatusMessage}>
                <SettingsContext value={settings}>
                  <SettingsDispatchContext value={setAdvanced}>
                    <SelectionStateContext value={selection}>
                      <SelectionDispatchContext value={dispatch}>
                        <Toaster position="bottom-center" theme="dark" richColors closeButton />
                        {children}
                      </SelectionDispatchContext>
                    </SelectionStateContext>
                  </SettingsDispatchContext>
                </SettingsContext>
              </HostStatusContext>
            </HostContext>
          </ServiceContext>
        </ProjectLinkContext>
      </ExternalLinkContext>
    </LocaleProvider>
  );
}
export const useAstMatrixPreview = (controller: PreviewController) =>
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
export const useInsert = (controller: InsertController) =>
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
export function useHostSnapshot() {
  const adapter = useContext(HostContext);
  if (!adapter) throw new Error('Host Provider required');
  return useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);
}
interface Runtime {
  preview: PreviewController;
}
export function AstMatrixPanel({ showHeader = true }: { showHeader?: boolean }) {
  const service = useContext(ServiceContext);
  const { debounceMs } = useContext(SettingsContext);
  const runtime = useMemo<Runtime>(() => {
    if (!service) throw new Error('Application Provider required');
    const preview = new PreviewController(service, {
      schedule: (callback) => {
        const timer = setTimeout(callback, debounceMs);
        return () => clearTimeout(timer);
      },
    });
    return { preview };
  }, [service, debounceMs]);
  useEffect(() => {
    runtime.preview.activate();
    return () => {
      runtime.preview.dispose();
    };
  }, [runtime]);
  return (
    <main className="astmatrix">
      {showHeader ? <BrandHeader /> : null}
      <Workbench runtime={runtime} />
    </main>
  );
}
function Workbench({ runtime }: { runtime: Runtime }) {
  const { t } = useTranslation();
  const selection = useContext(SelectionStateContext),
    dispatch = useContext(SelectionDispatchContext);
  const settings = useContext(SettingsContext),
    setAdvanced = useContext(SettingsDispatchContext);
  const symbol = getSymbology(selection.symbologyId);
  const p = profiles.find((definition) => definition.id === selection.profileId);
  const [lastProfile, setLastProfile] = useState(profiles[0]!);
  if (p && p !== lastProfile) setLastProfile(p);
  const enabled = symbol.status !== 'listed' && !!p;
  const choose = (action: SelectionAction) => {
    if (
      (action.type === 'tab' && action.tab === selection.tab) ||
      (action.type === 'symbology' && action.id === selection.symbologyId) ||
      (action.type === 'profile' && action.id === selection.profileId)
    )
      return;
    runtime.preview.invalidate();
    dispatch(action);
  };
  return (
    <>
      <div role="tablist" aria-label={t(($) => $.barcode.tabs.categoryLabel)} className="tabs">
        {(['barcode', 'matrix'] as CodeTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={'tab-' + tab}
            aria-controls={'panel-' + selection.tab}
            tabIndex={selection.tab === tab ? 0 : -1}
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 'barcode'
                    : event.key === 'End'
                      ? 'matrix'
                      : selection.tab === 'barcode'
                        ? 'matrix'
                        : 'barcode';
                choose({ type: 'tab', tab: next });
                document.getElementById('tab-' + next)?.focus();
              }
            }}
            aria-selected={selection.tab === tab}
            onClick={() => choose({ type: 'tab', tab })}
          >
            {tab === 'barcode' ? t(($) => $.barcode.tabs.linear) : t(($) => $.barcode.tabs.matrix)}
          </button>
        ))}
      </div>
      <div
        className="workspace"
        role="tabpanel"
        id={'panel-' + selection.tab}
        aria-labelledby={'tab-' + selection.tab}
      >
        <section className="editor" aria-label={t(($) => $.barcode.form.settingsTitle)}>
          <div className="section-heading editor-heading">
            <label className="settings">
              <input
                type="checkbox"
                checked={settings.advanced}
                onChange={(e) => setAdvanced(e.target.checked)}
              />
              {t(($) => $.barcode.form.advancedSettings)}
            </label>
          </div>
          <label className="field">
            {t(($) => $.barcode.form.symbology)}
            <select
              aria-label={t(($) => $.barcode.form.symbology)}
              value={symbol.id}
              onChange={(e) => choose({ type: 'symbology', id: e.target.value })}
            >
              {symbologyGroups.map((group) => {
                const options = group.symbologies
                  .filter((s) => s.tab === selection.tab)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {translateMessage(t, s.label)}
                      {s.status === 'listed' ? ' · ' + t(($) => $.common.notImplemented) : ''}
                    </option>
                  ));
                if (selection.tab === 'matrix') return options;
                return options.length ? (
                  <optgroup key={group.category} label={translateMessage(t, group.label)}>
                    {options}
                  </optgroup>
                ) : null;
              })}
            </select>
          </label>
          <label className="field">
            {t(($) => $.barcode.form.preset)}
            <select
              aria-label={t(($) => $.barcode.form.preset)}
              value={selection.profileId}
              onChange={(e) => choose({ type: 'profile', id: e.target.value })}
            >
              {symbol.profileIds.map((id) => (
                <option key={id} value={id}>
                  {translateMessage(
                    t,
                    profiles.find((candidate) => candidate.id === id)?.label ?? id,
                  )}
                </option>
              ))}
            </select>
          </label>
          {!enabled ? (
            <div role="alert" className="notice">
              {translateMessage(t, symbol.reason)}
            </div>
          ) : null}
          <div hidden={!enabled}>
            <BarcodeForm profile={p ?? lastProfile} runtime={runtime} enabled={enabled} />
          </div>
        </section>
        <PreviewPanel runtime={runtime} />
      </div>
    </>
  );
}
function BarcodeForm({
  profile,
  runtime,
  enabled,
}: {
  profile: ProfileDefinition;
  runtime: Runtime;
  enabled: boolean;
}) {
  const { advanced } = useContext(SettingsContext);
  const { t } = useTranslation();
  const { locale } = useLocale();
  const previousProfile = useRef(profile);
  const currentFields = useCallback(
    (values: Record<string, unknown>) =>
      Object.fromEntries(
        profile.fields.map((field) => [
          field.name,
          values[field.name] === undefined ? profile.defaults[field.name] : values[field.name],
        ]),
      ),
    [profile],
  );

  const resolver: Resolver<Record<string, unknown>> = (values) => {
    try {
      normalizeRequest({
        symbologyId: profile.symbologyId,
        profileId: profile.id,
        fields: currentFields(values),
      });
      return { values: currentFields(values), errors: {} };
    } catch (error) {
      const errors: FieldErrors<Record<string, unknown>> = {};
      if (error instanceof AstMatrixError)
        for (const [field, message] of Object.entries(error.fields))
          errors[field] = { type: 'validate', message };
      return { values: {}, errors };
    }
  };
  const {
    register,
    control,
    reset,
    getValues,
    subscribe,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    defaultValues: { ...profile.defaults, text: '' },
    resolver,
    mode: 'onChange',
  });
  const [checkDigit, hri, text] = useWatch({ control, name: ['checkDigit', 'hri', 'text'] });
  useEffect(() => {
    if (!enabled) return;
    const values = getValues();
    const previous = Object.fromEntries(
      previousProfile.current.fields
        .filter((field) => field.name in values)
        .map((field) => [field.name, values[field.name]]),
    );
    const migrated = migrateFields(previous, profile);
    previousProfile.current = profile;
    reset(migrated.fields);

    const request = (fields: Record<string, unknown>) => {
      if (fields.text === '') {
        runtime.preview.invalidate();
        return;
      }
      runtime.preview.request({
        symbologyId: profile.symbologyId,
        profileId: profile.id,
        fields: currentFields(fields),
      });
    };
    request(migrated.fields);
    return subscribe({
      formState: { values: true },
      callback: ({ values: nextValues }) => request({ ...nextValues }),
    });
  }, [profile, runtime, enabled, reset, getValues, subscribe, currentFields]);
  const preview = useAstMatrixPreview(runtime.preview);
  const fieldErrors =
    preview.status === 'error' && preview.error.layer !== 'provider' ? preview.error.fields : {};
  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="barcode-form">
      {profile.fields
        .filter((f) => !f.advanced || advanced)
        .map((f) => {
          const error =
            f.name === 'text' && text === ''
              ? undefined
              : (fieldErrors[f.name] ?? errors[f.name]?.message);
          const attrs = register(f.name, {
            valueAsNumber: f.kind === 'number' || f.valueType === 'number',
          });
          return (
            <label key={f.name} className={f.kind === 'boolean' ? 'field checkbox' : 'field'}>
              {f.kind === 'boolean' ? (
                <>
                  <input type="checkbox" {...attrs} />
                  {translateMessage(t, f.label)}
                </>
              ) : (
                <>
                  {translateMessage(t, f.label)}
                  {f.kind === 'select' ? (
                    <select {...attrs} aria-label={translateMessage(t, f.label)}>
                      {f.options?.map((v) => (
                        <option key={v} value={v}>
                          {v === 'validate'
                            ? t(($) => $.barcode.form.validateExisting)
                            : v === 'generate'
                              ? t(($) => $.barcode.form.generateAutomatically)
                              : translateMessage(t, v)}
                        </option>
                      ))}
                    </select>
                  ) : f.kind === 'text' && f.name === 'text' ? (
                    <textarea
                      placeholder={translateMessage(
                        t,
                        contentPlaceholder(profile, { checkDigit, hri }),
                      )}
                      rows={4}
                      spellCheck={false}
                      {...attrs}
                      aria-label={translateMessage(t, f.label)}
                      aria-invalid={!!error}
                    />
                  ) : (
                    <input
                      type={f.kind === 'number' ? 'number' : 'text'}
                      step="any"
                      {...attrs}
                      aria-label={translateMessage(t, f.label)}
                      aria-invalid={!!error}
                    />
                  )}
                </>
              )}
              {error ? (
                <span className="field-error" role="alert">
                  {translateValidationError(t, String(error), locale)}
                </span>
              ) : null}
            </label>
          );
        })}
    </form>
  );
}
function PreviewPanel({ runtime }: { runtime: Runtime }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const preview = useAstMatrixPreview(runtime.preview);
  const adapter = useContext(HostContext);
  const [copyResult, setCopyResult] = useState<{
    revision: number;
    status: 'pending' | 'success' | 'error';
    message?: string;
  } | null>(null);
  const copyFeedback = copyResult?.revision === preview.revision ? copyResult : null;
  const copying = copyFeedback?.status === 'pending';
  const ready = preview.status === 'ready' ? preview.barcode : null;
  const copySvg = async () => {
    if (!ready || copying) return;
    const revision = preview.revision;
    setCopyResult({ revision, status: 'pending' });
    try {
      await copySvgToClipboard(ready.svg);
      setCopyResult((current) =>
        current?.revision === revision ? { revision, status: 'success' } : current,
      );
    } catch (error) {
      console.error('[ToyShop] SVG copy failed:', error);
      setCopyResult((current) =>
        current?.revision === revision
          ? { revision, status: 'error', message: errorMessage(error) }
          : current,
      );
    }
  };
  const saveSvg = () => {
    if (!ready) return;
    try {
      downloadSvg(ready.svg, `astmatrix-${ready.request.symbologyId}.svg`);
    } catch (error) {
      console.error('[ToyShop] SVG download failed:', error);
      toast.error(t(($) => $.preview.downloadFailed));
    }
  };
  const copyButton = (
    <button
      type="button"
      onClick={() => void copySvg()}
      disabled={!ready}
      aria-disabled={copying || undefined}
      aria-busy={copying}
    >
      {copying ? t(($) => $.preview.copying) : t(($) => $.preview.copySvg)}
    </button>
  );
  return (
    <section className="preview" aria-label={t(($) => $.preview.title)}>
      <div className="section-heading">
        <span>{t(($) => $.preview.title)}</span>
        {preview.status === 'pending' || preview.status === 'error' ? (
          <output className="status">
            {preview.status === 'pending'
              ? t(($) => $.preview.generating)
              : t(($) => $.preview.needsCorrection)}
          </output>
        ) : null}
      </div>
      <div className="preview-stage">
        {ready ? (
          <img
            alt={t(($) => $.preview.vectorAlt, {
              symbology: translateMessage(t, getSymbology(ready.request.symbologyId).label),
            })}
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(ready.svg)}`}
          />
        ) : (
          <div className="placeholder">
            <span aria-hidden="true">▥</span>
            <p>
              {preview.status === 'pending'
                ? t(($) => $.preview.generatingVector)
                : t(($) => $.preview.enterValidContent)}
            </p>
          </div>
        )}
      </div>
      {preview.status === 'error' ? (
        <div className="error" role="alert">
          {preview.error.layer === 'provider' ? (
            <>
              {t(($) => $.preview.engineError, {
                message: translateMessage(t, engineErrorMessage(preview.error)),
              })}
            </>
          ) : (
            <>
              {t(($) => $.preview.validationError, {
                message: translateValidationError(t, preview.error.message, locale),
              })}
            </>
          )}
        </div>
      ) : null}
      {adapter ? (
        <HostPreviewActions runtime={runtime} adapter={adapter}>
          {copyButton}
        </HostPreviewActions>
      ) : (
        <div className="actions">
          <button type="button" className="primary" disabled={!ready} onClick={saveSvg}>
            {t(($) => $.preview.downloadSvg)}
          </button>
          {copyButton}
        </div>
      )}
      {copyFeedback?.status === 'success' ? (
        <output className="success">{t(($) => $.preview.svgCopied)}</output>
      ) : copyFeedback?.status === 'error' ? (
        <p role="alert" className="error">
          {t(($) => $.preview.copyError, {
            message: translateError(t, copyFeedback.message),
          })}
        </p>
      ) : null}
    </section>
  );
}

function HostPreviewActions({
  runtime,
  adapter,
  children,
}: {
  runtime: Runtime;
  adapter: HostAdapter;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const controller = useMemo(
    () => new InsertController(adapter, runtime.preview),
    [adapter, runtime.preview],
  );
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    controller.activate();
    return () => {
      mounted.current = false;
      controller.dispose();
    };
  }, [controller]);
  const preview = useAstMatrixPreview(runtime.preview);
  const insert = useInsert(controller);
  const host = useHostSnapshot();
  const hostStatusMessage = useContext(HostStatusContext);
  const ready = preview.status === 'ready' ? preview.barcode : null;
  const fake = adapter.id === 'development-fake';
  const insertionMessage = hostStatusMessage ?? (ready ? insertionReason(host, ready.scene) : null);
  const reason =
    insert.status === 'pending'
      ? t(($) => $.preview.insertingPleaseWait)
      : insertionMessage && translateError(t, insertionMessage);
  const insertScene = async () => {
    try {
      const result = await controller.insert();
      if (!mounted.current) return;
      toast.success(
        fake ? t(($) => $.preview.simulatedInsertSucceeded) : t(($) => $.preview.insertSucceeded),
        { description: `${result.objectId} / ${result.documentId}` },
      );
    } catch (error) {
      if (!mounted.current) return;
      console.error('[ToyShop] insertion failed:', error);
      toast.error(
        error instanceof AstMatrixError
          ? t(($) => $.common.errorWithCode, {
              code: error.code,
              message: translateError(t, error),
            })
          : translateError(t, error),
      );
    }
  };
  return (
    <>
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={!ready || !!reason}
          onClick={() => void insertScene()}
        >
          {insert.status === 'pending'
            ? fake
              ? t(($) => $.preview.simulatingInsert)
              : t(($) => $.preview.inserting)
            : fake
              ? t(($) => $.preview.simulateInsert)
              : t(($) => $.preview.insertDocument)}
        </button>
        {children}
      </div>
      {reason ? <p className="hint">{reason}</p> : null}
    </>
  );
}
