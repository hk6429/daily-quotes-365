export const AUDIO_VERSION = '20261003-yunjhe-v1';
export const FALLBACK_RATE = 0.82;

const lineKey = (day, k) => `${String(day).padStart(3, '0')}-${k}`;
export const audioUrl = (day, k) => `audio/${lineKey(day, k)}.mp3?v=${AUDIO_VERSION}`;

// 正音只影響朗讀；資料必須與這一句的原文相符，避免錯套其他版本。
export function readingText(overrides, day, k, original) {
  const entry = overrides?.[lineKey(day, k)];
  if (entry?.text !== original || !Array.isArray(entry.parts) || !entry.parts.length
    || !entry.parts.every(part => typeof part === 'string' && part.trim())) return original;
  return entry.parts.join('');
}

export function taiwanMaleVoice(voices) {
  return voices.find(voice => /^zh-tw$/i.test(voice.lang.replace('_', '-'))
    && /YunJhe|雲哲/i.test(voice.name)) || null;
}
