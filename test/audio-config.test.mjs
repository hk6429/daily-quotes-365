import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_VERSION, FALLBACK_RATE, audioUrl, readingText, taiwanMaleVoice } from '../js/audio-config.js';

test('播放與預載使用男聲音檔版本，沿用原檔名', () => {
  assert.equal(AUDIO_VERSION, '20261003-yunjhe-v1');
  assert.equal(audioUrl(1, 1), 'audio/001-1.mp3?v=20261003-yunjhe-v1');
  assert.equal(audioUrl(365, 5), 'audio/365-5.mp3?v=20261003-yunjhe-v1');
  assert.equal(FALLBACK_RATE, 0.82);
});

test('正音僅改朗讀內容，未知句子與原文不符時回到原文', () => {
  const original = '學而時習之，不亦說乎？';
  const overrides = { '001-1': { text: original, parts: ['學而時習之，', '不亦悅乎？'] } };
  assert.equal(readingText(overrides, 1, 1, original), '學而時習之，不亦悅乎？');
  assert.equal(overrides['001-1'].text, original);
  assert.equal(readingText(overrides, 2, 1, original), original);
  assert.equal(readingText(overrides, 1, 1, '新版原句'), '新版原句');
  assert.equal(readingText(null, 1, 1, original), original);
});

test('正音資料缺少合成片段或片段無效時仍可朗讀原文', () => {
  for (const parts of [undefined, [], [''], ['原句', null], '原句']) {
    assert.equal(readingText({ '001-1': { text: '原句', parts } }, 1, 1, '原句'), '原句');
  }
});

test('只選明確標示 YunJhe 或雲哲的臺灣語音，沒有時交給裝置預設', () => {
  const female = { lang: 'zh-TW', name: 'Microsoft HsiaoChen' };
  const otherLocale = { lang: 'zh-CN', name: 'Microsoft YunJhe' };
  const selected = { lang: 'zh-TW', name: 'Microsoft YunJhe Online (Natural) - Chinese (Taiwan)' };
  const localized = { lang: 'zh_TW', name: 'Microsoft 雲哲' };
  assert.equal(taiwanMaleVoice([female, otherLocale, selected]), selected);
  assert.equal(taiwanMaleVoice([localized]), localized);
  assert.equal(taiwanMaleVoice([female, otherLocale]), null);
  assert.equal(taiwanMaleVoice([]), null);
});
