#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["edge-tts==7.2.8"]
# ///
"""臺灣男聲清晰朗讀。uv run scripts/gen-audio.py --help；依內容雜湊續做，不以舊檔大小判定完成。"""
import argparse
import array
import asyncio
import fcntl
import hashlib
import json
import re
import tempfile
import wave
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOICE = 'zh-TW-YunJheNeural'
RATE = '-18%'
REVISION = '20261003-yunjhe-v1'
SAMPLE_RATE = 24000
COMPOSITOR = 1


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def split_text(text):
    # 只在現有標點切段；無標點的詩句不猜測詞界。
    return [p.strip() for p in re.findall(r'[^，,。！？；：!?;:\n]+[，,。！？；：!?;:]*', text) if p.strip()]


def line_plan(key, text, overrides):
    override = overrides.get(key)
    if override and override['text'] != text:
        raise ValueError(f'{key} 原文已變，請重新審核讀音設定')
    parts = override['parts'] if override else split_text(text)
    gaps = override.get('gaps_ms', [420] * (len(parts) - 1)) if override else [420] * (len(parts) - 1)
    if not parts or any(not p.strip() for p in parts) or len(gaps) != len(parts) - 1 or any(g < 0 for g in gaps):
        raise ValueError(f'{key} 分段／停頓設定錯誤')
    plan = dict(text=text, parts=parts, gaps_ms=gaps, voice=VOICE, rate=RATE, revision=REVISION, compositor=COMPOSITOR)
    return dict(id=key, **plan, input_sha256=digest(plan))


def make_jobs(scenes, overrides, days=None):
    all_keys = {f"{s['id']:03d}-{i}" for s in scenes for i, _ in enumerate(s['lines'], 1)}
    if set(overrides) - all_keys:
        raise ValueError('讀音設定包含不存在的題號')
    return [line_plan(f"{s['id']:03d}-{i}", line['text'], overrides)
            for s in scenes if days is None or s['id'] in days
            for i, line in enumerate(s['lines'], 1)]


def trim(samples):
    # 保留軟子音的前後緩衝，只移除片段邊界近乎無聲的部分。
    bounds = [i for i, v in enumerate(samples) if abs(v) > 32]
    if not bounds:
        raise ValueError('語音片段沒有可辨識的訊號')
    return samples[max(0, bounds[0] - 1200):min(len(samples), bounds[-1] + 2400)]


def reusable(plan, entry, path):
    return bool(entry and entry.get('input_sha256') == plan['input_sha256'] and path.is_file()
                and hashlib.sha256(path.read_bytes()).hexdigest() == entry.get('audio_sha256'))


def write_json(path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    tmp.replace(path)


def cached_pcm(target, key):
    """僅信任生成當下留下的內容指紋；舊快取或損毀快取必須重新生成。"""
    try:
        raw = target.read_bytes()
        metadata = read_json(target.with_suffix('.json'))
        if metadata != dict(cache_key=key, sha256=hashlib.sha256(raw).hexdigest(),
                            bytes=len(raw), sample_rate=SAMPLE_RATE, channels=1, sample_width=2):
            return None
        if len(raw) < 2000 or len(raw) % 2:
            return None
        data = array.array('h'); data.frombytes(raw)
        trim(data)
        return raw
    except (OSError, ValueError, TypeError):
        return None


@contextmanager
def generation_lock(*directories):
    handles = []
    try:
        for directory in sorted(set(directories)):
            directory.mkdir(parents=True, exist_ok=True)
            handle = (directory / '.generation.lock').open('a')
            handles.append(handle)
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError(f'此資料夾已有生成程序執行中：{directory}') from None
        yield
    finally:
        for handle in handles:
            handle.close()


async def build(args, jobs):
    with generation_lock(args.output_dir.resolve(), args.cache_dir.resolve()):
        return await build_locked(args, jobs)


async def build_locked(args, jobs):
    import edge_tts
    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    cache = args.cache_dir.resolve()
    cache.mkdir(parents=True, exist_ok=True)
    manifest_path = args.manifest or (ROOT / 'data/audio-manifest.json' if out == ROOT / 'audio' else out / 'audio-manifest.json')
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    old = read_json(manifest_path) if manifest_path.exists() else {}
    entries = old.get('files', {})
    completed = {p['id']: entries[p['id']] for p in jobs if reusable(p, entries.get(p['id']), out / (p['id'] + '.mp3'))}
    pending = [p for p in jobs if p['id'] not in completed]
    locks = {}
    failures = []
    raw_count = 0

    def checkpoint():
        write_json(manifest_path, dict(revision=REVISION, voice=VOICE, rate=RATE, compositor=COMPOSITOR,
                   expected=len(jobs), completed=len(completed), failures=failures, files=dict(sorted(completed.items()))))

    async def segment(text):
        nonlocal raw_count
        key = digest(dict(text=text, voice=VOICE, rate=RATE, engine='edge-tts-7.2.8'))
        target = cache / (key + '.pcm')
        async with locks.setdefault(key, asyncio.Lock()):
            raw = cached_pcm(target, key)
            if raw is None:
                error = None
                for attempt in range(2):
                    temporary = tempfile.TemporaryDirectory(prefix='.segment-', dir=cache)
                    mp3 = Path(temporary.name) / 'source.mp3'
                    try:
                        await asyncio.wait_for(edge_tts.Communicate(text, VOICE, rate=RATE).save(str(mp3)), timeout=60)
                        proc = await asyncio.create_subprocess_exec('ffmpeg', '-nostdin', '-v', 'error', '-i', str(mp3),
                            '-f', 's16le', '-ac', '1', '-ar', str(SAMPLE_RATE), 'pipe:1',
                            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                        raw, err = await proc.communicate()
                        if proc.returncode or len(raw) < 2000:
                            raise ValueError('音檔解碼失敗: ' + err.decode()[-200:])
                        data = array.array('h'); data.frombytes(raw)
                        trim(data)  # 靜音輸出不能寫入快取。
                        temp = target.with_suffix('.tmp.pcm'); temp.write_bytes(raw); temp.replace(target)
                        write_json(target.with_suffix('.json'), dict(cache_key=key,
                            sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw),
                            sample_rate=SAMPLE_RATE, channels=1, sample_width=2))
                        raw_count += 1
                        break
                    except Exception as exc:
                        error = exc
                        if attempt == 0:
                            await asyncio.sleep(2)
                    finally:
                        temporary.cleanup()
                raw = cached_pcm(target, key)
                if raw is None:
                    raise RuntimeError(f'TTS 兩次未成功: {error}')
            data = array.array('h'); data.frombytes(raw)
            return trim(data)

    async def render(plan):
        combined = array.array('h', [0] * 2400)
        for i, text in enumerate(plan['parts']):
            combined.extend(await segment(text))
            if i < len(plan['gaps_ms']):
                combined.extend([0] * (24 * plan['gaps_ms'][i]))
        combined.extend([0] * 4800)
        target = out / (plan['id'] + '.mp3')
        with tempfile.TemporaryDirectory(prefix='dq365-') as tmp:
            wav = Path(tmp) / 'audio.wav'; mp3 = Path(tmp) / 'audio.mp3'
            with wave.open(str(wav), 'wb') as f:
                f.setnchannels(1); f.setsampwidth(2); f.setframerate(SAMPLE_RATE); f.writeframes(combined.tobytes())
            proc = await asyncio.create_subprocess_exec('ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(wav),
                '-codec:a', 'libmp3lame', '-b:a', '96k', str(mp3),
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            _, err = await proc.communicate()
            if proc.returncode or not mp3.exists() or mp3.stat().st_size < 3000:
                raise RuntimeError('MP3 編碼失敗: ' + err.decode()[-200:])
            data = mp3.read_bytes()
            temp = target.with_suffix('.tmp.mp3'); temp.write_bytes(data); temp.replace(target)
        completed[plan['id']] = dict(input_sha256=plan['input_sha256'], audio_sha256=hashlib.sha256(data).hexdigest(),
                                    bytes=len(data), seconds=round(len(combined) / SAMPLE_RATE, 3))

    queue = asyncio.Queue()
    for p in pending:
        queue.put_nowait(p)

    async def worker():
        while not queue.empty():
            plan = queue.get_nowait()
            try:
                await render(plan)
            except Exception as exc:
                failures.append(dict(id=plan['id'], error=str(exc)))
                print('FAIL', plan['id'], str(exc), flush=True)
            finally:
                queue.task_done()
                checkpoint()
                if (len(completed) + len(failures)) % 25 == 0:
                    print(f"完成 {len(completed)}/{len(jobs)}，失敗 {len(failures)}，新片段 {raw_count}", flush=True)

    print(f"臺灣男聲：共 {len(jobs)} 句，沿用 {len(completed)} 句，待產生 {len(pending)} 句，並行 {args.workers}", flush=True)
    await asyncio.gather(*(worker() for _ in range(args.workers)))
    checkpoint()
    print(f"結束：完成 {len(completed)}/{len(jobs)}，失敗 {len(failures)}", flush=True)
    return 1 if failures else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'audio')
    parser.add_argument('--cache-dir', type=Path, default=ROOT / 'scratch/yunjhe-segments')
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--days', help='僅產生指定天，例如 1,8；建議搭配獨立 output-dir')
    parser.add_argument('--plan-only', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.workers <= 8:
        parser.error('workers 必須介於 1–8')
    days = {int(n) for n in args.days.split(',')} if args.days else None
    if days and args.output_dir.resolve() == ROOT / 'audio':
        parser.error('--days 請搭配獨立 --output-dir，避免部分產出覆蓋正式清單')
    scenes = read_json(ROOT / 'data/scenes.json')
    overrides = read_json(ROOT / 'data/reading-overrides.json')
    jobs = make_jobs(scenes, overrides, days)
    if not jobs:
        parser.error('沒有符合天數的句子')
    if args.plan_only:
        print(json.dumps(dict(lines=len(jobs), segments=sum(len(p['parts']) for p in jobs),
                              voice=VOICE, rate=RATE, overrides=len(overrides)), ensure_ascii=False))
        return 0
    return asyncio.run(build(args, jobs))


if __name__ == '__main__':
    raise SystemExit(main())
