# Dati e criteri della gestione

## Origine e conservazione

La migrazione parte dai dati del browser/account e conserva i campi aggiuntivi.
I dati iniziali inclusi nella repo comprendono 62 movimenti, 14 letture e
13 soggiorni ricostruibili (due sono di dicembre 2025, incassati nel 2026).
`migrationSnapshot` conserva le registrazioni prima della riorganizzazione.
`beforeConfirmedCorrections` conserva i dati prima delle correzioni del proprietario.
La migrazione è versionata e non ripete le correzioni sui salvataggi successivi.

## Correzioni confermate dal proprietario

- Gli importi storici Booking e Airbnb sono già al netto delle commissioni.
- 19–23 maggio: 7 ospiti, Booking 395,47 €, extra separato 80 €: ricavo 475,47 €.
- 13 giugno: 50 € netti, permanenza diurna senza pernottamenti.
- Luce aprile–maggio 79,89 € e conguaglio acqua 12 €: pagati.
- Le 11 voci di tassa di soggiorno sono rimosse dal registro economico e
  conservate in `taxArchive`, senza alterare il backup originale.
- Promemoria tassa: 3 € per persona/notte, esclusi bambini sotto i 12 anni,
  massimo 7 notti per soggiorno. Primo e secondo trimestre 2026 pagati;
  terzo e quarto non pagati. Le regole sono impostazioni fornite dal proprietario.

Il numero di ospiti imponibili dei soggiorni storici è recuperato dalle vecchie
voci della tassa quando il collegamento è univoco. Se manca, l'importo del trimestre
è da completare. Un trimestre senza soggiorni mostra «Nessun dato», non una tassa
definitiva pari a zero. Lo stato pagato non genera movimenti monetari.

## Calcoli

- Presenze = ospiti × notti, calcolate dai soggiorni, non dai pagamenti.
- Check-out escluso dalle notti; per le bollette entrambi gli estremi inclusi.
- Ricavo concordato ripartito tra i mesi delle notti; acconti e saldi servono
  per cassa e residuo. Per gli storici senza totale concordato si usano gli
  importi registrati e il residuo resta da completare.
- I costi collegati seguono il soggiorno. I costi comuni seguono il loro periodo
  e sono attribuiti ai soggiorni in proporzione alle presenze mensili: è una stima.
- Le ripartizioni monetarie per giorni conservano i centesimi sull'intero periodo.
- Una bolletta nuova crea un solo movimento. L'eventuale lettura è collegata
  e non è sommata nuovamente ai costi.
- La cassa comprende solo pagamenti confermati entro oggi. Una data trascorsa
  non trasforma automaticamente un pagamento previsto in uno avvenuto.
- Risultato operativo = ricavi meno costi registrati/attribuiti; non include
  imposte o spese non inserite. Le medie senza presenze non sono calcolabili.

## Bollette recuperate e lacune

| Utenza | Registrazioni presenti (quote casa) | Verifiche ancora necessarie |
| --- | --- | --- |
| Luce | Dic/gen 165,07 €; feb/mar 107,08 €; apr/mag 79,89 €; giu/lug 134,45 € | Non risultano bollette per consumi successivi a luglio. Quota casa 25%. 82,53 € della prima bolletta restano attribuiti a dicembre 2025. |
| Gas | Gen/feb 107,96 €; mar/apr 144,62 € | Non risultano bollette per consumi successivi ad aprile. |
| Acqua | Gennaio 44 €; conguaglio 12 €; 28 maggio–31 agosto 63 € stimati | Il vecchio dettaglio gennaio riporta 21,31 €, diverso dal pagamento di 44 €. Il periodo dicembre–maggio del conguaglio non basta a ricostruire tutte le fatture di quel periodo. |

La repo non contiene le fatture originali: assenza di una voce non prova una
bolletta mancante o non pagata. Restano le quote già indicate, esplicitamente
provvisorie; la quota luce 25% non viene applicata una seconda volta.

## Verifica locale

`node accounting.test.cjs` verifica migrazione, copie originali, correzioni,
presenze senza duplicazioni, competenza mensile, estremi delle bollette,
trimestri, esenzione bambini e tetto notti tra trimestri.

L'anteprima `?preview=1` su localhost usa un archivio separato e nessun client
Supabase. Le modifiche non sono state pubblicate.

## Conservazione dei dati esistenti

La migrazione non reinserisce i dati iniziali in un archivio già esistente e non elimina o deduplica movimenti autonomamente. Conserva il backup originale. Le sole rettifiche monetarie concordate sono la separazione 553,27 € in 459,61 € e 93,66 € no-show, la rimozione dell’acconto duplicato 100 € e l’archiviazione delle tasse di soggiorno. Resta 436 € per il soggiorno di settembre. Il check-out errato del soggiorno 3 luglio viene corretto al 10 luglio. Gli importi netti registrati non subiscono una seconda commissione.

Il resoconto Booking contiene una trattenuta di 146,99 € da classificare: non viene inventata una spesa né modificato il relativo incasso registrato.
