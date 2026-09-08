(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SGBoards=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const categories=[
  {id:'epl',icon:'⚽',name:'EPL',group:'유럽 주요 리그',description:'프리미어리그 경기와 구단 이야기를 나누세요.'},
  {id:'laliga',icon:'⚽',name:'라리가',group:'유럽 주요 리그',description:'스페인 라리가 경기와 구단 이야기를 나누세요.'},
  {id:'bundesliga',icon:'⚽',name:'분데스리가',group:'유럽 주요 리그',description:'독일 분데스리가 경기와 구단 이야기를 나누세요.'},
  {id:'serie-a',icon:'⚽',name:'세리에 A',group:'유럽 주요 리그',description:'이탈리아 세리에 A 경기와 구단 이야기를 나누세요.'},
  {id:'ligue-1',icon:'⚽',name:'리그 1',group:'유럽 주요 리그',description:'프랑스 리그 1 경기와 구단 이야기를 나누세요.'},
  {id:'korean-players',icon:'🇰🇷',name:'한국선수',group:'한국축구',description:'한국선수의 경기, 활약과 근황을 함께 이야기하세요.'},
  {id:'kleague',icon:'🏟️',name:'K리그',group:'한국축구',description:'K리그1·K리그2 경기와 응원하는 구단 이야기를 나누세요.'},
  {id:'national',icon:'🇰🇷',name:'국가대표',group:'한국축구',description:'남녀 국가대표와 연령별 대표팀 이야기를 나누세요.'},
  {id:'free',icon:'📝',name:'자유게시판',group:'자유 이야기',description:'주제에 구애받지 않고 축구 이야기를 나누세요. 기존 자유게시판 글도 이곳에 있습니다.'}
 ];
 function find(id){return categories.find(c=>c.id===id)||null;}
 function belongs(post,id){return !!find(id)&&(post.board||'free')===id;}
 function queryValue(id){if(!find(id))throw new Error('Unknown board');return id==='free'?null:id;}
 return {categories,find,belongs,queryValue};
});
