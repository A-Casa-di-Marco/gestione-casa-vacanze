/* Pure bookkeeping calculations. Dates are civil dates; stay checkout is exclusive. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const days = (a, b) => Math.max(0, Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY)) || 0;
  const nextDay = d => new Date(Date.parse(d + 'T00:00:00Z') + DAY).toISOString().slice(0, 10);
  const range = month => { const d = new Date(month + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return [month + '-01', d.toISOString().slice(0, 10)]; };
  const overlap = (a, b, c, d) => days(a > c ? a : c, b < d ? b : d);
  const isTax = t => t.category === 'Tassa di soggiorno';
  const posted = (t, today) => t.status !== 'planned' && t.date <= today;
  const bookingCategories = ['Booking', 'Airbnb', 'Prenotazione diretta'];
  const fixed = ['Internet', 'Assicurazione'];
  // Explicit historical allocations recovered from the repository. Cash amounts remain unchanged.
  const schedules = {
    'bill-electricity-2026-01-share25': [['2025-12',82.53],['2026-01',82.54]],
    'bill-water-2026-01-vacation': [['2026-01',44]],
    'bill-gas-2026-01-02-vacation': [['2026-01',53.98],['2026-02',53.98]],
    'bill-electricity-2026-02-03-share25': [['2026-02',53.54],['2026-03',53.54]],
    'bill-gas-2026-03-04-vacation': [['2026-03',72.31],['2026-04',72.31]],
    'bill-electricity-2026-04-05-share25': [['2026-04',39.94],['2026-05',39.95]],
    'bill-water-2026-06-08-vacation': [['2026-05',12]],
    'bill-electricity-2026-06-07-share25': [['2026-06',50.08],['2026-07',84.37]]
  };
  function migrate(input) {
    const s = structuredClone(input);
    correctLedger(s);
    if (s.ledgerVersion >= 1) { s.stays ||= []; return applyConfirmedCorrections(s); }
    s.stays ||= [];
    s.migrationSnapshot ||= { transactions: structuredClone(s.transactions), utilities: structuredClone(s.utilities), settings: structuredClone(s.settings) };
    for (const t of s.transactions) {
      if (t.type === 'income' && bookingCategories.includes(t.category) && t.checkin && days(t.checkin,t.checkout)) {
        const id = 'stay-' + t.id;
        s.stays.push({ id, name:t.description, channel:t.category, checkin:t.checkin, checkout:t.checkout, guests:t.guests || null, agreed:null, basis:'recorded', review:true, notes:'Ricostruito dal movimento originale. Verifica ospiti, importo complessivo e commissioni.' });
        t.stayId = id;
      }
      const historicalBills={
        '2026-02-24|165.07':'bill-electricity-2026-01-share25',
        '2026-03-06|44':'bill-water-2026-01-vacation',
        '2026-03-30|107.96':'bill-gas-2026-01-02-vacation',
        '2026-04-24|107.08':'bill-electricity-2026-02-03-share25',
        '2026-05-29|144.62':'bill-gas-2026-03-04-vacation',
        '2026-06-26|79.89':'bill-electricity-2026-04-05-share25',
        '2026-07-07|12':'bill-water-2026-06-08-vacation',
        '2026-08-11|134.45':'bill-electricity-2026-06-07-share25'
      };
      const scheduleId=schedules[t.id]?t.id:(t.type==='expense'&&t.category==='Utenze'?historicalBills[t.date+'|'+Number(t.amount)]:null);
      if (scheduleId && !t.allocations?.length && !t.periodStart) {
        const total = schedules[scheduleId].reduce((n,p)=>n+p[1],0);
        t.allocations = schedules[scheduleId].map(([month,amount])=>({month,amount:round(Number(t.amount)*amount/total)}));
        t.allocations[t.allocations.length-1].amount = round(Number(t.amount)-t.allocations.slice(0,-1).reduce((n,p)=>n+p.amount,0));
        t.allocationNote = 'Ripartizione recuperata dalla repo; da verificare sulla bolletta.';
      }
      if (t.id === 'bill-water-2026-05-08-stima-vacation' || t.type==='expense'&&t.category==='Utenze'&&t.date==='2026-09-03'&&Number(t.amount)===63&&!t.periodStart) { t.periodStart='2026-05-28'; t.periodEnd='2026-08-31'; t.allocationNote='Bolletta stimata; ripartizione per giorni, estremi inclusi.'; }
    }
    for (const t of s.transactions) {
      if (t.stayId) continue;
      const matches = s.stays.filter(b=>b.checkin===t.checkin && b.checkout===t.checkout);
      if (matches.length===1 && (isTax(t) || t.category==='Extra')) t.stayId=matches[0].id;
      if (t.id==='manual-breakfast-20260526-31') {
        const b=s.stays.find(b=>b.checkin==='2026-05-26' && b.checkout==='2026-05-31');
        if(b) t.stayId=b.id;
      }
    }
    s.ledgerVersion=1;
    return applyConfirmedCorrections(s);
  }
  function correctLedger(s) {
    if(s.confirmedCorrectionsVersion>=4)return;
    s.migrationSnapshot ||= structuredClone(s);
    s.correctionArchive ||= [];
    const archive=t=>{if(!s.correctionArchive.some(x=>x.id===t.id))s.correctionArchive.push(structuredClone(t));};
    s.transactions=s.transactions.filter(t=>{
      const deposit=t.type==='income'&&t.category==='Prenotazione diretta'&&Number(t.amount)===100&&t.date==='2026-06-27';
      const ignoredTax=isTax(t)&&Number(t.amount)===24&&t.date==='2026-07-27';
      if(deposit||ignoredTax){archive(t);return false;}return true;
    });
    for(const t of [...s.transactions]) {
      if(t.category==='Booking'&&t.checkin==='2026-07-03'&&t.checkout==='2026-08-10') {
        archive(t);t.checkout='2026-07-10';
        const stay=s.stays?.find(x=>x.id===t.stayId);if(stay)stay.checkout=t.checkout;
      }
      if(t.category==='Booking'&&Number(t.amount)===553.27&&t.checkin==='2026-08-11'&&t.checkout==='2026-08-16') {
        archive(t);t.amount=459.61;
        const id=t.id+'-noshow';
        if(!s.transactions.some(x=>x.id===id))s.transactions.push({...t,id,amount:93.66,category:'No-show',description:'Booking · no-show 16–17 agosto 2026',checkin:'2026-08-16',checkout:'2026-08-17',guests:null,stayId:null,noShow:true});
        const stay=s.stays?.find(x=>x.id===t.stayId);if(stay&&Number(stay.agreed)===553.27)stay.agreed=459.61;
      }
      if(t.id==='report-booking-20260528-01'&&Number(t.amount)===395.47) {
        const original=s.migrationSnapshot?.transactions?.find(x=>x.id===t.id);
        if(original&&Number(original.amount)===286.5){archive(t);t.amount=286.5;}
      }
    }
  }
  function applyConfirmedCorrections(s) {
    s.taxArchive ||= [];
    const taxes=s.transactions.filter(isTax);
    for(const t of taxes) if(!s.taxArchive.some(x=>x.id===t.id))s.taxArchive.push(structuredClone(t));
    s.transactions=s.transactions.filter(t=>!isTax(t));
    s.taxPayments ||= {};
    s.taxRules ||= [];
    if(s.confirmedCorrectionsVersion>=4)return s;
    s.beforeConfirmedCorrections ||= {transactions:structuredClone(s.transactions),stays:structuredClone(s.stays)};
    for(const stay of s.stays) {
      if(['Booking','Airbnb'].includes(stay.channel))stay.basis='net';
      const oldTaxes=s.taxArchive.filter(t=>t.stayId===stay.id || t.checkin===stay.checkin&&t.checkout===stay.checkout);
      if(stay.taxableGuests==null && oldTaxes.length===1 && Number(oldTaxes[0].guests)>0 && Number(oldTaxes[0].guests)<=Number(stay.guests)) {
        stay.taxableGuests=Number(oldTaxes[0].guests);
        if(stay.guests>=stay.taxableGuests)stay.childrenUnder12=stay.guests-stay.taxableGuests;
      }
      if(stay.channel==='Booking'&&stay.checkin==='2026-05-19'&&stay.checkout==='2026-05-23') {
        stay.guests=7;stay.agreed=null;stay.basis='net';stay.review=false;
        stay.notes='Confermato dal proprietario: 7 ospiti complessivi; Booking 395,47 € netti; 80 € extra separati per la persona aggiuntiva già inclusa nei 7.';
      }
    }
    const booking=s.transactions.find(t=>t.id==='report-booking-20260528-01');
    if(booking)booking.notes='Resoconto: 395,47 € prima della trattenuta aggiuntiva 108,97 €; incasso originale conservato.';
    s.taxPayments['2026-Q1'] ||= {paid:true,paidDate:null,note:'Pagamento confermato dal proprietario'};
    s.taxPayments['2026-Q2'] ||= {paid:true,paidDate:null,note:'Pagamento confermato dal proprietario'};
    s.taxPayments['2026-Q3'] ||= {paid:false};s.taxPayments['2026-Q4'] ||= {paid:false};
    for(const id of ['bill-electricity-2026-04-05-share25','bill-water-2026-06-08-vacation']) {
      const t=s.transactions.find(t=>t.id===id || t.type==='expense'&&(id.includes('electricity')?t.date==='2026-06-26'&&Number(t.amount)===79.89:t.date==='2026-07-07'&&Number(t.amount)===12));if(t)t.status='posted';
    }
    const daytime=s.transactions.find(t=>t.id==='manual-direct-20260613');
    if(daytime){daytime.notes='Confermato dal proprietario: 50 € netti alla casa, tassa di soggiorno esclusa. Permanenza diurna senza pernottamenti.';daytime.dayUse=true;}
    if(!s.taxRules.length)s.taxRules=[{from:'2026-01-01',rate:3,maxNights:7,source:'Tariffa indicata dal proprietario: esclusi bambini sotto i 12 anni, massimo 7 notti per soggiorno.'}];
    const confirmedRule=s.taxRules.find(r=>r.from==='2026-01-01');if(confirmedRule){confirmedRule.rate=3;confirmedRule.maxNights=7;}
    s.confirmedCorrectionsVersion=4;
    return s;
  }
  function quarterTax(s,year,quarter) {
    const start=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`;
    const end=quarter===4?`${Number(year)+1}-01-01`:`${year}-${String(quarter*3+1).padStart(2,'0')}-01`;
    let total=0,taxableNights=0,missingGuests=0,missingRates=false;
    const details=[];
    for(const stay of s.stays.filter(x=>overlap(x.checkin,x.checkout,start,end)>0)) {
      if(stay.taxableGuests==null){missingGuests++;details.push({id:stay.id,name:stay.name,amount:null,nights:null});continue;}
      let amount=0,nights=0,complete=true;
      for(let day=stay.checkin;day<stay.checkout;day=nextDay(day)) {
        if(day<start||day>=end)continue;
        const rule=[...(s.taxRules||[])].filter(r=>r.from<=day).sort((a,b)=>b.from.localeCompare(a.from))[0];
        if(!rule){if(Number(stay.taxableGuests)>0){missingRates=true;complete=false;}continue;}
        if(rule.maxNights>0 && days(stay.checkin,day)>=rule.maxNights)continue;
        nights+=Number(stay.taxableGuests);amount+=Number(stay.taxableGuests)*Number(rule.rate);
      }
      total+=amount;taxableNights+=nights;details.push({id:stay.id,name:stay.name,amount:complete?round(amount):null,nights});
    }
    return {amount:missingRates||missingGuests||!s.taxRules?.length?null:round(total),knownAmount:round(total),taxableNights,missingGuests,missingRates,details,payment:s.taxPayments?.[`${year}-Q${quarter}`]||{paid:false}};
  }
  function presences(s, month) {
    const [a,b]=range(month);
    return s.stays.reduce((n,t)=>n+overlap(t.checkin,t.checkout,a,b)*(Number(t.guests)||0),0);
  }
  function portion(s,t,month) {
    const [a,b]=range(month);
    const stay=s.stays.find(x=>x.id===t.stayId);
    if(stay) return days(stay.checkin,stay.checkout) ? overlap(stay.checkin,stay.checkout,a,b)/days(stay.checkin,stay.checkout) : 0;
    if(t.periodStart && t.periodEnd) return overlap(t.periodStart,nextDay(t.periodEnd),a,b)/days(t.periodStart,nextDay(t.periodEnd));
    return t.date?.startsWith(month) ? 1:0;
  }
  function expenseInMonth(s,t,month) {
    if(t.allocations?.length) return t.allocations.filter(p=>p.month===month).reduce((n,p)=>n+Number(p.amount),0);
    const stay=s.stays.find(x=>x.id===t.stayId);
    if(stay) return allocateMoney(Number(t.amount),stay.checkin,stay.checkout,month);
    if(t.periodStart&&t.periodEnd) return allocateMoney(Number(t.amount),t.periodStart,nextDay(t.periodEnd),month);
    return t.date?.startsWith(month)?Number(t.amount):0;
  }
  function allocateMoney(amount,start,end,month) {
    const [a,b]=range(month),count=days(start,end);
    if(!count||!overlap(start,end,a,b))return 0;
    const first=start>a?start:a,last=end<b?end:b;
    // Difference of rounded cumulative amounts preserves every cent across months.
    return round(round(amount*days(start,last)/count)-round(amount*days(start,first)/count));
  }
  function monthly(s,month,today) {
    const [a,b]=range(month);
    const active=s.stays.filter(t=>overlap(t.checkin,t.checkout,a,b)>0);
    let revenue=0, costs=0, direct=0, common=0, fixedCosts=0, utilities=0;
    // Explicit agreed revenue is separate from cash receipts. Historical records use recorded income.
    for(const stay of active) if(stay.agreed !== null && stay.agreed !== '' && stay.agreed !== undefined) revenue+=allocateMoney(Number(stay.agreed),stay.checkin,stay.checkout,month);
    for(const t of s.transactions) {
      if(isTax(t)) continue;
      if(t.type==='income') {
        const stay=s.stays.find(x=>x.id===t.stayId);
        const isBookingPayment=stay && bookingCategories.includes(t.category);
        if(isBookingPayment && stay.agreed!=null && stay.agreed!=='') continue;
        revenue+=expenseInMonth(s,t,month);
      } else {
        const value=expenseInMonth(s,t,month); costs+=value;
        if(t.stayId) direct+=value; else common+=value;
        if(fixed.includes(t.category)) fixedCosts+=value;
        if(t.category==='Utenze') utilities+=value;
      }
    }
    revenue=round(revenue);costs=round(costs);
    const guestNights=presences(s,month);
    const cash=s.transactions.filter(t=>!isTax(t)&&t.date.startsWith(month)&&posted(t,today));
    const cashIn=cash.filter(t=>t.type==='income').reduce((n,t)=>n+Number(t.amount),0);
    const cashOut=cash.filter(t=>t.type==='expense').reduce((n,t)=>n+Number(t.amount),0);
    const occupied=new Set();
    for(const stay of active) for(let d=stay.checkin>a?stay.checkin:a;d<stay.checkout&&d<b;d=nextDay(d)) occupied.add(d);
    const incomplete=active.some(t=>!t.guests || t.review || t.agreed==null) || s.transactions.some(t=>!isTax(t)&&!t.dayUse&&!t.stayId&&t.type==='income'&&t.date.startsWith(month));
    return { month,revenue:round(revenue),costs:round(costs),profit:round(revenue-costs),direct:round(direct),common:round(common),fixedCosts:round(fixedCosts),utilities:round(utilities),guestNights,occupied:occupied.size,stays:active.length,costPerGuest:guestNights?costs/guestNights:null,profitPerGuest:guestNights?(revenue-costs)/guestNights:null,cashIn:round(cashIn),cashOut:round(cashOut),incomplete };
  }
  function monthsForStay(stay) {
    const out=[];
    for(let m=stay.checkin.slice(0,7);m<=stay.checkout.slice(0,7);m=range(m)[1].slice(0,7)) if(overlap(stay.checkin,stay.checkout,...range(m))) out.push(m);
    return out;
  }
  function staySummary(s,stay,today) {
    const linked=s.transactions.filter(t=>t.stayId===stay.id&&!isTax(t));
    const receipts=linked.filter(t=>t.type==='income'&&posted(t,today));
    const bookingReceived=receipts.filter(t=>bookingCategories.includes(t.category)).reduce((n,t)=>n+Number(t.amount),0);
    const agreed=stay.agreed==null||stay.agreed===''?null:Number(stay.agreed);
    const revenue=(agreed??linked.filter(t=>t.type==='income'&&bookingCategories.includes(t.category)).reduce((n,t)=>n+Number(t.amount),0))+linked.filter(t=>t.type==='income'&&!bookingCategories.includes(t.category)).reduce((n,t)=>n+Number(t.amount),0);
    const direct=linked.filter(t=>t.type==='expense').reduce((n,t)=>n+Number(t.amount),0);
    let allocated=0;
    for(const m of monthsForStay(stay)) {
      const summary=monthly(s,m,today);
      if(summary.guestNights) allocated+=summary.common*overlap(stay.checkin,stay.checkout,...range(m))*(Number(stay.guests)||0)/summary.guestNights;
    }
    return {revenue:round(revenue),received:round(receipts.reduce((n,t)=>n+Number(t.amount),0)),due:agreed===null?null:Math.max(0,round(agreed-bookingReceived)),direct:round(direct),allocated:round(allocated),profit:round(revenue-direct-allocated),nights:days(stay.checkin,stay.checkout),guestNights:days(stay.checkin,stay.checkout)*(Number(stay.guests)||0)};
  }
  function warnings(s,today) {
    const list=[];
    const review=s.stays.filter(t=>t.review||!t.guests||t.agreed==null);
    if(review.length) list.push(`${review.length} soggiorni da completare: verifica ospiti e importo complessivo. Gli importi storici Booking e Airbnb sono già netti, come confermato; le commissioni non vengono sottratte di nuovo.`);
    if(s.transactions.some(t=>t.id==='manual-direct-20260613'&&!t.dayUse)) list.push('13 giugno: permanenza diurna da chiarire, esclusa dal conteggio dei pernottamenti.');
    if(s.transactions.some(t=>t.allocationNote)) list.push('Le ripartizioni delle bollette sono stime recuperate dalla repo. Acqua gennaio: usati i 44 € del movimento; il vecchio dettaglio consumi riporta 21,31 €. Conguaglio da 12 € attribuito a maggio, da verificare.');
    const overdue=s.transactions.filter(t=>t.status==='planned'&&t.date<=today);
    if(overdue.length) list.push(`${overdue.length} pagamenti previsti con data passata: inclusi nei costi/ricavi previsti, esclusi dagli incassi e pagamenti confermati. Confermali dal registro quando avvenuti.`);
    return list;
  }
    const api={migrate,days,range,nextDay,overlap,monthly,presences,staySummary,warnings,posted,isTax,expenseInMonth,quarterTax};
  if(typeof module!=='undefined') module.exports=api;
  root.CasaAccounting=api;
})(typeof window!=='undefined'?window:globalThis);
