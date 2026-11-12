import { version } from '../../../package.json';
import { openSourceProjects } from './open-source-projects';
export const PROJECT_URL = 'https://github.com/EIHRTeam/AstMatrix';
export const ISSUES_URL = `${PROJECT_URL}/issues`;
export const TOYSHOP_PROJECT_URL = 'https://github.com/EIHRTeam/ToyShop';
export const TOYSHOP_ISSUES_URL = `${TOYSHOP_PROJECT_URL}/issues`;
export const LICENSE_URL = 'https://www.apache.org/licenses/LICENSE-2.0';
export const PROJECT_VERSION = version;

export function isAllowedExternalLink(url: string): boolean {
  return (
    url === PROJECT_URL ||
    url === ISSUES_URL ||
    url === TOYSHOP_PROJECT_URL ||
    url === TOYSHOP_ISSUES_URL ||
    url === LICENSE_URL ||
    openSourceProjects.some((project) => project.url === url)
  );
}
