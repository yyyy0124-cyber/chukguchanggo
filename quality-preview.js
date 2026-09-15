(()=>{'use strict';
 const readTools=['boot-size','kickoff','points-sim','winrate','trip-cost'];
 const articles=['watch','boots','calendar','xg','stats'];
 const names={'watch':'해외축구 시청, 결제 전에 확인할 순서','boots':'축구화 선택: 발 길이보다 먼저 확인할 것','calendar':'새벽 축구 일정, 날짜를 틀리지 않고 읽는 법','xg':'xG가 높은 팀이 졌다: 숫자를 해석하는 순서','stats':'승률 60%인 두 팀의 승점은 왜 다를까'};
 const toolNames=['축구화 사이즈 표 확인','킥오프 한국시간 변환','목표 승점 조합 계산기','승률과 경기당 승점','축구 직관 경비 계산기'];
 window.renderRank=function(){const list=document.querySelector('#rank-list');if(list)list.innerHTML=readTools.map((id,i)=>'<li><a href="/tools/'+id+'/"><b>'+toolNames[i]+'</b></a></li>').join('');};
 const hot=document.querySelector('[data-view=hot]');hot.querySelectorAll('.rk-tab').forEach(b=>b.remove());hot.querySelectorAll('.edition-heading h1,h2.sec').forEach(h=>h.textContent='추천 도구');hot.querySelector('.edition-heading p').textContent='입력 예시와 계산 기준을 함께 확인하는 대표 도구';hot.querySelector('.note').textContent='이용량 순위가 아닌 편집 추천 목록입니다.';window.renderRank();
 const oldNav=window.navTo;window.navTo=function(view){if(view==='part')view='home';if(view==='mag'){location.href='/mag/';return false;}return oldNav(view);};
 const oldArticle=window.openArticle;window.openArticle=function(id){if(articles.includes(id)){location.href='/mag/'+id+'/';return false;}return oldArticle(id);};
 window.navToolA=function(id){window.navTool(id);return false;};
 document.querySelectorAll('a[data-nav=part],a[href="/players/korean/"]').forEach(a=>a.closest('li')?a.closest('li').remove():a.remove());
 document.querySelectorAll('[data-view=transfer] .note').forEach(n=>{if(n.querySelector('a[onclick*="part"]'))n.remove();});
 document.querySelector('#sg-community-sec')?.remove();
 document.querySelectorAll('[data-view=part],#sg-sheet,#sg-sheet-backdrop').forEach(el=>el.hidden=true);
 document.querySelectorAll('[data-nav=mag]').forEach(a=>{a.href='/mag/';a.onclick=null;});
 document.querySelectorAll('a[href^="#"]').forEach(a=>{const id=a.hash.slice(1);if(readTools.includes(id)){a.href='/tools/'+id+'/';a.onclick=null;}});
 const newsView=document.querySelector('[data-view=intl]');newsView.querySelectorAll(':scope>.note').forEach(n=>n.remove());
 const original=window.renderIntlLive;let hasLive=false;
 function emptyNews(){document.querySelector('#news-live').innerHTML='<li>최근 해외축구 소식을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</li>';}
 window.renderIntlLive=function(items){const now=Date.now(),fresh=(items||[]).filter(n=>Number(n.d)>=now-3*86400000&&Number(n.d)<=now+300000);hasLive=fresh.length>0;original(fresh);if(!hasLive)emptyNews();};emptyNews(); document.addEventListener('sg-news-archive',e=>{if(hasLive)return;const rows=(e.detail||[]).filter(n=>window.SGNewsFilters.classify(n).intl);window.renderIntlLive(rows);});
 const home=document.querySelector('#sg-home');const tools=document.querySelector('#sg-tools-sec');home.insertBefore(tools,document.querySelector('#sg-newslinks-sec'));home.insertBefore(document.querySelector('#sg-mag-sec'),document.querySelector('#sg-newslinks-sec'));
 document.querySelector('#sg-transfer-sec').hidden=true;
 const dateLabel=document.querySelector('#hr-transfer-status');if(dateLabel)dateLabel.textContent='';
 const allTools=document.querySelector('#sg-tools-sec .sg-more');allTools.textContent='도구 선택하기 →';allTools.href='/tools/';
 document.querySelector('#sg-mag-sec .sg-more').href='/mag/';
 document.querySelector('#sg-home .media-heading h1').textContent='축구를 즐기는 창고';
 document.querySelector('#sg-home .media-heading p').textContent='직접 쓰는 도구, 읽을거리, 그리고 새로운 소식';
 const rate=document.querySelector('.edition-tool[href="/tools/winrate/"] .edition-diagram');if(rate)rate.innerHTML='<svg viewBox="0 0 280 132" aria-hidden="true"><text x="24" y="31" class="diagram-label">가상 기록 · 6승 3무 1패</text><text x="24" y="81" class="diagram-number">60%</text><text x="163" y="81" class="diagram-number">2.10</text><text x="24" y="113" class="diagram-label">승률</text><text x="163" y="113" class="diagram-label">경기당 승점</text></svg>';
 document.querySelector('#sg-tools-sec .sg-secdesc').textContent='직접 계산하고, 기준과 예시까지 확인하세요';
 document.querySelector('#sg-mag-sec .sg-secdesc').textContent='축구창고가 만든 예시와 확인 자료로 읽는 가이드';

 if(location.hash==='#part')window.navTo('home');
 if(location.hash==='#mag')location.replace('/mag/');
 if(location.hash.startsWith('#article-')&&articles.includes(location.hash.slice(9)))location.replace('/mag/'+location.hash.slice(9)+'/');
})();

