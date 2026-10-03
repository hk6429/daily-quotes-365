import importlib.util
import asyncio
import array
import json
import math
import shutil
import sys
import tempfile
import types
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('gen_audio', ROOT / 'scripts/gen-audio.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)


class AudioPlanTest(unittest.TestCase):
    def test_every_line_uses_selected_voice_and_keeps_original(self):
        scenes = audio.read_json(ROOT / 'data/scenes.json')
        overrides = audio.read_json(ROOT / 'data/reading-overrides.json')
        plans = audio.make_jobs(scenes, overrides)
        self.assertEqual(len(plans), 1825)
        self.assertEqual(len({p['id'] for p in plans}), 1825)
        self.assertTrue(all(p['voice'] == 'zh-TW-YunJheNeural' and p['rate'] == '-18%' for p in plans))
        first = plans[0]
        self.assertEqual(first['text'], '學而時習之，不亦說乎？')
        self.assertIn('不亦悅乎？', first['parts'])
        self.assertEqual(first['gaps_ms'], [420])

    def test_stale_pronunciation_override_is_rejected(self):
        with self.assertRaisesRegex(ValueError, '原文已變'):
            audio.line_plan('001-1', '別的原文', {'001-1': {'text': '舊原文', 'parts': ['舊原文']}})

    def test_unreviewed_text_only_splits_at_existing_punctuation(self):
        text = '行到水窮處，坐看雲起時。'
        parts = audio.split_text(text)
        self.assertEqual(parts, ['行到水窮處，', '坐看雲起時。'])
        self.assertEqual(''.join(parts), text)

    def test_existing_female_file_is_not_skipped_by_size(self):
        plan = audio.line_plan('001-1', '測試句。', {})
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'audio.mp3'; path.write_bytes(b'old voice' * 1000)
            self.assertFalse(audio.reusable(plan, None, path))
            self.assertFalse(audio.reusable(plan, {'input_sha256': 'old'}, path))
            entry = {'input_sha256': plan['input_sha256'], 'audio_sha256': audio.hashlib.sha256(path.read_bytes()).hexdigest()}
            self.assertTrue(audio.reusable(plan, entry, path))
            path.write_bytes(b'corrupt')
            self.assertFalse(audio.reusable(plan, entry, path))

    def test_untrusted_or_corrupt_pcm_is_regenerated(self):
        for damaged in (b'', b'bad non-silent cache' * 300):
            with self.subTest(bytes=len(damaged)), tempfile.TemporaryDirectory() as temp:
                root = Path(temp); cache = root / 'cache'; cache.mkdir()
                plan = audio.line_plan('001-1', '測試句。', {})
                key = audio.digest(dict(text='測試句。', voice=audio.VOICE, rate=audio.RATE, engine='edge-tts-7.2.8'))
                target = cache / (key + '.pcm'); target.write_bytes(damaged)
                # 即使存在過期的雜湊，不可把損毀資料補登為可信快取。
                audio.write_json(target.with_suffix('.json'), {'sha256': 'stale'})
                source = root / 'fixture.wav'
                with wave.open(str(source), 'wb') as f:
                    f.setnchannels(1); f.setsampwidth(2); f.setframerate(audio.SAMPLE_RATE)
                    f.writeframes(array.array('h', (int(3000 * math.sin(i * 0.1)) for i in range(24000))).tobytes())
                calls = []

                class FakeVoice:
                    def __init__(self, *args, **kwargs):
                        calls.append(args)

                    async def save(self, path):
                        shutil.copyfile(source, path)

                args = types.SimpleNamespace(output_dir=root / 'out', cache_dir=cache, manifest=None, workers=2)
                with patch.dict(sys.modules, {'edge_tts': types.SimpleNamespace(Communicate=FakeVoice)}):
                    self.assertEqual(asyncio.run(audio.build(args, [plan])), 0)
                    self.assertEqual(len(calls), 1)
                    self.assertIsNotNone(audio.cached_pcm(target, key))
                    self.assertEqual(asyncio.run(audio.build(args, [plan])), 0)
                    self.assertEqual(len(calls), 1)
                target.write_bytes(b'changed')
                self.assertIsNone(audio.cached_pcm(target, key))

    def test_generation_lock_rejects_overlap_and_releases(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            with audio.generation_lock(directory):
                with self.assertRaisesRegex(RuntimeError, '已有生成程序'):
                    with audio.generation_lock(directory):
                        self.fail('重疊生成程序不應取得鎖')
            with audio.generation_lock(directory):
                pass


if __name__ == '__main__':
    unittest.main()
