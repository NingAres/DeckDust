import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateDeckVariants } from '../src/decks/model.js';
import { decodeDeck, encodeDeck, deckStats, parseDeckFile, addDeckCard, eligibleForDeck, deckEntryVariants, removeDeckCard, deckCollectionCards, deckClass, RENATHAL_DBF_ID, RAFAM_DBF_ID, ETC_DBF_ID, GARONA_DBF_ID, addSideboardCard } from '../src/decks/model.js';
test('included cards inherit their owner finish on addition and collection refresh without inventory shortages', () => {
 const garona = {dbfId:GARONA_DBF_ID,name:'半兽人迦罗娜',cardClass:'ROGUE',rarity:'LEGENDARY',counts:[0,1,0,0],displayQuality:'golden'};
 const added = addDeckCard({hero:930,format:2,entries:[]},garona,'ROGUE');
 for (const entry of added.entries) assert.deepEqual(entry.variants,{golden:1});
 for (const quality of ['normal','golden','signature','diamond']) {
  const counts = ['normal','golden','diamond','signature'].map(value=>Number(value===quality));
  const resolved = allocateDeckVariants(added,[{...garona,counts}]);
  for (const entry of resolved.entries) {
   assert.deepEqual(entry.variants,{[quality]:1});
   assert.equal(deckEntryVariants(entry,entry.id===GARONA_DBF_ID?{counts}:undefined)[0].missing,0);
  }
 }
 assert.equal(deckStats(added,[garona]).missing,0);
});
test('deck codes round trip all count groups and shared text names', () => {
 const deck = {name:'测试法师',hero:637,format:1,entries:[{id:100,count:1},{id:200,count:2},{id:300,count:3}]};
 const decoded = decodeDeck(`### ${deck.name}\n${encodeDeck(deck)}\n# 分享`);
 assert.deepEqual(decoded,deck);
});
test('reject damaged codes and preserve official sideboard records', () => {
 assert.throws(() => decodeDeck('hello'));
 const code=encodeDeck({hero:637,format:2,entries:[{id:100,count:2}]});
 const deck={hero:637,format:2,entries:[{id:ETC_DBF_ID,count:1},{id:100,count:2}],sideboards:[{id:581,count:1,ownerId:ETC_DBF_ID},{id:46589,count:1,ownerId:ETC_DBF_ID},{id:113183,count:1,ownerId:ETC_DBF_ID}]};
 assert.deepEqual(decodeDeck(encodeDeck(deck)).sideboards,deck.sideboards);
 assert.throws(() => decodeDeck(code.slice(0,8)));
});
test('missing dust combines qualities and reports unknown cards', () => {
 const deck={entries:[{id:1,count:2},{id:2,count:1},{id:3,count:1},{id:4,count:1}]};
 const s=deckStats(deck,[{dbfId:1,counts:[0,1,1,0],rarity:'RARE',cost:2},{dbfId:2,counts:[0,0,0,0],rarity:'LEGENDARY',cost:9},{dbfId:3,counts:[0,0,0,0],rarity:'EPIC',set:'CORE'}]);
 assert.equal(s.missing,3); assert.equal(s.dust,1600); assert.equal(s.unknown,1); assert.equal(s.curve[7],1);
 assert.equal(s.fullDust,3200);
});

test('golden dust discounts owned normal copies and fully crafts the remaining copies', () => {
 const deck={entries:[{id:10,count:1},{id:11,count:1},{id:12,count:2},{id:13,count:1},{id:14,count:1}]};
 const cards=[
  {dbfId:10,name:'已有普通传说',counts:[1,0,0,0],rarity:'LEGENDARY'},
  {dbfId:11,name:'未拥有传说',counts:[0,0,0,0],rarity:'LEGENDARY'},
  {dbfId:12,name:'普通史诗一张',counts:[1,0,0,0],rarity:'EPIC'},
  {dbfId:13,name:'已有钻石传说',counts:[0,0,1,0],rarity:'LEGENDARY'},
  {dbfId:14,name:'已有异画史诗',counts:[0,0,0,1],rarity:'EPIC'},
 ];
 const stats=deckStats(deck,cards);
 assert.equal(stats.fullDust,7600);
 assert.deepEqual(stats.goldenCards.map(card=>[card.id,card.dust]),[[10,1600],[12,1200]]);
 assert.deepEqual(stats.goldenCraftCards.map(card=>[card.id,card.dust]),[[11,3200],[12,1600]]);
});

test('collection building accepts the deck class and neutral cards and enforces copy limits', () => {
 const mage = { dbfId:1, cardClass:'MAGE', rarity:'LEGENDARY', name:'法师传说' };
 const neutral = { dbfId:2, cardClass:'NEUTRAL', rarity:'COMMON', name:'中立随从' };
 const other = { dbfId:3, classes:['ROGUE','PRIEST'], rarity:'RARE', name:'其他职业' };
 let deck = {hero:637, entries:[]};
 assert.equal(eligibleForDeck(neutral,'MAGE'),true);
 assert.equal(eligibleForDeck(other,'MAGE'),false);
 deck=addDeckCard(deck,mage,'MAGE');
 assert.throws(()=>addDeckCard(deck,mage,'MAGE'), /可添加数量/);
 deck=addDeckCard(addDeckCard(deck,neutral,'MAGE'),neutral,'MAGE');
 assert.equal(deck.entries.find(e=>e.id===2).count,2);
 assert.throws(()=>addDeckCard(deck,neutral,'MAGE'), /可添加数量/);
 assert.throws(()=>addDeckCard(deck,other,'MAGE'), /当前职业/);
});

test('legacy JSON imports repeated card copies and modern JSON never reuses saved IDs', () => {
 const cards=[{dbfId:1,cardClass:'PRIEST'},{dbfId:2,cardClass:'NEUTRAL'}];
 const legacy=JSON.stringify([{name:'旧套牌',cards:[{id:1,status:'golden'},{id:1,status:'normal'},{id:2}]}]);
 const [deck]=parseDeckFile(legacy,cards);
 assert.equal(deck.hero,813);
 assert.deepEqual(deck.entries,[{id:1,count:2,variants:{golden:1,normal:1}},{id:2,count:1,variants:{normal:1}}]);
 const [modern]=parseDeckFile(JSON.stringify({decks:[{...deck,id:'must-not-overwrite'}]}),cards);
 assert.equal(modern.id,undefined);
 assert.deepEqual(modern,deck);
 assert.throws(()=>parseDeckFile('[{"name":"缺失职业","cards":[{"id":2}]}]',cards), /无法确定/);
 assert.throws(()=>parseDeckFile('{"decks":[]}',cards));
 assert.throws(()=>parseDeckFile(JSON.stringify({...deck,entries:[{id:1,count:-1}]}),cards));
});

test('one golden copy never upgrades both copies; removal targets the selected quality', () => {
 const card={dbfId:1,name:'测试牌',cardClass:'MAGE',rarity:'COMMON',counts:[1,1,0,0]};
 assert.deepEqual(deckEntryVariants({id:1,count:2},card).map(r=>[r.quality,r.count]),[['golden',1],['normal',1]]);
 let deck={hero:637,entries:[]};
 deck=addDeckCard(deck,{...card,displayQuality:'golden'},'MAGE');
 deck=addDeckCard(deck,{...card,displayQuality:'normal'},'MAGE');
 assert.deepEqual(deck.entries[0].variants,{golden:1,normal:1});
 deck=removeDeckCard(deck,1,'golden',card);
 assert.equal(deck.entries[0].count,1); assert.deepEqual(deck.entries[0].variants,{normal:1});
 const imported=parseDeckFile(JSON.stringify({...deck,name:'品质回读',format:1}),[card])[0];
 assert.deepEqual(imported.entries,deck.entries);
 assert.deepEqual(decodeDeck(encodeDeck({...deck,format:1})).entries,[{id:1,count:1}]);
});

test('a second selected golden copy stays in the deck and reports the exact-quality shortage', () => {
 const card={dbfId:12,name:'金色仅一张',cardClass:'MAGE',rarity:'COMMON',counts:[3,1,0,0]};
 let deck={hero:637,format:1,entries:[]};
 deck=addDeckCard(deck,{...card,displayQuality:'golden'},'MAGE');
 deck=addDeckCard(deck,{...card,displayQuality:'golden'},'MAGE');
 assert.deepEqual(deckEntryVariants(deck.entries[0],card),[{quality:'golden',count:2,missing:1}]);
 const stats=deckStats(deck,[card]);
 assert.equal(stats.missing,0);
 assert.equal(stats.qualityMissing,1);
});

test('deck-only collection excludes unrelated cards and sorts missing, quality, then mana', () => {
 const card=(id,cost,counts)=>({dbfId:id,id:`CARD_${id}`,name:`牌${id}`,cost,counts});
 const cards=[card(1,5,[0,0,0,0]),card(2,1,[0,0,0,0]),card(3,6,[0,0,1,0]),card(4,1,[0,1,0,0]),card(5,0,[1,0,0,0]),card(6,2,[0,0,1,0]),card(7,0,[2,0,0,0])];
 const deck={entries:cards.slice(0,6).map(c=>({id:c.dbfId,count:1}))};
 const result=deckCollectionCards(deck,cards);
 assert.deepEqual(result.map(c=>c.dbfId),[2,1,5,4,6,3]);
 assert.equal(result[0].deckMissing,1);
 assert.equal(result.some(c=>c.dbfId===7),false);
});

test('diamond and signature quantities and missing preferred copies remain distinct', () => {
 const card={counts:[0,1,1,1]};
 assert.deepEqual(deckEntryVariants({count:3},card).map(r=>r.quality),['diamond','signature','golden']);
 assert.deepEqual(deckEntryVariants({count:2,variants:{golden:2}},card),[{quality:'golden',count:2,missing:1}]);
 assert.throws(()=>parseDeckFile(JSON.stringify({name:'无效品质',hero:637,format:1,entries:[{id:1,count:2,variants:{diamond:1}}]}),[]),/品质数量/);
});

test('deck capacity follows the 30-card rule and Renathal expands it to 40', () => {
 const full30={format:1,hero:637,entries:Array.from({length:15},(_,i)=>({id:i+1,count:2}))};
 assert.throws(()=>addDeckCard(full30,{dbfId:100,name:'额外牌',rarity:'COMMON',cardClass:'NEUTRAL'},'MAGE'),/最多 30 张/);
 let deck=addDeckCard(full30,{dbfId:RENATHAL_DBF_ID,name:'雷纳索尔王子',rarity:'LEGENDARY',cardClass:'NEUTRAL'},'MAGE');
 assert.equal(deck.entries.reduce((n,e)=>n+e.count,0),31);
 for(let id=101;id<=109;id++) deck=addDeckCard(deck,{dbfId:id,name:`牌${id}`,rarity:'COMMON',cardClass:'NEUTRAL'},'MAGE');
 assert.equal(deck.entries.reduce((n,e)=>n+e.count,0),40);
 assert.throws(()=>addDeckCard(deck,{dbfId:110,name:'超额牌',rarity:'COMMON',cardClass:'NEUTRAL'},'MAGE'),/最多 40 张/);
});

test('deck overview reports remaining slots, per-card rule violations and exact-quality shortage', () => {
 const deck={format:1,entries:[{id:1,count:2,variants:{golden:2}},{id:2,count:3}]};
 const cards=[
  {dbfId:1,name:'品质牌',rarity:'COMMON',counts:[3,1,0,0],cost:1},
  {dbfId:2,name:'超量传说',rarity:'LEGENDARY',counts:[0,0,0,0],cost:5},
 ];
 const stats=deckStats(deck,cards);
 assert.equal(stats.limit,30); assert.equal(stats.remaining,25); assert.equal(stats.overLimit,0);
 assert.equal(stats.qualityMissing,4); assert.equal(stats.missing,3);
 assert.deepEqual(stats.copyViolations,[{id:2,name:'超量传说',count:3,limit:1}]);
 assert.equal(deckStats({...deck,entries:[...deck.entries,{id:RENATHAL_DBF_ID,count:1}]},cards).limit,40);
});

test('Rafam occupies ten deck slots while collection ownership remains one card', () => {
 const deck={format:1,hero:893,entries:[{id:RAFAM_DBF_ID,count:1}]};
 const card={dbfId:RAFAM_DBF_ID,name:'时空大盗拉法姆',rarity:'LEGENDARY',counts:[1,0,0,0],cost:10};
 const stats=deckStats(deck,[card]);
 assert.equal(stats.limit,40); assert.equal(stats.total,10); assert.equal(stats.remaining,30);
 assert.equal(stats.missing,0); assert.equal(stats.qualityMissing,0);
 assert.equal(stats.owned,10);
});

test('Garona progress counts included cards only when their owner is owned, regardless of reference metadata', () => {
 const entries=[{id:GARONA_DBF_ID,count:1},{id:119815,count:1},{id:119816,count:1},...Array.from({length:27},(_,i)=>({id:200000+i,count:1}))];
 const cards=entries.filter(e=>![119815,119816].includes(e.id)).map(e=>({dbfId:e.id,counts:[1,0,0,0],rarity:'COMMON'}));
 const deck={hero:930,format:2,entries};
 assert.equal(deckStats(deck,cards).owned,30);
 const references=[{dbfId:119815,counts:[0,0,0,0]},{dbfId:119816,counts:[0,0,0,0]}];
 assert.equal(deckStats(deck,[...cards,...references]).owned,30);
 const missingOwner=cards.map(c=>c.dbfId===GARONA_DBF_ID?{...c,counts:[0,0,0,0]}:c);
 assert.equal(deckStats(deck,missingOwner).owned,27);
 assert.equal(deckStats(deck,missingOwner).missing,1);
});

test('ETC accepts three distinct sideboard cards and rejects a fourth', () => {
 let deck={format:1,hero:637,entries:[{id:ETC_DBF_ID,count:1}]};
 for (const id of [10,11,12]) deck=addSideboardCard(deck,ETC_DBF_ID,{dbfId:id,name:`备选${id}`});
 assert.equal(deck.sideboards.length,3);
 assert.throws(()=>addSideboardCard(deck,ETC_DBF_ID,{dbfId:13,name:'第四张'}),/最多选择 3 张/);
});

test('deckstring sideboard format round trips one, two and N-copy groups', () => {
 const deck={hero:637,format:2,entries:[{id:ETC_DBF_ID,count:1}],sideboards:[
  {id:20,count:1,ownerId:ETC_DBF_ID},{id:21,count:2,ownerId:ETC_DBF_ID},{id:22,count:3,ownerId:ETC_DBF_ID},
 ]};
 assert.deepEqual(decodeDeck(encodeDeck(deck)).sideboards,deck.sideboards);
});

test('the user-provided sideboard deck code imports without losing ETC card choices', () => {
 const code='AAEBAZ7ZBw7sFeC7AqDNAvX8AtqdA5XNA4mLBJfvBOKkBf3EBe+pBq7ABtuXB5mxBw1f6QHkCI/2Aoz7Aui6A4rgA6+ABK7ABJqgBomhBqqvB9nEBwABA8UE/cQF/esC/cQFn/QG/cQFAAA=';
 const deck=decodeDeck(code);
 assert.equal(deck.entries.reduce((sum,entry)=>sum+entry.count,0),40);
 assert.deepEqual(deck.sideboards,[{id:581,count:1,ownerId:ETC_DBF_ID},{id:46589,count:1,ownerId:ETC_DBF_ID},{id:113183,count:1,ownerId:ETC_DBF_ID}]);
 assert.equal(encodeDeck(deck),code);
});

test('Garona adds her two linked non-collectible cards and they count toward the 30-card deck', () => {
 const card={dbfId:GARONA_DBF_ID,name:'半兽人迦罗娜',rarity:'LEGENDARY',cardClass:'ROGUE',counts:[0,0,0,0]};
 const deck=addDeckCard({hero:121643,format:2,entries:[]},card,'ROGUE');
 assert.deepEqual(deck.entries.map(entry=>entry.id),[GARONA_DBF_ID,119815,119816]);
 const stats=deckStats(deck,[card]);
 assert.equal(stats.total,3); assert.equal(stats.unknown,0); assert.equal(stats.missing,1);
});

test('hero class falls back to the unique class of the deck when its hero is a skin ID', () => {
 const deck={hero:121643,entries:[{id:1,count:1},{id:2,count:1},{id:3,count:1}]};
 const cards=[{dbfId:1,cardClass:'ROGUE'},{dbfId:2,cardClass:'ROGUE'},{dbfId:3,cardClass:'NEUTRAL'}];
 assert.equal(deckClass(deck,cards),'ROGUE');
});

