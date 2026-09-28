#!/bin/bash
# usage: gen-image.sh <id:3digits> "<scene description>"
# writes ~/projects/_daily-quotes-365-png/<id>.png then img/<id>.webp
set -u
ID="$1"; SCENE="$2"
ROOT="$HOME/projects/daily-quotes-365"
PNGDIR="$HOME/projects/_daily-quotes-365-png"
OUT="$PNGDIR/$ID.png"; TMP="/tmp/dq365-$ID.png"
WEBP="$ROOT/img/$ID.webp"
if [ -f "$WEBP" ] && [ "$(stat -f%z "$WEBP")" -gt 20000 ]; then echo "skip $ID"; exit 0; fi
PROMPT="請生成一張圖片，存成 ${TMP} 。Splash-ink painting (潑墨) illustration, American cartoon energy fused with Chinese ink-wash aesthetics: bold black ink splashes, loose wet brush strokes, rice-paper texture, sparse accent colors (vermilion red, indigo, ochre) bleeding into the ink, generous white space. Chibi characters with head-to-body ratio exactly 1:1 (the head is as tall as the body), big expressive eyes, rounded American-cartoon proportions, playful poses. Scene: $SCENE. No text, no letters, no signs with words, no watermark. Landscape 4:3 (1536x1152)."
/bin/rm -f "$TMP"
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/naicheng-codex-agent" && perl -e "alarm 300; exec @ARGV" command codex exec --skip-git-repo-check "$PROMPT" </dev/null >/tmp/dq365-$ID.log 2>&1
if [ -f "$TMP" ] && [ "$(stat -f%z "$TMP")" -gt 100000 ]; then
  mv "$TMP" "$OUT"
  ffmpeg -y -loglevel error -i "$OUT" -vf "scale=1200:-2" -c:v libwebp -quality 80 "$WEBP" && echo "ok $ID $(stat -f%z "$WEBP")"
else
  echo "FAIL $ID"; exit 1
fi
