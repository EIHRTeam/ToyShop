# ToyShop

[![CodeQL](https://github.com/EIHRTeam/ToyShop/actions/workflows/codeql.yml/badge.svg)](https://github.com/EIHRTeam/ToyShop/actions/workflows/codeql.yml)
[![CI](https://github.com/EIHRTeam/ToyShop/actions/workflows/ci.yml/badge.svg)](https://github.com/EIHRTeam/ToyShop/actions/workflows/ci.yml)<br>
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square&label=License)](LICENSE)
[![Version](https://img.shields.io/github/v/release/EIHRTeam/ToyShop?style=flat-square&label=Version&color=blue)](https://github.com/EIHRTeam/ToyShop/releases/latest)<br>
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7-blue.svg?logo=typescript&style=flat-square&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933.svg?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=white)](https://react.dev)

A suite of toys for designers.

**Try on web:**<br>
Stable version - [toys.eihrteam.com](https://toys.eihrteam.com)<br>
Nightly build - [beta.toys.eihrteam.com](https://beta.toys.eihrteam.com)

## Index

- [Compatibility](#compatibility)
- [Features](#features)
- [Installation](#installation)
  - [Adobe Illustrator](#adobe-illustrator)
  - [Adobe Photoshop](#adobe-photoshop)
  - [Figma](#figma)

## Compatibility

### Complete Support

- Adobe Illustrator 2023 (and above)
- Adobe Photoshop 2025 (and above)
- Figma
- Browsers
  - Chromium (Google Chrome, Microsoft Edge, etc.) 111 and above
  - Firefox 114 (and above)
  - Safari 16.4 (and above)

## Features

- **Bar Code & QR Code Generation** (Formerly **[AstMatrix](https://github.com/EIHRTeam/AstMatrix)**)<br>
    Generate bar code or QR code in any symbology, right in your design tools.

- **Low Case - Upper Case Convert**<br>
    Convert selected text to lower case or upper case.

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
