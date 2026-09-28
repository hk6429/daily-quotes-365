#!/bin/bash
# 13 張全版背景（12 主題＋generic），無人物、留白多。輸出 bg/<slug>.webp
set -u
ROOT="$HOME/projects/daily-quotes-365"; PNGDIR="$HOME/projects/_daily-quotes-365-png/bg"; mkdir -p "$PNGDIR"
gen() {
  local slug="$1" scene="$2" TMP="/tmp/dq365-bg-$1.png" WEBP="$ROOT/bg/$1.webp"
  if [ -f "$WEBP" ] && [ "$(stat -f%z "$WEBP")" -gt 20000 ]; then echo "skip $slug"; return 0; fi
  local PROMPT="請生成一張圖片，存成 ${TMP} 。Wide atmospheric background illustration in splash-ink (潑墨) style fused with American cartoon color accents: loose wet black ink washes, rice-paper texture, sparse accent colors (vermilion red, indigo, ochre) bleeding into ink, lots of soft white space especially in the center, low contrast and gentle so text can be overlaid on top. Scene, environment only, NO people, NO characters, NO animals: $scene. No text, no letters, no calligraphy, no signs with words, no watermark. Landscape 3:2 (1536x1024)."
  /bin/rm -f "$TMP"
  (cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/naicheng-codex-agent" && perl -e 'alarm 300; exec @ARGV' command codex exec --skip-git-repo-check "$PROMPT" </dev/null >"/tmp/dq365-bg-$slug.log" 2>&1)
  if [ -f "$TMP" ] && [ "$(stat -f%z "$TMP")" -gt 100000 ]; then
    mv "$TMP" "$PNGDIR/$slug.png"
    ffmpeg -y -loglevel error -i "$PNGDIR/$slug.png" -vf "scale=1600:-2" -c:v libwebp -quality 72 "$WEBP" && echo "ok $slug $(stat -f%z "$WEBP")"
  else echo "FAIL $slug"; return 1; fi
}
gen generic  "a misty ink-wash landscape with a river pavilion, distant mountains, a lone boat and a few red maple branches"
gen lizhi    "a mountain peak above a sea of clouds at sunrise, a winding stone path climbing upward, a flag pole without flag text"
gen qinxue   "a scholar's study with piles of thread-bound books, a brush and inkstone, an oil lamp, a window with bamboo shadows"
gen xishi    "an hourglass and a sundial on a stone table, falling petals and drifting leaves, a crescent moon and a rising sun on either side"
gen youqing  "two empty cups of tea on a stone table under a pine tree, a guqin resting nearby, a mountain stream"
gen qinqing  "a warm courtyard home with a lit doorway at dusk, a cooking stove with steam, a small garden and a swing"
gen aiqing   "a moonlit bridge over lotus pond, two willow branches intertwined, red plum blossoms, a paper lantern"
gen libie    "a riverside willow tree with a small boat departing, a long road toward distant city walls, geese flying south, a full moon"
gen shanshui "towering misty mountains and a waterfall, pine trees on cliffs, a winding river through a valley"
gen zheli    "a quiet zen garden with raked sand, a single stone, a lotus pond, ripples spreading from a fallen leaf"
gen xiushen  "a plum tree in snow beside a clean stone well, orchid and bamboo, a mirror-like pond reflecting the sky"
gen jiaoyu   "an old-style school hall with wooden desks and a blackboard without writing, a tall tree with young saplings beside it, sunlight"
gen nijing   "a lone pine tree on a cliff bending in a storm, a small boat riding big waves, a rainbow appearing behind clouds"
