(function(root){
 'use strict';
 function topic(title){
  const t=String(title||'').normalize('NFKC');
  if(/스폰서|후원|광고 계약|중계권|파트너십|유니폼 계약|sponsor|partnership|broadcast rights|commercial deal/i.test(t))return false;
  if(/감독|코치|사령탑|선임|경질|\b(manager|coach|sacking)\b/i.test(t))return false;
  if(/회상|재조명|이적 당시|역대.*이적료|이적료.*(?:순위|역대)|on this day|look back|all.time.*transfer/i.test(t))return false;
  if(/autograph|signed (?:shirt|jersey)|signs? (?:of|autographs)|이적생.*(?:골|활약|평가)|new signing.*(?:scores|goal|debut)/i.test(t))return false;
  return /이적(?:설|료|시장|\s*(?:협상|합의|확정|임박|추진|가능|완료|발표|불발|거절))|영입|임대|재계약|계약\s*(?:연장|해지|만료|체결)|자유계약|방출|\btransfers?\b|\bsign(?:s|ed|ing)?\b|\bloan\b|contract (?:extension|renewal|termination|expires)|free agent|release clause/i.test(t);
 }
 function select(items,now=Date.now()){
  const urls=new Set(),titles=new Set();
  return items.map(n=>({...n,t:String(n.t||n.title||'').trim(),l:n.l||n.link||'',d:Number(n.d)||0})).filter(n=>topic(n.t)&&/^https?:\/\//i.test(n.l)&&n.d>=now-7*86400000&&n.d<=now+300000).sort((a,b)=>b.d-a.d).filter(n=>{
   const u=new URL(n.l);u.hash='';['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k=>u.searchParams.delete(k));
   const key=n.t.toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');if(urls.has(u.href)||titles.has(key))return false;urls.add(u.href);titles.add(key);return true;
  });
 }
 const api={topic,select};if(typeof module==='object'&&module.exports){module.exports=api;return;}root.SGTransferNews=api;
 const view=document.querySelector('[data-view="transfer"]');if(!view)return;
 view.classList.add('transfer-news-only');
 const heading=view.querySelector('.edition-heading');heading.querySelector('p').textContent='선수 이적·임대·재계약 소식';
 const section=document.createElement('section');section.id='transfer-news-section';section.innerHTML='<p class="note">최근 7일 기사 · 보도 내용의 확정 여부는 구단 공식 발표를 확인하세요.</p><ul class="plist" id="transfer-news-list"></ul>';view.append(section);
 let archive=[];
 function render(){
  const rows=select([...(root.HOME_INTL||[]),...(root.HOME_KR||[]),...(root.HOME_NT||[]),...archive]);
  const box=document.getElementById('transfer-news-list');box.replaceChildren();
  if(!rows.length){const li=document.createElement('li');li.textContent='현재 불러온 기사 중 조건에 맞는 최근 이적 소식이 없습니다.';box.append(li);return;}
  rows.forEach(n=>{const li=document.createElement('li');li.className='intl-news-row';const meta=document.createElement('div');meta.className='intl-news-meta';meta.textContent=(n.src||n.tag||new URL(n.l).hostname)+' · '+new Date(n.d).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+' 한국시간';const a=document.createElement('a');a.href=n.l;a.target='_blank';a.rel='noopener noreferrer';const b=document.createElement('b');b.textContent=n.t;a.append(b);li.append(meta,a);box.append(li);});
 }
 const previous=root.mixHomeNews;root.mixHomeNews=function(){const result=previous.apply(this,arguments);render();return result;};
 document.addEventListener('sg-news-archive',e=>{archive=e.detail||[];render();});render();
})(typeof globalThis!=='undefined'?globalThis:this);
