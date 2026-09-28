#!/usr/bin/env python3
"""edge-tts 批次：奇數句=曉臻(女) 偶數句=雲哲(男)，4 路並行，已存在跳過。只讀原句。"""
import json, os, subprocess
from concurrent.futures import ThreadPoolExecutor
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE=['zh-TW-HsiaoChenNeural','zh-TW-YunJheNeural']
scenes=json.load(open(f'{ROOT}/data/scenes.json'))
jobs=[]
for x in scenes:
    for k,l in enumerate(x['lines'],1):
        out=f"{ROOT}/audio/{x['id']:03d}-{k}.mp3"
        if os.path.exists(out) and os.path.getsize(out)>3000: continue
        jobs.append((out,VOICE[(k-1)%2],l['text']))
def run(j):
    out,v,t=j
    for _ in range(3):
        r=subprocess.run(['uvx','edge-tts','--voice',v,'--rate=-8%','--text',t,'--write-media',out],capture_output=True)
        if r.returncode==0 and os.path.exists(out) and os.path.getsize(out)>3000: return out
    return 'FAIL '+out
with ThreadPoolExecutor(4) as ex:
    for i,r in enumerate(ex.map(run,jobs),1):
        if r.startswith('FAIL') or i%100==0: print(i,len(jobs),r,flush=True)
print('done',len(jobs))
