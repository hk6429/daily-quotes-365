// 產出跨批重複清單：scratch/used-quotes.txt（全站已用原句）與 scratch/dedupe-NN.json（該批需替換的句／需改名的 title）
// 重複定義：去標點後完全相同，或（雙方皆 ≥8 字時）一方包含另一方。保留較小 id，後者需替換。
const fs=require('fs');const out=[];
for(const f of fs.readdirSync('scratch').filter(f=>/^batch-\d+\.json$/.test(f)).sort()) out.push(...JSON.parse(fs.readFileSync('scratch/'+f,'utf8')));
out.sort((a,b)=>a.id-b.id);
const norm=t=>t.replace(/[，。、！？；：「」『』（）,.!?;:'"“”‘’\s—-]/g,'');
const kept=[],titles=new Set(),plan={};
const clash=(a,b)=>a===b||(a.length>=8&&b.length>=8&&(a.includes(b)||b.includes(a)));
const batchOf=id=>String(Math.min(12,Math.ceil(id/30))).padStart(2,'0');
for(const x of out){const b=batchOf(x.id);plan[b]=plan[b]||{titles:[],lines:[]};
 if(titles.has(x.title_zh)) plan[b].titles.push({id:x.id,title_zh:x.title_zh}); titles.add(x.title_zh);
 x.lines.forEach((l,k)=>{const n=norm(l.text); const hit=kept.find(a=>clash(a.n,n));
  if(hit) plan[b].lines.push({id:x.id,k:k+1,title_zh:x.title_zh,text:l.text,author:l.author,clash_with:hit.id+': '+hit.t}); else kept.push({n,id:x.id+'-'+(k+1),t:l.text});});}
fs.writeFileSync('scratch/used-quotes.txt',kept.map(a=>a.n).join('\n'));
let total=0;for(const [b,p] of Object.entries(plan)){ if(p.lines.length||p.titles.length){fs.writeFileSync(`scratch/dedupe-${b}.json`,JSON.stringify(p,null,1));} total+=p.lines.length; if(p.lines.length||p.titles.length) console.log(b,'lines',p.lines.length,'titles',p.titles.length);}
console.log('total',total,'used',kept.length);
