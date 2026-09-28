const fs=require('fs');const s=JSON.parse(fs.readFileSync('data/scenes.json','utf8'));
const strict=!!process.env.STRICT_IMG; let errs=[],warn=[];
const sz=p=>{try{return fs.statSync(p).size}catch{return 0}};
for(const x of s){const id=String(x.id).padStart(3,'0');
 for(let k=1;k<=5;k++){ if(sz(`audio/${id}-${k}.mp3`)<3000) errs.push(`audio ${id}-${k}`); }
 if(sz(`img/${id}.webp`)<20000) (strict?errs:warn).push(`img ${id}`); }
if(warn.length) console.warn(`warn: ${warn.length} images missing`);
if(errs.length){console.error(errs.slice(0,20).join('\n'),`\n${errs.length} errors`);process.exit(1)}
console.log('assets ok');
