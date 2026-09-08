/* Home presentation uses the existing collectors; no additional external feeds. */
(function () {
  'use strict';
  const home = document.getElementById('sg-home');
  if (!home) return;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => { try { const u = new URL(value, location.href); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; } };
  const dateText = value => new Date(value).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
  const DAY = 86400000;
  const filters = window.SGNewsFilters;
  let live = [], archive = [], archiveDate = '', selected = 'all', settled = false;
  const listBox = document.getElementById('hr-news-list');
  const status = document.getElementById('hr-news-status');

  // Match the DOM reading order to the visual order, including keyboard navigation.
  home.insertBefore(document.getElementById('sg-tools-sec'), document.getElementById('sg-videos-sec'));
  home.insertBefore(document.getElementById('sg-mag-sec'), document.getElementById('sg-transfer-sec'));
  document.getElementById('sg-tools-grid').innerHTML = SG_POPULAR_TOOLS.slice(0,4).map(SGToolCard).join('');
  document.querySelector('#sg-mag-sec .sg-more').setAttribute('href','/mag/');
  document.querySelectorAll('#sg-mag-grid > a').forEach((a,i) => { const slug=['watch','boots','xg'][i]; if(slug) a.setAttribute('href','/mag/'+slug+'/'); });
  const fixtures = document.createElement('div');
  fixtures.id = 'hr-fixtures';
  fixtures.innerHTML = '<h2 class="sec">경기 일정 · 결과</h2><div class="sg-secdesc">한국시간 · TheSportsDB</div><div id="hr-fixture-list"><p class="hr-empty">가까운 경기 일정을 확인하고 있습니다.</p></div>';
  home.insertBefore(fixtures, document.getElementById('sg-tools-sec'));
  document.getElementById('sg-sns-links').innerHTML = '<a href="https://www.youtube.com/@%EC%B6%95%EA%B5%AC%EC%B0%BD%EA%B3%A0" target="_blank" rel="noopener noreferrer">YouTube ↗</a><a href="https://www.instagram.com/chukguchanggo/" target="_blank" rel="noopener noreferrer">Instagram ↗</a>';

  const input = document.getElementById('gsearch');
  input.placeholder = '선수·도구·글 검색';
  input.setAttribute('aria-label', '선수, 도구, 글, 영상 검색');
  const settings = document.createElement('button');
  settings.id = 'hr-settings'; settings.type = 'button'; settings.textContent = '설정 · 글꼴 / 화면';
  settings.onclick = event => { event.stopPropagation(); window.sgSheetClose(false); window.scrollTo({top:0,behavior:'instant'}); toggleCfg(); const first = document.querySelector('#cfg-panel button'); if (first) first.focus(); };
  document.getElementById('sg-sheet').appendChild(settings);
  document.addEventListener('keydown', event => {
    const panel = document.getElementById('cfg-panel');
    if (event.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      const target = document.getElementById(matchMedia('(max-width:600px)').matches ? 'sg-sheet-btn' : 'cfg-btn');
      target.focus();
    }
  });

  function normalise(n) {
    const title = String(n.t || n.title || '').trim();
    const href = safeURL(n.l || n.link || '');
    const d = Number(n.d) || Date.parse(n.date || '');
    let source = n.src || n.source || n.tag || '';
    if (!source && href) source = new URL(href).hostname.replace(/^www\./,'');
    return {title,href,d,source,category:n.category,tag:n.tag,summary:n.summary,archive:!!n.archive};
  }
  function currentNews() {
    const seen = new Set();
    return live.concat(archive).map(normalise).filter(n => {
      if (!n.title || !n.href || !Number.isFinite(n.d) || n.d < Date.now()-3*DAY || n.d > Date.now()+DAY) return false;
      const key = n.title.toLowerCase().replace(/[\s\p{P}]/gu,'');
      if (seen.has(n.href) || seen.has(key)) return false;
      seen.add(n.href); seen.add(key); return true;
    });
  }
  function renderNews() {
    const all = currentNews();
    const rows = filters.select(all, selected);
    listBox.setAttribute('aria-busy', String(!settled && !all.length));
    const anyLive = all.some(n => !n.archive);
    const label = {all:'한국 선수 우선',korean:'한국 선수 소식 · 최신순',intl:'해외 리그·국제축구 · 최신순',domestic:'K리그·한국 대표팀 · 최신순',transfer:'선수 영입·이적·재계약 · 최신순'}[selected];
    status.textContent = all.length ? (anyLive ? '최근 3일 소식' : archiveDate+' 수집본')+' · '+label+' · 한국시간' : settled ? '새 소식을 불러오지 못했습니다.' : '최신 소식을 확인하고 있습니다.';
    listBox.innerHTML = rows.length ? rows.map(n => '<a class="hr-news" href="'+esc(n.href)+'" target="_blank" rel="noopener noreferrer"><h3>'+esc(n.title)+'</h3><div class="hr-news-meta"><span class="hr-source">'+esc(n.source)+'</span><time datetime="'+new Date(n.d).toISOString()+'">'+esc(dateText(n.d))+(n.archive?' 수집':'')+'</time><span>원문 보기 ↗</span></div></a>').join('') : '<div class="hr-empty">'+(all.length ? '이 분야의 최근 소식이 아직 없습니다.' : settled ? '잠시 후 다시 방문하거나 날짜별 뉴스를 확인해 주세요.' : '뉴스를 불러오는 중입니다.')+'<a href="/news/">날짜별 뉴스 보기 →</a></div>';
  }
  home.querySelectorAll('[data-news-filter]').forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.newsFilter;
    home.querySelectorAll('[data-news-filter]').forEach(b => b.setAttribute('aria-pressed', String(b===button)));
    renderNews();
  }));
  const previousNewsRender = window.renderHomeNewsLive;
  window.renderHomeNewsLive = function(items) {
    try { previousNewsRender(items); } finally { live = items || []; settled = true; renderNews(); }
  };
  live = window.SG_NEWS_CACHE || [];
  async function getText(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try { const response = await fetch(path, {signal:controller.signal}); if (!response.ok) throw new Error('Unavailable'); return await response.text(); }
    finally { clearTimeout(timeout); }
  }
  // The daily archive is same-origin and stays available when third-party RSS is slow.
  async function loadArchive() {
    try {
      const parse = text => new DOMParser().parseFromString(text,'text/html');
      const index = parse(await getText('/news/'));
      const paths = Array.from(index.querySelectorAll('a[href]')).map(a=>a.getAttribute('href')).filter(h=>/^\/news\/\d{4}-\d{2}-\d{2}\/$/.test(h)).sort().reverse();
      if (!paths.length) return;
      archiveDate = paths[0].split('/')[2];
      const page = parse(await getText(paths[0]));
      archive = Array.from(page.querySelectorAll('.art')).map(row => {
        const title = row.querySelector('h3'); const meta = row.querySelector('.meta'); const link = row.querySelector('.meta a[href]');
        const text = meta ? meta.textContent : '';
        const stamp = text.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
        const heading = row.parentElement.previousElementSibling;
        const summary = Array.from(row.querySelectorAll('p:not(.meta)')).map(p=>p.textContent).join(' ');
        const category = heading && /국내|K리그/.test(heading.textContent) ? 'domestic' : heading && /해외/.test(heading.textContent) ? 'intl' : '';
        return {t:title ? title.textContent : '',l:link ? link.getAttribute('href') : '',d:stamp ? Date.parse(stamp[0].replace(' ','T')+':00+09:00') : 0,src:text.split('·')[0].trim(),category,summary,archive:true};
      });
    } catch (_) { /* The existing collectors can still supply the live list. */ }
    finally { settled=true; renderNews(); }
  }
  renderNews(); loadArchive();

  // Extend the existing tool/article search without changing its navigation behavior.
  const previousSearch = window.gSearch;
  window.gSearch = function() {
    previousSearch();
    const q = input.value.trim().toLowerCase(); if (!q) return;
    const out = document.getElementById('gs-out');
    const players = (window.SG_PLAYERS_DB || []).filter(p=>(p.nameKo+' '+p.nameEn).toLowerCase().includes(q));
    const videos = (window.SG_VIDEOS || []).filter(v=>(v.title||'').toLowerCase().includes(q)).slice(-4).reverse();
    let extra = players.length ? '<div class="gcat">한국 선수</div>'+players.map(p=>'<a href="/players/'+encodeURIComponent(p.slug)+'/">'+esc(p.nameKo)+'</a>').join('') : '';
    if (videos.length) extra += '<div class="gcat">축구창고 영상 · YouTube</div>'+videos.map(v=>'<a href="'+esc(safeURL(v.href))+'" target="_blank" rel="noopener noreferrer">'+esc(v.title)+' ↗</a>').join('');
    if (extra) { if (!out.querySelector('a')) out.innerHTML=''; out.insertAdjacentHTML('afterbegin',extra); }
  };

  function renderHomeFixtures() {
    const toTime = ts => ts ? Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(ts) ? ts : ts.replace(' ','T')+'Z') : NaN;
    const rows = (window.FX_LAST || []).map(r=>({...r, time:toTime(r.ts)})).filter(r=>Number.isFinite(r.time) && (r.done ? r.time>=Date.now()-2*DAY && r.time<=Date.now() : r.time>=Date.now() && r.time<=Date.now()+7*DAY)).sort((a,b)=>Number(a.done)-Number(b.done) || (a.done ? b.time-a.time : a.time-b.time)).slice(0,4);
    document.getElementById('hr-fixture-list').innerHTML = rows.length ? rows.map(r=>'<div class="hr-game"><small>'+esc(r.tag)+' · '+esc(dateText(r.time))+'</small><b>'+esc(fxName(r.h))+' '+(r.done ? esc(r.hs)+' : '+esc(r.as) : 'vs')+' '+esc(fxName(r.a))+'</b><em>'+(r.done?'경기 종료':'경기 예정')+'</em></div>').join('') : '<p class="hr-empty">현재 확인된 가까운 경기가 없습니다.</p>';
  }
  const previousFixtures = window.renderFixtures;
  window.renderFixtures = function() { previousFixtures(); renderHomeFixtures(); };
  setTimeout(renderHomeFixtures, 15000);

  // Use the existing daily transfer dataset; do not label collection time as transfer date.
  const major = /토트넘|맨체스터|맨유|아스널|리버풀|첼시|레알|바르셀로나|뮌헨|파리|리옹|아틀레티코|유벤투스|밀란|tottenham|arsenal|chelsea|liverpool|manchester|madrid|barcelona|bayern|paris|lyon/i;
  async function renderTransfers() {
    const box = document.getElementById('sg-transfer-list');
    try {
      const data = JSON.parse(await getText('/transfer/tm.json'));
      const rows = (data.items || []).filter(r=>r.name && safeURL(r.url)).sort((a,b)=>(Number(!!b.kr)*2+Number(major.test(b.from+' '+b.to)))-(Number(!!a.kr)*2+Number(major.test(a.from+' '+a.to)))).slice(0,4);
      document.getElementById('hr-transfer-status').textContent = (data.updated ? data.updated+' 수집 · ' : '')+'Transfermarkt';
      box.innerHTML = rows.length ? rows.map(r=>'<div class="sg-tr"><span class="sg-badge" style="background:var(--hr-soft);color:var(--hr-brand);padding:5px 8px;border-radius:6px;font-size:12px">이적</span><a href="'+esc(safeURL(r.url))+'" target="_blank" rel="noopener noreferrer"><b>'+esc(r.name)+'</b><small>'+esc(sgKoClub(r.from)||r.from)+' → '+esc(sgKoClub(r.to)||r.to)+'</small></a></div>').join('') : '<p class="hr-empty">새 이적 소식이 아직 없습니다.</p>';
    } catch (_) { box.innerHTML='<p class="hr-empty">이적 소식을 불러오지 못했습니다. <a href="/transfer/">이적시장 보기 →</a></p>'; }
  }
  // Existing asynchronous collectors call this renderer as their data arrives.
  let transferRequest;
  window.sgRenderTransfers = function() { if (!transferRequest) transferRequest=renderTransfers().finally(()=>{transferRequest=null;}); return transferRequest; };
  window.sgRenderTransfers();
})();
