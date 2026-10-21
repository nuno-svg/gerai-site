/* Self-hosted reader: no analytics, accounts, remote assets or storage. */
(() => {
  'use strict';
  const docs = window.INVESTOR_CATALOG || [];
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const aliases = {facts:'facts-pt',assets:'assets-pt',sectors:'sectors-pt',welcome:'welcome-pt'};
  const requested = aliases[params.get('doc')] || params.get('doc');
  let current = docs.find(d => d.id === requested) || docs.find(d => d.language === (params.get('lang') === 'EN' ? 'EN' : 'PT')) || docs[0];
  const t = (pt,en) => current.language === 'EN' ? en : pt;
  let page = 0, flip = null, textMode = false, resizeTimer;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const normal = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(current.pages.length - 1, Math.floor(n) - 1)) : 0;
  }
  function message(text) { $('status').textContent = text; }
  const mobile = () => innerWidth <= 760;
  const sidebarOpen = () => !document.body.classList.contains('sidebar-off');
  // On small screens the contents panel behaves as a modal dialog: backdrop, Esc, focus in and back.
  function sidebarMode() {
    const modal = sidebarOpen() && mobile(), aside = $('sidebar');
    if (modal) { aside.setAttribute('role', 'dialog'); aside.setAttribute('aria-modal', 'true'); }
    else { aside.removeAttribute('role'); aside.removeAttribute('aria-modal'); }
    $('sidebar-backdrop').hidden = !modal;
    for (const el of [document.querySelector('main'), document.querySelector('.topbar'), document.querySelector('.skip')]) el.inert = modal;
    return modal;
  }
  function setSidebar(open, focusTo = 'toggle') {
    document.body.classList.toggle('sidebar-off', !open);
    $('toggle-sidebar').setAttribute('aria-expanded', String(open));
    const modal = sidebarMode();
    if (open && modal) $('close-sidebar').focus();
    else if (!open && focusTo === 'toggle' && mobile()) $('toggle-sidebar').focus();
    else if (!open && focusTo === 'main') $('main').focus();
    setTimeout(buildBook, 0);
  }
  // After choosing a result or chapter, reading continues in the main area.
  function toReading() { if (mobile()) setSidebar(false, 'main'); else $('main').focus(); }
  function sync() {
    $('page-input').value = page + 1;
    $('page-input').max = current.pages.length;
    $('page-total').textContent = `/ ${current.pages.length}`;
    $('previous').disabled = page === 0;
    $('next').disabled = page === current.pages.length - 1;
    $('transcript').textContent = current.pages[page].text;
    const url = new URL(location.href);
    url.searchParams.set('doc', current.id); url.searchParams.set('page', page + 1); url.searchParams.set('lang',current.language);
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
      message(t('O efeito de folhear não ficou disponível. Utilize Texto ou o PDF.','Page turning is unavailable. Use Text or download the PDF.'));
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
      im.alt = `${current.title} — ${t('página','page')} ${i + 1}. ${t('Transcrição disponível no modo Texto.','Transcript available in Text mode.')}`;
      im.loading = i < 3 || Math.abs(i - page) < 3 ? 'eager' : 'lazy'; im.draggable = false;
      el.append(im);
      for (const link of p.links) {
        const a = document.createElement('a'); a.href = link.url;
        a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label', `${t('Abrir fonte','Open source')}: ${link.url}`);
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
    const en = doc.language === 'EN';
    document.documentElement.lang = en ? 'en' : 'pt-PT';
    document.querySelector('.skip').textContent=t('Saltar para a publicação','Skip to publication');
    document.querySelector('.brand').setAttribute('aria-label',t('Voltar à página pública de Caldas da Rainha','Back to the Caldas da Rainha public page'));
    document.querySelector('.identity span').textContent=t('Biblioteca do Investidor · Outubro 2026','Investor Library · October 2026');
    document.querySelector('.edition').textContent=t('Outubro 2026','October 2026');
    for (const [id,pt,english] of [['sidebar','Biblioteca e índice','Library and contents'],['chapters','Índice da publicação','Publication contents'],['stage','Publicação com efeito de folhear','Page-turning publication'],['text-view','Transcrição de texto','Text transcript'],['thumbnails','Miniaturas das páginas','Page thumbnails'],['previous','Página anterior','Previous page'],['next','Página seguinte','Next page'],['close-sidebar','Fechar índice','Close contents']]) $(id).setAttribute('aria-label',t(pt,english));
    for (const [id,pt,english] of [['publication','PUBLICAÇÃO','PUBLICATION'],['search','PESQUISAR','SEARCH']]) document.querySelector(`label[for="${id}"]`).textContent=t(pt,english);
    $('edition-language').value = doc.language;
    $('publication').replaceChildren();
    for (const d of docs.filter(d => d.language === doc.language)) {
      const o = document.createElement('option'); o.value = d.id; o.textContent = d.title; $('publication').append(o);
    }
    $('download-dossier').href = `assets/dossier-${doc.language.toLowerCase()}/document.pdf`;
    $('download-dossier').download = `Dossier_Caldas_Investidor_${doc.language}.pdf`;
    $('download-dossier').textContent = t('Dossier completo PDF','Complete dossier PDF');
    $('download-package').href = `assets/dossier-${doc.language.toLowerCase()}/Kit_Caldas_${doc.language}.zip`;
    $('download-package').textContent = t('Pacote em português ZIP','English package ZIP');
    for (const [id,pt,english] of [['toggle-sidebar','Índice','Contents'],['zoom','Ampliar','Zoom'],['share','Partilhar','Share'],['download','Descarregar PDF','Download PDF'],['fullscreen','Ecrã inteiro','Full screen'],['previous','Anterior','Previous'],['next','Seguinte','Next'],['close-sidebar','Fechar','Close'],['zoom-close','Fechar ampliação','Close zoom']]) $(id).textContent=t(pt,english);
    $('mode').textContent = textMode ? t('Folhear','Browse') : t('Texto','Text');
    document.querySelector('#sidebar h1').textContent=t('Uma cidade. Muitas possibilidades.','One city. Many possibilities.');
    document.querySelector('#sidebar .intro').textContent=t('Edição portuguesa. Sete publicações para conhecer o território e investir.','English edition. Seven publications to explore the area and invest.');
    document.querySelector('.text-note').textContent=t('Transcrição de leitura. Consulte a página ou o PDF para ver tabelas, imagens e disposição original.','Reading transcript. View the page or PDF for tables, images and the original layout.');
    document.querySelector('label[for="page-input"]').firstChild.nodeValue=t('Página ','Page ');
    $('project-link').textContent=t('Quer falar sobre o seu projeto?','Would you like to discuss your project?');
    $('project-link').href=en?'../?lang=en#pedido':'../#pedido';
    document.querySelector('.privacy').textContent=t('Sem publicidade ou cookies de análise. Leitor independente; não utiliza o serviço iPaper.','No advertising or analytics cookies. Independent reader; does not use the iPaper service.');
    $('search').placeholder=t('Ex.: talento, comércio, energia','E.g. talent, retail, energy');
    message(t('Use as setas ou deslize para folhear.','Use the arrows or swipe to browse.'));
    $('publication').value = doc.id;
    $('title').textContent = doc.title; $('language').textContent = doc.language;
    $('document-info').textContent = `${doc.pages.length} ${t('páginas','pages')} · ${doc.language} · ${t('Edição','Edition')} 19.10.2026`;
    $('download').href = doc.pdf;
    document.title = `${doc.title} · Caldas da Rainha`;
    $('chapters').replaceChildren();
    for (const c of doc.chapters) {
      const b = document.createElement('button'); b.dataset.page = c.page;
      const title = document.createElement('span'); title.textContent = c.title;
      const n = document.createElement('span'); n.textContent = String(c.page).padStart(2,'0');
      b.append(title,n); b.onclick = () => {go(c.page - 1); toReading();};
      $('chapters').append(b);
    }
    $('thumbnails').replaceChildren();
    for (const [i,p] of doc.pages.entries()) {
      const b = document.createElement('button'); b.dataset.page = i; b.setAttribute('aria-label', `${t('Ir para página','Go to page')} ${i+1}`);
      const im = document.createElement('img'); im.src = p.thumb; im.alt = ''; im.loading = 'lazy';
      const n = document.createElement('span'); n.textContent = i + 1;
      b.append(im,n); b.onclick = () => go(i); $('thumbnails').append(b);
    }
    $('search').value = ''; $('search-results').replaceChildren();
    buildBook(); sync();
  }
  $('edition-language').onchange = e => loadDocument(docs.find(d => d.language === e.target.value && d.group === current.group) || docs.find(d => d.language === e.target.value));
  $('publication').onchange = e => {loadDocument(docs.find(d=>d.id===e.target.value)); if(mobile())setSidebar(false,'main');};
  $('toggle-sidebar').onclick = () => setSidebar(document.body.classList.contains('sidebar-off'));
  $('close-sidebar').onclick = () => setSidebar(false);
  $('sidebar-backdrop').onclick = () => setSidebar(false);
  $('previous').onclick = () => {if(textMode)go(page-1);else if(reduced.matches)flip?.turnToPrevPage();else flip?.flipPrev();};
  $('next').onclick = () => {if(textMode)go(page+1);else if(reduced.matches)flip?.turnToNextPage();else flip?.flipNext();};
  $('page-input').onchange = e => go(number(e.target.value));
  $('mode').onclick = () => {
    textMode = !textMode; $('stage').hidden = textMode; $('text-view').hidden = !textMode;
    $('mode').setAttribute('aria-pressed',String(textMode)); $('mode').textContent = textMode ? t('Folhear','Browse') : t('Texto','Text');
    if (!textMode) buildBook(); sync();
  };
  $('search').oninput = e => {
    const q = normal(e.target.value.trim()); const box = $('search-results'); box.replaceChildren();
    if(q.length<2)return;
    const found = current.pages.filter(p=>normal(p.text).includes(q));
    const count = document.createElement('p'); count.textContent = `${found.length} ${t('página(s) encontrada(s)','page(s) found')}`; box.append(count);
    for(const p of found){
      const b=document.createElement('button');const i=normal(p.text).indexOf(q);
      b.textContent=`P. ${p.number} · …${p.text.slice(Math.max(0,i-25),i+90).replace(/\s+/g,' ')}…`;
      b.onclick=()=>{go(p.number-1);message(t(`Resultado na página ${p.number}. Use Ampliar ou Texto para ler.`,`Result on page ${p.number}. Use Zoom or Text to read.`));toReading();};box.append(b);
    }
  };
  $('zoom').onclick=()=>{
    $('zoom-image').src=current.pages[page].image;$('zoom-image').alt=`${current.title}, ${t('página','page')} ${page+1}`;
    $('zoom-label').textContent=`${current.title} · ${page+1} / ${current.pages.length}`;
    $('zoom-dialog').showModal();$('zoom-dialog').scrollTop=0;$('zoom-dialog').scrollLeft=0;
  };
  $('zoom-close').onclick=()=>$('zoom-dialog').close();
  $('share').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);message(t('Ligação para esta publicação e página copiada.','Link to this publication and page copied.'));}catch{message(t('Copie o endereço do navegador para partilhar esta página.','Copy the browser address to share this page.'));}};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message(t('Ecrã inteiro indisponível neste navegador.','Full screen is unavailable in this browser.'));}};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&sidebarOpen()&&mobile()&&!$('zoom-dialog').open){setSidebar(false);e.preventDefault();return;}
    if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||$('zoom-dialog').open)return;
    if(e.key==='ArrowRight'){$('next').click();e.preventDefault();}
    if(e.key==='ArrowLeft'){$('previous').click();e.preventDefault();}
    if(textMode)return; // Home/End keep their native scrolling in the transcript.
    if(e.key==='Home'){go(0);e.preventDefault();}if(e.key==='End'){go(current.pages.length-1);e.preventDefault();}
  });
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{sidebarMode();buildBook();},180);});
  if(innerWidth<=760){document.body.classList.add('sidebar-off');$('toggle-sidebar').setAttribute('aria-expanded','false');}
  if(current)loadDocument(current,number(params.get('page')||1));
  else message('Publicações indisponíveis. Volte a carregar a página.');
})();
