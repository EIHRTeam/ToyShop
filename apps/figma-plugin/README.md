# ToyShop Figma Design development plugin

Run `pnpm build:figma`, then import `apps/figma-plugin/dist/manifest.json` with **Plugins → Development → Import plugin from manifest**. The plugin is offline and Design only. Its UI contains the existing AstMatrix vector generator and the Text Case simulated preview.

The source Manifest uses a ToyShop development placeholder ID (`1941905204601984000`). Replace it with a Figma-assigned ID before publication. The AstMatrix ID must not be reused. The plugin main thread and iframe UI build separately; `pnpm check:figma-bundle` verifies the combined bundle. Actual host behavior still requires Figma testing.

Text Case does not yet read or modify Figma text nodes. The AstMatrix functionality and its previous acceptance notes are preserved in [the archived project README](../../docs/ASTMATRIX.md).
