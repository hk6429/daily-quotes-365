#!/bin/bash
# 等日語站 365 張跑完（日語站又排在英語站之後）（scratch/img-done 出現）再跑本站背景＋365 張配圖
cd "$(dirname "$0")/.." || exit 1
while [ ! -f "$HOME/projects/daily-japanese-365/scratch/img-done" ] || [ ! -f scratch/audio-done ]; do sleep 120; done
scripts/gen-bg.sh > scratch/bg.log 2>&1
LANES=4 scripts/gen-images-all.sh > scratch/img.log 2>&1
