# 名句日日聽 daily-quotes-365

每天一個主題、5 句中西名言佳句：唐詩宋詞、漢賦、先秦諸子、西方哲學家與教育家的通行譯句。先聽、再看原句、再看出處與白話解釋，逐句重播、0.75× 慢速，記錄已練天數與連續天數。365 個主題依「台北時區一年第幾天」輪播，`?d=N` 可跳任一天，`archive.html` 依類別總覽。

- 純靜態站，無框架、無後端、免帳號。
- 12 大類：立志抱負、勤學讀書、惜時光陰、友情知己、親情家庭、愛情相思、離別鄉愁、山水自然、人生哲理、修身品德、教育啟蒙、逆境勇氣。
- 配圖：潑墨水墨 × 美式 Q 版（1:1 頭身），AI 生成。
- 語音：edge-tts 台灣腔（奇數句 zh-TW-HsiaoChen、偶數句 zh-TW-YunJhe），只讀原句。

## 結構

```
index.html / archive.html
css/style.css  js/app.js  js/day.js  js/cats.js
data/scenes.json   365 筆 {id, category, title_zh, intro_zh, image_prompt_en, lines[5]{text, author, source, era, gloss}}
img/NNN.webp       365 張 4:3
audio/NNN-K.mp3    1825 檔
scripts/           validate.cjs / check-assets.cjs / merge-batches.cjs / gen-audio.py / gen-image.sh / gen-images-all.sh / gen-bg.sh
test/              day.test.mjs（node --test）、smoke.mjs（Playwright WebKit）
```

## 開發

```bash
npm test                      # 日期邏輯 + 資料驗證 + 資產檢查
STRICT_IMG=1 npm test         # 上線前：缺圖視為錯誤
python3 scripts/gen-audio.py  # 補產缺的 mp3（已存在跳過）
scripts/gen-images-all.sh     # 補產缺的配圖（codex exec）
npx serve .                   # 本機預覽
```

## 授權

古典名句為公版；近現代與西方譯句僅短句引用並註明出處，供教學使用。插畫為 AI 生成、語音為合成人聲。整理內容 CC BY-NC 4.0。
