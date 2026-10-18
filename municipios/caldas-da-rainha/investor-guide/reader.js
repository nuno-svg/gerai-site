/* Self-hosted reader: no analytics, accounts, remote assets or storage. */
(() => {
  'use strict';
  const docs = window.INVESTOR_CATALOG || [];
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let current = docs.find(d => d.id === params.get('doc')) || docs[0];
  let page = 0, flip = null, textMode = false, resizeTimer;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const normal = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(current.pages.length - 1, Math.floor(n) - 1)) : 0;
  }
  function message(text) { $('status').textContent = text; }
  function setSidebar(open) {
    document.body.classList.toggle('sidebar-off', !open);
    $('toggle-sidebar').setAttribute('aria-expanded', String(open));
    setTimeout(buildBook, 0);
  }
  function sync() {
    $('page-input').value = page + 1;
    $('page-input').max = current.pages.length;
    $('page-total').textContent = `/ ${current.pages.length}`;
    $('previous').disabled = page === 0;
    $('next').disabled = page === current.pages.length - 1;
    $('transcript').textContent = current.pages[page].text;
    const url = new URL(location.href);
    url.searchParams.set('doc', current.id); url.searchParams.set('page', page + 1);
    history.replaceState(null, '', url);
    let active = current.chapters[0]?.page;
    for (const c of current.chapters) if (c.page <= page + 1) active = c.page;
    for (const b of $('chapters').children) {
      if (Number(b.dataset.page) === active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    for (const b of $('thumbnails').children) {
      if (Number(b.dataset.page) === page) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    for (let i = Math.max(0, page - 2); i < Math.min(current.pages.length, page + 4); i++) {
      const im = document.querySelector(`.page[data-number="${i}"] img`);
      if (im) im.loading = 'eager';
    }
  }
  function go(index, animate = false) {
    page = Math.max(0, Math.min(current.pages.length - 1, index));
    if (flip && !textMode) {
      if (animate && !reduced.matches) flip.flip(page);
      else flip.turnToPage(page);
    }
    sync();
  }
  function buildBook() {
    if (!current || textMode || !$('stage').clientHeight) return;
    const requestedPage = page;
    const mount = $('book-mount');
    if (flip) { flip.destroy(); flip = null; }
    mount.replaceChildren();
    if (!window.St?.PageFlip) {
      message('O efeito de folhear não ficou disponível. Utilize Texto / Text ou o PDF.');
      return;
    }
    const book = document.createElement('div'); book.className = 'book'; mount.append(book);
    const ratio = current.width / current.height;
    const availableW = mount.clientWidth - 10, availableH = mount.clientHeight - 18;
    const spread = availableW > 700 && ratio < 1;
    const width = Math.floor(Math.min(availableH * ratio, availableW / (spread ? 2 : 1)));
    const height = Math.floor(width / ratio);
    for (const [i, p] of current.pages.entries()) {
      const el = document.createElement('div'); el.className = 'page'; el.dataset.number = i;
      const im = document.createElement('img'); im.src = p.image;
      im.alt = `${current.title} — página ${i + 1}. Texto disponível no modo Texto / Text.`;
      im.loading = i < 3 || Math.abs(i - page) < 3 ? 'eager' : 'lazy'; im.draggable = false;
      el.append(im);
      for (const link of p.links) {
        const a = document.createElement('a'); a.href = link.url;
        a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label', `Abrir fonte: ${link.url}`);
        const [x,y,w,h] = link.box; Object.assign(a.style, {left:`${x}%`,top:`${y}%`,width:`${w}%`,height:`${h}%`});
        el.append(a);
      }
      book.append(el);
    }
    flip = new St.PageFlip(book, {width, height, startPage:requestedPage, size:'fixed', autoSize:false, showCover:true,
      usePortrait:true, drawShadow:!reduced.matches, maxShadowOpacity:.22,
      flippingTime:reduced.matches ? 1 : 650, mobileScrollSupport:false,
      clickEventForward:true, useMouseEvents:true, showPageCorners:!reduced.matches});
    flip.loadFromHTML(book.querySelectorAll('.page'));
    flip.on('flip', e => {page = e.data; sync();});
    flip.turnToPage(requestedPage);
    page = requestedPage;
    sync();
  }
  function loadDocument(doc, initial = 0) {
    current = doc; page = initial;
    $('publication').value = doc.id;
    $('title').textContent = doc.title; $('language').textContent = doc.language;
    $('document-info').textContent = `${doc.pages.length} páginas · ${doc.language} · Edição 18.10.2026`;
    $('download').href = doc.pdf;
    document.title = `${doc.title} · Caldas da Rainha`;
    $('chapters').replaceChildren();
    for (const c of doc.chapters) {
      const b = document.createElement('button'); b.dataset.page = c.page;
      const title = document.createElement('span'); title.textContent = c.title;
      const n = document.createElement('span'); n.textContent = String(c.page).padStart(2,'0');
      b.append(title,n); b.onclick = () => {go(c.page - 1); if (innerWidth <= 760) setSidebar(false);};
      $('chapters').append(b);
    }
    $('thumbnails').replaceChildren();
    for (const [i,p] of doc.pages.entries()) {
      const b = document.createElement('button'); b.dataset.page = i; b.setAttribute('aria-label', `Ir para página ${i+1}`);
      const im = document.createElement('img'); im.src = p.thumb; im.alt = ''; im.loading = 'lazy';
      const n = document.createElement('span'); n.textContent = i + 1;
      b.append(im,n); b.onclick = () => go(i); $('thumbnails').append(b);
    }
    $('search').value = ''; $('search-results').replaceChildren();
    buildBook(); sync();
  }
  for (const d of docs) {
    const o = document.createElement('option'); o.value = d.id; o.textContent = `${d.title} · ${d.language}`; $('publication').append(o);
  }
  $('publication').onchange = e => {loadDocument(docs.find(d=>d.id===e.target.value)); if(innerWidth<=760)setSidebar(false);};
  $('toggle-sidebar').onclick = () => setSidebar(document.body.classList.contains('sidebar-off'));
  $('close-sidebar').onclick = () => setSidebar(false);
  $('previous').onclick = () => {if(textMode)go(page-1);else if(reduced.matches)flip?.turnToPrevPage();else flip?.flipPrev();};
  $('next').onclick = () => {if(textMode)go(page+1);else if(reduced.matches)flip?.turnToNextPage();else flip?.flipNext();};
  $('page-input').onchange = e => go(number(e.target.value));
  $('mode').onclick = () => {
    textMode = !textMode; $('stage').hidden = textMode; $('text-view').hidden = !textMode;
    $('mode').setAttribute('aria-pressed',String(textMode)); $('mode').textContent = textMode ? 'Folhear / Browse' : 'Texto / Text';
    if (!textMode) buildBook(); sync();
  };
  $('search').oninput = e => {
    const q = normal(e.target.value.trim()); const box = $('search-results'); box.replaceChildren();
    if(q.length<2)return;
    const found = current.pages.filter(p=>normal(p.text).includes(q));
    const count = document.createElement('p'); count.textContent = `${found.length} página(s) encontrada(s)`; box.append(count);
    for(const p of found){
      const b=document.createElement('button');const i=normal(p.text).indexOf(q);
      b.textContent=`P. ${p.number} · …${p.text.slice(Math.max(0,i-25),i+90).replace(/\s+/g,' ')}…`;
      b.onclick=()=>{go(p.number-1);message(`Resultado na página ${p.number}. Use Ampliar ou Texto / Text para ler.`);if(innerWidth<=760)setSidebar(false);};box.append(b);
    }
  };
  $('zoom').onclick=()=>{
    $('zoom-image').src=current.pages[page].image;$('zoom-image').alt=`${current.title}, página ${page+1}`;
    $('zoom-label').textContent=`${current.title} · ${page+1} / ${current.pages.length}`;
    $('zoom-dialog').showModal();$('zoom-dialog').scrollTop=0;$('zoom-dialog').scrollLeft=0;
  };
  $('zoom-close').onclick=()=>$('zoom-dialog').close();
  $('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);message('Ligação para esta publicação e página copiada.');}catch{message('Copie o endereço do navegador para partilhar esta página.');}};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message('Ecrã inteiro indisponível neste navegador.');}};
  document.addEventListener('keydown',e=>{
    if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||$('zoom-dialog').open)return;
    if(e.key==='ArrowRight'){$('next').click();e.preventDefault();}
    if(e.key==='ArrowLeft'){$('previous').click();e.preventDefault();}
    if(e.key==='Home'){go(0);e.preventDefault();}if(e.key==='End'){go(current.pages.length-1);e.preventDefault();}
  });
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(buildBook,180);});
  if(innerWidth<=760){document.body.classList.add('sidebar-off');$('toggle-sidebar').setAttribute('aria-expanded','false');}
  if(current)loadDocument(current,number(params.get('page')||1));
  else message('Publicações indisponíveis. Volte a carregar a página.');
})();
