const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const A = require('./accounting.js');
const today='2026-10-08';
const base = () => ({ledgerVersion:1,stays:[],transactions:[],utilities:[],settings:{}});
const close=(a,b)=>assert(Math.abs(a-b)<0.011,`${a} != ${b}`);
const stay={id:'s',name:'Test',checkin:'2026-05-30',checkout:'2026-06-02',guests:2,agreed:300,basis:'gross',review:false};
const s=base();s.stays=[stay];
s.transactions=[
 {id:'a',type:'income',category:'Prenotazione diretta',amount:100,date:'2026-05-01',stayId:'s'},
 {id:'b',type:'income',category:'Prenotazione diretta',amount:200,date:'2026-06-02',stayId:'s'},
 {id:'tax',type:'income',category:'Tassa di soggiorno',amount:15,date:'2026-06-02',stayId:'s'},
 {id:'clean',type:'expense',category:'Pulizie',amount:60,date:'2026-06-02',stayId:'s'}
];
assert.equal(A.presences(s,'2026-05'),4);assert.equal(A.presences(s,'2026-06'),2);
assert.equal(A.monthly(s,'2026-05',today).revenue,200);
assert.equal(A.monthly(s,'2026-06',today).revenue,100);
assert.equal(A.monthly(s,'2026-05',today).costs,40);
assert.equal(A.staySummary(s,stay,today).due,0);
assert.equal(A.monthly(s,'2026-06',today).cashIn,200);
// Utility presences are counted once even with three bills over the same dates.
const bills=base();bills.stays=[{...stay,checkin:'2026-01-01',checkout:'2026-01-11',agreed:400}];
for(const category of ['Luce','Acqua','Gas'])bills.transactions.push({id:category,type:'expense',category:'Utenze',amount:100,date:'2026-02-10',periodStart:'2026-01-01',periodEnd:'2026-01-31'});
assert.equal(A.monthly(bills,'2026-01',today).costPerGuest,15);
assert.equal(A.monthly(bills,'2026-02',today).costPerGuest,null);
// Bill dates include the final day, including leap years and a single-day bill.
assert.equal(A.expenseInMonth(bills,{amount:29,date:'2024-03-01',periodStart:'2024-02-01',periodEnd:'2024-02-29'},'2024-02'),29);
assert.equal(A.expenseInMonth(bills,{amount:20,date:'2026-02-01',periodStart:'2026-01-31',periodEnd:'2026-01-31'},'2026-01'),20);
assert.equal(A.posted({date:'2026-01-01',status:'planned'},today),false);
// Exercise the actual repository migration without browser or network access.
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const STORAGE_KEY'));
new vm.Script(script);new vm.Script(fs.readFileSync('manager.js','utf8'));
const prefix=script.slice(0,script.indexOf('      let state = loadState();'));
const context={CasaAccounting:A,structuredClone,URLSearchParams,window:{},location:{hostname:'localhost',search:'?preview=1'}};
vm.createContext(context);vm.runInContext(prefix+'globalThis.migrateSaved=migrateState; globalThis.audit = migrateState(null); globalThis.original = seedTransactions; })();',context);
const recovered=context.audit;
assert.equal(recovered.transactions.length+recovered.taxArchive.length,context.original.length);
for(const t of context.original) {
 const original=recovered.migrationSnapshot.transactions.find(x=>x.id===t.id);assert.equal(original.amount,t.amount);assert.equal(original.status,t.status);
}
assert.equal(recovered.transactions.find(t=>t.id==='report-booking-20260528-01').amount,286.5);
assert.equal(recovered.transactions.find(t=>t.id==='bill-electricity-2026-04-05-share25').status,'posted');
assert.equal(recovered.transactions.find(t=>t.id==='manual-direct-20260613').amount,50);
assert(!recovered.transactions.some(A.isTax));
assert.equal(recovered.stays.length,13);
assert.equal(JSON.stringify(A.migrate(recovered)),JSON.stringify(recovered));
const breakfast=recovered.transactions.find(t=>t.id==='manual-breakfast-20260526-31');assert(breakfast.stayId);
assert.equal(recovered.stays.filter(s=>s.checkin==='2026-05-19').length,1);
assert.equal(recovered.stays.find(s=>s.checkin==='2026-05-19').guests,7);
for(const t of recovered.transactions)if(t.allocations)close(t.allocations.reduce((n,p)=>n+p.amount,0),t.amount);
console.log('PASS: separate payments/presences, monthly allocation, taxes, three utilities, empty months, inclusive bill dates, payment status, original data preserved, idempotent migration.');
console.log(JSON.stringify({stays:recovered.stays.length,transactions:recovered.transactions.length,utilities:recovered.utilities.length,may:A.monthly(recovered,'2026-05',today)},null,2));
const taxes=base();taxes.taxRules=[{from:'2026-01-01',rate:3,maxNights:0}];taxes.stays=[{...stay,checkin:'2026-03-30',checkout:'2026-04-03',guests:3,taxableGuests:2,childrenUnder12:1}];
assert.equal(A.quarterTax(taxes,2026,1).amount,12);assert.equal(A.quarterTax(taxes,2026,2).amount,12);
taxes.taxRules[0].maxNights=3;assert.equal(A.quarterTax(taxes,2026,2).amount,6);
taxes.stays[0].taxableGuests=null;assert.equal(A.quarterTax(taxes,2026,1).amount,null);
assert(A.quarterTax(recovered,2026,1).payment.paid);assert(A.quarterTax(recovered,2026,2).payment.paid);assert(!A.quarterTax(recovered,2026,3).payment.paid);
assert.equal(A.quarterTax(recovered,2026,2).amount,324);
console.log('PASS: owner corrections, tax archive excluded from ledger, quarterly split, exempt children, night cap across quarters, unknown ages, paid status.');
console.log('Quarter estimates:',[1,2,3,4].map(q=>({quarter:q,...A.quarterTax(recovered,2026,q),details:undefined})));
// Preservation checks use private CSV-derived input only when available locally.
const privateFile='.local-data/preview-state.json';
if(fs.existsSync(privateFile)) {
 const source=JSON.parse(fs.readFileSync(privateFile,'utf8'));
 const converted=A.migrate(source);
 assert.equal(source.transactions.length,95);
 const split=converted.transactions.filter(t=>t.id===source.transactions.find(t=>t.amount===553.27).id||t.noShow);
 close(split.reduce((n,t)=>n+t.amount,0),553.27);
 assert.equal(split.find(t=>t.noShow).amount,93.66);
 assert(!converted.stays.some(t=>t.checkin==='2026-08-16'));
 assert(!converted.transactions.some(t=>t.date==='2026-06-27'&&t.amount===100));
 assert(converted.transactions.some(t=>t.amount===436));
 for(const original of source.transactions) {
  const changed=A.isTax(original)||(original.date==='2026-06-27'&&original.amount===100)||original.amount===553.27||(original.category==='Booking'&&original.checkout==='2026-08-10')||(original.date==='2026-06-13'&&original.amount===50);
  if(changed)continue;
  const result=converted.transactions.find(t=>t.id===original.id);
  assert(result,original.id);assert.equal(result.amount,original.amount);assert.equal(result.date,original.date);assert.equal(result.notes,original.notes);
 }
 assert.equal(JSON.stringify(A.migrate(converted)),JSON.stringify(converted));
 context.saved=source;vm.runInContext('globalThis.preserved=migrateSaved(saved)',context);
 assert.equal(context.preserved.utilities.length,0);
 assert.equal(context.preserved.migrationSnapshot.transactions.length,95);
 console.log('PASS: all 95 exported movements audited; unrelated amounts/dates/notes preserved; split and deposit corrections idempotent; no seed injection.');
}
