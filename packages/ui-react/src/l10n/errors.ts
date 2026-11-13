import type { TFunction } from 'i18next';
import { HOST_ERROR_CODES } from '@astmatrix/host-contract';
import type { HostErrorCode } from '@astmatrix/host-contract';
import { AstMatrixError, errorMessage } from '@astmatrix/shared';
import { translateKnownMessage, translateMessage } from './dynamic';
import type { Locale } from './i18n';

/** Keep raw host diagnostics out of the ordinary UI when no specific translation exists. */
export function translateError(t: TFunction, error: unknown): string {
  const known = translateKnownMessage(t, errorMessage(error));
  if (known) return known;
  if (error instanceof AstMatrixError && HOST_ERROR_CODES.includes(error.code as HostErrorCode))
    return t(($) => $.hostError[error.code as HostErrorCode]);
  return t(($) => $.hostError.UNKNOWN_HOST_ERROR);
}

export function translateValidationError(t: TFunction, source: string, locale: Locale): string {
  const message = translateMessage(t, source);
  return locale === 'en' && /\p{Script=Han}/u.test(message)
    ? t(($) => $.validation.correctInput)
    : message;
}
