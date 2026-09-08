const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const boards=require('../board-categories.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
test('Eight requested topics and legacy free board have stable unique routes',()=>{
 assert.deepEqual(boards.categories.map(c=>c.id),['epl','laliga','bundesliga','serie-a','ligue-1','korean-players','kleague','national','free']);
 assert.equal(new Set(boards.categories.map(c=>c.id)).size,9);
 assert.throws(()=>boards.queryValue('chat/free'));
});
test('Legacy posts stay in free and every topic is isolated',()=>{
 assert.equal(boards.queryValue('free'),null);
 assert.equal(boards.belongs({t:'old'},'free'),true);
 for(const c of boards.categories){
  const p={board:boards.queryValue(c.id)};
  for(const other of boards.categories)assert.equal(boards.belongs(p,other.id),c.id===other.id);
 }
});
test('Slow replies cannot overwrite the newly selected board',async()=>{
 const pending=[],list={innerHTML:''},renders=[];
 const ctx={SGBoards:boards,boardCur:'epl',boardReady:true,boardLoadVersion:0,boardPosts:[],boardCmts:{},window:{firebase:true},document:{getElementById:()=>list},renderBoardList(){renders.push(ctx.boardPosts.map(p=>p.t));},firebase:{database(){return {ref(){return {orderByChild(){return this;},equalTo(id){this.category=id;return this;},limitToLast(){return this;},once(){return new Promise(resolve=>pending.push({category:this.category,resolve}));}};}};}}};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function boardLoad(){'),html.indexOf('function renderBoardList(){')),ctx);
 ctx.boardLoad();ctx.boardCur='national';ctx.boardLoad();
 assert.deepEqual(pending.map(p=>p.category),['epl','national']);
 pending[1].resolve({val:()=>null});await new Promise(r=>setImmediate(r));
 pending[0].resolve({val:()=>({old:{board:'epl',t:'wrong board'}})});await new Promise(r=>setImmediate(r));
 assert.equal(renders.length,1);assert.equal(ctx.boardPosts.length,0);
});
test('Post writes include selected topic and chat client is removed',()=>{
 assert.match(html,/board:SGBoards.queryValue\(targetBoard\)/);
 for(const old of ['id="chat-ui"','id="chat-in"','function chatSend','function chatJoin','ref("chat/'])assert.ok(!html.includes(old),old);
});
test('Submitting a post sends the captured category and guards duplicate writes',async()=>{
 const els={'bw-nick':{value:'tester'},'bw-title':{value:'test title'},'bw-body':{value:'test body'},'board-submit':{disabled:false},'board-write':{hidden:false}};
 let payload,finish,loads=0;
 const db=()=>({ref(p){assert.equal(p,'posts');return {push(value){payload=value;return new Promise(r=>finish=r);}};}});db.ServerValue={TIMESTAMP:123};
 const ctx={boardReady:true,boardCur:'laliga',boardSaving:false,boardLastWrite:0,BOARD_BAN:/forbidden/,SGBoards:boards,window:{firebase:true},firebase:{database:db},document:{getElementById:id=>els[id]},boardIp:cb=>cb('0.0'),boardLoad:()=>loads++,alert:message=>assert.fail(message)};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function boardWrite(){'),html.indexOf('function boardCmt(')),ctx);
 ctx.boardWrite();assert.equal(payload.board,'laliga');assert.equal(ctx.boardSaving,true);assert.equal(els['board-submit'].disabled,true);
 ctx.boardWrite();finish();await new Promise(r=>setImmediate(r));assert.equal(loads,1);assert.equal(ctx.boardSaving,false);assert.equal(els['bw-body'].value,'');
});
