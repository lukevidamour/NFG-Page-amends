// Builds the mockup from the raw capture in src/:
//   docs/         Switzerland site (clone + runtime fixes)
//   docs/dubai/   Dubai site (teal accents, see TEAL_HEX, + Dubai placeholder content)
// Usage: node build.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'docs');

const GOLD_SVG = 'assets/87e90a6d2895.svg';
const TEAL_SVG = 'assets/87e90a6d2895-teal.svg';
// Dubai accent colour (replaces the Swiss gold #A08455 everywhere)
const TEAL_HEX = '#1090A8';
const TEAL_RGB = TEAL_HEX.slice(1).match(/../g).map(h => parseInt(h, 16)).join(',');
const TEAL_DARK_RGB = TEAL_RGB.split(',').map(v => Math.round(v / 2)).join(','); // Wix's half-brightness gold variant
const MEDIA_POST = 'media/nfg-partners-appoints-paul-sarosy-as-non-executive-director.html';

const OFFICES = {
  swiss: { lat: 46.2089, lng: 6.1443, zoom: 15, label: 'NFG Partners Switzerland' },
  dubai: { lat: 25.2138, lng: 55.2821, zoom: 14, label: 'NFG Partners Dubai' },
};

function listPages(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? listPages(path.join(dir, d.name), path.join(base, d.name))
      : d.name.endsWith('.html') ? [path.join(base, d.name)] : []);
}

// ---------- In-page transforms (run inside the browser) ----------

function commonTransform({ office }) {
  // Wix embeds whose target is injected by script at runtime; blank them so nothing 404s
  document.querySelectorAll('iframe[src="https://undefined"]').forEach(f => f.setAttribute('src', 'about:blank'));
  // Swap the Wix Google Maps iframe for our own map element
  document.querySelectorAll('iframe[src*="googleMap"], iframe[title*="Google Maps" i]').forEach(f => {
    const d = document.createElement('div');
    d.className = 'mk-map';
    Object.assign(d.dataset, { lat: office.lat, lng: office.lng, zoom: office.zoom, label: office.label });
    d.style.cssText = 'width:100%;height:100%;';
    f.replaceWith(d);
  });
}

function dubaiTransform({ page, office, postHref }) {
  const ROOT = '@@ROOT@@';
  const img = n => `${ROOT}mockup/img/dubai-${((n - 1) % 8) + 1}.jpg`;
  document.documentElement.classList.add('mk-dubai');
  document.title = document.title.replace(/NFG Partners/, 'NFG Partners Dubai');

  const services = [
    ['Discretionary Investment Management', 'Dubai Service 1'],
    ['Investment Advisory Services', 'Dubai Service 2'],
    ['Private Markets', 'Dubai Service 3'],
    ['Banking Solutions', 'Dubai Service 4'],
  ];
  const serviceBlurbs = [
    [/^Our discretionary investment strategies/, 1],
    [/^We provide high-touch/, 2],
    [/^Gain access to exclusive private equity/, 3],
    [/^Our custom banking solutions/, 4],
    [/^Our discretionary service offers/, 1],
    [/^Secure your financial future with our extensive/, 4],
  ];
  const intro = (document.querySelector('meta[name="description"]')?.content || '').slice(0, 30);
  if (page.startsWith('expertise/') && intro) {
    const n = { 'discretionary-investment-management.html': 1, 'investment-advisory-services.html': 2, 'private-markets.html': 3, 'banking-solutions.html': 4 }[page.split('/')[1]];
    serviceBlurbs.push([new RegExp('^' + intro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), n]);
  }
  const blurb = n => `Placeholder description for Dubai Service ${n}. Final copy to be supplied by the NFG Partners Dubai team.`;

  const textSwaps = [
    [/\+41 22 512 80 00/g, '+971 4 000 0000'],
    [/admin@nfgpartners\.ch/g, 'dubai@nfgpartners-placeholder.ae'],
    [/Rue du Mont-Blanc 4, 1201 Geneva/g, 'Dubai address line 1, Dubai address line 2'],
    [/Rue du Mont Blanc 4,/g, 'Dubai address line 1,'],
    [/1201 Geneva,/g, 'Dubai address line 2,'],
    [/NFG Partners SA,/g, 'NFG Partners Dubai,'],
    [/regulated by FINMA/g, 'regulated by [Dubai regulator]'],
    [/CHE-170\.661\.905/g, '[Dubai company number]'],
    ...services.map(([a, b]) => [new RegExp(a, 'g'), b]),
    [/^Discretionary $/, 'Dubai Service 1 '],
    [/^\u00a0Advisory investment capabilities/, ' Dubai Service 2 capabilities'],
  ];

  // Text nodes
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const t of nodes) {
    let v = t.nodeValue;
    if (!v.trim()) continue;
    if (v.trim() === 'Switzerland') {
      v = v.replace('Switzerland', t.parentElement.closest('footer, [id*="FOOTER"]') ? 'United Arab Emirates' : 'Dubai');
    }
    for (const [re, rep] of textSwaps) v = v.replace(re, rep);
    t.nodeValue = v;
  }
  // "Banking Solutions & Wealth Management." feature on the home page
  document.querySelectorAll('p').forEach(p => {
    if (/^Dubai Service 4\s*&\s*Wealth Management\.$/.test(p.textContent.trim())) {
      const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const t = w.currentNode;
        t.nodeValue = t.nodeValue.replace('Dubai Service 4', 'Dubai Service 3').replace('Wealth Management.', 'Dubai Service 4.');
      }
    }
  });
  // Service description paragraphs
  document.querySelectorAll('p, h6, h5').forEach(p => {
    const txt = p.textContent.trim();
    for (const [re, n] of serviceBlurbs) if (re.test(txt)) {
      const leaf = [...p.querySelectorAll('*')].reverse().find(e => e.textContent.trim()) || p;
      p.querySelectorAll('*').forEach(e => { if (e !== leaf && !e.contains(leaf)) e.remove(); });
      leaf.textContent = blurb(n);
    }
  });
  // Contact links
  document.querySelectorAll('a[href^="tel:"]').forEach(a => a.href = 'tel:+97140000000');
  document.querySelectorAll('a[href^="mailto:"]').forEach(a => a.href = 'mailto:dubai@nfgpartners-placeholder.ae');

  const tagExample = el => {
    el.classList.add('mk-example');
    if (!el.querySelector(':scope > .mk-example-tag')) {
      const s = document.createElement('span');
      s.className = 'mk-example-tag';
      s.textContent = '(example media)';
      el.appendChild(s);
    }
  };
  const swapMedia = (container, src) => {
    // replace the biggest media element (img / video / iframe) in the container with one image,
    // keeping the frame it sits in so the card layout is untouched
    const area = e => { const r = e.getBoundingClientRect(); return r.width * r.height; };
    const media = [...container.querySelectorAll('img, iframe, video, wix-video, [data-testid="imageX"]')].sort((a, b) => area(b) - area(a))[0];
    if (!media) return null;
    const r0 = media.getBoundingClientRect();
    let frame = media;
    while (frame.parentElement && frame.parentElement !== container) {
      const r = frame.parentElement.getBoundingClientRect();
      if (Math.abs(r.width - r0.width) > 4 || Math.abs(r.height - r0.height) > 4) break;
      frame = frame.parentElement;
    }
    if (frame === media) frame = media.parentElement;
    const fr = frame.getBoundingClientRect();
    const im = document.createElement('img');
    im.src = src; im.alt = 'Example Dubai imagery';
    im.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;';
    frame.innerHTML = '';
    if (fr.height > 0) { frame.style.height = fr.height + 'px'; }
    if (getComputedStyle(frame).position === 'static') frame.style.position = 'relative';
    frame.style.overflow = 'hidden';
    frame.appendChild(im);
    tagExample(frame);
    return frame;
  };

  // Media post cards (Media page + Featured Viewpoints on home)
  const readMore = [...document.querySelectorAll('a')].filter(a => /^(Read more|Read viewpoint)$/.test(a.textContent.trim()));
  const items = [];
  for (const a of readMore) {
    let n = a;
    while (n && !(n.parentElement && /-container$/.test([...n.parentElement.classList].pop() || '') && n.parentElement.parentElement?.classList.contains('wixui-repeater'))) n = n.parentElement;
    if (n && !items.includes(n)) items.push(n);
  }
  items.forEach((item, i) => {
    const n = i + 1;
    if (page === 'media.html' && n > 9) { item.remove(); return; }
    swapMedia(item, img(n));
    const title = item.querySelector('h1,h2,h3,h4');
    if (title) {
      const leaf = [...title.querySelectorAll('*')].reverse().find(e => e.textContent.trim()) || title;
      leaf.textContent = `Dubai Media Post ${n}`;
    }
    item.querySelectorAll('p, h5, h6').forEach(p => {
      const txt = p.textContent.trim();
      if (txt.length > 40 && !/^\d{1,2}\s*\w+\s*\d{4}$/.test(txt)) {
        const leaf = [...p.querySelectorAll('*')].reverse().find(e => e.textContent.trim()) || p;
        leaf.textContent = 'Placeholder excerpt for a Dubai-focused article. Content to be supplied by the NFG Partners Dubai team.';
      }
    });
    item.querySelectorAll('a[href]').forEach(a => { if (!/^https?:\/\/(?!www\.nfg)/.test(a.href) || a.href.includes('nfg.partners')) a.setAttribute('href', postHref); });
  });

  // Home hero: Geneva video -> Dubai video, kept inside Wix's own video component
  const heroVideo = document.querySelector('wix-video');
  if (heroVideo && page === 'index.html') {
    const v = heroVideo.querySelector('video');
    if (v) {
      v.setAttribute('src', `${ROOT}mockup/img/dubai-hero.mp4`);
      v.setAttribute('poster', `${ROOT}mockup/img/dubai-hero-poster.jpg`);
      v.setAttribute('aria-label', 'Dubai skyline');
      ['autoplay', 'muted', 'loop', 'playsinline'].forEach(a => v.setAttribute(a, ''));
      v.removeAttribute('crossorigin');
    }
    const bg = heroVideo.closest('[id^="bgMedia_"]') || heroVideo.parentElement;
    bg.querySelectorAll('img').forEach(i => { i.src = `${ROOT}mockup/img/dubai-hero-poster.jpg`; i.alt = 'Dubai skyline'; });
    tagExample(bg);
    // "On Point." accent in the hero headline
    const hero = heroVideo.closest('section');
    [...(hero || document).querySelectorAll('span, p')].filter(e => /^On Point\.?$/.test(e.textContent.trim()))
      .slice(-1).forEach(e => e.classList.add('mk-hero-accent'));
  }

  // Media post page: placeholder title + hero image
  if (page.startsWith('media/')) {
    const h1 = document.querySelector('h1');
    if (h1) {
      const leaf = [...h1.querySelectorAll('*')].reverse().find(e => e.textContent.trim()) || h1;
      leaf.textContent = 'Dubai Media Post 1';
    }
    const main = document.querySelector('main') || document.body;
    const firstImg = [...main.querySelectorAll('img')].find(i => i.getBoundingClientRect().width > 300 || +i.getAttribute('width') > 300);
    if (firstImg) swapMedia(firstImg.parentElement, img(1));
  }

  // Contact: signpost the Swiss office for anyone who landed on the wrong site
  if (page === 'contact.html') {
    const mail = [...document.querySelectorAll('a[href^="mailto:"]')].find(a => !a.closest('footer, [id*="FOOTER"]'));
    const block = mail && mail.closest('h6, p');
    if (block) {
      block.insertAdjacentHTML('beforeend', '<br class="wixui-rich-text__text"><br class="wixui-rich-text__text">'
        + '<a class="wixui-rich-text__text mk-crosslink" href="@@SWISS@@contact.html">Looking for our Geneva office? <span style="text-decoration:underline">Visit NFG Partners Switzerland</span></a>');
    }
  }
}

// ---------- Build ----------

// cache-bust the mockup runtime so viewers never get a stale copy after a push
const VERSION = require('crypto').createHash('md5')
  .update(fs.readFileSync(path.join(OUT, 'mockup/mockup.css')) + fs.readFileSync(path.join(OUT, 'mockup/mockup.js')))
  .digest('hex').slice(0, 8);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/*', r => r.request().resourceType() === 'document' ? r.continue() : r.abort());

  // teal copy of the gold N mark
  fs.writeFileSync(path.join(OUT, TEAL_SVG), fs.readFileSync(path.join(OUT, GOLD_SVG), 'utf8').replace(/#a08455/gi, TEAL_HEX));

  for (const rel of listPages(SRC)) {
    const depth = rel.split(path.sep).length - 1;
    for (const site of ['swiss', 'dubai']) {
      const page = await ctx.newPage();
      await page.goto('file://' + path.join(SRC, rel), { waitUntil: 'domcontentloaded' });
      const pageRel = rel.split(path.sep).join('/');
      const outDepth = depth + (site === 'dubai' ? 1 : 0);
      const up = '../'.repeat(outDepth);
      await page.evaluate(commonTransform, { office: OFFICES[site] });
      if (site === 'dubai') {
        const postHref = path.posix.relative(path.posix.dirname(pageRel), MEDIA_POST) || path.posix.basename(MEDIA_POST);
        await page.evaluate(dubaiTransform, { page: pageRel, office: OFFICES.dubai, postHref });
      }
      let html = '<!DOCTYPE html>\n' + await page.evaluate(() => document.documentElement.outerHTML);
      await page.close();

      if (site === 'dubai') {
        html = html
          .replace(/(["'(]|&quot;)((?:\.\.\/)*)assets\//g, '$1../$2assets/')
          .split(GOLD_SVG).join(TEAL_SVG)
          .replace(/160,\s*132,\s*85/g, TEAL_RGB)
          .replace(/#a08455/gi, TEAL_HEX)
          .replace(/80,\s*66,\s*43/g, TEAL_DARK_RGB)
          .split('@@SWISS@@').join('../'.repeat(outDepth));
      }
      // Mockup must never compete with the client's real site in search
      const live = 'https://www.nfg.partners/' + pageRel.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');
      html = html
        .replace(/<meta name="robots"[^>]*>/gi, '')
        .replace(/<link rel="canonical"[^>]*>/gi, `<link rel="canonical" href="${live}">`)
        .replace('</head>', '<meta name="robots" content="noindex, nofollow">\n</head>');

      html = html.split('@@ROOT@@').join(up)
        .replace('</head>', `<link rel="stylesheet" href="${up}mockup/mockup.css?v=${VERSION}">\n</head>`)
        .replace('</body>', `<script src="${up}mockup/mockup.js?v=${VERSION}"></script>\n</body>`);

      const dest = path.join(OUT, site === 'dubai' ? 'dubai' : '', rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, html);
      console.log('built', site, rel);
    }
  }
  await browser.close();
})();
