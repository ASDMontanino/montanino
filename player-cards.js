/* Carte personalizzate della rosa Montanino. Le chiavi sono i cognomi. */
(() => {
  'use strict';
  const cards = Object.freeze({
    banchetti: 'assets/img/cards/banchetti.webp',
    benedetti: 'assets/img/cards/benedetti.webp',
    brandini: 'assets/img/cards/brandini.webp',
    casini: 'assets/img/cards/casini.webp',
    deiana: 'assets/img/cards/deiana.webp',
    'del mira': 'assets/img/cards/del-mira.webp',
    drappello: 'assets/img/cards/drappello.webp',
    ermini: 'assets/img/cards/ermini.webp',
    filippone: 'assets/img/cards/filippone.webp',
    guhacaj: 'assets/img/cards/guhacaj.webp',
    iavarazzo: 'assets/img/cards/iavarazzo.webp',
    madrucci: 'assets/img/cards/madrucci.webp',
    novedrati: 'assets/img/cards/novedrati.webp',
    palma: 'assets/img/cards/palma.webp',
    pancrazzi: 'assets/img/cards/pancrazzi.webp',
    ragona: 'assets/img/cards/ragona.webp',
    russolillo: 'assets/img/cards/russolillo.webp',
    tacconi: 'assets/img/cards/tacconi.webp',
    tozzi: 'assets/img/cards/tozzi.webp'
  });
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it').replace(/[^a-z0-9]+/g, ' ').trim();
  function assetFor(name) {
    const key = normalize(name), words = key.split(' ').filter(Boolean);
    return cards[key] || cards[words.slice(-2).join(' ')] || cards[words.at(-1)] || '';
  }
  function urlFor(value, supabaseUrl) {
    const file = String(value || '').trim();
    if (/^sb:montanino-card-[0-9a-f]{32}\.webp$/i.test(file) && supabaseUrl)
      return supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/montanino-partite/' + encodeURIComponent(file.slice(3));
    if (/^assets\/img\/cards\/[a-z-]+\.webp$/i.test(file)) return file;
    return '';
  }
  window.MontaninoPlayerCards = Object.freeze({ assetFor, urlFor });
})();
