const DATA=window.VOCAB_DATA||[];
let module='course', idx=0, memIdx=0, reviewIdx=0, answerVisible=false;
const states=JSON.parse(localStorage.getItem('alan_vocab_e01_states_v1')||'{}');
let voices=[];
function loadVoices(){voices=speechSynthesis?.getVoices?.()||[]}
if('speechSynthesis' in window){loadVoices();speechSynthesis.onvoiceschanged=loadVoices}
function speak(t){
  if(!('speechSynthesis' in window)) return alert('当前浏览器不支持语音朗读');
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(t);
  u.lang='en-US';u.rate=.88;
  u.voice=voices.find(v=>/en-US/i.test(v.lang)&&/Samantha|Ava|Allison|Susan|Alex|Joelle|Nicky/i.test(v.name))
      ||voices.find(v=>/en-US/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||null;
  speechSynthesis.speak(u);
}
function saveStates(){localStorage.setItem('alan_vocab_e01_states_v1',JSON.stringify(states))}
function entryKey(r){return r.no?`word-${r.no}`:`ext-${r.word.toLowerCase()}`}
function stateLabel(s){return s==='know'?'认识':s==='fuzzy'?'模糊':s==='no'?'不认识':'未学习'}
function stateClass(s){return s||''}
function allEntries(){
  const map=new Map();
  DATA.forEach(x=>{
    const k=entryKey(x);
    if(!map.has(k)) map.set(k,{...x,key:k,kind:'core',sourceMain:true});
    (x.related||[]).forEach(r=>{
      const rk=entryKey(r);
      if(!map.has(rk)) map.set(rk,{...r,key:rk,kind:r.extension?'extension':'related',sourceMain:false});
    })
  });
  return [...map.values()];
}
function stats(){
  const arr=allEntries(); let know=0,fuzzy=0,no=0,marked=0;
  arr.forEach(e=>{const s=states[e.key]; if(s){marked++; if(s==='know')know++; if(s==='fuzzy')fuzzy++; if(s==='no')no++;}});
  return {total:arr.length,know,fuzzy,no,marked};
}
function updateStats(){
  const s=stats();
  document.getElementById('st-total').textContent=s.total;
  document.getElementById('st-know').textContent=s.know;
  document.getElementById('st-fuzzy').textContent=s.fuzzy;
  document.getElementById('st-no').textContent=s.no;
  document.getElementById('pstate').textContent=`${s.marked} / ${s.total} 词已标记`;
  document.getElementById('bar').style.width=`${s.total?s.marked/s.total*100:0}%`;
}
function exampleBlock(examples){
  if(!examples?.length)return '<div class="zh">原讲义未提供例句。</div>';
  return examples.map(x=>`<div class="example"><div class="ex-top"><div class="en" onclick='speak(${JSON.stringify(x[0])})'>${x[0]}</div><button class="ex-speak" onclick='speak(${JSON.stringify(x[0])})'>🔊</button></div><div class="zh">${x[1]}</div></div>`).join('');
}
function relatedBlock(r){
  const key=entryKey(r), st=states[key]||'';
  return `<details data-related-key="${key}">
  <summary>
    <div class="rword" onclick="event.stopPropagation();speak('${r.word.replaceAll("'","\\'")}')">${r.word}${r.extension?'<span class="tag">拓展词</span>':'<span class="tag" style="background:#eef4ff;color:#315ea8;border-color:#cfddf6">关联词</span>'}</div>
    <div class="rmeta">${r.no?'No. '+r.no+' · ':''}${r.ipa?'['+r.ipa+'] · ':''}${r.pos||''}</div>
    ${st?`<div class="rstate ${st}">${stateLabel(st)}</div>`:'<div class="chev">⌄</div>'}
  </summary>
  <div class="rbody">
    <div class="section" style="margin-top:0"><div class="label">中文释义</div><div class="meaning" style="font-size:16px">${r.meaning}</div></div>
    ${r.explain?`<div class="section"><div class="label">课程讲解</div><div class="explain">${r.explain}</div></div>`:''}
    <div class="section"><div class="label">原讲义例句</div>${exampleBlock(r.examples)}</div>
    <button class="speak" style="margin:12px 0 0;width:auto;font-size:15px" onclick="speak('${r.word.replaceAll("'","\\'")}')">🔊 美式发音</button>
    <div class="related-status">
      ${stateButtons(key,'rstate')}
    </div>
    <button class="collapse-bottom" onclick="collapseRelated(this,event)">↑ 收起这个单词</button>
  </div></details>`;
}
function stateButtons(key, attr='state'){
  const st=states[key]||'';
  const a=attr==='rstate'?'data-rstate':'data-state';
  return `
    <button ${a}="know" class="${st==='know'?'active':''}" onclick="mark('${key}','know',event)">认识</button>
    <button ${a}="fuzzy" class="${st==='fuzzy'?'active':''}" onclick="mark('${key}','fuzzy',event)">模糊</button>
    <button ${a}="no" class="${st==='no'?'active':''}" onclick="mark('${key}','no',event)">不认识</button>`;
}
function mark(key,s,event){
  event?.stopPropagation();
  states[key]=s; saveStates(); updateStats();
  if(module==='course') renderCourse();
  if(module==='memorize') renderMemorize();
  if(module==='review') renderReview();
  if(module==='library') renderLibrary();
}
function collapseRelated(btn,event){
  event?.stopPropagation(); const d=btn.closest('details'); if(!d)return;
  d.open=false; setTimeout(()=>d.scrollIntoView({behavior:'smooth',block:'center'}),80);
}
function renderTabs(){
  document.getElementById('tabs').innerHTML=DATA.map((x,i)=>`<button class="tab ${i===idx?'active':''}" onclick="goCourse(${i})">${x.word}</button>`).join('');
}
function renderCourse(){
  renderTabs();
  const x=DATA[idx], key=entryKey(x);
  document.getElementById('cards').innerHTML=`<section class="card">
    <div class="headline">
      <div><div class="num">E01 · No. ${x.no}</div><div class="word" onclick="speak('${x.word}')">${x.word}</div><div class="ipa">[${x.ipa}] · ${x.pos}</div></div>
      <button class="speak" onclick="speak('${x.word}')">🔊</button>
    </div>
    <div class="section"><div class="label">中文释义</div><div class="meaning">${x.meaning}</div></div>
    ${x.explain?`<div class="section"><div class="label">课程讲解 / 词源记忆</div><div class="explain">${x.explain}</div></div>`:''}
    <div class="section"><div class="label">原讲义例句</div>${exampleBlock(x.examples)}</div>
    <div class="section">
      <div class="related-head">
        <div class="label" style="margin:0">词族与关联词</div>
        <div class="related-count">${x.related.length} 个</div>
      </div>
      ${x.related.map(relatedBlock).join('')}
    </div>
    <div class="status">${stateButtons(key,'state')}</div>
    <div class="nav">
      <button onclick="goCourse(Math.max(0,idx-1))">← 上一个</button>
      <button onclick="goCourse(Math.min(DATA.length-1,idx+1))">下一个 →</button>
    </div>
  </section>`;
}
function goCourse(i){idx=i;renderCourse();window.scrollTo({top:0,behavior:'smooth'})}
function setModule(m){
  module=m; if(m!=='course') answerVisible=false;
  ['course','memorize','review','library'].forEach(v=>{
    document.getElementById(v+'-view').classList.toggle('hidden',v!==m);
    document.getElementById('nav-'+v).classList.toggle('active',v===m);
  });
  const titles={
    course:['词汇学习 · E01','先理解再背诵：完整展示主词、讲解、原讲义例句以及词族/关联词。隐藏答案练习请进入“背诵模式”。'],
    memorize:['背诵模式','将主词、关联词、拓展词打平成独立单词卡。先回忆，再显示答案。'],
    review:['今日复习','优先抽取你标记为“不认识”和“模糊”的单词，集中重复。'],
    library:['E01 词库','搜索本组主词、关联词和拓展词；同一编号词只保留一个学习状态。']
  };
  document.getElementById('hero-title').textContent=titles[m][0];
  document.getElementById('hero-desc').textContent=titles[m][1];
  if(m==='course') renderCourse();
  if(m==='memorize') renderMemorize();
  if(m==='review') renderReview();
  if(m==='library') renderLibrary();
}
function wordCard(e,modeName,index,total){
  const st=states[e.key]||'';
  const answer=answerVisible;
  return `<section class="card">
    <div class="queue-meta">${modeName} · ${index+1} / ${total} · ${e.kind==='extension'?'拓展词':e.sourceMain?'主词':'关联词'}</div>
    <div class="headline">
      <div><div class="num">${e.no?'No. '+e.no:'大纲外延伸词'}</div><div class="word" onclick="speak('${e.word.replaceAll("'","\\'")}')">${e.word}</div><div class="ipa">[${e.ipa||''}] · ${e.pos||''}</div></div>
      <button class="speak" onclick="speak('${e.word.replaceAll("'","\\'")}')">🔊</button>
    </div>
    ${answer?`
      <div class="section"><div class="label">中文释义</div><div class="meaning">${e.meaning||''}</div></div>
      ${e.explain?`<div class="section"><div class="label">课程讲解 / 词源记忆</div><div class="explain">${e.explain}</div></div>`:''}
      <div class="section"><div class="label">原讲义例句</div>${exampleBlock(e.examples)}</div>
      <div class="status">${stateButtons(e.key,'state')}</div>
    `:`<div class="answer-cover"><p>先自己回忆释义与用法。</p><button class="reveal" onclick="answerVisible=true;${module==='review'?'renderReview()':'renderMemorize()'}">显示答案</button></div>`}
  </section>`;
}
function renderMemorize(){
  const arr=allEntries(); if(!arr.length)return;
  memIdx=Math.min(memIdx,arr.length-1);
  document.getElementById('memorize-view').innerHTML=wordCard(arr[memIdx],'背诵模式',memIdx,arr.length)+
    `<div class="nav"><button onclick="memMove(-1)">← 上一个</button><button onclick="memMove(1)">下一个 →</button></div>
     <div class="queue-actions"><button onclick="memFilter('all')">全部</button><button onclick="memFilter('no')">只看不认识</button><button onclick="memFilter('fuzzy')">只看模糊</button><button onclick="memFilter('unseen')">只看未学习</button></div>`;
}
let memMode='all';
function memArray(){
  const arr=allEntries();
  if(memMode==='no')return arr.filter(e=>states[e.key]==='no');
  if(memMode==='fuzzy')return arr.filter(e=>states[e.key]==='fuzzy');
  if(memMode==='unseen')return arr.filter(e=>!states[e.key]);
  return arr;
}
function memFilter(m){
  memMode=m; memIdx=0; answerVisible=false;
  const arr=memArray();
  if(!arr.length){document.getElementById('memorize-view').innerHTML='<div class="card empty">当前筛选没有单词。</div>';return;}
  renderMemorizeFiltered(arr);
}
function renderMemorizeFiltered(arr){
  memIdx=Math.min(memIdx,arr.length-1);
  document.getElementById('memorize-view').innerHTML=wordCard(arr[memIdx],'背诵模式',memIdx,arr.length)+
  `<div class="nav"><button onclick="memMoveFiltered(-1)">← 上一个</button><button onclick="memMoveFiltered(1)">下一个 →</button></div>
   <div class="queue-actions"><button onclick="memFilter('all')">全部</button><button onclick="memFilter('no')">只看不认识</button><button onclick="memFilter('fuzzy')">只看模糊</button><button onclick="memFilter('unseen')">只看未学习</button></div>`;
}
function memMove(d){const a=allEntries();memIdx=Math.max(0,Math.min(a.length-1,memIdx+d));answerVisible=false;renderMemorize();window.scrollTo({top:0,behavior:'smooth'})}
function memMoveFiltered(d){const a=memArray();memIdx=Math.max(0,Math.min(a.length-1,memIdx+d));answerVisible=false;renderMemorizeFiltered(a);window.scrollTo({top:0,behavior:'smooth'})}
function renderReview(){
  const arr=allEntries().filter(e=>states[e.key]==='no'||states[e.key]==='fuzzy');
  if(!arr.length){document.getElementById('review-view').innerHTML='<div class="card empty">目前没有“模糊”或“不认识”的单词。<br>先在课程学习或单词背诵中标记一些词。</div>';return;}
  reviewIdx=Math.min(reviewIdx,arr.length-1);
  document.getElementById('review-view').innerHTML=wordCard(arr[reviewIdx],'今日复习',reviewIdx,arr.length)+
    `<div class="nav"><button onclick="reviewMove(-1)">← 上一个</button><button onclick="reviewMove(1)">下一个 →</button></div>`;
}
function reviewMove(d){
  const arr=allEntries().filter(e=>states[e.key]==='no'||states[e.key]==='fuzzy');
  reviewIdx=Math.max(0,Math.min(arr.length-1,reviewIdx+d));answerVisible=false;renderReview();window.scrollTo({top:0,behavior:'smooth'});
}
function renderLibrary(q=''){
  const arr=allEntries().filter(e=>!q||e.word.toLowerCase().includes(q.toLowerCase())||String(e.no||'').includes(q));
  document.getElementById('library-view').innerHTML=`<section class="card">
    <input class="search" placeholder="搜索单词或编号…" value="${q.replaceAll('"','&quot;')}" oninput="renderLibrary(this.value)">
    <div class="wordlist">${arr.map(e=>{
      const s=states[e.key]||'';
      return `<div class="wordrow" onclick="openFromLibrary('${e.key}')"><div><b>${e.word}</b><br><small>${e.no?'No. '+e.no:'拓展词'} · [${e.ipa||''}] · ${e.meaning||''}</small></div><span class="state-dot ${stateClass(s)}">${stateLabel(s)}</span></div>`;
    }).join('')||'<div class="empty">没有找到匹配单词。</div>'}</div>
  </section>`;
}
function openFromLibrary(key){
  const arr=allEntries(), p=arr.findIndex(e=>e.key===key); if(p<0)return;
  memIdx=p; memMode='all'; answerVisible=true; setModule('memorize');
}
updateStats(); setModule('course');
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
