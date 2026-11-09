/* A.S.D. MONTANINO — V3.0 · DATI DI BASE E BACKUP
   Contiene i dati di BASE della V2.2. Con la V3.0 usa admin.html per aggiornarli.
   Calendario e risultati iniziali: UISP Arezzo, Categoria 2 Girone C, consultazione 30/10/2026.
   Link fonte: https://gestionalecalcionuovo.uisp.it/AREZZO/25/57
   Per partite non ancora programmate: data:null, ora:null, campo:null.
   Per partite non giocate: golCasa:null, golOspite:null.
   I link Facebook/TikTok NON sono inventati: incolla qui gli URL ufficiali quando li conosci.
   Per statistiche e staff trovi esempi nei commenti in LEGGIMI.txt.
*/
let SITE_DATA = {
  social: {
  "instagram": "https://www.instagram.com/asd_montanino/",
  "facebook": "",
  "tiktok": ""
},
  prossimaPartita: {
  "casa": "Levanella ’86",
  "ospite": "Montanino",
  "data": "LUN 02 NOV 2026 · 21:15",
  "dataISO": "2026-11-02T21:15:00+01:00",
  "competizione": "4ª GIORNATA · CAMPIONATO",
  "campo": "STADIO DI LEVANE · BUCINE",
  "indirizzoMaps": "Stadio di Levane, Bucine"
},
  ultimoRisultato: {
  "idPartita": "A03",
  "casa": "Montanino",
  "ospite": "San Cipriano",
  "golCasa": 2,
  "golOspite": 5,
  "data": "23 OTT 2026",
  "competizione": "3ª GIORNATA · CAMPIONATO",
  "nota": "RISULTATO UFFICIALE UISP"
},
  classifica: [
  {
    "squadra": "Ginestra",
    "giocate": 3,
    "punti": 6
  },
  {
    "squadra": "San Cipriano",
    "giocate": 3,
    "punti": 5
  },
  {
    "squadra": "Gaiole",
    "giocate": 3,
    "punti": 4
  },
  {
    "squadra": "Ponte agli Stolli",
    "giocate": 3,
    "punti": 4
  },
  {
    "squadra": "Vacchereccia",
    "giocate": 3,
    "punti": 4
  },
  {
    "squadra": "Levane Leona",
    "giocate": 3,
    "punti": 4
  },
  {
    "squadra": "Pietrapiana Giglio Verde",
    "giocate": 3,
    "punti": 3
  },
  {
    "squadra": "AS Giglio",
    "giocate": 3,
    "punti": 3
  },
  {
    "squadra": "Levanella ’86",
    "giocate": 3,
    "punti": 3
  },
  {
    "squadra": "Baco Donnini",
    "giocate": 3,
    "punti": 2
  },
  {
    "squadra": "Pol. Il Ponte",
    "giocate": 3,
    "punti": 2
  },
  {
    "squadra": "Malva",
    "giocate": 3,
    "punti": 1
  },
  {
    "squadra": "Montanino",
    "giocate": 3,
    "punti": 1
  },
  {
    "squadra": "Sereto GS",
    "giocate": 3,
    "punti": 0
  }
],
  calendario: [
  {
    "id": "A01",
    "fase": "Andata",
    "giornata": 1,
    "casa": "Montanino",
    "ospite": "Gaiole",
    "data": "2026-10-09",
    "ora": "21:15",
    "campo": "Campo Sportivo Sussidiario di Reggello, Reggello",
    "golCasa": 2,
    "golOspite": 2
  },
  {
    "id": "A02",
    "fase": "Andata",
    "giornata": 2,
    "casa": "Vacchereccia",
    "ospite": "Montanino",
    "data": "2026-10-19",
    "ora": "21:00",
    "campo": "Stadio Marino Zatini, Vacchereccia, Cavriglia",
    "golCasa": 4,
    "golOspite": 1
  },
  {
    "id": "A03",
    "fase": "Andata",
    "giornata": 3,
    "casa": "Montanino",
    "ospite": "San Cipriano",
    "data": "2026-10-23",
    "ora": "21:15",
    "campo": "Campo Sportivo Sussidiario di Reggello, Reggello",
    "golCasa": 2,
    "golOspite": 5
  },
  {
    "id": "A04",
    "fase": "Andata",
    "giornata": 4,
    "casa": "Levanella ’86",
    "ospite": "Montanino",
    "data": "2026-11-02",
    "ora": "21:15",
    "campo": "Stadio di Levane, Bucine",
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "A05",
    "fase": "Andata",
    "giornata": 5,
    "casa": "Montanino",
    "ospite": "Ginestra",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "A06",
    "fase": "Andata",
    "giornata": 6,
    "casa": "Malva",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "A07",
    "fase": "Andata",
    "giornata": 7,
    "casa": "Montanino",
    "ospite": "Ponte agli Stolli",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "A08",
    "fase": "Andata",
    "giornata": 8,
    "casa": "Sereto GS",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "A09",
    "fase": "Andata",
    "giornata": 9,
    "casa": "Montanino",
    "ospite": "Pol. Il Ponte",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "A10",
    "fase": "Andata",
    "giornata": 10,
    "casa": "Levane Leona",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "A11",
    "fase": "Andata",
    "giornata": 11,
    "casa": "Montanino",
    "ospite": "Baco Donnini",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "A12",
    "fase": "Andata",
    "giornata": 12,
    "casa": "Montanino",
    "ospite": "AS Giglio",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "A13",
    "fase": "Andata",
    "giornata": 13,
    "casa": "Pietrapiana Giglio Verde",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R01",
    "fase": "Ritorno",
    "giornata": 1,
    "casa": "Gaiole",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R02",
    "fase": "Ritorno",
    "giornata": 2,
    "casa": "Montanino",
    "ospite": "Vacchereccia",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R03",
    "fase": "Ritorno",
    "giornata": 3,
    "casa": "San Cipriano",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R04",
    "fase": "Ritorno",
    "giornata": 4,
    "casa": "Montanino",
    "ospite": "Levanella ’86",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R05",
    "fase": "Ritorno",
    "giornata": 5,
    "casa": "Ginestra",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R06",
    "fase": "Ritorno",
    "giornata": 6,
    "casa": "Montanino",
    "ospite": "Malva",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R07",
    "fase": "Ritorno",
    "giornata": 7,
    "casa": "Ponte agli Stolli",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R08",
    "fase": "Ritorno",
    "giornata": 8,
    "casa": "Montanino",
    "ospite": "Sereto GS",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R09",
    "fase": "Ritorno",
    "giornata": 9,
    "casa": "Pol. Il Ponte",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R10",
    "fase": "Ritorno",
    "giornata": 10,
    "casa": "Montanino",
    "ospite": "Levane Leona",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R11",
    "fase": "Ritorno",
    "giornata": 11,
    "casa": "Baco Donnini",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R12",
    "fase": "Ritorno",
    "giornata": 12,
    "casa": "AS Giglio",
    "ospite": "Montanino",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  },
  {
    "id": "R13",
    "fase": "Ritorno",
    "giornata": 13,
    "casa": "Montanino",
    "ospite": "Pietrapiana Giglio Verde",
    "data": null,
    "ora": null,
    "campo": null,
    "golCasa": null,
    "golOspite": null
  }
],
  /* TABELLINI PARTITA — aggiungi qui formazione, episodi e MVP.
     Le prime tre partite hanno risultati confermati, ma NON i dati individuali.
     Per compilare usa l'esempio dettagliato in COME_COMPILARE_TABELLINI.txt.
     Giocatori: {numero:1, nome:"Nome Cognome", reparto:"P", nota:"..."}
       reparto = P (portiere), D (difesa), C (centrocampo), A (attacco).
     Eventi: {minuto:"23", tipo:"gol", giocatore:"Nome Cognome", assist:"Nome Assist"}
             {minuto:"51", tipo:"giallo", giocatore:"Nome Cognome"}
             {minuto:"73", tipo:"rosso", giocatore:"Nome Cognome"}
             {minuto:"70", tipo:"sostituzione", esce:"Nome A", entra:"Nome B"}
     datiCompleti = true se la formazione e i partecipanti sono verificati.
     Se manca qualcosa lascia false: il sito lo segnalerà come dato parziale.
  */
  dettagliPartite: {
    "A01": { modulo: null, titolari: [], panchina: [], eventi: [], note: "", datiCompleti: false, eventiCompleti: false },
    "A02": { modulo: null, titolari: [], panchina: [], eventi: [], note: "", datiCompleti: false, eventiCompleti: false },
    "A03": { modulo: null, titolari: [], panchina: [], eventi: [], note: "", datiCompleti: false, eventiCompleti: false }
  },
  giocatori: [], /* aggiungi qui i giocatori (vedi LEGGIMI.txt) */
  staff: [],     /* aggiungi qui dirigenti, allenatori e preparatori */
  sponsor: [],  /* aggiungi qui gli sponsor reali e i file dei loghi */
  galleria: [
  {
    "titolo": "LA NOSTRA ROSA / 01",
    "sottotitolo": "VOLTI BIANCOVERDI",
    "foto": "rosa-01.webp"
  },
  {
    "titolo": "LA NOSTRA ROSA / 02",
    "sottotitolo": "VOLTI BIANCOVERDI",
    "foto": "rosa-02.webp"
  },
  {
    "titolo": "LA NOSTRA ROSA / 03",
    "sottotitolo": "VOLTI BIANCOVERDI",
    "foto": "rosa-03.webp"
  },
  {
    "titolo": "LA NOSTRA ROSA / 04",
    "sottotitolo": "VOLTI BIANCOVERDI",
    "foto": "rosa-04.webp"
  },
  {
    "titolo": "LA NOSTRA ROSA / 05",
    "sottotitolo": "VOLTI BIANCOVERDI",
    "foto": "rosa-05.webp"
  },
  {
    "titolo": "LA NOSTRA ROSA / 06",
    "sottotitolo": "VOLTI BIANCOVERDI",
    "foto": "rosa-06.webp"
  },
  {
    "titolo": "LA NOSTRA ROSA / 07",
    "sottotitolo": "VOLTI BIANCOVERDI",
    "foto": "rosa-07.webp"
  }
]
};
