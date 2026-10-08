(function () {
  'use strict';
  const A=window.CasaAccounting;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const eur=n=>n===null?'Da completare':new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n);
  const date=d=>new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'));
  const uid=()=>crypto.randomUUID();
  let app,month,editingStay=null,taxYear;
  const stat=(label,value,note='',kind='')=>`<article class="stat-card ${kind}"><span class="label">${label}</span><strong>${value}</strong>${note?`<small>${note}</small>`:''}</article>`;
  const field=(label,id,type='text',extra='')=>`<div class="form-field"><label for="${id}">${label}</label><input id="${id}" type="${type}" ${extra}></div>`;
  function mount(adapter) {
    app=adapter;month=app.today.slice(0,7);taxYear=Number(app.today.slice(0,4));
    // Retain the historical screens as read-only reference for their original calculations.
    const home=$('#view-home');
    const old=document.createElement('div');old.id='legacy-home';old.hidden=true;
    while(home.firstChild)old.append(home.firstChild);
    home.append(old);
    home.insertAdjacentHTML('beforeend',`<div class="page-heading"><div><p class="eyebrow">A CASA DI MARCO</p><h1>Come sta andando?</h1><p>Il mese della tua casa, dai soggiorni al risultato.</p></div><div class="month-picker"><label for="ledger-month">Mese da consultare</label><div><button class="button secondary" data-month-step="-1" aria-label="Mese precedente">‹</button><input type="month" id="ledger-month" value="${month}" required><button class="button secondary" data-month-step="1" aria-label="Mese successivo">›</button></div><button class="text-button" id="ledger-current">Questo mese</button></div></div><div id="ledger-overview"></div>`);
    $('#ledger-month').closest('.month-picker').insertAdjacentHTML('beforeend','<button class="text-button" id="ledger-latest">Ultimo mese con soggiorni</button>');
    const stays=document.createElement('section');stays.id='view-stays';stays.className='view';stays.hidden=true;
    stays.innerHTML=`<div class="page-heading"><div><p class="eyebrow">OSPITALITÀ</p><h1>I tuoi soggiorni</h1><p>Una prenotazione, tutti i suoi incassi e le sue spese.</p></div><button class="button" id="new-stay">+ Soggiorno</button></div><div class="filter-bar stay-filters"><input type="search" id="stay-search" aria-label="Cerca soggiorno" placeholder="Cerca nome o canale"><select id="stay-filter" aria-label="Stato soggiorni"><option value="all">Tutti i soggiorni</option><option value="review">Da verificare</option><option value="due">Da incassare</option></select></div><p id="stay-count" role="status"></p><div id="stay-list" class="stay-list"></div>`;
    document.querySelector('main').append(stays);
    document.querySelectorAll('nav [data-view]').forEach(button=>{
      if(button.dataset.view==='home')button.textContent='Riepilogo';
      if(button.dataset.view==='movements')button.textContent='Registro';
      if(button.dataset.view==='utilities'){button.dataset.view='stays';button.textContent='Soggiorni';button.dataset.icon='⌂';}
      if(button.dataset.view==='settings')button.textContent='Altro';
    });
    $('#view-movements h1').textContent='Incassi e spese';
    $('#view-movements .page-heading p').textContent='Pagamenti confermati e previsti, collegati ai soggiorni.';
    $('#view-movements .heading-actions').insertAdjacentHTML('beforeend','<button class="button secondary" data-new-bill>+ Bolletta</button>');
    $('#view-settings .settings-grid').insertAdjacentHTML('afterbegin',`<section class="panel"><h2>Dati da verificare</h2><p>Controlla le informazioni recuperate prima di considerare definitivi i risultati.</p><div id="data-warnings"></div><button class="button secondary" id="review-stays">Controlla soggiorni</button></section><section class="panel"><h2>Come vengono fatti i conti</h2><p>I soggiorni si dividono tra i mesi in base alle notti. Le spese collegate seguono il soggiorno. Le bollette seguono il periodo indicato, con primo e ultimo giorno inclusi.</p><p>I costi comuni del mese vengono attribuiti ai soggiorni in proporzione alle presenze. È una stima: include anche i costi sostenuti quando la casa è vuota. Senza presenze, il costo resta nel mese e la media non è calcolabile.</p><p>La tassa di soggiorno resta separata dai ricavi. I risultati non includono imposte o spese non registrate. Per i soggiorni diurni manca una misura separata: vengono segnalati nei dati da verificare.</p><button class="button secondary" id="open-utility-reference">Dettagli consumi storici</button></section>`);
    $('#view-settings .settings-grid').insertAdjacentHTML('beforeend',`<section class="panel"><h2>Copia prima della riorganizzazione</h2><p>Le registrazioni originali sono conservate nel backup. Puoi scaricarle per confrontare importi e note.</p><button class="button secondary" id="export-original">Scarica dati originali</button></section>`);
    const backupText=$('#export-json').closest('section').querySelector('p');
    $('#view-settings .settings-grid').insertAdjacentHTML('afterbegin','<section class="panel tax-panel"><h2>Tassa di soggiorno · promemoria trimestrale</h2><div id="tax-position"></div><p class="help">Questo prospetto non genera entrate o uscite. “Pagato” è un promemoria, non effettua un pagamento. Gli importi sono ricalcolati sui soggiorni presenti; non ricostruiscono i versamenti già effettuati.</p></section>');
    backupText.textContent='Scarica soggiorni, movimenti e consumi insieme. In anteprima i dati restano in questo browser; con accesso normale vengono sincronizzati con il tuo account.';
    $('#view-utilities .page-heading p').textContent='Dettagli storici delle letture. Per costi e margini usa il riepilogo mensile.';
    $('#view-utilities .utility-summary').hidden=true;
    $('#view-utilities .summary-kpis').hidden=true;
    $('#monthly-summary-table').closest('section').hidden=true;
    $('#view-utilities .notice').textContent='Archivio delle letture precedenti: le presenze manuali possono differire dai soggiorni ricostruiti. I costi qui riportati non vengono aggiunti una seconda volta alle spese. Le nuove bollette si registrano con un’unica operazione.';
    $('#transaction-form .form-grid').insertAdjacentHTML('afterbegin',`<div class="form-field full"><label for="transaction-stay">Collega a un soggiorno</label><select id="transaction-stay"></select></div><div class="form-field full"><label for="transaction-status">Pagamento</label><select id="transaction-status"><option value="posted">Avvenuto</option><option value="planned">Previsto / da confermare</option></select></div>`);
    $('#transaction-form .form-grid').insertAdjacentHTML('beforeend',`${field('Periodo spesa: dal (facoltativo)','transaction-period-start','date')}${field('Al, incluso','transaction-period-end','date')}<p class="form-field full help" id="transaction-allocation-note"></p>`);
    $('#stay-fields').classList.add('retired-fields');
    document.body.insertAdjacentHTML('beforeend',`<dialog id="stay-dialog" aria-labelledby="stay-title"><form id="stay-form"><div class="dialog-header"><h2 id="stay-title">Soggiorno</h2><button type="button" class="dialog-close" data-manager-close aria-label="Chiudi">×</button></div><div class="dialog-body"><div class="form-grid">${field('Nome o riferimento','stay-name','text','required maxlength="100"')}<div class="form-field"><label for="stay-channel">Canale</label><select id="stay-channel"><option>Prenotazione diretta</option><option>Booking</option><option>Airbnb</option></select></div>${field('Arrivo','stay-checkin','date','required')}${field('Partenza','stay-checkout','date','required')}${field('Ospiti totali, bambini inclusi','stay-guests','number','min="1" step="1" inputmode="numeric" required')}${field('Importo totale soggiorno (€)','stay-agreed','number','min="0" step="0.01" inputmode="decimal"')}<div class="form-field full"><label for="stay-basis">Come è espresso l’importo?</label><select id="stay-basis"><option value="gross">Lordo: registro le commissioni come spese</option><option value="net">Netto: commissioni già trattenute dal portale</option><option value="recorded">Da verificare sui documenti</option></select></div><p class="form-field full help">Escludi tassa di soggiorno ed extra. L’importo indica il ricavo complessivo, non il singolo acconto. Lasciandolo vuoto si usano gli incassi registrati e non si calcola il residuo. Usa la stessa base (lordo o netto) anche per i pagamenti collegati.</p><div class="form-field full"><label for="stay-notes">Note</label><textarea id="stay-notes" maxlength="600"></textarea></div><label class="check-field form-field full"><input id="stay-reviewed" type="checkbox"> Ho verificato ospiti, importo e commissioni</label></div><div class="dialog-actions"><button type="button" class="button secondary" data-manager-close>Annulla</button><button class="button" type="submit">Salva soggiorno</button></div></div></form></dialog>
    <dialog id="bill-dialog" aria-labelledby="bill-title"><form id="bill-form"><div class="dialog-header"><h2 id="bill-title">Nuova bolletta</h2><button type="button" class="dialog-close" data-manager-close aria-label="Chiudi">×</button></div><div class="dialog-body"><div class="form-grid"><div class="form-field"><label for="bill-type">Utenza</label><select id="bill-type"><option value="electricity">Luce</option><option value="water">Acqua</option><option value="gas">Gas</option></select></div>${field('Totale bolletta (€)','bill-amount','number','required min="0.01" step="0.01" inputmode="decimal"')}${field('Quota casa vacanze (%)','bill-share','number','required min="0" max="100" step="0.01" inputmode="decimal"')}${field('Data pagamento / prevista','bill-date','date','required')}${field('Periodo dal','bill-start','date','required')}${field('Al, incluso','bill-end','date','required')}<div class="form-field"><label for="bill-status">Pagamento</label><select id="bill-status"><option value="posted">Avvenuto</option><option value="planned">Previsto / da confermare</option></select></div>${field('Consumo totale (facoltativo)','bill-consumption','number','min="0" step="0.001" inputmode="decimal"')}<div class="form-field full"><label for="bill-notes">Riferimento / note</label><input id="bill-notes" maxlength="200" placeholder="Numero fattura o criterio di ripartizione"></div><p class="form-field full notice" id="bill-preview" role="status"></p></div><div class="dialog-actions"><button class="button secondary" type="button" data-manager-close>Annulla</button><button class="button" type="submit">Salva bolletta</button></div></div></form></dialog>`);
    $('#stay-guests').closest('.form-field').insertAdjacentHTML('afterend',field('Di cui bambini sotto i 12 anni','stay-children','number','min="0" step="1" required inputmode="numeric"'));
    $('#ledger-month').addEventListener('change',()=>{month=$('#ledger-month').value||app.today.slice(0,7);render();});
    document.querySelectorAll('[data-month-step]').forEach(b=>b.addEventListener('click',()=>{const d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()+Number(b.dataset.monthStep));month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');$('#ledger-month').value=month;render();}));
    $('#ledger-current').onclick=()=>{month=app.today.slice(0,7);$('#ledger-month').value=month;render();};
    $('#ledger-latest').onclick=()=>{
      const dates=app.getState().stays.filter(s=>s.checkin<=app.today).map(s=>s.checkout>app.today?app.today:new Date(Date.parse(s.checkout+'T00:00:00Z')-86400000).toISOString().slice(0,10)).sort();
      if(dates.length){month=dates.at(-1).slice(0,7);$('#ledger-month').value=month;render();}
    };
    $('#new-stay').onclick=()=>openStay();
    $('#stay-search').oninput=renderStays;$('#stay-filter').onchange=renderStays;
    $('#review-stays').onclick=()=>{$('#stay-filter').value='review';renderStays();app.view('stays');};
    $('#open-utility-reference').onclick=()=>app.view('utilities');
    $('#export-original').onclick=()=>{const s=app.getState();app.download('dati-prima-riorganizzazione.json',JSON.stringify(s.migrationSnapshot||{transactions:[],utilities:[],settings:{}},null,2),'application/json');};
    document.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-manager-close'))b.closest('dialog').close();
      if(b.hasAttribute('data-new-bill'))openBill();
      if(b.hasAttribute('data-new-stay'))openStay();
      if(b.dataset.editStay)openStay(app.getState().stays.find(s=>s.id===b.dataset.editStay));
      if(b.dataset.removeStay && confirm('Rimuovere questo soggiorno? Incassi e spese restano nel registro, ma vengono scollegati. Il conteggio delle presenze e i risultati mensili cambieranno.')) {
        const s=app.getState();s.stays=s.stays.filter(t=>t.id!==b.dataset.removeStay);
        s.transactions.forEach(t=>{if(t.stayId===b.dataset.removeStay)delete t.stayId;});
        app.save('Soggiorno rimosso; movimenti conservati');
      }
      if(b.dataset.stayPayment){app.openTransaction('income');$('#transaction-stay').value=b.dataset.stayPayment;$('#transaction-category-input').value=app.getState().stays.find(s=>s.id===b.dataset.stayPayment).channel;}
      if(b.dataset.stayExpense){app.openTransaction('expense');$('#transaction-stay').value=b.dataset.stayExpense;}
      if(b.dataset.stayLedger){app.view('movements');$('#movement-search').value='';$('#movement-type').value='all';$('#movement-category').value='all';$('#movement-month').value='';$('#movement-stay-filter').value=b.dataset.stayLedger;$('#movement-stay-filter').dispatchEvent(new Event('input'));}
      if(b.hasAttribute('data-open-checks'))app.view('settings');
      if(b.dataset.taxPaid) {
        const s=app.getState(),previous=s.taxPayments[b.dataset.taxPaid]||{};
        s.taxPayments[b.dataset.taxPaid]={...previous,paid:!previous.paid,paidDate:previous.paid?null:app.today,note:'Stato aggiornato manualmente'};
        app.save(previous.paid?'Trimestre segnato da pagare':'Trimestre segnato pagato');
      }
    });
    $('#stay-form').onsubmit=saveStay;
    $('#bill-form').onsubmit=saveBill;
    $('#bill-form').oninput=renderBillPreview;
    $('#bill-type').onchange=()=>{$('#bill-share').value=$('#bill-type').value==='electricity'?(app.getState().settings?.electricityShare??25):100;renderBillPreview();};
    $('#stay-checkin').onchange=()=>{$('#stay-checkout').min=A.nextDay($('#stay-checkin').value);};
    $('#transaction-stay').onchange=()=>{
      const stay=app.getState().stays.find(s=>s.id===$('#transaction-stay').value);
      if(stay)$('#transaction-allocation-note').textContent=`Soggiorno ${date(stay.checkin)} – ${date(stay.checkout)}. Base importi: ${stay.basis==='net'?'netto, non sottrarre di nuovo le commissioni':stay.basis==='gross'?'lordo, registra le commissioni tra le spese':'da verificare'}.`;
    };
  }
  function render() {
    if(!app)return;
    const s=app.getState(),r=A.monthly(s,month,app.today),warnings=A.warnings(s,app.today);
    const active=s.stays.filter(t=>A.overlap(t.checkin,t.checkout,...A.range(month))>0);
    const due=active.map(t=>A.staySummary(s,t,app.today)).filter(x=>x.due!==null).reduce((n,x)=>n+x.due,0);
    const unknown=active.filter(t=>t.agreed==null).length;
    renderTax();
    $('#ledger-overview').innerHTML=`<section class="balance-panel"><div><p class="balance-label">Risultato operativo · ${esc(new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00')))}</p><p class="balance-value ${r.profit<0?'negative':'positive'}">${eur(r.profit)}</p><p class="balance-note">${r.incomplete?'Provvisorio · alcuni dati dei soggiorni sono da completare':'In base ai ricavi e ai costi registrati'}<br>Imposte e spese non inserite escluse. Include voci previste.</p></div><div class="balance-actions"><button class="button income" data-new-stay>+ Soggiorno</button><button class="button expense" id="overview-expense">+ Spesa</button></div></section><div class="stats-grid">${stat('Ricavi del mese',eur(r.revenue),'Senza tassa di soggiorno','income')}${stat('Costi del mese',eur(r.costs),'Attribuiti al periodo','expense')}${stat('Presenze nel mese',r.guestNights,`${r.occupied} notti occupate · ${r.stays} soggiorni`)}</div><div class="dashboard-grid"><section class="panel"><div class="panel-header"><h2>Quanto costa ospitare?</h2></div><div class="guest-metrics"><div><span>Costo completo / ospite / notte</span><strong>${eur(r.costPerGuest)}</strong></div><div><span>Margine / ospite / notte</span><strong>${eur(r.profitPerGuest)}</strong></div></div><p class="help">${r.guestNights?'Costi del mese divisi per '+r.guestNights+' presenze. Una persona per tre notti = tre presenze.':'Nessuna presenza registrata: i costi restano nel mese, la media non è calcolabile.'} ${r.incomplete?'La media è provvisoria.':''}</p><div class="cost-breakdown"><p><span>Spese collegate ai soggiorni</span><strong>${eur(r.direct)}</strong></p><p><span>Costi comuni della casa</span><strong>${eur(r.common)}</strong></p><p><span>Di cui utenze</span><strong>${eur(r.utilities)}</strong></p><p><span>Di cui internet e assicurazione</span><strong>${eur(r.fixedCosts)}</strong></p></div></section><section class="panel"><h2>Incassi e pagamenti</h2><p class="help">Nel mese, per data del pagamento. Solo voci confermate; tassa di soggiorno esclusa.</p><div class="cost-breakdown"><p><span>Incassato</span><strong>${eur(r.cashIn)}</strong></p><p><span>Pagato</span><strong>${eur(r.cashOut)}</strong></p><p><span>Differenza di cassa</span><strong>${eur(r.cashIn-r.cashOut)}</strong></p><p><span>Da incassare sui soggiorni del mese</span><strong>${eur(due)}</strong></p></div><p class="help">${unknown?`${unknown} soggiorni esclusi dal residuo: manca l’importo totale.`:'Residuo complessivo delle prenotazioni che toccano il mese, aggiornato a oggi.'}</p></section></div><section class="panel monthly-costs"><div class="panel-header"><h2>Le spese di questo mese</h2><button class="text-button" data-new-bill>+ Bolletta</button></div>${renderCosts(s)}<p class="help">Le bollette seguono il periodo di consumo; il giorno del pagamento resta nel registro. Nessun costo dei dettagli consumi viene sommato due volte.</p></section>${warnings.length?`<div class="review-notice"><div><strong>Prima di considerare definitivi i conti</strong><p>Ci sono dati storici e ripartizioni da verificare.</p></div><button class="button secondary" data-open-checks>Controlla dati</button></div>`:''}`;
    $('#overview-expense').onclick=()=>app.openTransaction('expense');
    $('#ledger-overview .dashboard-grid > section:last-child .help').textContent='Nel mese, per data del pagamento. Solo voci confermate; tassa di soggiorno esclusa.';
    if(active.length && unknown===active.length) {
      const label=[...$('#ledger-overview').querySelectorAll('.cost-breakdown span')].find(e=>e.textContent==='Da incassare sui soggiorni del mese');
      if(label)label.nextElementSibling.textContent='Da completare';
    }
    $('#data-warnings').innerHTML=warnings.length?'<ul class="warning-list">'+warnings.map(w=>`<li>${esc(w)}</li>`).join('')+'</ul>':'<p>Nessuna segnalazione.</p>';
    renderStays();
    if($('#movement-stay-filter')) {
      const selected=$('#movement-stay-filter').value;
      $('#movement-stay-filter').innerHTML='<option value="all">Tutti i soggiorni / spese</option><option value="unlinked">Non collegati a soggiorni</option>'+s.stays.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · ${date(t.checkin)}</option>`).join('');
      $('#movement-stay-filter').value=selected||'all';
    }
  }
  function renderCosts(s) {
    const costs=s.transactions.filter(t=>t.type==='expense'&&!A.isTax(t)).map(t=>({t,value:A.expenseInMonth(s,t,month)})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
    return costs.length?`<div class="transaction-list">${costs.map(({t,value})=>`<div class="transaction-row"><span class="type-dot expense"></span><div class="transaction-copy"><strong>${esc(t.description)}</strong><span>${esc(t.category)}${t.status==='planned'?' · Pagamento da confermare':''}${t.allocationNote?' · Ripartizione stimata':''}</span></div><span class="transaction-amount expense">${eur(value)}</span></div>`).join('')}</div>`:'<p class="empty-state">Nessuna spesa registrata per questo mese.</p>';
  }
  function renderStays() {
    const s=app.getState(),query=$('#stay-search').value.toLowerCase(),filter=$('#stay-filter').value;
    const items=s.stays.map(t=>({t,r:A.staySummary(s,t,app.today)})).filter(({t,r})=>(t.name+' '+t.channel).toLowerCase().includes(query)&&(filter==='all'||filter==='review'&&(t.review||!t.guests||t.agreed==null)||filter==='due'&&r.due>0)).sort((a,b)=>b.t.checkin.localeCompare(a.t.checkin));
    $('#stay-count').textContent=items.length+' soggiorni';
    $('#stay-list').innerHTML=items.length?items.map(({t,r})=>`<article class="panel stay-card"><div class="panel-header"><div><span class="tag">${esc(t.channel)}</span><h2>${esc(t.name)}</h2></div><button class="edit-button" data-edit-stay="${esc(t.id)}">Modifica</button></div><p>${date(t.checkin)} – ${date(t.checkout)}<br><strong>${t.guests||'Ospiti da completare'}${t.guests?' ospiti':''} · ${r.nights} notti · ${r.guestNights} presenze</strong></p>${t.review||t.agreed==null?'<p class="review-chip">Da verificare · risultato provvisorio</p>':''}<div class="stay-numbers"><div><span>Ricavo soggiorno</span><strong>${eur(r.revenue)}</strong></div><div><span>Spese dirette</span><strong>${eur(r.direct)}</strong></div><div><span>Quota costi comuni</span><strong>${t.guests?eur(r.allocated):'Da completare'}</strong></div><div><span>Margine stimato</span><strong>${t.guests?eur(r.profit):'Da completare'}</strong></div><div><span>Incassato (senza tassa)</span><strong>${eur(r.received)}</strong></div><div><span>Ancora da incassare</span><strong>${eur(r.due)}</strong></div></div><p class="help">${t.basis==='net'?'Ricavi al netto delle commissioni: non sottrarle una seconda volta.':t.basis==='gross'?'Ricavi lordi: le commissioni vanno registrate tra le spese.':'Base ricavi da verificare: non sono state inventate commissioni.'} Quota dei costi comuni proporzionale alle presenze di ciascun mese.</p>${t.notes?`<details><summary>Note e provenienza</summary><p>${esc(t.notes)}</p></details>`:''}<div class="settings-actions"><button class="button" data-stay-payment="${esc(t.id)}">+ Incasso</button><button class="button secondary" data-stay-expense="${esc(t.id)}">+ Spesa</button><button class="text-button" data-stay-ledger="${esc(t.id)}">Movimenti</button></div></article>`).join(''):'<div class="empty-state"><strong>Nessun soggiorno trovato</strong>Aggiungi un soggiorno o modifica i filtri.</div>';
  }
  function openStay(stay) {
    editingStay=stay?.id||null;$('#stay-form').reset();$('#stay-title').textContent=stay?'Modifica soggiorno':'Nuovo soggiorno';
    for(const [id,key] of [['stay-name','name'],['stay-channel','channel'],['stay-checkin','checkin'],['stay-checkout','checkout'],['stay-guests','guests'],['stay-agreed','agreed'],['stay-basis','basis'],['stay-notes','notes']]) if(stay)$('#'+id).value=stay[key]??'';
    $('#stay-reviewed').checked=stay?!stay.review:false;
    $('#stay-children').value=stay?(stay.childrenUnder12??''):0;
    $('#stay-checkout').min=stay?.checkin?A.nextDay(stay.checkin):'';
    $('#stay-dialog').showModal();
  }
  function saveStay(e) {
    e.preventDefault();const checkin=$('#stay-checkin').value,checkout=$('#stay-checkout').value;
    if(!A.days(checkin,checkout)){alert('La partenza deve essere successiva all’arrivo.');return;}
    const s=app.getState();
    const children=Number($('#stay-children').value),guests=Number($('#stay-guests').value);
    if(children>guests){alert('I bambini sotto i 12 anni non possono superare il numero totale degli ospiti.');return;}
    const overlap=s.stays.some(t=>t.id!==editingStay&&A.overlap(checkin,checkout,t.checkin,t.checkout)>0);
    if(overlap&&!confirm('Le date si sovrappongono a un altro soggiorno. Verifica che non sia un duplicato. Vuoi salvare comunque?'))return;
    const name=$('#stay-name').value.trim();if(!name)return;
    if($('#stay-basis').value==='net' && s.transactions.some(t=>t.stayId===editingStay&&t.type==='expense'&&t.category==='Commissioni')) {
      alert('Sono presenti commissioni separate per questo soggiorno. Mantieni gli importi lordi oppure correggi prima quei movimenti per evitare di sottrarle due volte.');return;
    }
    const agreed=$('#stay-agreed').value===''?null:Number($('#stay-agreed').value);
    const stay={...s.stays.find(t=>t.id===editingStay),id:editingStay||uid(),name,channel:$('#stay-channel').value,checkin,checkout,guests:Number($('#stay-guests').value),agreed,basis:$('#stay-basis').value,notes:$('#stay-notes').value.trim(),review:!$('#stay-reviewed').checked||agreed===null||$('#stay-basis').value==='recorded'};
    stay.childrenUnder12=children;stay.taxableGuests=guests-children;
    if(editingStay)s.stays=s.stays.map(t=>t.id===editingStay?stay:t);else s.stays.push(stay);
    $('#stay-dialog').close();app.save('Soggiorno salvato');
  }
  function openBill() {
    $('#bill-form').reset();$('#bill-date').value=app.today;$('#bill-start').value=app.today.slice(0,8)+'01';$('#bill-end').value=app.today;$('#bill-share').value=app.getState().settings?.electricityShare??25;renderBillPreview();$('#bill-dialog').showModal();
  }
  function renderTax() {
    const s=app.getState(),latest=[...s.taxRules].sort((a,b)=>b.from.localeCompare(a.from))[0];
    $('#tax-position').innerHTML=`<div class="field-inline tax-year"><label for="tax-year">Anno</label><input type="number" id="tax-year" min="2020" max="2100" step="1" value="${taxYear}"></div><p class="help">Tariffa impostata: ${latest?eur(latest.rate):'da configurare'} a persona per notte. Bambini sotto i 12 anni esclusi. ${latest?.maxNights?'Limite: '+latest.maxNights+' notti per soggiorno.':'Nessun limite di notti impostato.'}</p><div class="tax-quarters">${[1,2,3,4].map(q=>{
      const r=A.quarterTax(s,taxYear,q),id=taxYear+'-Q'+q;
      return `<article class="quarter-card"><div class="panel-header"><h3>${q}° trimestre</h3><span class="tag ${r.payment.paid?'income':'expense'}">${r.payment.paid?'Pagato':'Da pagare'}</span></div><strong class="quarter-amount">${eur(r.amount)}</strong><p class="help">${r.taxableNights} presenze imponibili${r.missingGuests?' · '+r.missingGuests+' soggiorni senza età completate':''}${r.missingRates?' · tariffa mancante':''}</p><button class="button secondary" data-tax-paid="${id}">${r.payment.paid?'Segna non pagato':'Segna pagato'}</button><details><summary>Dettaglio soggiorni</summary>${r.details.length?r.details.map(d=>`<p>${esc(d.name)}: <strong>${eur(d.amount)}</strong><br><button class="text-button" data-edit-stay="${esc(d.id)}">Controlla ospiti</button></p>`).join(''):'<p>Nessun soggiorno registrato in questo trimestre.</p>'}</details></article>`;
    }).join('')}</div><details><summary>Modifica la tariffa del promemoria</summary><form id="tax-rule-form" class="form-grid">${field('Dal giorno','tax-rule-from','date','required value="'+(latest?.from||app.today)+'"')}${field('Euro per persona / notte','tax-rule-rate','number','required min="0" step="0.01" inputmode="decimal" value="'+(latest?.rate??3)+'"')}${field('Massimo notti (0 = nessun limite)','tax-rule-cap','number','required min="0" step="1" value="'+(latest?.maxNights||0)+'"')}<button class="button" type="submit">Salva tariffa</button></form><p class="help">Usa la tariffa e le regole applicabili alla tua struttura. Cambiando la decorrenza aggiungi una nuova tariffa; le date precedenti conservano la loro.</p></details>`;
    $('#tax-year').onchange=()=>{if($('#tax-year').reportValidity()){taxYear=Number($('#tax-year').value);renderTax();}};
    $('#tax-rule-form').onsubmit=e=>{
      e.preventDefault();const rule={from:$('#tax-rule-from').value,rate:Number($('#tax-rule-rate').value),maxNights:Number($('#tax-rule-cap').value),source:'Impostazione del proprietario'};
      s.taxRules=s.taxRules.filter(r=>r.from!==rule.from);s.taxRules.push(rule);app.save('Tariffa aggiornata');
    };
    $('#tax-position').querySelectorAll('.quarter-card').forEach((card,index)=>{
      if(!A.quarterTax(s,taxYear,index+1).details.length) card.querySelector('.quarter-amount').textContent='Nessun dato';
    });
  }
  function renderBillPreview() {
    $('#bill-preview').textContent='Quota attribuita alla casa: '+eur(Number($('#bill-amount').value)*Number($('#bill-share').value)/100)+'. Una sola spesa, ripartita sui giorni del periodo.';
  }
  function saveBill(e) {
    e.preventDefault();const start=$('#bill-start').value,end=$('#bill-end').value;
    if(end<start){alert('La fine del periodo non può precedere l’inizio.');return;}
    const s=app.getState(),type=$('#bill-type').value,total=Number($('#bill-amount').value),share=Number($('#bill-share').value),amount=Math.round(total*share)/100;
    if(s.transactions.some(t=>t.billType===type&&t.periodStart===start&&t.periodEnd===end&&t.amount===amount)&&!confirm('Esiste già una bolletta uguale per questo periodo. Vuoi aggiungerla comunque?'))return;
    const id=uid(),description=({water:'Acqua',gas:'Gas',electricity:'Luce'})[type]+' · '+date(start)+' – '+date(end);
    s.transactions.push({id,type:'expense',category:'Utenze',method:'Da confermare',amount,date:$('#bill-date').value,status:$('#bill-status').value,description,periodStart:start,periodEnd:end,billType:type,billTotal:total,billShare:share,notes:$('#bill-notes').value,createdAt:Date.now()});
    if($('#bill-consumption').value!=='')s.utilities.push({id:uid(),transactionId:id,type,date:end,periodStart:start,periodEnd:A.nextDay(end),consumption:Number($('#bill-consumption').value)*share/100,cost:amount,days:1,people:null,notes:description,createdAt:Date.now()});
    $('#bill-dialog').close();app.save('Bolletta e spesa salvate insieme');
  }
  window.CasaUI={mount,render,openBill};
})();
