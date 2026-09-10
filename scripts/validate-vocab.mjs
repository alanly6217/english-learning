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

for(const file of [...new Set([...lessonFiles,...manifest.map(x=>x.patch).filter(Boolean),'vocab-app-v2.js','vocab-app-extend.js','sw.js'])]){
  if(!exists(file))fail(`${file}: missing`); else syntaxCheck(file);
}

// Load all manifest-addressable lessons into one VM, then apply each correction layer exactly once.
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

// Cryptographic regression fingerprints transcribed from the original E28-E30 PDF.
// They validate every source word and every English example, not a sample.
const SOURCE={
  E28:{words:90,examples:140,sha256:'c861382607a71dfab746ca2d5fe41349cdc141a90aa3fd9142e958c2b713370b'},
  E29:{words:57,examples:82,sha256:'cc3cf0090617b6901cc096c59d38caeecd6c4d737c8ebff1241116ae721d8281'},
  E30:{words:76,examples:147,sha256:'c239576141099f28aa506e2a0cfffd3628e6642e7ce5e52b7f22d6392231bc94'}
};
for(const [id,expected] of Object.entries(SOURCE)){
  const data=lessonData[id];
  if(!data){fail(`${id}: missing lesson data for source audit`);continue}
  const actual=sourceFingerprint(data);
  if(actual.words!==expected.words)fail(`${id}: ${actual.words} unique words; source has ${expected.words}`);
  if(actual.examples!==expected.examples)fail(`${id}: ${actual.examples} examples; source has ${expected.examples}`);
  if(actual.sha256!==expected.sha256)fail(`${id}: source fingerprint mismatch; at least one word/example differs from the audited lecture source`);
}

// Blind-validated E31-E33 fingerprints include the full audited entry payload:
// word number, word, IPA, POS, Chinese meaning, lecture note, and both sides of every example.
const AUDITED={
  E31:{entries:53,uniqueWords:53,examples:89,sha256:'e711b869263381b43f38e22362bcf6bbbfaed40c4e43ca1deaa9e99b386a0b4a'},
  E32:{entries:56,uniqueWords:56,examples:59,sha256:'8c46e0cb1b3484e83855f6c03e85409ec1c9905031b5f45dc4ccd92154d1d58a'},
  E33:{entries:57,uniqueWords:56,examples:88,sha256:'bbe2772e685f3dae05595404912cf3419acf215f52f0877198cd4f1fc8747c0f'}
};
for(const [id,expected] of Object.entries(AUDITED)){
  const data=lessonData[id];
  if(!data){fail(`${id}: missing lesson data for audited source check`);continue}
  const actual=auditedFingerprint(data);
  for(const key of ['entries','uniqueWords','examples'])if(actual[key]!==expected[key])fail(`${id}: ${key} ${actual[key]}; audited source has ${expected[key]}`);
  if(actual.sha256!==expected.sha256)fail(`${id}: full audited source fingerprint mismatch`);
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
console.log(`PASS: ${manifest.length} lessons registered; schema, numbering, dynamic coverage, manifest-driven offline cache, correction layers, and exact E28-E30 source fingerprints and full E31-E33 audited fingerprints passed.`);
