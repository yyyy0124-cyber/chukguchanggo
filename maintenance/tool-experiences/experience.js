(()=>{'use strict';
const $=id=>document.getElementById(id),kind=document.body.dataset.tool;
const track=action=>{if(typeof window.gtag==='function')window.gtag('event','tool_'+action,{tool_id:kind});};
let started=false;const start=()=>{if(!started){started=true;track('start');}};
document.querySelector('.tool-panel').addEventListener('input',start);
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
if(kind==='uniform'){
 const out=$('result');
 $('compare').addEventListener('submit',e=>{e.preventDefault();start();const ids=['own-width','own-length','new-width','new-length'];const v=ids.map(id=>Number($(id).value));if(v.some(x=>!Number.isFinite(x)||x<=0||x>200))return;
 const diff=(a,b)=>{const n=Math.round((b-a)*10)/10;return n===0?'같습니다':`${Math.abs(n)}cm ${n>0?'큽니다':'작습니다'}`;};
 out.hidden=false;out.textContent=`가슴 단면은 ${diff(v[0],v[2])}. 총장은 ${diff(v[1],v[3])}. 이 결과는 두 옷의 실측 차이이며 착용감이나 구매 사이즈를 확정하지 않습니다. 소재·신축성과 측정 방법도 함께 확인하세요.`;track('complete');});
 $('sample').addEventListener('click',()=>{['own-width','own-length','new-width','new-length'].forEach((id,i)=>$(id).value=[52,70,54,72][i]);out.hidden=true;start();});
 $('compare').addEventListener('input',()=>out.hidden=true);
}
if(kind==='best11'){
 const layouts={'4-3-3':[['GK'],['LB','LCB','RCB','RB'],['LCM','CM','RCM'],['LW','ST','RW']], '4-4-2':[['GK'],['LB','LCB','RCB','RB'],['LM','LCM','RCM','RM'],['LST','RST']], '3-5-2':[['GK'],['LCB','CB','RCB'],['LWB','LCM','CM','RCM','RWB'],['LST','RST']], '4-2-3-1':[['GK'],['LB','LCB','RCB','RB'],['LDM','RDM'],['LAM','CAM','RAM'],['ST']]};
 let rendered=false;
 function fields(){const old=[...$('names').querySelectorAll('input')].map(x=>x.value);$('names').replaceChildren();layouts[$('formation').value].flat().forEach((pos,i)=>{const label=document.createElement('label'),inp=document.createElement('input');inp.id='player-'+i;inp.maxLength=30;inp.value=old[i]||'';label.textContent=`${i+1}. ${pos}`;inp.placeholder='선수 이름';label.append(inp);$('names').append(label);});}
 function draw(){const cv=$('pitch'),c=cv.getContext('2d'),rows=layouts[$('formation').value];c.fillStyle='#174d35';c.fillRect(0,0,900,1200);for(let y=170;y<1100;y+=150){c.fillStyle='#1d593e';c.fillRect(35,y,830,75);}c.strokeStyle='#b7d6bd';c.lineWidth=3;c.strokeRect(35,160,830,960);c.beginPath();c.moveTo(35,640);c.lineTo(865,640);c.stroke();c.beginPath();c.arc(450,640,95,0,Math.PI*2);c.stroke();c.strokeRect(270,160,360,125);c.strokeRect(270,995,360,125);c.textAlign='center';
 const text=(t,x,y,size,max,color)=>{c.fillStyle=color;c.font=`bold ${size}px sans-serif`;while(c.measureText(t).width>max&&size>12)c.font=`bold ${--size}px sans-serif`;c.fillText(t,x,y,max);};
 text($('team').value.trim()||'나의 베스트11',450,65,40,810,'#fff');text($('formation').value+' · 위쪽으로 공격 ↑',450,115,24,810,'#d5e6ce');let i=0;
 rows.forEach((row,r)=>{const y=1040-r*760/(rows.length-1);row.forEach((pos,j)=>{const x=900*(j+1)/(row.length+1),name=$('player-'+i).value.trim()||`선수 ${i+1}`;c.fillStyle=r===0?'#eeaf56':'#f5d462';c.beginPath();c.arc(x,y,29,0,Math.PI*2);c.fill();text(pos,x,y+7,17,55,'#183b2b');text(name,x,y+65,24,900/(row.length+1)-12,'#fff');i++;});});text('축구창고 · chukguchanggo.com',450,1170,20,810,'#c4d7c8');cv.hidden=false;rendered=true;$('download').hidden=false;$('download').href=cv.toDataURL('image/png');$('lineup-status').textContent='미리보기를 만들었습니다. 이름과 배치를 확인한 뒤 PNG로 저장하세요.';}
 fields();$('formation').addEventListener('change',()=>{fields();if(rendered)draw();});$('lineup').addEventListener('input',()=>{if(rendered)draw();});
 $('lineup').addEventListener('submit',e=>{e.preventDefault();start();draw();track('complete');});
 $('example').addEventListener('click',()=>{start();$('team').value='주말 축구 모임';for(let i=0;i<11;i++)$('player-'+i).value='팀원 '+(i+1);draw();track('complete');});
 $('random').addEventListener('click',()=>{start();const inputs=[...$('names').querySelectorAll('input')];if(inputs.some(x=>!x.value.trim())){$('lineup-status').textContent='11명의 이름을 모두 입력한 뒤 섞어주세요. 골키퍼를 포함한 전체 자리가 무작위로 바뀝니다.';return;}const vals=shuffle(inputs.map(x=>x.value));inputs.forEach((el,i)=>el.value=vals[i]);draw();track('complete');});
 $('download').addEventListener('click',()=>track('save'));
}
if(kind==='balance-game'){
 const questions={
 '관전':[['평생 홈경기 직관','평생 원정경기 직관'],['골대 뒤 응원석','하프라인 근처 관람석'],['친구들과 집관','혼자 경기장 직관'],['비 오는 날의 극적인 승리','맑은 날의 편안한 승리'],['경기 전 선수 워밍업 보기','경기 후 선수 인사 보기'],['유니폼 모으기','직관 티켓 모으기']],
 '동호회':[['결승골을 넣기','결승골을 돕기'],['매주 짧게 한 경기','한 달에 한 번 긴 대회'],['익숙한 포지션으로 뛰기','새 포지션에 도전하기'],['친구와 같은 팀','친구와 상대 팀'],['정확한 짧은 패스','과감한 긴 패스'],['팀의 주장 맡기','팀의 전술 담당 맡기']],
 '응원팀':[['유스 출신 선수가 주장','새로 영입한 선수가 주장'],['극적인 역전승','처음부터 끝까지 앞선 승리'],['더비전 승리','컵대회 다음 라운드 진출'],['오래 함께한 감독','새로운 철학의 감독'],['이번 시즌 컵 우승','다음 시즌 리그 우승'],['홈에서 우승 확정','원정에서 우승 확정']],
 '전술':[['강한 전방 압박','단단한 낮은 수비'],['빠른 역습','차근차근 빌드업'],['측면 돌파','중앙 침투'],['공격적인 풀백','수비적인 풀백'],['창의적인 개인 돌파','유기적인 패스 연계'],['후반 승부수 교체','전반부터 공격적 운영']]};
 let deck=[],index=0,answers=[];
 function show(){const done=index>=deck.length;$('play').hidden=done;$('summary').hidden=!done;$('progress').textContent=done?`${answers.length}개 질문을 모두 골랐습니다`:`질문 ${index+1} / ${deck.length}`;if(done){$('history').replaceChildren();answers.forEach(a=>{const li=document.createElement('li');li.textContent=`${a.pair[0]} / ${a.pair[1]} → ${a.selected}`;$('history').append(li);});track('complete');}else{$('question').textContent=deck[index].cat+' · 둘 중 하나를 골라보세요';$('choice-a').textContent=deck[index].pair[0];$('choice-b').textContent=deck[index].pair[1];}}
 function reset(){started=false;const cat=$('category').value;deck=shuffle(Object.entries(questions).filter(([k])=>cat==='전체'||k===cat).flatMap(([cat,pairs])=>pairs.map(pair=>({cat,pair}))));index=0;answers=[];$('copy-status').textContent='';$('copy-fallback').hidden=true;show();}
 ['a','b'].forEach((s,n)=>$('choice-'+s).addEventListener('click',()=>{start();const q=deck[index];answers.push({...q,selected:q.pair[n]});index++;show();}));
 $('category').addEventListener('change',reset);$('restart').addEventListener('click',reset);
 $('copy').addEventListener('click',async()=>{const text='축구창고 밸런스 게임 — 나의 선택\n'+answers.map((a,i)=>`${i+1}. ${a.pair.join(' / ')} → ${a.selected}`).join('\n')+'\nhttps://chukguchanggo.com/tools/balance-game/';try{await navigator.clipboard.writeText(text);$('copy-status').textContent='결과를 복사했습니다.';track('save');}catch(e){$('copy-fallback').hidden=false;$('copy-fallback').value=text;$('copy-fallback').focus();$('copy-fallback').select();$('copy-status').textContent='아래 결과를 길게 누르거나 Ctrl+C로 복사하세요.';}});
 reset();started=false;
}
})();
