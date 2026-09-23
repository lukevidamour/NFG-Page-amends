// Mockup runtime: restores the Wix hover menus, adds the CH | DXB site
// toggle, renders office maps and tags placeholder imagery.
(function () {
  var script = document.currentScript;
  var root = new URL('..', script.src).href; // site root (folder containing /mockup)
  var isDubai = document.documentElement.classList.contains('mk-dubai');

  // ---- Hover dropdowns (Wix normally drives these with JS) ----
  function wireDropdown(li) {
    var box = li.querySelector('[data-testid="positionBox"]');
    if (!box) return;
    var anim = box.querySelector('[class*="animationBox"]');
    var hideTimer;
    box.classList.add('mk-dropdown');
    function show() {
      clearTimeout(hideTimer);
      box.style.display = 'block';
      var r = li.getBoundingClientRect();
      var w = box.offsetWidth;
      var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
      box.style.position = 'fixed';
      box.style.left = left + 'px';
      box.style.top = (r.bottom + 4) + 'px';
      requestAnimationFrame(function () { if (anim) anim.style.opacity = 1; });
    }
    function hide() {
      hideTimer = setTimeout(function () {
        if (anim) anim.style.opacity = 0;
        box.style.display = 'none';
      }, 120);
    }
    li.addEventListener('mouseenter', show);
    li.addEventListener('mouseleave', hide);
    li.addEventListener('focusin', show);
    li.addEventListener('focusout', hide);
  }

  // ---- CH | DXB site toggle (header + footer) ----
  var here = location.href.split('#')[0].split('?')[0];
  var rel = here.indexOf(root) === 0 ? here.slice(root.length) : 'index.html';
  if (rel === '' || rel.slice(-1) === '/') rel += 'index.html';
  var swissRel = rel.replace(/^dubai\//, '');
  var SITES = [
    { code: 'CH', name: 'Switzerland', href: root + swissRel, current: !isDubai },
    { code: 'DXB', name: 'Dubai', href: root + 'dubai/' + swissRel, current: isDubai }
  ];
  var PREF = 'nfg-site';

  function toggleHTML() {
    return SITES.map(function (s) {
      return '<a href="' + s.href + '" data-site="' + s.code + '" aria-label="' + s.name + ' site"' +
        (s.current ? ' aria-current="true" class="mk-on"' : '') + '>' + s.code + '</a>';
    }).join('<span class="mk-sep" aria-hidden="true">|</span>');
  }
  function bindToggle(el) {
    el.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-site]');
      if (!a) return;
      try { localStorage.setItem(PREF, a.dataset.site); } catch (err) {}
    });
  }
  function addHeaderToggle() {
    var items = document.querySelectorAll('li[data-item-depth="0"]');
    if (!items.length) return;
    var last = items[items.length - 1];
    var li = last.cloneNode(true);
    li.classList.add('mk-toggle', 'mk-toggle--header');
    li.removeAttribute('aria-current');
    li.setAttribute('data-is-current', 'false');
    var box = li.querySelector('[data-testid="positionBox"]'); if (box) box.remove();
    // keep Wix's own link/label markup (it carries the menu typography), minus the link itself
    var a = li.querySelector('a');
    if (a) {
      var span = document.createElement('span');
      span.className = a.className;
      span.innerHTML = a.innerHTML;
      a.replaceWith(span);
    }
    var label = li.querySelector('[class*="label"]') || li.querySelector('span');
    label.innerHTML = toggleHTML();
    last.parentElement.appendChild(li);
    bindToggle(li);
  }
  function addFooterToggle() {
    var pp = [...document.querySelectorAll('a')].find(function (a) { return a.textContent.trim() === 'Privacy Policy'; });
    if (!pp) return;
    var block = pp.closest('p, h6, h5') || pp.parentElement;
    var wrap = document.createElement('span');
    wrap.className = 'mk-toggle mk-toggle--footer';
    wrap.innerHTML = toggleHTML();
    block.appendChild(document.createElement('br'));
    block.appendChild(document.createElement('br'));
    block.appendChild(wrap);
    bindToggle(wrap);
  }
  // Default by location: in production this is a geo/IP redirect at the edge.
  // For the mockup we approximate it with the visitor's timezone. It only applies
  // to someone arriving on the Swiss homepage with no saved choice, so direct
  // links (e.g. /dubai/) always open as sent and a manual switch always wins.
  function geoDefault() {
    var pref = null;
    try { pref = localStorage.getItem(PREF); } catch (err) {}
    if (pref || isDubai || swissRel !== 'index.html') return;
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (err) {}
    if (/^Asia\/(Dubai|Muscat)$/.test(tz) || /[?&]geo=dxb/i.test(location.search)) location.replace(SITES[1].href);
  }

  // ---- Office maps (replaces the Wix Google Maps embed) ----
  function initMaps() {
    var maps = document.querySelectorAll('.mk-map');
    if (!maps.length) return;
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = function () {
      maps.forEach(function (el) {
        var lat = +el.dataset.lat, lng = +el.dataset.lng;
        var map = L.map(el, { scrollWheelZoom: false, attributionControl: true }).setView([lat, lng], +el.dataset.zoom || 14);
        // Esri dark grey canvas: free to use without an API key
        var esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
        L.tileLayer(esri + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 16, attribution: 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
        }).addTo(map);
        L.tileLayer(esri + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(map);
        var icon = L.divIcon({
          className: 'mk-pin',
          html: '<svg viewBox="0 0 24 34" width="24" height="34"><path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 34 12 34s12-13.2 12-22.1C24 5.3 18.6 0 12 0z"/><circle cx="12" cy="12" r="4.2" fill="#fff" fill-opacity=".35"/></svg>',
          iconSize: [24, 34], iconAnchor: [12, 34], popupAnchor: [0, -30]
        });
        var dir = 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
        L.marker([lat, lng], { icon: icon }).addTo(map)
          .bindPopup('<strong>' + el.dataset.label + '</strong><br><a href="' + dir + '" target="_blank" rel="noopener">Directions</a>')
          .openPopup();
      });
    };
    document.head.appendChild(js);
  }

  // Accent text that lands on a dark background uses a lighter tint of the teal
  function tintOnDark() {
    if (!isDubai) return;
    var TEAL = getComputedStyle(document.documentElement).getPropertyValue('--mk-accent').trim().toLowerCase()
      .replace(/^#(..)(..)(..)$/, function (m, r, g, b) { return 'rgb(' + parseInt(r, 16) + ', ' + parseInt(g, 16) + ', ' + parseInt(b, 16) + ')'; });
    var lum = function (r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
    var imgLum = function (img) {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 12;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, 12, 12);
        var d = x.getImageData(0, 0, 12, 12).data, t = 0;
        for (var i = 0; i < d.length; i += 4) t += lum(d[i], d[i + 1], d[i + 2]);
        return t / (d.length / 4);
      } catch (e) { return 1; }
    };
    var bgOf = function (el) {
      for (var n = el; n && n !== document.documentElement; n = n.parentElement) {
        var layer = n.querySelector(':scope > [id^="bgLayers"], :scope > [id^="bgMedia"], :scope > .mk-example');
        var media = layer && layer.querySelector('img');
        if (media && media.complete && media.naturalWidth) return imgLum(media);
        if (layer) {
          var fill = [layer].concat([].slice.call(layer.querySelectorAll('*'))).map(function (x) {
            return getComputedStyle(x).backgroundColor.match(/[\d.]+/g);
          }).filter(function (m) { return m && (m[3] === undefined || +m[3] > 0.5); })[0];
          if (fill) return lum(+fill[0], +fill[1], +fill[2]);
        }
        var m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
        if (m && (m[3] === undefined || +m[3] > 0.5)) return lum(+m[0], +m[1], +m[2]);
      }
      return 1;
    };
    document.querySelectorAll('body *').forEach(function (el) {
      if (!el.firstChild || el.closest('.mk-map')) return;
      var hasText = [].some.call(el.childNodes, function (c) { return c.nodeType === 3 && c.nodeValue.trim(); });
      if (hasText && getComputedStyle(el).color === TEAL && bgOf(el) < 0.22) el.classList.add('mk-on-dark');
    });
  }

  // ---- Header scroll state: white bar, dark nav labels, colour logo ----
  // Wix toggles these two classes on scroll; its captured CSS does the rest.
  function wireHeaderScroll() {
    var header = document.querySelector('section.wixui-header');
    var navs = document.querySelectorAll('header nav.wixui-horizontal-menu, #SITE_HEADER nav.wixui-horizontal-menu');
    if (!header) return;
    // Pages that open with the white logo over a photo swap to the colour logo when scrolled
    var logos = [].slice.call(header.querySelectorAll('.wixui-vector-image')).filter(function (l) { return l.offsetWidth > 120; });
    var shown = logos.filter(function (l) { return getComputedStyle(l).visibility !== 'hidden'; });
    var hidden = logos.filter(function (l) { return getComputedStyle(l).visibility === 'hidden'; });
    var swapLogos = shown.length && hidden.length;
    var on = null;
    function update() {
      var scrolled = window.scrollY > 10;
      if (scrolled === on) return;
      on = scrolled;
      header.classList.toggle('aBo_xL', scrolled);
      navs.forEach(function (n) { n.classList.toggle('wixui-darken-text', scrolled); n.classList.toggle('darken-text', scrolled); });
      if (swapLogos) {
        shown.forEach(function (l) { l.style.setProperty('visibility', scrolled ? 'hidden' : 'visible', 'important'); });
        hidden.forEach(function (l) { l.style.setProperty('visibility', scrolled ? 'visible' : 'hidden', 'important'); });
      }
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function init() {
    geoDefault();
    wireHeaderScroll();
    addHeaderToggle();
    addFooterToggle();
    document.querySelectorAll('li[data-item-depth="0"]').forEach(wireDropdown);
    initMaps();
    if (document.readyState === 'complete') tintOnDark(); else window.addEventListener('load', tintOnDark);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
