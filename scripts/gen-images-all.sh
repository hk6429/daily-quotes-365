#!/bin/bash
# 四線並行跑完 365 張（LANES 可改）；失敗記 scratch/img-fail.txt 並序列重試一輪；結束寫 scratch/img-done
cd "$(dirname "$0")/.." || exit 1
LANES=${LANES:-4}
: > scratch/img-fail.txt
node -e "for(const x of require('./data/scenes.json'))console.log(String(x.id).padStart(3,'0')+'\t'+x.image_prompt_en)" > scratch/img-list.tsv
run_lane() {
  local n=$1
  awk -v n="$n" -v L="$LANES" 'NR % L == n' scratch/img-list.tsv | while IFS=$'\t' read -r id p; do
    scripts/gen-image.sh "$id" "$p" </dev/null || echo "$id	$p" >> scratch/img-fail.txt
  done
}
for ((i=0;i<LANES;i++)); do run_lane "$i" > "scratch/img-lane$i.log" 2>&1 & done
wait
cp scratch/img-fail.txt scratch/img-fail-round1.txt
while IFS=$'\t' read -r id p; do [ -n "$id" ] && scripts/gen-image.sh "$id" "$p" </dev/null; done < scratch/img-fail-round1.txt
ls img/*.webp | wc -l > scratch/img-done
