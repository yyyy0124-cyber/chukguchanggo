'use strict';
(function(root){
const fmt=n=>Number(n.toFixed(2)).toLocaleString('ko-KR'),won=n=>fmt(n)+'원';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const need=(ok,msg)=>{if(!ok)throw Error(msg);};
function names(s){const a=s.split(/[\n,]/).map(x=>x.trim()).filter(Boolean);need(a.length>=2&&a.length<=128,'명단은 2~128개로 입력하세요.');need(new Set(a).size===a.length,'이름이 중복됩니다. 이름 뒤에 번호를 붙여 구분하세요.');return a;}
function shuffle(a,rng=Math.random){a=a.slice();for(let i=a.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function stamp(date,time='00:00'){need(/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}$/.test(time),'날짜와 시간을 확인하세요.');const d=new Date(date+'T'+time+':00+09:00');need(Number.isFinite(+d)&&new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)===date,'존재하는 날짜를 입력하세요.');return +d;}
const kst=t=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'long',timeStyle:'short'}).format(new Date(t))+' (한국시간)';
function duration(s){s=Math.round(s);return `${Math.floor(s/60)}분 ${s%60}초`;}
function bracket(a,rng){a=shuffle(a,rng);const size=2**Math.ceil(Math.log2(a.length)),byes=size-a.length;const rows=[];for(let i=0;i<byes;i++)rows.push([a.shift(),null]);while(a.length)rows.push([a.shift(),a.shift()]);return shuffle(rows,rng);}
function pkState(history){let a=0,b=0,na=0,nb=0;for(let i=0;i<history.length;i++){if(i%2===0){na++;a+=history[i];}else{nb++;b+=history[i];}}
 let winner=null;if(na<=5&&nb<=5){if(a>b+5-nb)winner='A';if(b>a+5-na)winner='B';}if(na>=5&&nb>=5&&na===nb&&a!==b)winner=a>b?'A':'B';return {a,b,na,nb,winner,next:history.length%2?'B':'A'};}
function calculate(id,v,rng=Math.random){switch(id){
case 'roundrobin':need(v.n>=2&&Number.isInteger(v.n)&&[1,2].includes(v.ha),'팀 수와 맞대결 횟수를 확인하세요.');return `총 ${v.n*(v.n-1)/2*v.ha}경기 · 팀당 ${(v.n-1)*v.ha}경기 · ${((v.n%2)?v.n:v.n-1)*v.ha}라운드${v.n%2?' · 매 라운드 1팀 휴식':''}`;
case 'futsal-split':{let a=shuffle(names(v.names),rng);need(v.teams<=a.length,'팀 수가 참가자보다 많습니다.');let groups=Array.from({length:v.teams},()=>[]);a.forEach((x,i)=>groups[i%v.teams].push(x));let low=Math.floor(v.cost/a.length),extra=v.cost%a.length;return groups.map((g,i)=>`${i+1}팀: ${g.join(', ')}`).join('\n')+`\n정산: ${extra?extra+'명 × '+won(low+1)+' + ':''}${a.length-extra}명 × ${won(low)} = ${won(v.cost)}\n추가 1원을 낼 ${extra}명은 참가자끼리 정하세요.`;}
case 'dues-calc':{let income=v.fee*v.n,balance=v.carry+income-v.spent;return `이월금 ${won(v.carry)} + 회비 ${won(income)} − 지출 ${won(v.spent)}\n잔액 ${won(balance)}${balance<0?' · 입력 기준 부족액 '+won(-balance):''}`;}
case 'tourney-draw':return bracket(names(v.names),rng).map((r,i)=>`${i+1}번 대진: ${r[0]}${r[1]?' vs '+r[1]:' · 부전승'}`).join('\n');
case 'equal-time':need(v.n>=v.court,'전체 인원이 동시 출전 인원보다 적습니다.');return `1인 평균 출전 ${duration(v.t*60*v.court/v.n)}\n휴식 ${duration(v.t*60*(1-v.court/v.n))}\n총 배분할 시간 ${fmt(v.t*v.court)}인·분. 초 단위 반올림으로 합계에 차이가 생길 수 있습니다.`;
case 'mvp-count':{let tally=new Map();for(let l of v.raw.trim().split('\n')){let m=l.trim().match(/^(.+?)\s+(\d+)$/);need(m,'각 줄을 “이름 표수” 형태로 입력하세요.');let n=+m[2];need(Number.isSafeInteger(n)&&n<=1000000,'표수가 너무 큽니다.');tally.set(m[1],(tally.get(m[1])||0)+n);}let rows=[...tally].sort((a,b)=>b[1]-a[1]),total=rows.reduce((s,x)=>s+x[1],0),rank=0;return rows.map((x,i)=>{if(!i||x[1]!==rows[i-1][1])rank=i+1;return `${rank}위 ${x[0]} · ${x[1]}표 (${total?fmt(x[1]/total*100):0}%)`;}).join('\n')+`\n총 ${total}표`;}
case 'ga-point':return `공격포인트 ${v.g+v.a}개 · 경기당 ${fmt((v.g+v.a)/v.m)}개`;
case 'goal-pace':need(v.total>=v.m,'전체 경기는 치른 경기 이상이어야 합니다.');return `시즌 환산 ${fmt(v.g/v.m*v.total)}골 · 실제 예상 기록이 아닌 단순 환산`;
case 'card-pace':return `경기당 ${fmt(v.y/v.m)}장\n목표까지 ${Math.max(0,v.target-v.y)}장 · ${v.y>=v.target?'목표 장수 도달':v.y===0?'현재 0장이므로 도달 경기 수를 계산할 수 없습니다.':'같은 비율 가정 시 약 '+fmt((v.target-v.y)/(v.y/v.m))+'경기'}`;
case 'sprint-speed':return `구간 평균 ${fmt(v.d/v.t)}m/s · ${fmt(v.d/v.t*3.6)}km/h`;
case 'field-area':return `축구장 약 ${fmt(v.a/7140)}개 · 비교 크기 105×68m`;
case 'ftin-cm':return `${fmt(v.ft*30.48+v.inch*2.54)}cm`;
case 'seasonpass-break':{let equal=Math.ceil(v.pass/v.single),strict=Math.floor(v.pass/v.single)+1;return `개별 구매보다 같거나 저렴: ${equal}경기부터\n더 저렴: ${strict}경기부터${strict>v.total?' · 입력한 관람 가능 경기 수로는 도달하지 못합니다.':''}\n${v.total}경기 개별 구매 ${won(v.total*v.single)} / 시즌권 ${won(v.pass)}`;}
case 'chicken-calc':return `${Math.ceil(v.n/v.per)}마리 · 한 마리를 ${fmt(v.per)}명이 나누는 가정`;
case 'fpl-budget':{const values=v.prices.trim().split(/[\n,]/).map(x=>x.trim());need(values.length<=15,'선수 가격은 15개까지 입력하세요.');need(values.every(x=>/^\d+(\.\d+)?$/.test(x)&&+x>0&&+x<=100),'각 줄에 0 초과 100 이하의 가격을 입력하세요.');let sum=values.reduce((s,x)=>s+Math.round(+x*100),0)/100,remain=v.budget-sum,slots=15-values.length;return `${values.length}/15명 · 사용 £${fmt(sum)}m · 잔액 £${fmt(remain)}m${remain<0?' · 예산 초과':''}\n${slots?'남은 '+slots+'자리당 £'+fmt(remain/slots)+'m':'15명 가격 입력 완료 · 포지션과 구단 제한은 공식 화면에서 확인하세요.'}`;}
case 'fee-convert':return `${won(v.amount*1000000*v.rate)} · ${fmt(v.amount*v.rate/100)}억 원\n입력 환율 1€ = ${won(v.rate)} · 시세 조회 없음`;
case 'wage-calc':return `52주 환산 £${fmt(v.w*52)}\n원화 ${won(v.w*52*v.rate)} · 입력 환율 1£ = ${won(v.rate)}`;
case 'fx-calc':return `합계 ${fmt(v.price+v.shipping)} 외화 단위\n환산 ${won((v.price+v.shipping)*v.rate)} · 세금·결제 수수료 제외`;
case 'hr-zone':return `최대심박 참고값 ${220-v.age}bpm\n`+[.6,.7,.8,.9].map(x=>`${x*100}%: ${fmt((220-v.age)*x)}bpm`).join('\n')+'\n개인별 목표 강도나 안전 상한선이 아닙니다.';
case 'futsal-cal':return `약 ${fmt(v.met*3.5*v.w/200*v.t)}kcal · 입력 MET ${v.met} 기준 추정`;
case 'player-age':{need(stamp(v.date)>=stamp(v.birth),'기준일은 생년월일 이후여야 합니다.');let age=+v.date.slice(0,4)-+v.birth.slice(0,4)-(v.date.slice(5)<v.birth.slice(5)?1:0);return `기준일 ${v.date} · 만 ${age}세\n대회 참가 자격은 별도 규정을 확인하세요.`;}
case 'depart-time':return '출발 계획: '+kst(stamp(v.date,v.time)-(v.move+v.buffer)*60000);
case 'endtime':return '입력 기준 종료: '+kst(stamp(v.date,v.time)+(v.play+v.rest+v.extra)*60000);
case 'dday':{let diff=Math.round((stamp(v.date)-stamp(v.start))/86400000);return diff>0?`${diff}일 남음`:diff<0?`${-diff}일 지남`:'같은 날짜 · D-day';}
case 'ko-countdown':{let delta=Math.ceil((stamp(v.date,v.time)-Date.now())/1000);return delta<=0?'입력한 경기 시각이 지났습니다.':`${Math.floor(delta/86400)}일 ${Math.floor(delta%86400/3600)}시간 ${Math.floor(delta%3600/60)}분 ${delta%60}초 남음`;}
case 'fortune':{let i=Math.floor((Date.now()+9*3600000)/86400000)%4;return ['오늘 본 좋은 패스 하나를 기억해 보세요.','응원하는 팀에서 눈에 띈 장면을 나눠 보세요.','오랜만에 함께 축구 볼 사람을 떠올려 보세요.','경기 전에 공식 킥오프 시간을 한 번 더 확인해 보세요.'][i];}
case 'teamname-gen':return ['동네','주말','새벽','한강'][Math.floor(rng()*4)]+' '+['유나이티드','일레븐','FC','킥오프'][Math.floor(rng()*4)];
case 'euro-clock':return [['런던','Europe/London'],['마드리드','Europe/Madrid'],['베를린','Europe/Berlin'],['파리','Europe/Paris'],['서울','Asia/Seoul']].map(([n,z])=>n+': '+new Intl.DateTimeFormat('ko-KR',{timeZone:z,dateStyle:'medium',timeStyle:'medium'}).format(new Date())).join('\n');
case 'pos-test':{const labels=['공격 마무리','패스와 연결','수비와 차단','골문 지키기'];return [...new Set([v.role,v.space])].map(i=>labels[i]).join(' · ')+'에 관심이 있네요. 실제 적성 판정은 아닙니다.';}
default:throw Error('지원하지 않는 도구입니다.');}}
const api={calculate,bracket,pkState,stamp,shuffle};if(typeof module!=='undefined')module.exports=api;
if(typeof document==='undefined')return;
let timer=null,history=[],quizIndex=0,quizScore=0,answered=false;
const stop=()=>{clearInterval(timer);timer=null;};window.addEventListener('pagehide',stop);
const search=document.getElementById('lookup');if(search){const rows=[...document.querySelectorAll('tbody tr')],status=document.getElementById('search-status');search.addEventListener('input',()=>{let n=0;for(const row of rows){row.hidden=!row.textContent.toLowerCase().includes(search.value.trim().toLowerCase());if(!row.hidden)n++;}status.textContent=n?`${n}개 항목`:'검색 결과가 없습니다.';});return;}
const form=document.getElementById('tool-form');if(!form)return;
const id=location.pathname.split('/')[2],result=document.getElementById('tool-result'),actions=document.getElementById('tool-actions'),copy=document.getElementById('copy-result');
let catalog;
const ready=fetch('/tool-catalog.json?v=0915-content2').then(r=>{if(!r.ok)throw Error('도구 설명을 불러오지 못했습니다.');return r.json();}).then(data=>catalog=data.find(d=>d.id===id)).catch(e=>show(e.message,true));
function show(s,error=false){result.dataset.export=error?"error":"ok";result.hidden=false;result.textContent=s;copy.hidden=false;}
function button(text,fn){let b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);actions.append(b);return b;}
function renderPK(){actions.replaceChildren();let s=pkState(history);show(`A ${s.a} : ${s.b} B\nA ${s.na}회 / B ${s.nb}회\n${s.winner?s.winner+'팀 승리':s.next+'팀 차례'}\n기록: ${history.map((x,i)=>(i%2?'B':'A')+(x?' 성공':' 실패')).join(' / ')||'아직 없음'}`);if(!s.winner){button(s.next+' 성공',()=>{history.push(1);renderPK();});button(s.next+' 실패',()=>{history.push(0);renderPK();});}if(history.length)button('한 단계 되돌리기',()=>{history.pop();renderPK();});}
const questions=[['4-3-3에서 골키퍼를 제외한 선수 수는?', ['10명','11명','9명'],0,'4+3+3=10명이며 골키퍼는 별도입니다.'],['득점 3, 실점 1일 때 골득실은?', ['+2','+4','-2'],0,'골득실은 득점에서 실점을 뺀 값입니다.'],['승 3점·무 1점일 때 2승 1무의 승점은?', ['6점','7점','8점'],1,'2×3+1=7점입니다.'],['xG 합계 1.0은 한 골 이상 넣을 확률 100%일까?', ['맞다','아니다'],1,'기대 득점 합계와 최소 한 골의 확률은 다릅니다.'],['단일 풀리그 4팀의 전체 경기 수는?', ['12경기','4경기','6경기'],2,'4×3÷2=6경기입니다.']];
function renderQuiz(){actions.replaceChildren();if(quizIndex===questions.length){show(`5문제 중 ${quizScore}개 정답. 아래 초기화로 다시 풀 수 있습니다.`);return;}answered=false;let q=questions[quizIndex];show(`${quizIndex+1}/5 · ${q[0]}`);q[1].forEach((answer,i)=>button(answer,()=>{if(answered)return;answered=true;if(i===q[2])quizScore++;show((i===q[2]?'정답입니다. ':'다시 확인해 보세요. ')+q[3]);[...actions.children].forEach(b=>b.disabled=true);button('다음 문제',()=>{quizIndex++;renderQuiz();});}));}
async function run(e){e?.preventDefault();await ready;if(!catalog)return;if(!form.reportValidity())return;stop();actions.replaceChildren();try{
 let v={};for(let f of catalog.fields){let raw=form.elements.namedItem(f.k).value;need(raw.trim()!=='','입력값을 채워 주세요.');if(f.type==='number'){v[f.k]=Number(raw);need(Number.isFinite(v[f.k])&&v[f.k]>=f.min&&v[f.k]<=f.max,'입력 범위를 확인하세요.');if(f.step===1)need(Number.isInteger(v[f.k]),'인원·횟수·원 금액은 정수로 입력하세요.');}else if(f.type==='select'&&f.opts.every(x=>typeof x[0]==='number'))v[f.k]=Number(raw);else v[f.k]=raw;}
 result.dataset.export='ok';if(id==='pk-helper'){renderPK();return;}
 if(id==='fanquiz'){renderQuiz();return;}
 if(id==='formation'){result.hidden=false;copy.hidden=true;result.innerHTML='<p>↑ 공격 방향</p><div class="pitch">'+v.shape.split('-').reverse().concat(['1']).map((n,i)=>'<div class="pitch-row">'+Array.from({length:+n},(_,j)=>'<span>'+(i===v.shape.split('-').length?'GK':'●')+'</span>').join('')+'</div>').join('')+'</div>';return;}
 if(id==='marking'){result.hidden=false;copy.hidden=true;result.replaceChildren();const shirt=document.createElement('div');shirt.className='shirt';shirt.style.backgroundColor=v.color;shirt.style.color=(parseInt(v.color.slice(1,3),16)*.299+parseInt(v.color.slice(3,5),16)*.587+parseInt(v.color.slice(5,7),16)*.114)>140?'#171917':'#fff';let name=document.createElement('p'),num=document.createElement('strong');name.textContent=v.name;num.textContent=v.number;shirt.append(name,num);result.append(shirt);return;}
 if(id==='interval-timer'){const start=Date.now(),total=v.work*v.rounds+v.rest*(v.rounds-1);const tick=()=>{let elapsed=Math.floor((Date.now()-start)/1000);if(elapsed>=total){show('모든 구간이 끝났습니다.');stop();return;}let round=Math.floor(elapsed/(v.work+v.rest)),part=elapsed%(v.work+v.rest),work=part<v.work;show(`${round+1}/${v.rounds}회 · ${work?'운동':'휴식'} ${work?v.work-part:v.work+v.rest-part}초 남음\n전체 ${total-elapsed}초 남음`);};tick();timer=setInterval(tick,250);button('중지',()=>{stop();show('타이머를 중지했습니다. 다시 시작하면 첫 구간부터 진행합니다.');});return;}
 show(calculate(id,v));if(['euro-clock','ko-countdown'].includes(id))timer=setInterval(()=>show(calculate(id,v)),1000);
 }catch(e){show(e.message,true);}}
form.addEventListener('submit',run);
form.addEventListener('input',()=>{stop();actions.replaceChildren();result.hidden=true;copy.hidden=true;});
document.getElementById('reset-tool').addEventListener('click',()=>{stop();form.reset();history=[];quizIndex=quizScore=0;answered=false;actions.replaceChildren();result.hidden=true;copy.hidden=true;});
copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(result.textContent);copy.textContent='복사했습니다';setTimeout(()=>copy.textContent='결과 복사',1500);}catch{copy.textContent='복사하지 못했습니다. 결과를 선택해 복사하세요.';}});
})(typeof window==='undefined'?globalThis:window);
