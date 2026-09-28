const fs=require('fs');const out=[];
for(const f of fs.readdirSync('scratch').filter(f=>/^batch-\d+\.json$/.test(f)).sort()){
  let t=fs.readFileSync('scratch/'+f,'utf8').trim().replace(/^```(json)?\s*/,'').replace(/```\s*$/,'');
  try{out.push(...JSON.parse(t));}catch(e){console.error('parse fail',f,e.message);process.exit(1)}
}
out.sort((a,b)=>a.id-b.id);
fs.writeFileSync('data/scenes.json',JSON.stringify(out,null,1));
console.log('merged',out.length);
