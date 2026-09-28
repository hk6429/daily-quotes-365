// 產出跨批重複清單：scratch/used-quotes.txt（全站已用原句）與 scratch/dedupe-NN.json（該批需替換的句／需改名的 title）
const fs=require('fs');const out=[];
for(const f of fs.readdirSync('scratch').filter(f=>/^batch-\d+\.json$/.test(f)).sort()) out.push(...JSON.parse(fs.readFileSync('scratch/'+f,'utf8')));
out.sort((a,b)=>a.id-b.id);
const norm=t=>t.replace(/[，。、！？；：「」『』（）,.!?;:'"“”‘’\s—-]/g,'');
const seen=new Set(),titles=new Set(),plan={};
const batchOf=id=>String(Math.min(12,Math.ceil(id/30))).padStart(2,'0');
for(const x of out){const b=batchOf(x.id);plan[b]=plan[b]||{titles:[],lines:[]};
 if(titles.has(x.title_zh)) plan[b].titles.push({id:x.id,title_zh:x.title_zh}); titles.add(x.title_zh);
 x.lines.forEach((l,k)=>{const n=norm(l.text); if(seen.has(n)) plan[b].lines.push({id:x.id,k:k+1,title_zh:x.title_zh,text:l.text,author:l.author}); seen.add(n);});}
fs.writeFileSync('scratch/used-quotes.txt',[...seen].join('\n'));
let total=0;for(const [b,p] of Object.entries(plan)){ if(p.lines.length||p.titles.length){fs.writeFileSync(`scratch/dedupe-${b}.json`,JSON.stringify(p,null,1));} total+=p.lines.length; console.log(b,'lines',p.lines.length,'titles',p.titles.length);}
console.log('total',total,'used',seen.size);
