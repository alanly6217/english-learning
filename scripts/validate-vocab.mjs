import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'vocab-lessons.json'),'utf8'));
const failures=[];
const warnings=[];
const fail=msg=>failures.push(msg);
const warn=msg=>warnings.push(msg);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));

function loadGlobal(file,globalName){
  const sandbox={window:{}};
  vm.createContext(sandbox);
  try{vm.runInContext(read(file),sandbox,{filename:file,timeout:2000})}
  catch(err){fail(`${file}: JavaScript load failed: ${err.message}`);return []}
  const value=sandbox.window[globalName];
  if(!Array.isArray(value))fail(`${file}: expected window.${globalName} to be an array`);
  return Array.isArray(value)?value:[];
}

function flatten(data){
  const out=[];
  const walk=entry=>{
    if(!entry||typeof entry!=='object')return;
    out.push(entry);
    for(const r of Array.isArray(entry.related)?entry.related:[])walk(r);
  };
  for(const x of data)walk(x);
  return out;
}
const word=e=>String(e?.word||'').trim().toLowerCase();

if(!Array.isArray(manifest)||!manifest.length)fail('vocab-lessons.json is empty or invalid');
const ids=manifest.map(x=>x.id);
for(let i=0;i<ids.length;i++){
  const expected=`E${String(i+1).padStart(2,'0')}`;
  if(ids[i]!==expected)fail(`manifest sequence: expected ${expected}, got ${ids[i]}`);
}
if(new Set(ids).size!==ids.length)fail('manifest contains duplicate lesson ids');

const lessonData={};
for(const item of manifest){
  if(!item?.id||!item?.global){fail('manifest item missing id/global');continue}
  if(item.id==='E01')continue;
  if(!item.file){fail(`${item.id}: missing file in manifest`);continue}
  if(!exists(item.file)){fail(`${item.id}: file not found: ${item.file}`);continue}
  const data=loadGlobal(item.file,item.global);
  lessonData[item.id]=data;
  if(!data.length)fail(`${item.id}: lesson data is empty`);
  for(const [idx,e] of flatten(data).entries()){
    if(!word(e))fail(`${item.id}: entry ${idx+1} missing word`);
    if(e.examples!=null){
      if(!Array.isArray(e.examples))fail(`${item.id}/${e.word}: examples must be array`);
      else for(const ex of e.examples){
        if(!Array.isArray(ex)||ex.length!==2||typeof ex[0]!=='string'||typeof ex[1]!=='string'){
          fail(`${item.id}/${e.word}: invalid example pair`);
          break;
        }
      }
    }
  }
}

// Regression gate built from the original E28-E30 lecture pages.
// Counts are conservative minimums: passing them never requires inventing content.
const SOURCE_AUDIT={
  E28:{
    minUniqueWords:80,minTotalExamples:126,
    required:{assess:2,obsession:2,possess:3,possession:2,sit:2,set:5,grant:1,signature:1,assign:2}
  },
  E29:{
    minUniqueWords:57,minTotalExamples:82,
    required:{assume:4,empty:4,prompt:3,tip:4,reassure:1,sound:4,tone:4,annoy:1,atmosphere:2,sphere:1,hemisphere:1}
  },
  E30:{
    minUniqueWords:76,minTotalExamples:147,
    required:{attach:2,attachment:2,attack:4,stick:3,stock:4,stitch:3,sting:4,attempt:2,tender:5,attend:3,extend:4,content:3,sustain:3,tight:3,tenant:2}
  }
};

for(const [lessonId,spec] of Object.entries(SOURCE_AUDIT)){
  const data=lessonData[lessonId];
  if(!data){fail(`${lessonId}: missing lesson data for source audit`);continue}
  const flat=flatten(data);
  const byWord=new Map();
  for(const e of flat)if(!byWord.has(word(e)))byWord.set(word(e),e);
  const totalExamples=[...byWord.values()].reduce((n,e)=>n+(Array.isArray(e.examples)?e.examples.length:0),0);
  if(byWord.size<spec.minUniqueWords)fail(`${lessonId}: ${byWord.size} unique words; source has at least ${spec.minUniqueWords}`);
  if(totalExamples<spec.minTotalExamples)fail(`${lessonId}: ${totalExamples} examples; source has at least ${spec.minTotalExamples}`);
  for(const [w,minExamples] of Object.entries(spec.required)){
    const e=byWord.get(w);
    if(!e){fail(`${lessonId}: source word missing: ${w}`);continue}
    const count=Array.isArray(e.examples)?e.examples.length:0;
    if(count<minExamples)fail(`${lessonId}/${w}: ${count} examples; source has ${minExamples}`);
  }
}

const html=read('vocab.html');
if(/E01[–-]E\d{2}/.test(html)||/当前已接入\s*\d+\s*课/.test(html)){
  fail('vocab.html contains hard-coded lesson coverage/count');
}
const extend=read('vocab-app-extend.js');
if(!extend.includes('LESSON_ORDER.length')||!extend.includes("LESSON_ORDER.at(-1)")){
  fail('vocab-app-extend.js must derive coverage/count from the loaded manifest');
}
const sw=read('sw.js');
if(/['"]\.\/vocab-e(?:0[4-9]|[1-9]\d)\.js['"]/.test(sw)){
  fail('sw.js contains a hard-coded per-lesson JS list');
}
if(!sw.includes('cacheLessonFiles')||!sw.includes('vocab-lessons.json')){
  fail('sw.js must cache lesson files from vocab-lessons.json');
}

if(warnings.length){
  console.log('WARNINGS');
  warnings.forEach(x=>console.log(`- ${x}`));
}
if(failures.length){
  console.error(`FAILED (${failures.length})`);
  failures.forEach(x=>console.error(`- ${x}`));
  process.exit(1);
}
console.log(`PASS: ${manifest.length} lessons registered; schema, dynamic coverage, manifest-driven offline cache, and E28-E30 source regression checks passed.`);
