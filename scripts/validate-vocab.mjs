import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'vocab-lessons.json'),'utf8'));
const failures=[];
const fail=msg=>failures.push(msg);
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
  // E01-E03 are legacy statically-loaded bundles; E04+ are manifest-loaded files.
  if(['E01','E02','E03'].includes(item.id))continue;
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

// Source-derived example-count fingerprints from the original E28-E30 lecture PDF.
// They are completeness gates only; they never generate or infer study content.
const SOURCE_EXAMPLE_COUNTS={
E28:{assess:2,assessment:1,census:1,censor:1,censorship:0,session:3,obsession:2,obsess:2,obsessive:2,possess:3,possession:2,sit:2,seat:2,site:1,situated:1,situation:0,siege:1,parasite:1,parachute:3,set:5,setting:2,settle:2,settlement:0,size:0,setback:1,upset:3,offset:1,outset:1,sunset:0,subsidy:1,allowance:2,grant:1,resident:2,residence:2,preside:1,president:2,chairman:1,chair:0,saddle:1,thesis:2,synthesis:1,synthetic:1,hypothesis:1,assign:2,assignment:1,sign:4,signal:3,signature:1,signify:2,significance:1,significant:1,design:2,designate:2,resign:3,seal:2,second:1,secondary:1,consecutive:2,sequence:2,consequence:2,consequently:1,subsequent:1,execute:3,executive:2,persecute:1,prosecute:3,social:1,sociable:1,socialism:0,society:0,sociology:0,associate:3,association:3,suit:3,suitable:1,suite:2,sue:2,pursue:2,pursuit:2,section:3},
E29:{assume:4,assumption:2,example:2,sample:2,exemplify:1,exempt:2,empty:4,consume:3,consumption:0,presume:2,presumably:1,resume:2,premium:3,prompt:3,tip:4,top:0,assurance:2,assure:1,reassure:1,sure:0,insure:2,insurance:1,ensure:1,astonish:1,stun:2,thunder:1,sound:4,sane:1,tone:4,tune:3,supersonic:0,swan:2,noise:0,noisy:0,annoy:1,astronaut:0,star:0,astronomy:0,disaster:1,disastrous:0,catastrophe:1,consider:2,considerate:1,consideration:2,considerable:1,desire:2,desirable:1,eager:1,navy:0,naval:0,navigation:0,marine:2,submarine:2,athlete:0,atmosphere:2,sphere:1,hemisphere:1},
E30:{attach:2,attachment:2,detach:2,attack:4,stick:3,sticky:2,stake:3,stock:4,stocking:0,stack:3,stagger:2,steak:0,stitch:3,sting:4,instinct:2,extinct:2,extinguish:2,distinct:2,distinction:2,distinguish:2,stimulate:2,incentive:1,spur:2,style:0,thorn:1,ticket:1,stab:3,attempt:2,tempt:2,temptation:1,lure:2,tentative:2,tend:2,tendency:1,trend:1,tender:5,attend:3,attendance:2,attendant:1,attention:0,extend:4,extension:2,extensive:2,extent:2,intend:2,intention:1,intense:2,intensity:2,intensive:1,pretend:2,contend:2,contain:2,container:0,content:3,continue:2,continuous:1,continual:1,continent:0,detain:2,entertain:2,entertainment:2,entry:3,entrance:3,obtain:1,retain:2,retention:1,rein:3,refrain:2,sustain:3,tense:3,tension:1,tight:3,tent:0,tedious:2,tape:1,tenant:2}
};

for(const [lessonId,expected] of Object.entries(SOURCE_EXAMPLE_COUNTS)){
  const data=lessonData[lessonId];
  if(!data){fail(`${lessonId}: missing lesson data for source audit`);continue}
  const flat=flatten(data);
  const byWord=new Map();
  for(const e of flat)if(!byWord.has(word(e)))byWord.set(word(e),e);
  const expectedWords=Object.keys(expected);
  for(const w of expectedWords){
    const e=byWord.get(w);
    if(!e){fail(`${lessonId}: source word missing: ${w}`);continue}
    const actual=Array.isArray(e.examples)?e.examples.length:0;
    const needed=expected[w];
    if(actual<needed)fail(`${lessonId}/${w}: ${actual} examples; source has ${needed}`);
  }
  const sourceUnexpected=[...byWord.keys()].filter(w=>!(w in expected));
  if(sourceUnexpected.length)fail(`${lessonId}: words not present in source fingerprint: ${sourceUnexpected.join(', ')}`);
}

const html=read('vocab.html');
if(/E01[–-]E\d{2}/.test(html)||/当前已接入\s*\d+\s*课/.test(html))fail('vocab.html contains hard-coded lesson coverage/count');
const extend=read('vocab-app-extend.js');
if(!extend.includes('LESSON_ORDER.length')||!extend.includes("LESSON_ORDER.at(-1)"))fail('vocab-app-extend.js must derive coverage/count from manifest');
const sw=read('sw.js');
if(/['"]\.\/vocab-e(?:0[4-9]|[1-9]\d)\.js['"]/.test(sw))fail('sw.js contains a hard-coded per-lesson JS list');
if(!sw.includes('cacheLessonFiles')||!sw.includes('vocab-lessons.json'))fail('sw.js must cache lesson files from vocab-lessons.json');

if(failures.length){
  console.error(`FAILED (${failures.length})`);
  failures.forEach(x=>console.error(`- ${x}`));
  process.exit(1);
}
console.log(`PASS: ${manifest.length} lessons registered; schema, dynamic coverage, manifest-driven offline cache, and E28-E30 source completeness checks passed.`);
