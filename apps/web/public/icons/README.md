# PWA icons

Generate `icon-192.png` (192×192) and `icon-512.png` (512×512) here before first deploy.

Quickstart suggestions:

- Use a black background with the cyan `#00E5FF` glyph for brand consistency.
- Both icons should be `purpose: any maskable` compliant — keep the safe zone within the inner 80%.
- Tools: figma + export, or:

  ```bash
  # da c:/work/Cozza/cozza-ai
  pnpm dlx pwa-asset-generator assets/logo.svg apps/web/public/icons \
    --background "#000000" --opaque false --padding "12%" --type png \
    --icon-only --favicon --maskable true
  ```

  Genera 192/512/maskable + favicon. Output va già nei path attesi dal manifest.

These files are intentionally not committed; CI fails the PWA Lighthouse check until they exist.
