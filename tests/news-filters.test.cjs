const {test} = require('node:test');
const assert = require('node:assert/strict');
const {classify,select} = require('../news-filters.js');

test('mixed domestic collection cannot turn Kane or Son MLS news into domestic news',()=>{
  for(const title of ['73골 몰아친 케인, 월드컵 우승 트로피 없이 발롱도르 가능할까','손흥민 1골 1도움, LAFC 무승부','이강인 韓 축구 역대 최고 이적료 2위, 라리가 이적생 위엄 재조명']){
    const topics=classify({title,category:'domestic',source:'연합뉴스'});
    assert.equal(topics.domestic,false,title);
    assert.equal(topics.intl,true,title);
  }
});
test('K League and Korean national team are domestic even in an overseas feed',()=>{
  for(const title of ['용인FC K리그2 프렌들리 구단상 도전','홍명보 한국 대표팀 명단 발표','수원 삼성, 주말 경기 승리']){
    const topics=classify({title,tag:'해외축구'});
    assert.equal(topics.domestic,true,title);
    assert.equal(topics.intl,false,title);
  }
});
test('publisher or an unknown title alone cannot assign an overseas category',()=>{
  assert.equal(classify({title:'새 소식이 도착했습니다',source:'연합뉴스'}).intl,false);
  assert.equal(classify({title:'새 소식이 도착했습니다',source:'연합뉴스'}).domestic,false);
});
test('Korean player names include returnees and English spellings, not their foreign friends',()=>{
  for(const title of ['지동원 현역 은퇴 선언','Heung-min Son scores for LAFC','Kim Min-jae returns to training','Lee Kang-in makes his debut']) assert.equal(classify({title}).korean,true,title);
  assert.equal(classify({title:'이강인 절친, 프리미어리그 이적설…맨시티가 관심'}).korean,false);
});
test('transfer filter excludes retrospectives, sponsor contracts and coach appointments',()=>{
  for(const title of ['손흥민도 충격받았다! LAFC 이적 당시 회상','이강인 역대 최고 이적료 2위 위엄 재조명','현대차, UEFA 챔피언스리그 공식 파트너 계약','[오피셜] 한국 대표팀 감독 선임','토트넘 새 감독 영입 확정']) assert.equal(classify({title}).transfer,false,title);
});
test('transfer filter includes active deals, rumours, loans and renewals',()=>{
  for(const title of ['상가레, 맨체스터 시티 → 알 카디시야 완전 이적','이강인 절친, 프리미어리그 이적설','손흥민 LAFC 재계약 합의','역대 최고 이적료로 선수 영입 확정','김지수 임대 이적','Arsenal signs new striker','Kane contract extension confirmed']) assert.equal(classify({title}).transfer,true,title);
});
test('topic selection precedes the four-row limit and only All prioritises Korean players',()=>{
  const rows=[{title:'손흥민 LAFC 경기',d:1},...Array.from({length:9},(_,i)=>({title:'아스널 새 경기 소식 '+i,d:i+2})),{title:'K리그2 용인FC 승리',d:20}];
  assert.equal(select(rows,'all')[0].title,'손흥민 LAFC 경기');
  assert.equal(select(rows,'intl')[0].d,10);
  assert.equal(select(rows,'intl').length,4);
  assert.deepEqual(select(rows,'domestic').map(n=>n.title),['K리그2 용인FC 승리']);
  assert.equal(select(rows,'transfer').length,0);
});
test('refreshing the data preserves the requested filter rather than reverting to All',()=>{
  const rows=[{title:'K리그1 이번 주 일정',d:2},{title:'손흥민 LAFC 골',d:3}];
  assert.equal(select(rows,'domestic')[0].title,'K리그1 이번 주 일정');
  const refreshed=select([...rows,{title:'이강인 이적 확정',d:4}],'domestic');
  assert.equal(refreshed.length,1);
  assert.equal(refreshed[0].title,'K리그1 이번 주 일정');
});
