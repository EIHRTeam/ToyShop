# Photoshop icons

These assets are size exports of the repository's `icon.svg` ToyShop logo on its dark rounded
square. `icon.png` is its 192px raster export. Panel icons use 23/46px; plugin list icons use
24/48px. Both Photoshop manifests reference the base path without a scale suffix; UXP loads the
actual `@1x.png` and `@2x.png` files. The mark matches the title bar: the logo spans 18/46 of the
tile height and the tile uses a 6/46 corner radius, so the PNG corners are transparent. The logo
has its own dark background and is shared across the four Photoshop themes.

To refresh the exports on macOS with librsvg installed, run these commands from the repository root:

```sh
rsvg-convert -w 192 -h 192 -o icon.png icon.svg
sips -z 23 23 icon.png --out apps/photoshop-uxp/icons/panel@1x.png
sips -z 46 46 icon.png --out apps/photoshop-uxp/icons/panel@2x.png
sips -z 24 24 icon.png --out apps/photoshop-uxp/icons/list@1x.png
sips -z 48 48 icon.png --out apps/photoshop-uxp/icons/list@2x.png
```
