import { isAllowedExternalLink } from '@astmatrix/shared';
import type { CSInterfaceLike } from '@astmatrix/host-adapter-illustrator-cep';

export function createCepLinkOpener(
  cs: Pick<CSInterfaceLike, 'openURLInDefaultBrowser'>,
): (url: string) => void {
  return (url) => {
    if (!isAllowedExternalLink(url)) throw new Error('Unsupported external link');
    const result = cs.openURLInDefaultBrowser?.(url);
    if (result !== 0) throw new Error('Unable to open external link');
  };
}
