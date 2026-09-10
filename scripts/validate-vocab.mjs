import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const root=process.cwd();
const failures=[];
const fail=msg=>failures.push(msg);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const norm=s=>String(s??'')
  .replace(/[ﬁ]/g,'fi').replace(/[ﬂ]/g,'fl').replace(/[ﬀ]/g,'ff')
  .replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-')
  .replace(/\s+/g,' ').trim();
const normWord=e=>norm(e?.word).toLowerCase();

function syntaxCheck(file){
  try{new vm.Script(read(file),{filename:file})}
  catch(err){fail(`${file}: JavaScript syntax error: ${err.message}`)}
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
function auditedFingerprint(data){
  const rows=flatten(data).map((e,index)=>[
    `${e?.no??'x'}|${normWord(e)}|${index}`,
    norm(e?.ipa),norm(e?.pos),norm(e?.meaning),norm(e?.explain),
    (Array.isArray(e?.examples)?e.examples:[]).map(ex=>[norm(ex?.[0]),norm(ex?.[1])])
  ]);
  return {
    entries:rows.length,
    uniqueWords:new Set(rows.map(r=>r[0].split('|')[1])).size,
    examples:flatten(data).reduce((n,e)=>n+(Array.isArray(e.examples)?e.examples.length:0),0),
    sha256:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  };
}
function sourceFingerprint(data){
  const byWord=new Map();
  for(const e of flatten(data)){
    const w=normWord(e);
    if(w&&!byWord.has(w))byWord.set(w,e);
  }
  const canonical=[...byWord.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([w,e])=>[
    w,(Array.isArray(e.examples)?e.examples:[]).map(ex=>norm(ex?.[0]))
  ]);
  return {
    words:byWord.size,
    examples:[...byWord.values()].reduce((n,e)=>n+(Array.isArray(e.examples)?e.examples.length:0),0),
    sha256:crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
  };
}

let manifest=[];
try{manifest=JSON.parse(read('vocab-lessons.json'))}
catch(err){fail(`vocab-lessons.json parse failed: ${err.message}`)}
if(!Array.isArray(manifest)||!manifest.length)fail('vocab-lessons.json is empty or invalid');

let auditRegistry={};
try{
  const parsed=JSON.parse(read('vocab-source-audits.json'));
  if(parsed?.schema_version!==1)fail(`vocab-source-audits.json schema_version must be 1`);
  if(parsed?.normalization!=='v1')fail(`vocab-source-audits.json normalization must be v1`);
  auditRegistry=parsed?.lessons&&typeof parsed.lessons==='object'?parsed.lessons:{};
}catch(err){fail(`vocab-source-audits.json parse failed: ${err.message}`)}

const ids=manifest.map(x=>x.id);
for(let i=0;i<ids.length;i++){
  const expected=`E${String(i+1).padStart(2,'0')}`;
  if(ids[i]!==expected)fail(`manifest sequence: expected ${expected}, got ${ids[i]}`);
}
if(new Set(ids).size!==ids.length)fail('manifest contains duplicate lesson ids');
const globals=manifest.map(x=>x.global).filter(Boolean);
if(new Set(globals).size!==globals.length)fail('manifest contains duplicate global names');
const lessonFiles=manifest.map(x=>x.file).filter(Boolean);
if(new Set(lessonFiles).size!==lessonFiles.length)fail('manifest contains duplicate lesson files');
for(const id of Object.keys(auditRegistry))if(!ids.includes(id))fail(`audit registry references unknown lesson ${id}`);

for(const file of [...new Set([...lessonFiles,...manifest.map(x=>x.patch).filter(Boolean),'vocab-app-v2.js','vocab-app-extend.js','sw.js'])]){
  if(!exists(file))fail(`${file}: missing`); else syntaxCheck(file);
}

const sandbox={window:{}};
vm.createContext(sandbox);
for(const item of manifest){
  if(['E01','E02','E03'].includes(item.id))continue;
  if(!item?.id||!item?.global||!item.file){fail(`${item?.id||'manifest item'}: missing id/global/file`);continue}
  if(!exists(item.file))continue;
  try{vm.runInContext(read(item.file),sandbox,{filename:item.file,timeout:3000})}
  catch(err){fail(`${item.file}: JavaScript load failed: ${err.message}`)}
}
for(const patch of [...new Set(manifest.map(x=>x.patch).filter(Boolean))]){
  if(!exists(patch))continue;
  try{vm.runInContext(read(patch),sandbox,{filename:patch,timeout:3000})}
  catch(err){fail(`${patch}: correction layer failed: ${err.message}`)}
}

const lessonData={};
const numberedWords=new Map();
for(const item of manifest){
  if(['E01','E02','E03'].includes(item.id))continue;
  const data=sandbox.window[item.global];
  if(!Array.isArray(data)||!data.length){fail(`${item.id}: lesson data is empty or unavailable`);continue}
  lessonData[item.id]=data;
  for(const [idx,e] of flatten(data).entries()){
    const w=normWord(e);
    if(!w)fail(`${item.id}: entry ${idx+1} missing word`);
    if(e.no!=null){
      const no=String(e.no);
      const prior=numberedWords.get(no);
      if(prior&&prior!==w)fail(`No. ${no} maps to conflicting words: ${prior} / ${w}`);
      else if(w)numberedWords.set(no,w);
    }
    if(e.examples!=null){
      if(!Array.isArray(e.examples))fail(`${item.id}/${e.word}: examples must be array`);
      else for(const [exIdx,ex] of e.examples.entries()){
        if(!Array.isArray(ex)||ex.length!==2||typeof ex[0]!=='string'||typeof ex[1]!=='string'){
          fail(`${item.id}/${e.word}: invalid example pair #${exIdx+1}`);continue;
        }
        if(!norm(ex[0]))fail(`${item.id}/${e.word}: empty English example #${exIdx+1}`);
        if(!norm(ex[1]))fail(`${item.id}/${e.word}: empty Chinese example #${exIdx+1}`);
      }
    }
  }
}

for(const [id,expected] of Object.entries(auditRegistry)){
  const data=lessonData[id];
  if(!data){fail(`${id}: missing lesson data for source audit`);continue}
  if(expected.mode==='source'){
    const actual=sourceFingerprint(data);
    for(const key of ['words','examples'])if(actual[key]!==expected[key])fail(`${id}: ${key} ${actual[key]}; audited source has ${expected[key]}`);
    if(actual.sha256!==expected.sha256)fail(`${id}: source fingerprint mismatch`);
  }else if(expected.mode==='full'){
    const actual=auditedFingerprint(data);
    for(const key of ['entries','uniqueWords','examples'])if(actual[key]!==expected[key])fail(`${id}: ${key} ${actual[key]}; audited source has ${expected[key]}`);
    if(actual.sha256!==expected.sha256)fail(`${id}: full audited source fingerprint mismatch`);
  }else{
    fail(`${id}: unsupported audit mode ${expected.mode}`);
  }
  if(Array.isArray(expected.word_sequence)){
    const seq=flatten(data).map(e=>`${e?.no??'x'}|${normWord(e)}`);
    if(JSON.stringify(seq)!==JSON.stringify(expected.word_sequence))fail(`${id}: source/review word sequence mismatch`);
  }
}

const html=read('vocab.html');
if(/E01[–-]E\d{2}/.test(html)||/当前已接入\s*\d+\s*课/.test(html))fail('vocab.html contains hard-coded lesson coverage/count');
const extend=read('vocab-app-extend.js');
if(!extend.includes('LESSON_ORDER.length')||!extend.includes("LESSON_ORDER.at(-1)"))fail('vocab-app-extend.js must derive coverage/count from manifest');
if(!extend.includes('item&&item.patch'))fail('vocab-app-extend.js must apply optional manifest correction layers');
const sw=read('sw.js');
if(/['"]\.\/vocab-e(?:0[4-9]|[1-9]\d)\.js['"]/.test(sw))fail('sw.js contains a hard-coded per-lesson JS list');
if(!sw.includes('cacheLessonFiles')||!sw.includes('vocab-lessons.json')||!sw.includes('x&&x.patch'))fail('sw.js must cache lesson files and correction layers from vocab-lessons.json');

if(failures.length){
  console.error(`FAILED (${failures.length})`);
  failures.forEach(x=>console.error(`- ${x}`));
  process.exit(1);
}
console.log(`PASS: ${manifest.length} lessons registered; schema, numbering, manifest-driven offline cache, correction layers, and ${Object.keys(auditRegistry).length} source-audited lessons verified.`);
