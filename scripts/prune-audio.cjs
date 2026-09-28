// 比對 data/scenes.json 與 git HEAD 版本，原句文字有變的行刪掉 mp3（之後 gen-audio.py 會補產）
const fs=require('fs'),{execSync}=require('child_process');
const cur=JSON.parse(fs.readFileSync('data/scenes.json','utf8'));
let old;try{old=JSON.parse(execSync('git show HEAD:data/scenes.json',{encoding:'utf8',maxBuffer:1<<26}));}catch{console.log('no HEAD');process.exit(0)}
let n=0;for(const x of cur){const o=old.find(o=>o.id===x.id);x.lines.forEach((l,k)=>{if(!o||o.lines[k].text!==l.text){const p=`audio/${String(x.id).padStart(3,'0')}-${k+1}.mp3`;if(fs.existsSync(p)){fs.unlinkSync(p);n++;}}});}
console.log('pruned',n);
