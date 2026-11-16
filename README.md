# ToyShop

[![CodeQL](https://github.com/EIHRTeam/ToyShop/actions/workflows/codeql.yml/badge.svg)](https://github.com/EIHRTeam/ToyShop/actions/workflows/codeql.yml)
[![CI](https://github.com/EIHRTeam/ToyShop/actions/workflows/ci.yml/badge.svg)](https://github.com/EIHRTeam/ToyShop/actions/workflows/ci.yml)<br>
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square&label=License)](LICENSE)
[![Version](https://img.shields.io/github/v/release/EIHRTeam/ToyShop?style=flat-square&label=Version&color=blue)](https://github.com/EIHRTeam/ToyShop/releases/latest)<br>
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7-blue.svg?logo=typescript&style=flat-square&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933.svg?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=white)](https://react.dev)

A suite of toys for designers.

## Index

- [Compatibility](#compatibility)
- [Features](#features)
- [Static website](#static-website)
- [Installation](#installation)
  - [Adobe Illustrator](#adobe-illustrator)
  - [Adobe Photoshop](#adobe-photoshop)
  - [Figma](#figma)

## Compatibility

### Complete Support

- Adobe Illustrator 2023 (and above)
- Adobe Photoshop 2025 (and above)
- Figma

## Features

- **Bar Code & QR Code Generation** (Formerly **[AstMatrix](https://github.com/EIHRTeam/AstMatrix)**)<br>
    Generate bar code or QR code in any symbology, right in your design tools.

- **Low Case - Upper Case Convert**<br>
    Convert selected text to lower case or upper case.

## Static website

The browser application provides text case conversion with separate input and result fields,
plus barcode and QR code generation with SVG downloads and clipboard copying. Processing runs
locally in the browser.

Use Node.js 24 and the pinned pnpm 12.11.2 release.

```sh
pnpm install --frozen-lockfile
pnpm --filter @astmatrix/web-spa dev
pnpm build:spa
pnpm check:spa-bundle
pnpm exec wrangler pages dev
```

`pnpm build:spa` emits `apps/web-spa/dist/`. The build is also available through
`pnpm build:web --profile=web-spa`, with `--dry-run` support. Wrangler reads the output directory
from the root `wrangler.jsonc`. Pages serves the SPA entry for unmatched paths, and assets use
root-relative URLs so nested addresses can be refreshed.

### Cloudflare Pages setup

1. Log in to the target Cloudflare account and create the Direct Upload project once.

   ```sh
   pnpm exec wrangler login
   pnpm exec wrangler pages project create toyshop --production-branch=main
   ```

2. Add repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in GitHub Actions.
   Grant the API token **Account / Cloudflare Pages / Edit** permission for the target account.
3. Push to `main`. After all CI checks pass, the Preview deployment is published to the `beta`
   branch alias, `beta.toyshop.pages.dev`. Pull requests and manually dispatched CI runs build
   and validate the SPA.
4. Once the beta deployment succeeds, add `beta.toys.eihrteam.org` under the Pages project's
   **Custom domains**. After activation, set its Cloudflare DNS CNAME target to
   `beta.toyshop.pages.dev` and enable proxying for the branch alias to work.
5. Add `toys.eihrteam.org` under the same project's **Custom domains**, pointing its CNAME to
   `toyshop.pages.dev`.
6. Trigger the existing **Release** workflow from `main`. After signed packages, installer
   verification and GitHub Release publication succeed, the workflow deploys the SPA artifact
   built from that same commit to the `main` production branch and `toys.eihrteam.org`.

The SPA travels as a separate workflow artifact. Deployment failures fail the corresponding
job. For a failed deployment, rerun that job from the same workflow run to reuse its artifact.

Cloudflare documents Direct Upload CI credentials and custom branch domains in its Pages
guides. [Direct Upload CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
and [custom branch domains](https://developers.cloudflare.com/pages/how-to/custom-branch-aliases/).

## Installation

### Adobe Illustrator

**Via Adobe Creative Cloud (Recommended)**

1. Make sure Adobe Creative Cloud is installed and that you are signed in with your Adobe account.
2. Open the [Adobe Exchange page](https://exchange.adobe.com/apps/cc/206252/toyshop-legacy), or search "**ToyShopx**" in the Creative Cloud desktop app.
3. Install the plugin.
4. Open Illustrator (or restart it completely if it is already running), then select "Window" > "Extensions" > "ToyShop" to launch the plugin.

**Via Installer Program (for Windows)**

1. Download the appropriate installer for your system from the [Releases page](https://github.com/EIHRTeam/ToyShop/releases/latest).
    - Windows x64: `ToyShop-Illustrator-<version>-Setup.exe`
    - Windows ARM64: `ToyShop-Illustrator-<version>-aarch64-Setup.exe`
2. Run the installer and follow the on-screen instructions to complete the installation.

**Manual**

1. Download the latest Illustrator `.zxp` package from the [Releases page](https://github.com/EIHRTeam/ToyShop/releases/latest).
2. Make sure Adobe Illustrator is installed and completely closed.
3. Open the downloaded `.zxp` file using a ZIP archive utility (e.g., 7-Zip, ShichiZip, or Keka). Its contents start with `CSXS/manifest.xml`, without an enclosing `ToyShop` folder.
4. Create an `ToyShop` folder in the following directory, then extract all archive contents into it:

   - Windows: `%APPDATA%\Adobe\CEP\extensions\`
   - macOS: `~/Library/Application Support/Adobe/CEP/extensions/`

   Create the `extensions` folder if it does not already exist. The final manifest path must be `extensions/ToyShop/CSXS/manifest.xml`, without an extra nested folder.

5. Because the manually installed plugin is unsigned, enable CEP debug mode by setting `PlayerDebugMode` for the CEP version used by Illustrator:

   - Windows: Press Windows + R, enter `regedit`, and open Registry Editor. Navigate to `HKEY_CURRENT_USER\Software\Adobe\CSXS.12` (create the key if necessary), create a String Value (`REG_SZ`) named `PlayerDebugMode`, and set its value to `1`.
   - macOS: Open Terminal via Spotlight (Command + Space), then run:

     ```sh
     defaults write com.adobe.CSXS.12 PlayerDebugMode 1
     ```

   These examples use CEP 12. If your Illustrator version uses a different CEP version, replace `12` with the corresponding version number (e.g., `11` for CEP 11). Enable this setting only for plugins from sources you trust.

6. Open Illustrator (or restart it completely if it is already running), then select "Window" > "Extensions" > "ToyShop" to launch the plugin.

### Adobe Photoshop

**Via Adobe Creative Cloud (Recommended)**

1. Make sure Adobe Creative Cloud is installed and that you are signed in with your Adobe account.
2. Open the [Adobe Exchange page](https://exchange.adobe.com/apps/cc/8941323d/toyshop), or search "**ToyShop for Photoshop**" in the Creative Cloud desktop app.
3. Install the plugin.
4. Open Photoshop (or restart it completely if it is already running), then select "Plugins" > "ToyShop" to launch the plugin.

**Via Installer Program (for Windows)**

1. Download the appropriate installer for your system from the [Releases page](https://github.com/EIHRTeam/ToyShop/releases/latest).
    - Windows x64: `ToyShop-Photoshop-<version>-Setup.exe`
    - Windows ARM64: `ToyShop-Photoshop-<version>-aarch64-Setup.exe`
2. Run the installer and follow the on-screen instructions to complete the installation.

**Via Adobe Creative Cloud (.ccx file)**

1. Download the latest Photoshop `.ccx` package from the [Releases page](https://github.com/EIHRTeam/ToyShop/releases/latest).
2. Make sure Adobe Creative Cloud is installed and that you are signed in with your Adobe account.
3. Double-click the downloaded `.ccx` file, or open it using the Adobe Creative Cloud desktop app.
4. Confirm the non-marketplace plugin installation prompt by clicking "Install" (or "Install locally", depending on your Creative Cloud version).
5. Open Photoshop (or restart it completely if it is already running), then select "Plugins" > "ToyShop" to launch the plugin.

**Via Adobe Universal Plugin Installer Agent (UPIA)**

1. Download the latest Photoshop `.ccx` package from the [Releases page](https://github.com/EIHRTeam/ToyShop/releases/latest).
2. Make sure Adobe Creative Cloud version 5.7 or later is installed.
3. Run the command for your operating system. Replace the example `.ccx` path with the path to your downloaded file, keeping the quotation marks:

   - Windows: Press Windows + R, enter `cmd`, and run in CMD:

     ```bat
     "C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe" /install "C:\path\to\ToyShop.ccx"
     ```

   - macOS: Open Terminal via Spotlight (Command + Space), then run:

     ```sh
     "/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent" --install "/path/to/ToyShop.ccx"
     ```

   See Adobe's [How to Install UXP Plugins Using Command Line Tools](https://blog.developer.adobe.com/en/publish/2022/03/how-to-install-uxp-plugins-using-command-line-tools) for details.

4. Open Photoshop (or restart it completely if it is already running), then select "Plugins" > "ToyShop" to launch the plugin.

**Manual extraction (experimental)**

1. Download the latest Photoshop `.ccx` package from the [Releases page](https://github.com/EIHRTeam/ToyShop/releases/latest).
2. Open the `.ccx` file using a ZIP archive utility (e.g., 7-Zip, ShichiZip, or Keka).
3. Extract its contents to the following directory:

   - Windows: `%APPDATA%\Adobe\UXP\Plugins\External\1f4db629_<version>\` (create this plugin-specific directory; `manifest.json` must be directly inside it)
   - macOS: `~/Library/Application Support/Adobe/UXP/Plugins/`

4. Open Photoshop (or restart it completely if it is already running), then select "Plugins" > "ToyShop" to launch the plugin.

Extraction may not register the plugin with current Photoshop/Creative Cloud versions. If it does not appear, use Creative Cloud or UPIA instead; do not modify Adobe's internal registration JSON. Avoid keeping extracted and Adobe-managed copies of the same plugin together.

### Figma

**Via Figma Community**

1. Open [the Figma Community page of this project](https://www.figma.com/community/plugin/1693350407249302347).

2. Click the "Save" button to save the plugin to your Figma account.

3. Open a Figma file, go to the menu bar, and select "Plugins" > "Saved plugins" > "ToyShop" to launch the plugin.

**From GitHub Releases (Figma Desktop)**

1. Download `ToyShop-Figma-<version>.zip` from the [Releases page](https://github.com/EIHRTeam/ToyShop/releases/latest).
2. Extract the entire archive and keep its files together.
3. In Figma Desktop, select "Plugins" > "Development" > "Import plugin from manifest" and choose the extracted `manifest.json`.
4. Open a Figma Design file, then select "Plugins" > "Development" > "ToyShop" to launch the plugin.

## Legal

Copyright © 2026 Endfield Industries Human Resource Team.

This project is licensed under the [Apache License, Version 2.0](LICENSE).

Privacy policy: [PRIVACY.md](https://github.com/EIHRTeam/AstMAtrix/blob/main/PRIVACY.md)
