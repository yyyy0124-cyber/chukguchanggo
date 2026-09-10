(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const isApp=!!$('sg-home');
 if(!isApp){
  document.body.classList.add('sg-static');
  const main=document.querySelector('main,.wrap,.container');
  if(main&&!main.querySelector('.sg-section-nav')){
   const nav=document.createElement('nav');nav.className='sg-section-nav';nav.setAttribute('aria-label','주요 페이지');
   [['/','홈'],['/news/','뉴스'],['/tools/','도구'],['/mag/','매거진'],['/players/korean/','한국 선수'],['/transfer/','이적시장']].forEach(([href,label])=>{const a=document.createElement('a');a.href=href;a.textContent=label;if(href!=='/'&&location.pathname.startsWith(href))a.setAttribute('aria-current','page');nav.append(a);});
   main.prepend(nav);
  }
 }
 document.querySelectorAll('table').forEach(table=>{if(table.parentElement.classList.contains('sg-table-scroll'))return;const wrap=document.createElement('div');wrap.className='sg-table-scroll';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','표 — 가로로 스크롤할 수 있습니다');table.before(wrap);wrap.append(table);});
 document.querySelectorAll('.field').forEach(field=>{const label=field.querySelector('label'),input=field.querySelector('input,select,textarea');if(label&&input&&input.id&&!label.htmlFor)label.htmlFor=input.id;});
 document.querySelectorAll('.result').forEach(el=>{el.setAttribute('role','status');el.setAttribute('aria-live','polite');});
 if(!isApp)return;
 const oldNav=window.navTo;
 function mode(){document.body.classList.toggle('sg-inner',$('sg-home').hidden);}
 window.navTo=function(view){if(['about','privacy','contact'].includes(view)){location.href='/'+view+'.html';return false;}document.body.classList.remove('sg-tool-focus');document.querySelectorAll('.sg-tool-back').forEach(el=>el.remove());const r=oldNav(view);mode();return r;};
 const oldTool=window.navTool;
 window.navTool=function(id){
  const aliases={goalpace:'goal-pace',tripcost:'trip-cost',fx:'fx-calc',stud:'stud-pick',bootsize:'boot-size',fpl:'fpl-budget',glossary:'term-search','jersey-size':'uniform'};
  id=aliases[id]||id;
  if(['uniform','best11','balance-game'].includes(id)){location.href='/tools/'+id+'/';return false;}
  const el=$(id);
  if(!el||!el.classList.contains('tool'))return window.navTo('tools');
  const r=oldTool(id);
  document.querySelectorAll('.sg-active-tool').forEach(t=>t.classList.remove('sg-active-tool'));
  el.classList.add('sg-active-tool');document.body.classList.add('sg-tool-focus');
  const back=document.createElement('div');back.className='sg-tool-back';const a=document.createElement('a');a.href='#tools';a.textContent='← 도구 전체 보기';a.onclick=()=>window.navTo('tools');back.append(a);el.before(back);
  const heading=el.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});document.title=heading.textContent+' | 축구창고';}
  return r;
 };
 window.sgEventDday=function(){
  const raw=$('event-date').value,out=$('event-result');out.classList.add('show');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)){out.textContent='경기 날짜를 선택해 주세요.';return;}
  const kst=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const delta=Math.round((Date.parse(raw+'T00:00:00Z')-Date.parse(kst+'T00:00:00Z'))/86400000);
  out.textContent=delta===0?'오늘입니다.':delta>0?'D-'+delta+' · '+delta+'일 남았습니다.':Math.abs(delta)+'일 지난 날짜입니다.';
 };
 mode();
 const hash=location.hash.slice(1);
 if(['uniform','best11','balance-game'].includes(hash)){location.replace('/tools/'+hash+'/');return;}
 if(['about','privacy','contact'].includes(hash))window.navTo(hash);
 else if($(hash)?.classList.contains('tool'))window.navTool(hash);
 else if(hash.startsWith('article-'))window.openArticle(hash.slice(8));
 else if(hash==='newsitem'){
  let item=null;try{item=JSON.parse(sessionStorage.getItem('sg-last-news'));}catch(e){}
  if(item&&item.t&&/^https?:/.test(item.u||''))window.openNewsView(item);
  else $('sg-news-detail').innerHTML='<div class="article-body"><h1>기사 목록에서 다시 선택해 주세요</h1><p>이 기사 주소에는 원문 정보가 저장되어 있지 않습니다.</p><a href="/news/">뉴스 목록 보기 →</a></div>';
 }
})();
