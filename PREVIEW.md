# Anteprima locale

Avvia un server HTTP nella cartella del progetto, ad esempio:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Apri http://127.0.0.1:8080/?preview=1 sullo stesso computer.

La modalità anteprima è attiva solo su localhost/127.0.0.1 e con `preview=1`.
Usa i dati iniziali già inclusi nel progetto, una chiave di archiviazione
separata e nessuna connessione al database Supabase. Le prove vengono conservate
nel browser locale. Non rappresentano necessariamente la situazione aggiornata
dell'account online. Senza il parametro, rimane il normale flusso di accesso.

Il restyling è in `mobile-refresh.css`; struttura e funzionalità restano in
`index.html`. Non occorrono installazioni di pacchetti né una compilazione.

Su questo computer l’anteprima carica una copia privata dei 95 movimenti da `.local-data/preview-state.json`, esclusa da Git. Questo file non sostituisce i dati dell’account online.
