#!/usr/bin/env python3
"""檢查男聲音檔完整性；退出碼 0＝技術檢查通過、1＝驗收失敗、2＝設定錯誤。

完整模式必須涵蓋 scenes.json 的 1825 句；--partial 僅驗收 manifest 列出的子集。
需已安裝 ffmpeg、ffprobe，Python 本身只使用標準函式庫。技術通過不代表讀音正確。
"""
import argparse
import array
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_COUNT = 1825
EXPECTED_VOICE = 'zh-TW-YunJheNeural'
EXPECTED_RATE = '-18%'
SAMPLE_RATE = 24000


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'JSON 出現重複鍵：{key}')
        result[key] = value
    return result


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique_object)


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def run(command):
    return subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)


def check_file(key, entry, plan, output_dir, min_seconds):
    result = dict(id=key, errors=[], review=[])
    errors, review = result['errors'], result['review']
    path = output_dir / f'{key}.mp3'
    if not isinstance(entry, dict):
        errors.append('manifest_entry_invalid')
        return result
    if entry.get('input_sha256') != plan['input_sha256']:
        errors.append('input_fingerprint_mismatch')
    if not path.is_file():
        errors.append('audio_file_missing')
        return result
    try:
        result['bytes'] = path.stat().st_size
        result['audio_sha256'] = sha256(path)
        if type(entry.get('bytes')) is not int or entry['bytes'] != result['bytes']:
            errors.append('byte_count_mismatch')
        if entry.get('audio_sha256') != result['audio_sha256']:
            errors.append('audio_hash_mismatch')
        probe = run(['ffprobe', '-v', 'error', '-show_entries',
                     'format=duration:stream=codec_type,codec_name,sample_rate,channels',
                     '-of', 'json', str(path)])
        if probe.returncode or probe.stderr.strip():
            errors.append('ffprobe_failed')
            result['probe_error'] = probe.stderr.decode(errors='replace')[-500:]
        else:
            metadata = json.loads(probe.stdout)
            streams = metadata.get('streams', [])
            audio = [s for s in streams if s.get('codec_type') == 'audio']
            if len(audio) != 1 or audio[0].get('codec_name') != 'mp3':
                errors.append('expected_single_mp3_stream')
            result['streams'] = streams
            duration = float(metadata.get('format', {}).get('duration', 'nan'))
            if not math.isfinite(duration) or duration <= 0:
                errors.append('container_duration_invalid')
            else:
                result['container_seconds'] = round(duration, 4)

        # 完整解碼，不以 ffprobe 可讀或只解碼開頭作為音檔有效的證據。
        decoded = run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror',
                       '-err_detect', 'explode', '-i', str(path), '-map', '0:a:0',
                       '-ac', '1', '-ar', str(SAMPLE_RATE), '-f', 's16le', 'pipe:1'])
        if decoded.returncode or decoded.stderr.strip():
            errors.append('full_decode_failed')
            result['decode_error'] = decoded.stderr.decode(errors='replace')[-500:]
            return result
        if len(decoded.stdout) % 2 or not decoded.stdout:
            errors.append('decoded_samples_invalid')
            return result
        samples = array.array('h')
        samples.frombytes(decoded.stdout)
        if sys.byteorder != 'little':
            samples.byteswap()
        seconds = len(samples) / SAMPLE_RATE
        peak = max(abs(min(samples)), max(samples))
        square_sum = sum(sample * sample for sample in samples)
        rms = math.sqrt(square_sum / len(samples))
        clipped = sum(abs(sample) >= 32760 for sample in samples)
        result.update(decoded_seconds=round(seconds, 4), samples=len(samples), peak=peak,
                      rms_dbfs=round(20 * math.log10(rms / 32768), 2) if rms else None,
                      clipped_samples=clipped, clipped_ratio=round(clipped / len(samples), 8))
        if peak <= 32:
            errors.append('silent_or_near_silent_audio')
        if seconds < min_seconds:
            errors.append('implausibly_short_audio')
        manifest_seconds = entry.get('seconds')
        if not finite_number(manifest_seconds) or manifest_seconds <= 0:
            errors.append('manifest_duration_invalid')
        elif abs(seconds - manifest_seconds) > 0.15:
            errors.append('decoded_manifest_duration_mismatch')
        container_seconds = result.get('container_seconds')
        if container_seconds and abs(container_seconds - seconds) > 0.25:
            review.append('container_decoded_duration_difference')
        if clipped:
            review.append('possible_clipping')
        if rms and result['rms_dbfs'] < -40:
            review.append('low_audio_level')
        # 字速僅供人工複核，不能用字數換算硬性秒數而擋住正常音檔。
        characters = sum(char.isalnum() for char in plan['text'])
        rate = characters / seconds
        result['characters_per_second'] = round(rate, 3)
        if seconds < 1 or rate > 9 or rate < 1:
            review.append('duration_or_speech_rate_review')
    except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
        errors.append('inspection_failed')
        result['inspection_error'] = str(exc)[:500]
    return result


def inspect(args):
    generator_path = ROOT / 'scripts/gen-audio.py'
    source_paths = dict(scenes=args.scenes, overrides=args.overrides, generator=generator_path)
    source_hashes = {name: sha256(path) for name, path in source_paths.items()}
    spec = importlib.util.spec_from_file_location('daily_quotes_gen_audio', generator_path)
    generator = importlib.util.module_from_spec(spec)
    previous_bytecode = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec.loader.exec_module(generator)
    finally:
        sys.dont_write_bytecode = previous_bytecode
    jobs = generator.make_jobs(read_json(args.scenes), read_json(args.overrides))
    ids = [job['id'] for job in jobs]
    plans = {job['id']: job for job in jobs}
    manifest = read_json(args.manifest)
    if not isinstance(manifest, dict) or not isinstance(manifest.get('files'), dict):
        raise ValueError('manifest 必須包含 files 物件')
    entries = manifest['files']
    errors = []
    report = dict(schema_version=1, checked_at=datetime.now(timezone.utc).isoformat(),
                  mode='partial' if args.partial else 'full', output_dir=str(args.output_dir),
                  manifest=str(args.manifest), source_sha256=source_hashes,
                  checks_scope='檔案、設定指紋與解碼訊號；不包含 ASR 或人工讀音判定',
                  thresholds=dict(min_seconds=args.min_seconds, silence_peak_max=32,
                                  duration_tolerance_seconds=0.15, clipping_sample_min=32760),
                  errors=errors, files=[])
    duplicates = [key for key, count in Counter(ids).items() if count != 1]
    if duplicates:
        errors.append(dict(code='duplicate_scene_ids', ids=duplicates))
    if len(ids) != EXPECTED_COUNT:
        errors.append(dict(code='source_count_mismatch', actual=len(ids), expected=EXPECTED_COUNT))
    if not entries:
        errors.append(dict(code='manifest_empty'))
    for field, expected in [('voice', EXPECTED_VOICE), ('rate', EXPECTED_RATE),
                            ('revision', generator.REVISION), ('compositor', generator.COMPOSITOR)]:
        if manifest.get(field) != expected:
            errors.append(dict(code='manifest_metadata_mismatch', field=field, expected=expected,
                               actual=manifest.get(field)))
    if generator.VOICE != EXPECTED_VOICE or generator.RATE != EXPECTED_RATE:
        errors.append(dict(code='generator_voice_or_rate_mismatch'))
    if type(manifest.get('completed')) is not int or manifest['completed'] != len(entries):
        errors.append(dict(code='manifest_completed_count_mismatch'))
    expected = manifest.get('expected')
    if type(expected) is not int or expected < len(entries) or expected > EXPECTED_COUNT:
        errors.append(dict(code='manifest_expected_count_invalid'))
    if manifest.get('failures') != []:
        errors.append(dict(code='manifest_has_failures_or_missing_failure_list', details=manifest.get('failures')))
    unknown = sorted(set(entries) - set(plans))
    if unknown:
        errors.append(dict(code='manifest_unknown_ids', ids=unknown))
    if not args.partial:
        missing = sorted(set(plans) - set(entries))
        if missing:
            errors.append(dict(code='manifest_missing_ids', ids=missing))
        if expected != EXPECTED_COUNT:
            errors.append(dict(code='full_manifest_expected_count_mismatch', actual=expected))
    actual_ids = {path.stem for path in args.output_dir.glob('*.mp3')}
    if actual_ids != set(entries):
        errors.append(dict(code='directory_manifest_id_mismatch',
                           missing=sorted(set(entries) - actual_ids), extra=sorted(actual_ids - set(entries))))
    selected = sorted(set(entries) & set(plans))
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        report['files'] = list(executor.map(
            lambda key: check_file(key, entries[key], plans[key], args.output_dir, args.min_seconds), selected))
    for name, path in source_paths.items():
        if sha256(path) != source_hashes[name]:
            errors.append(dict(code='source_changed_during_check', source=name))
    checked = report['files']
    bad = [item['id'] for item in checked if item['errors']]
    review = [item['id'] for item in checked if item['review']]
    durations = [item['decoded_seconds'] for item in checked if 'decoded_seconds' in item]
    report['summary'] = dict(source_count=len(ids), manifest_count=len(entries), directory_count=len(actual_ids),
                           checked_count=len(checked), failed_count=len(bad), failed_ids=bad,
                           review_count=len(review), review_ids=review,
                           decoded_seconds_min=min(durations) if durations else None,
                           decoded_seconds_max=max(durations) if durations else None,
                           bytes_total=sum(item.get('bytes', 0) for item in checked))
    report['status'] = 'FAIL' if errors or bad else 'PASS'
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True, type=Path, help='待驗收 MP3 所在資料夾')
    parser.add_argument('--manifest', required=True, type=Path, help='音檔 manifest JSON')
    parser.add_argument('--partial', action='store_true', help='只驗收 manifest 子集，不可作為整批放行')
    parser.add_argument('--scenes', type=Path, default=ROOT / 'data/scenes.json')
    parser.add_argument('--overrides', type=Path, default=ROOT / 'data/reading-overrides.json')
    parser.add_argument('--report', type=Path, help='完整 JSON 報告；省略時僅列印摘要')
    parser.add_argument('--workers', type=int, default=4, help='並行驗收數，預設 4，上限 8')
    parser.add_argument('--min-seconds', type=float, default=0.5, help='絕對最低時長，預設 0.5 秒；不依字數決定')
    args = parser.parse_args()
    if not 1 <= args.workers <= 8 or not math.isfinite(args.min_seconds) or args.min_seconds <= 0:
        parser.error('workers 必須介於 1–8，min-seconds 必須是有限正數')
    for name in ('ffmpeg', 'ffprobe'):
        if not shutil.which(name):
            parser.error(f'找不到 {name}')
    args.output_dir = args.output_dir.resolve()
    args.manifest = args.manifest.resolve()
    if not args.output_dir.is_dir():
        parser.error('output-dir 不存在或不是資料夾')
    try:
        report = inspect(args)
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f'設定錯誤：{exc}', file=sys.stderr)
        return 2
    print(json.dumps(dict(status=report['status'], mode=report['mode'], **report['summary'],
                          global_error_codes=[error['code'] for error in report['errors']],
                          report=str(args.report) if args.report else None), ensure_ascii=False))
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
