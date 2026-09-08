const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'index.html'),'utf8');
const block=src.match(/const ARTICLES=\{[\s\S]*?\n\};/)[0];
const articles=vm.runInNewContext(block.replace('const ARTICLES=','(').replace(/;$/,')'));
const ids=new Set([...src.matchAll(/(?:id="|id:")([\w-]+)/g)].map(m=>m[1]));
test('Every editorial article has working internal destinations',()=>{
 assert.equal(Object.keys(articles).length,19);
 for(const [key,a] of Object.entries(articles)){
  for(const m of a.body.matchAll(/href=['"]([^'"]+)/g)){
   const href=m[1];if(href==='#')continue;
   if(href.startsWith('/#'))assert.ok(ids.has(href.slice(2)),`${key}: ${href}`);
   else if(href.startsWith('/'))assert.ok(fs.existsSync(path.join(root,href,href.endsWith('/')?'index.html':'')),`${key}: ${href}`);
  }
  for(const m of a.body.matchAll(/navToolA\('([^']+)'\)/g))assert.ok(ids.has(m[1]),`${key}: ${m[1]}`);
 }
});
test('Unverified evergreen claims and seeded transfer results are removed',()=>{
 for(const bad of ['스페인이 아르헨티나를 연장','홍명보 감독이 물러난 지 한 달','이강인은 왜 아틀레티코였나','눈 피로가 평소의 배','두 번째 경고 퇴장은 대상 아님'])assert.ok(!src.includes(bad),bad);
 assert.match(src,/var SG_VIDEOS = \[\];/);
 assert.ok(src.includes('article-'));
});
test('New UI scripts compile',()=>{new vm.Script(fs.readFileSync(path.join(root,'internal.js'),'utf8'));});
test('All generated detail pages include the shared UI and valid local page links',()=>{
 let count=0;
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='.git'||entry.name.includes("'"))continue;const f=path.join(dir,entry.name);if(entry.isDirectory())walk(f);else if(entry.name==='index.html'&&f!==path.join(root,'index.html')){
  const html=fs.readFileSync(f,'utf8');assert.ok(html.includes('/internal.css?v=0908-review1'),f);count++;
  for(const m of html.matchAll(/href="(\/(?:tools|mag|players|teams|news)\/[^"#?]*)"/g))assert.ok(fs.existsSync(path.join(root,m[1],'index.html')),`${f}: ${m[1]}`);
 }}}
 walk(root);assert.ok(count>=140);
});
