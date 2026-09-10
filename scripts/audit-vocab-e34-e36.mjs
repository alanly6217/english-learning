import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const norm=s=>String(s??'')
  .replace(/[ﬁ]/g,'fi').replace(/[ﬂ]/g,'fl').replace(/[ﬀ]/g,'ff')
  .replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-')
  .replace(/\s+/g,' ').trim();
const flatten=data=>{
  const out=[];
  const walk=e=>{out.push(e); for(const r of Array.isArray(e?.related)?e.related:[])walk(r)};
  for(const e of data)walk(e);
  return out;
};
const auditedFingerprint=data=>{
  const rows=flatten(data).map((e,index)=>[
    `${e?.no??'x'}|${norm(e?.word).toLowerCase()}|${index}`,
    norm(e?.ipa),norm(e?.pos),norm(e?.meaning),norm(e?.explain),
    (Array.isArray(e?.examples)?e.examples:[]).map(ex=>[norm(ex?.[0]),norm(ex?.[1])])
  ]);
  return {
    entries:rows.length,
    uniqueWords:new Set(rows.map(r=>r[0].split('|')[1])).size,
    examples:flatten(data).reduce((n,e)=>n+(Array.isArray(e.examples)?e.examples.length:0),0),
    sha256:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  };
};

const EXPECTED = {"E34":{"entries":69,"uniqueWords":69,"examples":88,"sha256":"dfaaeb938fd24c4cfdef3277aea1681222a5feb8aff40bf20c2390d2e84071a2"},"E35":{"entries":57,"uniqueWords":57,"examples":84,"sha256":"d225687a2130df51de306093d41dd28328a6b5fe14743b24ea5f1e05852d5d4b"},"E36":{"entries":53,"uniqueWords":53,"examples":70,"sha256":"821a75db509ab4e325e1086373614954fd6ea2427a2218de162c402bb08c4803"}};
const WORDSEQ = {"E34":["364|away","1472|doorway","1471|door","2489|indoor","3375|outdoor","5349|way","2312|highway","4408|sideways","4756|subway","1082|convey","5314|voyage","5111|trivial","5269|via","5105|trifle","5318|wagon","5247|vehicle","1342|deviate","3750|previous","3286|obvious","5249|vein","5250|velocity","5369|weigh","5370|weight","5361|wedge","365|awe","366|awful","x|awesome","367|awkward","5051|toward","374|backward","372|back","5209|upward","1481|downward","2001|forward","1970|for","2621|inward","3388|outward","4701|straightforward","371|bachelor","2951|master","2952|masterpiece","3061|mistress","2265|headmaster","1456|doctor","1457|doctorate","1458|document","1459|documentary","3364|orthodox","3450|paradox","377|bad","379|badly","381|bag","382|baggage","2884|luggage","2713|lag","612|budget","447|beg","3420|pack","3421|package","3422|packet","3635|pocket","3456|parcel","4207|sack","3423|pact","933|compact","2440|impact","3812|propaganda","3499|peace","3500|peaceful"],"E35":["383|bait","497|bite","496|bit","498|bitter","4555|sour","4836|sweet","3551|persuade","3552|persuasion","4595|spicy","472|bet","3559|petty","3555|pet","3579|piece","3482|patch","1323|dispatch","384|bake","421|batch","422|bath","423|bathe","424|bathroom","385|balance","387|bald","388|ball","390|balloon","389|ballet","391|ballot","620|bullet","619|bull","622|bully","458|belly","457|bell","462|belt","486|bill","3585|pill","621|bulletin","559|bowl","532|boil","533|bold","572|brave","1217|dare","618|bulk","515|block","617|bulb","1965|fool","1966|foolish","4423|silly","3658|pool","3656|pond","611|bud","610|bucket","529|boast","401|bar","402|barbecue","411|barrier","409|barrel","410|barren","1602|embarrass"],"E36":["403|barber","433|beard","404|bare","405|barely","3152|naked","2213|gymnasium","418|basket","419|basketball","416|basin","432|bear","546|born","493|birth","434|bearing","593|bring","626|burden","3303|offer","3719|prefer","3720|preferable","3721|preference","3989|refer","3990|reference","1361|differ","1362|difference","1363|different","2484|indifferent","1364|differentiate","996|confer","997|conference","2500|infer","2501|inference","4767|suffer","5075|transfer","3014|metaphor","1884|ferry","1885|fertile","1886|fertilizer","441|bed","1604|embed","3599|pit","2002|fossil","1368|dig","1443|ditch","444|beer","476|beverage","4509|sober","3640|poison","3641|poisonous","5055|toxic","4849|symposium","3688|pot","552|bottle","2676|kettle","553|bottom"]};

const failures=[];
for(const id of Object.keys(EXPECTED)){
  const file=`vocab-${id.toLowerCase()}.js`;
  const sandbox={window:{}};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file,timeout:3000});
  const data=sandbox.window[`VOCAB_${id}_DATA`];
  if(!Array.isArray(data)||!data.length){failures.push(`${id}: data missing`);continue}
  const actual=auditedFingerprint(data);
  for(const key of ['entries','uniqueWords','examples']){
    if(actual[key]!==EXPECTED[id][key])failures.push(`${id}: ${key} ${actual[key]} != ${EXPECTED[id][key]}`);
  }
  if(actual.sha256!==EXPECTED[id].sha256)failures.push(`${id}: full-field fingerprint mismatch`);
  const seq=flatten(data).map(e=>`${e?.no??'x'}|${norm(e?.word).toLowerCase()}`);
  if(JSON.stringify(seq)!==JSON.stringify(WORDSEQ[id]))failures.push(`${id}: source/review word sequence mismatch`);
}
if(failures.length){
  console.error(`FAILED (${failures.length})`);
  for(const f of failures)console.error(`- ${f}`);
  process.exit(1);
}
console.log('PASS: E34-E36 full-field fingerprints and source/review word sequences verified.');
