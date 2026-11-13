import { createContext, useContext, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import * as Dialog from 'radix-ui/dialog';
import * as Popover from 'radix-ui/popover';
import { useTranslation } from 'react-i18next';
import {
  ISSUES_URL,
  LICENSE_URL,
  PROJECT_URL,
  PROJECT_VERSION,
  openSourceProjects,
} from '@astmatrix/shared';
import { useLocale } from './l10n';
import type { LanguagePreference } from './l10n';

export const ProjectLinkContext = createContext<(() => void | Promise<void>) | undefined>(
  undefined,
);
export const ExternalLinkContext = createContext<
  ((url: string) => void | Promise<void>) | undefined
>(undefined);
const githubIcon = new URL('./assets/GitHub_Invertocat_Black.svg', import.meta.url).href;
export interface HeaderProduct {
  name: string;
  projectUrl: string;
  issuesUrl: string;
}
const astmatrixProduct: HeaderProduct = {
  name: 'AstMatrix',
  projectUrl: PROJECT_URL,
  issuesUrl: ISSUES_URL,
};

export function BrandHeader({
  product = astmatrixProduct,
  className = '',
}: {
  product?: HeaderProduct;
  className?: string;
}) {
  return (
    <header className={className ? `brand ${className}` : 'brand'}>
      <div className="brand-mark" aria-hidden="true">
        ▥
      </div>
      <h1>{product.name}</h1>
      <HeaderActions product={product} />
    </header>
  );
}
function LanguageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" />
    </svg>
  );
}
function AboutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v7M12 7v1" />
    </svg>
  );
}
function IssueIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6m0 3v1" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-4 16" />
    </svg>
  );
}
function ExternalArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}
function ExternalLink({
  href,
  label,
  title,
  children,
  className,
  onError,
}: {
  href: string;
  label?: string;
  title?: string;
  children: ReactNode;
  className?: string;
  onError: (url: string | null) => void;
}) {
  const openExternal = useContext(ExternalLinkContext);
  const openProject = useContext(ProjectLinkContext);
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    onError(null);
    const callback = openExternal
      ? () => openExternal(href)
      : href === PROJECT_URL
        ? openProject
        : undefined;
    if (!callback) return;
    event.preventDefault();
    try {
      void Promise.resolve(callback()).catch(() => onError(href));
    } catch {
      onError(href);
    }
  };
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={title}
      onClick={open}
    >
      {children}
    </a>
  );
}
const languages: { value: LanguagePreference; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
];
function LanguageMenu() {
  const { preference, setPreference } = useLocale();
  const { t } = useTranslation();
  const options = [{ value: 'auto' as const, label: t(($) => $.common.auto) }, ...languages];
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const tabExit = useRef(false);
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      tabExit.current = true;
      trigger.current?.focus();
      setOpen(false);
      return;
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % items.length
            : event.key === 'ArrowUp'
              ? (current + items.length - 1) % items.length
              : event.key.length === 1
                ? options.findIndex((item) =>
                    item.label.toLowerCase().startsWith(event.key.toLowerCase()),
                  )
                : -1;
    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus();
    }
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        ref={trigger}
        className="icon-button"
        aria-haspopup="menu"
        aria-label={t(($) => $.common.language)}
        title={t(($) => $.common.language)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <LanguageIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={content}
          className="language-menu"
          role="menu"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-label={t(($) => $.common.language)}
          onKeyDown={navigate}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (tabExit.current) {
              event.preventDefault();
              tabExit.current = false;
            }
          }}
        >
          {options.map((language) => (
            <button
              key={language.value}
              type="button"
              className="language-option"
              role="menuitemradio"
              aria-checked={preference === language.value}
              onClick={() => {
                setPreference(language.value);
                setOpen(false);
              }}
            >
              <span>{language.label}</span>
              {preference === language.value ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function HeaderActions({ product = astmatrixProduct }: { product?: HeaderProduct }) {
  const { t } = useTranslation();
  const [linkError, setLinkError] = useState<string | null>(null);
  return (
    <div className="header-actions">
      <LanguageMenu />
      <ExternalLink
        href={product.projectUrl}
        label={t(($) => $.about.openGithub)}
        title="GitHub"
        className="icon-button"
        onError={setLinkError}
      >
        <img src={githubIcon} className="github-icon" alt="" />
      </ExternalLink>
      <Dialog.Root>
        <Dialog.Trigger
          className="icon-button"
          aria-label={t(($) => $.common.about)}
          title={t(($) => $.common.about)}
        >
          <AboutIcon />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="about-overlay" />
          <Dialog.Content className="about-dialog">
            <Dialog.Title>{t(($) => $.about.productTitle, { product: product.name })}</Dialog.Title>
            <Dialog.Description>{t(($) => $.about.description)}</Dialog.Description>
            <p>
              {t(($) => $.about.version)} v{PROJECT_VERSION}
            </p>
            <p>
              Copyright © 2026 Endfield Industries Human Resource Team,
              <br />
              Licensed under the{' '}
              <ExternalLink className="license-link" href={LICENSE_URL} onError={setLinkError}>
                Apache License, Version 2.0
              </ExternalLink>
              .
            </p>
            {linkError === LICENSE_URL || linkError === product.issuesUrl ? (
              <div className="error" role="alert">
                {linkError === LICENSE_URL
                  ? t(($) => $.about.licenseOpenFailed)
                  : t(($) => $.about.feedbackOpenFailed)}{' '}
                {linkError}
              </div>
            ) : null}
            <div className="about-links">
              <Dialog.Root>
                <Dialog.Trigger className="about-link about-link-button">
                  <CodeIcon />
                  <span>{t(($) => $.about.openSourceLicenses)}</span>
                  <ExternalArrowIcon />
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="about-overlay open-source-overlay" />
                  <Dialog.Content className="about-dialog open-source-dialog">
                    <Dialog.Title>{t(($) => $.about.openSourceLicenses)}</Dialog.Title>
                    <Dialog.Description>{t(($) => $.about.credits)}</Dialog.Description>
                    <div className="open-source-list">
                      {openSourceProjects.map((project) => (
                        <ExternalLink
                          key={project.url}
                          className="open-source-link"
                          href={project.url}
                          onError={setLinkError}
                          title={project.packages.join(', ')}
                        >
                          <span className="open-source-name">{project.name}</span>
                          <small>{project.license}</small>
                          <ExternalArrowIcon />
                        </ExternalLink>
                      ))}
                    </div>
                    {openSourceProjects.some((project) => project.url === linkError) ? (
                      <div className="error" role="alert">
                        {t(($) => $.about.projectOpenFailed)} {linkError}
                      </div>
                    ) : null}
                    <Dialog.Close className="about-close">{t(($) => $.common.close)}</Dialog.Close>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
              <ExternalLink
                className="about-link"
                href={product.projectUrl}
                label={t(($) => $.about.openGithub)}
                title="GitHub"
                onError={setLinkError}
              >
                <img src={githubIcon} className="github-icon" alt="" />
                <span>GitHub</span>
                <ExternalArrowIcon />
              </ExternalLink>
              <ExternalLink className="about-link" href={product.issuesUrl} onError={setLinkError}>
                <IssueIcon />
                <span>{t(($) => $.about.reportIssue)}</span>
                <ExternalArrowIcon />
              </ExternalLink>
            </div>
            <Dialog.Close className="about-close">{t(($) => $.common.close)}</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {linkError === product.projectUrl ? (
        <p className="header-error" role="alert">
          {t(($) => $.about.githubOpenFailed)} {product.projectUrl}
        </p>
      ) : null}
    </div>
  );
}
