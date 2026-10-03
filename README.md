# 名句日日聽 daily-quotes-365

每天一個主題、5 句中西名言佳句：唐詩宋詞、漢賦、先秦諸子、西方哲學家與教育家的名句（本站自譯或短句直譯）。先聽、再看原句、再看出處與白話解釋，逐句重播、0.75× 慢速，記錄已練天數與連續天數。365 個主題依「台北時區一年第幾天」輪播，`?d=N` 可跳任一天，`archive.html` 依類別總覽。

- 純靜態站，無框架、無後端、免帳號。
- 12 大類：立志抱負、勤學讀書、惜時光陰、友情知己、親情家庭、愛情相思、離別鄉愁、山水自然、人生哲理、修身品德、教育啟蒙、逆境勇氣。
- 配圖：潑墨水墨 × 美式 Q 版（1:1 頭身），AI 生成。
- 語音：edge-tts 臺灣男聲 `zh-TW-YunJheNeural` 清晰版，合成語速 `-18%`，依原有標點分段並加上停頓（少數句子另經人工指定分段），只朗讀名句。正音覆寫只調整合成文字，畫面保留原文。
- 音檔無法播放時，改用裝置語音備援並套用相同正音文字；優先選取臺灣雲哲語音，未安裝時使用裝置提供的中文語音，聲線依裝置而異。

## 結構

```
index.html / archive.html
css/style.css  js/app.js  js/day.js  js/cats.js
data/scenes.json   365 筆 {id, category, title_zh, intro_zh, image_prompt_en, lines[5]{text, author, source, era, gloss}}
data/reading-overrides.json   特定名句的正音與分段覆寫，原文須相符才套用
data/audio-manifest.json      每句的合成設定指紋、音檔 SHA-256、位元組與時長
img/NNN.webp       365 張 4:3
audio/NNN-K.mp3    1825 檔
scripts/           validate.cjs / check-assets.cjs / merge-batches.cjs / gen-audio.py / gen-image.sh / gen-images-all.sh / gen-bg.sh
test/              day.test.mjs（node --test）、smoke.mjs（Playwright WebKit）
```

## 開發

```bash
npm test                      # 日期/練習/朗讀設定 + 資料驗證 + 資產檢查
STRICT_IMG=1 npm test         # 上線前：缺圖視為錯誤
uv run scripts/gen-audio.py --output-dir scratch/yunjhe-release  # 依內容雜湊續做，先產生至暫存目錄
python3 -B scripts/check-audio-manifest.py --output-dir scratch/yunjhe-release --manifest scratch/yunjhe-release/audio-manifest.json --report scratch/audio-qa-release.json
scripts/gen-images-all.sh     # 補產缺的配圖（codex exec）
npx serve .                   # 本機預覽
```

生成器需 `uv` 與 `ffmpeg`，使用檔案鎖（macOS/Linux）避免同時寫入相同快取或輸出目錄。快取必須符合生成當下的 SHA-256；舊格式或損毀快取會重建。先驗收暫存的完整 1,825 檔，再替換正式 `audio/` 與清單。`--days` 僅用於獨立試聽目錄。

讀音審查與來源見 `docs/pronunciation-audit-20261003.md`。31 句設有讀音引導，另有 5 句待人工確認；技術驗收僅證明設定、完整性及可解碼，不代表所有多音字已通過真人驗聽。

## 授權

- 古典名句與《聖經》和合本為公共領域；近現代作者每位全站最多一句短引，並註明出處，供教學合理使用；西方名句經原文與歸屬查證，中文為「本站自譯」或通行短句直譯。
- 插畫為 AI 生成、語音為 edge-tts 臺灣男聲 AI 合成人聲，純 AI 生成部分不主張著作權。
- 站方原創的編排、釋義與程式以 CC BY-NC 4.0 授權（範圍見 `LICENSE`，不含公共領域與他人著作）。
- 完整權利、AI 揭露與通報方式見網站的 `rights.html`。

## 功能
- 課堂模式：全螢幕深色大字，每句依序「聽 → 原句 → 出處 → 白話」，空白鍵／→ 下一步、← 上一步、P 重播、Esc 離開，適合投影。
- 每日小測驗：常見作者的句子猜作者（干擾項優先同時代人名）、其餘猜白話意思，每天 5 題四選一，成績只存本機（`dq365.quiz`）。
- 離線：Service Worker（`sw.js`）快取網頁殼與資料，並預載目前這天的音檔與圖；斷網時已看過的天數仍可練習。
