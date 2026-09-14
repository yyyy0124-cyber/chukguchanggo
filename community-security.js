(function(){
'use strict';
const cfg=window.SGCommunitySecurity||{enabled:false};
const $=id=>document.getElementById(id);
let ready,working=false;
function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('로그인 연결에 실패했습니다.'));document.head.appendChild(s);});}
async function connect(){
 if(!cfg.enabled||!cfg.appCheckSiteKey)throw Error('운영 기능을 준비하고 있습니다. 현재 미리보기에서는 글·댓글·신고가 전송되지 않습니다.');
 if(!ready)ready=(async()=>{if(!window.firebase?.apps?.length)throw Error('게시판 연결 후 다시 시도해 주세요.');await load('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');await load('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check-compat.js');firebase.appCheck().activate(cfg.appCheckSiteKey,true);})().catch(e=>{ready=null;throw e;});
 await ready;
}
async function login(){await connect();if(!firebase.auth().currentUser)await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());return firebase.auth().currentUser;}
async function call(name,data){const user=await login(),token=await user.getIdToken(),app=await firebase.appCheck().getToken();const project=firebase.app().options.projectId;
 const res=await fetch('https://'+cfg.region+'-'+project+'.cloudfunctions.net/'+name,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'X-Firebase-AppCheck':app.token},body:JSON.stringify({data})});
 const payload=await res.json();if(!res.ok||payload.error)throw Error(payload.error?.message||'요청을 처리하지 못했습니다.');return payload.result;
}
function note(message){$('community-security-note').textContent=message;}
async function submit(action,input,onDone){if(working)return;working=true;try{await call('communityAction',{action,input});onDone();note('처리되었습니다.');}catch(e){note(e.message);}finally{working=false;}}
function readHidden(){try{return JSON.parse(localStorage.getItem('sg-community-hidden')||'{"posts":[],"authors":[]}');}catch{return {posts:[],authors:[]};}}
let hidden=readHidden();if(!Array.isArray(hidden.posts)||!Array.isArray(hidden.authors))hidden={posts:[],authors:[]};
function saveHidden(){try{localStorage.setItem('sg-community-hidden',JSON.stringify(hidden));return true;}catch{note('브라우저 저장 공간을 사용할 수 없어 숨김 설정이 저장되지 않았습니다.');return false;}}
function button(label,handler){const b=document.createElement('button');b.type='button';b.className='community-action';b.textContent=label;b.onclick=handler;return b;}
function actions(post,commentId,container){
 const row=document.createElement('div');row.className='community-actions';
 const report=button('신고',()=>openReport(post._id,commentId));report.disabled=!cfg.enabled;report.title=cfg.enabled?'운영자에게 신고':'서버 연결 후 신고할 수 있습니다';row.append(report);
 if(!commentId)row.append(button(post.authorKey?'이 작성자 차단':'이 글 숨기기',()=>{if(post.authorKey)hidden.authors.push(post.authorKey);else hidden.posts.push(post._id);saveHidden();boardOpenId=null;renderBoardList();note('이 기기에서 숨겼습니다. 서버 신고나 이용 제한은 별도입니다.');}));
 container.append(row);
}
const original=window.renderBoardList;
window.renderBoardList=function(){const saved=boardPosts;try{boardPosts=saved.filter(p=>!hidden.posts.includes(p._id)&&!hidden.authors.includes(p.authorKey));original();}finally{boardPosts=saved;}
 const post=boardPosts.find(p=>p._id===boardOpenId),view=$('board-list').querySelector('.bbs-view');if(!post||!view)return;actions(post,null,view);
 const comments=Object.entries(boardCmts[post._id]||{}).sort((a,b)=>(a[1].d||0)-(b[1].d||0));
 view.querySelectorAll('.bcmt').forEach((el,i)=>{if(comments[i]){if(hidden.authors.includes(comments[i][1].authorKey)){el.textContent='차단한 작성자의 댓글입니다.';}else actions(post,comments[i][0],el);}});
};
window.boardWrite=function(){submit('post',{board:$('bw-topic').value,n:$('bw-nick').value,t:$('bw-title').value,b:$('bw-body').value},()=>{$('bw-title').value='';$('bw-body').value='';$('board-write').hidden=true;boardLoad();});};
window.boardCmt=function(postId){const el=$('bc-in');if(!el)return;submit('comment',{postId,t:el.value,n:$('bw-nick').value||'축구팬'},()=>{el.value='';boardLoad();});};
const status=document.createElement('section');status.className='community-security';status.innerHTML='<p id="community-security-note" role="status"></p><div id="community-account-actions"></div>';$('board-ui').prepend(status);
note(cfg.enabled?'글·댓글·신고는 Google 로그인 후 이용할 수 있습니다.':'운영 기능 준비 중 · 이 미리보기의 글·댓글·신고는 서버로 전송되지 않습니다.');
$('community-account-actions').append(button('숨김·차단 초기화',()=>{hidden={posts:[],authors:[]};saveHidden();renderBoardList();note('이 기기의 숨김·차단을 해제했습니다.');}));
if(cfg.enabled){$('community-account-actions').append(button('로그인',()=>login().then(()=>note('로그인되었습니다.')).catch(e=>note(e.message))),button('로그아웃',()=>connect().then(()=>firebase.auth().signOut()).then(()=>note('로그아웃되었습니다.')).catch(e=>note(e.message))));}
const dialog=document.createElement('dialog');dialog.className='community-report';dialog.setAttribute('aria-labelledby','community-report-title');dialog.innerHTML='<h2 id="community-report-title">신고하기</h2><p>신고 내용은 운영자만 확인합니다.</p><label>신고 사유<select id="community-report-reason"><option value="abuse">욕설·괴롭힘</option><option value="spam">광고·도배</option><option value="privacy">개인정보 노출</option><option value="other">기타</option></select></label><label>추가 설명<textarea id="community-report-detail" maxlength="500" placeholder="필요한 내용을 500자 이내로 적어주세요."></textarea></label><div id="community-report-buttons"></div>';document.body.append(dialog);
let target;function openReport(postId,commentId){target={postId,commentId};$('community-report-detail').value='';dialog.showModal();}
$('community-report-buttons').append(button('취소',()=>dialog.close()),button('신고 접수',()=>submit('report',{...target,reason:$('community-report-reason').value,detail:$('community-report-detail').value},()=>dialog.close())));
const admin=document.createElement('section');admin.className='community-admin';admin.hidden=true;admin.innerHTML='<h3>신고 관리</h3><p>최근 신고 100건 · 처리 사유는 운영 기록에 남습니다.</p><div id="community-reports"></div>';$('board-ui').append(admin);
async function showReports(){try{const reports=await call('communityReports',{});admin.hidden=false;const host=$('community-reports');host.replaceChildren();if(!reports.length)host.textContent='접수된 신고가 없습니다.';
 for(const r of reports){const card=document.createElement('article');const heading=document.createElement('h4');heading.textContent=(r.snapshot?.t||'신고된 글')+' · '+r.status;const body=document.createElement('p');body.textContent=(r.snapshot?.b||r.snapshot?.t||'')+' / '+r.reason+' / '+r.detail;card.append(heading,body);
 if(['open','hide','ban'].includes(r.status)){const reason=document.createElement('input');reason.maxLength=500;reason.placeholder='처리 사유';reason.setAttribute('aria-label','처리 사유');card.append(reason);
 for(const [decision,label] of (r.status==='open'?[['dismiss','신고 기각'],['hide','내용 숨김'],['ban','숨김 및 작성 제한']]:[['restore','처리 취소·복구']]))card.append(button(label,()=>{if(!reason.value.trim()){note('처리 사유를 입력해 주세요.');return;}if(!confirm(label+' 처리하시겠습니까?'))return;submit('moderate',{reportId:r.id,decision,note:reason.value},showReports);}));}host.append(card);}
 }catch(e){note(e.message);}}
if(cfg.enabled)$('community-account-actions').append(button('운영자 신고 관리',showReports));
window.SGCommunity={call};renderBoardList();
})();
