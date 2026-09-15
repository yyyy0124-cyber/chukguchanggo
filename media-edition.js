(function(){
 'use strict';
 const home=document.getElementById('sg-home');if(!home)return;
 const svg=(body)=>'<svg viewBox="0 0 280 132" aria-hidden="true" focusable="false">'+body+'</svg>';
 const pitch=svg('<rect x="55" y="12" width="170" height="110" fill="none" stroke="currentColor" opacity=".35"/><path d="M55 67H225M105 12V32H175V12M105 122V102H175V122" fill="none" stroke="currentColor" opacity=".35"/><circle cx="140" cy="67" r="15" fill="none" stroke="currentColor" opacity=".35"/>'+[[140,112],[75,90],[118,90],[162,90],[205,90],[95,65],[140,60],[185,65],[90,34],[140,25],[190,34]].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="5" fill="currentColor"/>').join(''));
 const clock=svg('<text x="24" y="31" class="diagram-label">런던</text><text x="180" y="31" class="diagram-label">서울</text><text x="22" y="80" class="diagram-number">15:00</text><text x="178" y="80" class="diagram-number">23:00</text><path d="M137 66H163M157 61L163 66L157 71" stroke="currentColor" fill="none"/><text x="24" y="113" class="diagram-label">예시 · 영국 서머타임 적용일</text>');
 const size=svg('<path d="M36 64C61 75 72 43 104 38L121 69L166 85L239 93V109H35Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M101 54L122 48M109 65L131 59M116 76L141 71M40 117H237M40 113V121M237 113V121" fill="none" stroke="currentColor"/><text x="26" y="26" class="diagram-label">발 길이</text><text x="185" y="26" class="diagram-label">EU / UK / US</text>');
 const points=svg('<text x="25" y="31" class="diagram-label">승</text><text x="115" y="31" class="diagram-label">무</text><text x="210" y="31" class="diagram-label">패</text><text x="23" y="83" class="diagram-number">3</text><text x="112" y="83" class="diagram-number">1</text><text x="208" y="83" class="diagram-number">0</text><path d="M24 103H252" stroke="currentColor" opacity=".35"/><text x="25" y="122" class="diagram-label">승점 계산 · 결과를 바꾸며 비교</text>');
 const tools=[['kickoff','킥오프 시간 변환','현지 경기 시간을 한국시간으로',clock],['boot-size','축구화 사이즈 표','아디다스 공식 표로 확인',size],['winrate','승률과 경기당 승점','승·무·패로 기록 비교',points],['points-sim','승점 시뮬레이터','남은 경기 결과에 따른 승점 계산',points]];
 window.sgRenderTools=function(){document.getElementById('sg-tools-grid').innerHTML=tools.map(([id,title,desc,art],i)=>'<a class="edition-tool" href="#'+id+'" onclick="return navToolA(\''+id+'\')"><span class="edition-tool-top"><small>0'+(i+1)+'</small><span>도구 열기</span></span><span class="edition-diagram">'+art+'</span><strong>'+title+'</strong><span class="edition-tool-desc">'+desc+'</span></a>').join('');};
 const covers={watch:svg('<rect x="27" y="24" width="226" height="90" fill="none" stroke="currentColor"/><path d="M130 48L159 68L130 88Z" fill="currentColor"/><path d="M108 124H173" stroke="currentColor"/>'),boots:size,xg:svg('<path d="M27 120V26H252V120M93 26V56H186V26" fill="none" stroke="currentColor"/><path d="M67 107L140 26M209 91L140 26M132 86L140 26" stroke="currentColor" opacity=".35"/><circle cx="67" cy="107" r="5" fill="currentColor"/><circle cx="209" cy="91" r="9" fill="currentColor"/><circle cx="132" cy="86" r="13" fill="currentColor"/>')};
 const magazines=[['watch','시청 가이드','해외축구, 어디서 볼까','시청 서비스를 고르기 전에 확인할 것.'],['boots','장비 가이드','축구화 고르는 법','사이즈와 발볼, 경기장 바닥부터.'],['xg','축구 데이터','xG로 경기를 읽는 법','득점 기회의 질을 보는 참고 지표.']];
 window.sgRenderMag=function(){document.getElementById('sg-mag-grid').innerHTML=magazines.map(([id,cat,title,desc],i)=>'<a class="edition-mag" href="/mag/'+id+'/"><span class="edition-cover cover-'+id+'"><small>'+cat+'</small>'+covers[id]+'<b>'+['시청','장비','기록'][i]+'</b></span><strong>'+title+'</strong><p>'+desc+'</p></a>').join('');};
 sgRenderTools();sgRenderMag();
 // 외부 썸네일을 불러오지 못해도 영상 링크는 읽고 사용할 수 있다.
 function fallbackThumbnail(img){
   if(!img.matches || !img.matches('.sg-vc-thumb') || img.tagName!=='IMG')return;
   const card=img.closest('.sg-vc');if(!card)return;
   const cover=document.createElement('span');cover.className='sg-vc-thumb edition-video-fallback';
   const label=document.createElement('span');label.textContent='축구창고 영상';
   const title=document.createElement('strong');title.textContent=img.alt||'유튜브에서 보기';
   cover.append(label,title);img.replaceWith(cover);
 }
 home.addEventListener('error',event=>fallbackThumbnail(event.target),true);
 home.querySelectorAll('img.sg-vc-thumb').forEach(img=>{if(img.complete&&!img.naturalWidth)fallbackThumbnail(img);});
 // 화면 읽기 순서는 모바일의 뉴스 → 도구 → 영상 → 매거진 순서와 일치한다.
 const tagline=document.querySelector('header .tagline');if(tagline)tagline.textContent='축구팬을 위한 모든 것을 한곳에';
 // 모든 메뉴의 첫 화면을 홈과 같은 제목 체계로 맞춘다.
 const sections={intl:['해외축구','주요 리그별 뉴스와 해외축구 소식'],domestic:['국내축구','K리그와 대한민국 축구 소식'],transfer:['이적시장','이적 보도와 루머 · 확정 여부는 구단 발표 확인'],mag:['매거진','축구를 보는 데 도움이 되는 가이드와 분석'],hot:['주요 소식','축구 뉴스 모아보기'],players:['한국 선수','해외와 국내에서 뛰는 한국 선수 소식']};
 Object.entries(sections).forEach(([id,[title,desc]])=>{
   const view=document.querySelector('[data-view="'+id+'"]');if(!view)return;
   const heading=document.createElement('div');heading.className='edition-heading';
   const h=document.createElement('h1');h.textContent=title;const p=document.createElement('p');p.textContent=desc;
   heading.append(h,p);view.prepend(heading);
   view.querySelectorAll(':scope > .banner,:scope > .tabhero').forEach(el=>el.classList.add('edition-old-banner'));
 });
 document.querySelector('.thero h2').textContent='축구 도구';
 const intlView=document.querySelector('[data-view="intl"]');
 intlView.querySelector('.edition-heading p').textContent='해외축구 뉴스 모아보기';
 const intlHeads=intlView.querySelectorAll(':scope > .klhead');
 if(intlHeads[0]){const label=document.createElement('span');label.className='intl-list-label';label.textContent='전체 소식';intlHeads[0].childNodes.forEach(node=>{if(node.nodeType===3)node.textContent='';});intlHeads[0].querySelector('.klmark')?.remove();intlHeads[0].prepend(label);}
 if(intlHeads[1])intlHeads[1].remove();
 document.querySelectorAll('#news-live > li').forEach(row=>{
   if(row.querySelector('.intl-news-meta'))return;
   const title=row.querySelector('b');if(!title)return;
   const meta=document.createElement('div');meta.className='intl-news-meta';
   const league=document.createElement('span');league.textContent=lgDetect(title.dataset.en||title.textContent);
   const source=document.createElement('span');source.textContent=row.querySelector('.pill')?.textContent||'';
   meta.append(league,source);row.querySelector('.pill')?.remove();row.querySelector('.pmeta2')?.remove();row.prepend(meta);row.classList.add('intl-news-row');
 });
 document.querySelector('.wrap > [data-view="tools"]')?.remove();
 document.querySelector('.thero p').textContent='시간 변환부터 사이즈와 승점 계산까지';
})();
