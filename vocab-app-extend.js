(async()=>{
  async function loadScript(src){
    return new Promise(resolve=>{
      const s=document.createElement('script');
      s.src='./'+src;
      s.async=false;
      s.onload=()=>resolve(true);
      s.onerror=()=>resolve(false);
      document.head.appendChild(s);
    });
  }
  let manifest=[];
  try{
    const response=await fetch('./vocab-lessons.json',{cache:'no-store'});
    if(response.ok)manifest=await response.json();
  }catch{}
  if(!Array.isArray(manifest)||!manifest.length)return;
  for(const item of manifest){
    if(!window[item.global]&&item.file)await loadScript(item.file);
  }
  for(const item of manifest){
    const data=window[item.global]||[];
    if(Array.isArray(data)&&data.length&&!LESSONS[item.id]){
      LESSONS[item.id]={id:item.id,title:item.title,data};
      LESSON_ORDER.push(item.id);
    }
  }
  renderDirectory();
  document.getElementById('footer-current').textContent=`当前已接入 ${LESSON_ORDER.length} 课 · 正在学习 ${lessonId}`;
  const requested=new URLSearchParams(location.search).get('lesson');
  if(requested&&LESSONS[requested]&&requested!==lessonId)openLesson(requested);
})();
