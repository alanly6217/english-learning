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

  const lastId=LESSON_ORDER.at(-1)||'E01';
  const note=document.querySelector('.directory-note');
  if(note)note.textContent=`当前正式接入 E01–${lastId}。后续课程继续按原讲义数据导入，不生成不存在的词条。`;

  renderDirectory();
  const footer=document.getElementById('footer-current');
  if(footer)footer.textContent=`当前已接入 ${LESSON_ORDER.length} 课 · 正在学习 ${lessonId}`;

  const requested=new URLSearchParams(location.search).get('lesson');
  if(requested&&LESSONS[requested]&&requested!==lessonId)openLesson(requested);
})();
