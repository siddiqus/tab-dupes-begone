#!/usr/bin/env bash
# Renders Chrome Web Store assets with headless Chrome + ImageMagick (macOS paths).
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
abs() { [[ "$1" = /* ]] && echo "$1" || echo "$PWD/$1"; }
render() { "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --default-background-color=00000000 --window-size="$2" --screenshot="$(abs "$3")" "file://$(abs "$1")" >/dev/null 2>&1; }

# Toolbar/manifest icons
render assets/icon.svg 512,512 /tmp/tdb-icon-512.png
for s in 16 32 48 128; do magick /tmp/tdb-icon-512.png -filter Lanczos -resize ${s}x${s} public/icons/icon-$s.png; done

# Store icon: 96x96 artwork centred on a transparent 128x128 canvas (Chrome Web Store guideline)
magick /tmp/tdb-icon-512.png -filter Lanczos -resize 96x96 -background none -gravity center -extent 128x128 assets/store/store-icon-128.png

# Screenshot
render assets/store/screenshot-before-after.html 1280,800 assets/store/screenshot-before-after.png
magick identify assets/store/*.png
