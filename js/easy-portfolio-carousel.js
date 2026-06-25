/*
 * Easy Portfolio – Carousel (no external dependencies)
 *
 * Attiva un carousel orizzontale "full width" usando scroll + scroll-snap.
 * Si aggancia a:
 *   .easy-portfolio-slider.is-carousel
 *   oppure .easy-portfolio-slider[data-layout="carousel"]
 *
 * Richiede markup:
 *   .easy-portfolio-slider-wrapper (wrapper)
 *     .easy-portfolio-slider (track)
 *       .easy-portfolio-slide (item)
 *
 * Il plugin PHP aggiunge data-peek e, se fullwidth=1, la classe .is-fullwidth sul wrapper.
 */

(function () {
  'use strict';

  function toInt(value, fallback) {
    var n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function ensureStyles() {
    if (document.getElementById('easy-portfolio-carousel-inline-css')) return;

    var css = '';
    css += '.easy-portfolio-slider.is-carousel{display:flex;align-items:stretch;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:24px;scroll-behavior:smooth;cursor:grab;user-select:none;touch-action:pan-y;}';
    css += '.easy-portfolio-slider.is-carousel::-webkit-scrollbar{display:none;}';
    // Card base: width/height vengono gestiti via JS (Slick-like: slidesToShow)
    css += '.easy-portfolio-slider.is-carousel .easy-portfolio-slide{flex:0 0 auto;display:flex;flex-direction:column;scroll-snap-align:start;scroll-snap-stop:always;}';
    css += '.easy-portfolio-slider.is-carousel .easy-portfolio-slide .easy-portfolio-image, .easy-portfolio-slider.is-carousel .easy-portfolio-slide figure{margin:0;width:100%;overflow:hidden;display:block;}';
    css += '.easy-portfolio-slider.is-carousel .easy-portfolio-slide img{display:block;width:100%;height:100%;object-fit:cover;object-position:top;}';
    css += '.easy-portfolio-slider.is-carousel.is-dragging{cursor:grabbing;}';
    css += '.easy-portfolio-slider.is-carousel a,.easy-portfolio-slider.is-carousel button{user-select:auto;}';
    css += '.easy-portfolio-slider-wrapper{position:relative;}';
    css += '.easy-portfolio-carousel-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:5;display:flex;gap:12px;pointer-events:none;width:100%;justify-content:space-between;padding:0 16px;}';
    css += '.easy-portfolio-carousel-nav button{pointer-events:auto;cursor:pointer;border:0;border-radius:999px;padding:10px 12px;line-height:1;background:rgba(0,0,0,.55);color:#fff;}';
    css += '.easy-portfolio-carousel-nav button:disabled{opacity:.35;cursor:default;}';
    css += '.easy-portfolio-carousel-dots{display:flex;gap:8px;justify-content:center;align-items:center;margin-top:14px;}';
    css += '.easy-portfolio-carousel-dots button{width:8px;height:8px;border-radius:999px;border:0;background:rgba(0,0,0,.25);cursor:pointer;padding:0;}';
    css += '.easy-portfolio-carousel-dots button.is-active{background:rgba(0,0,0,.65);}';

    var style = document.createElement('style');
    style.id = 'easy-portfolio-carousel-inline-css';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function createNav(wrapper, onPrev, onNext) {
    var nav = document.createElement('div');
    nav.className = 'easy-portfolio-carousel-nav';

    var btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = 'easy-portfolio-carousel-prev';
    btnPrev.setAttribute('aria-label', 'Slide precedente');
    btnPrev.innerHTML = '‹';

    var btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'easy-portfolio-carousel-next';
    btnNext.setAttribute('aria-label', 'Slide successiva');
    btnNext.innerHTML = '›';

    btnPrev.addEventListener('click', onPrev);
    btnNext.addEventListener('click', onNext);

    nav.appendChild(btnPrev);
    nav.appendChild(btnNext);

    wrapper.appendChild(nav);

    return { nav: nav, prev: btnPrev, next: btnNext };
  }

  function getClosestIndex(track, slides) {
    // Trova la slide più vicina al centro visibile del track
    var trackRect = track.getBoundingClientRect();
    var centerX = trackRect.left + trackRect.width / 2;

    var bestIdx = 0;
    var bestDist = Infinity;

    for (var i = 0; i < slides.length; i++) {
      var r = slides[i].getBoundingClientRect();
      var c = r.left + r.width / 2;
      var d = Math.abs(c - centerX);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  function scrollToIndex(track, slides, idx) {
    idx = clamp(idx, 0, slides.length - 1);
    var target = slides[idx];
    if (!target) return;

    var trackRect = track.getBoundingClientRect();
    var targetRect = target.getBoundingClientRect();

    // Allinea la slide all'inizio (sinistra) del track
    var delta = (targetRect.left - trackRect.left);
    track.scrollTo({ left: track.scrollLeft + delta, behavior: 'smooth' });
  }

  function initCarousel(track) {
    if (!track || track.dataset.mlCarouselInit === '1') return;
    track.dataset.mlCarouselInit = '1';

    ensureStyles();

    // Normalizza classi / dataset
    track.classList.add('is-carousel');

    var wrapper = track.closest('.easy-portfolio-slider-wrapper');
    var slides = Array.prototype.slice.call(track.querySelectorAll('.easy-portfolio-slide'));
    if (!slides.length) return;

    var peek = toInt(track.getAttribute('data-peek'), 80);

    function getConfig() {
      var w = window.innerWidth || 1200;

      // Default desktop
      var cfg = { slidesToShow: 4, slidesToScroll: 4, infinite: false, dots: true, previewH: 320, gap: 24 };

      if (w < 480) {
        cfg = { slidesToShow: 1, slidesToScroll: 1, infinite: false, dots: true, previewH: 260, gap: 16 };
      } else if (w < 600) {
        cfg = { slidesToShow: 2, slidesToScroll: 2, infinite: false, dots: true, previewH: 260, gap: 16 };
      } else if (w < 1024) {
        cfg = { slidesToShow: 3, slidesToScroll: 3, infinite: true, dots: true, previewH: 290, gap: 20 };
      }

      return cfg;
    }

    // Setta larghezza slide (responsiva) come inline style per evitare dipendenze da CSS esterni
    function applySlideWidths() {
      var cfg = getConfig();

      // Imposta gap (così combacia con la matematica delle larghezze)
      track.style.gap = cfg.gap + 'px';

      var trackW = track.clientWidth;
      var n = Math.max(1, cfg.slidesToShow);

      // Larghezza card in px come Slick: (track - gap*(n-1)) / n
      var cardW = Math.floor((trackW - cfg.gap * (n - 1)) / n);
      cardW = clamp(cardW, 260, 520);

      slides.forEach(function (s) {
        s.style.width = cardW + 'px';
        s.style.maxWidth = wrapper && wrapper.classList.contains('is-fullwidth')
          ? 'calc(100vw - ' + (peek * 2) + 'px)'
          : '100%';

        var media = s.querySelector('.easy-portfolio-image, figure');
        if (media) {
          media.style.height = cfg.previewH + 'px';
        }

        var img = s.querySelector('img');
        if (img) {
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.objectPosition = 'top';
          img.style.display = 'block';
        }
      });

      // Mantieni il gruppo corrente dopo resize
      var idx = getClosestIndex(track, slides);
      scrollToIndex(track, slides, idx);
    }

    // Drag to scroll (desktop)
    var isDown = false;
    var startX = 0;
    var startLeft = 0;

    track.addEventListener('mousedown', function (e) {
      // Ignora click su link/bottoni (anche se clicchi su elementi figli)
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('a,button')) {
        return;
      }
      if (e.button !== 0) return; // solo tasto sinistro

      isDown = true;
      startX = e.pageX;
      startLeft = track.scrollLeft;
      track.classList.add('is-dragging');
    });

    function endDrag() {
      if (!isDown) return;
      isDown = false;
      track.classList.remove('is-dragging');

      // Snap alla slide più vicina quando si rilascia
      var idx = getClosestIndex(track, slides);
      scrollToIndex(track, slides, idx);
    }

    function onMove(e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX;
      var walk = (x - startX) * 1.1;
      track.scrollLeft = startLeft - walk;
    }

    // Rilascio ovunque (document)
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('mousemove', onMove);

    // Se esci dal track mentre trascini
    track.addEventListener('mouseleave', endDrag);

    // Touch: alla fine del touch, snap alla slide più vicina
    var touchTimeout = null;
    track.addEventListener('touchend', function () {
      if (touchTimeout) window.clearTimeout(touchTimeout);
      touchTimeout = window.setTimeout(function () {
        var idx = getClosestIndex(track, slides);
        scrollToIndex(track, slides, idx);
      }, 140);
    }, { passive: true });

    var state = { idx: 0 };
    var nav = null;

    var dotsEl = null;

    function getPages() {
      var cfg = getConfig();
      var step = Math.max(1, cfg.slidesToScroll);
      return Math.max(1, Math.ceil(slides.length / step));
    }

    function buildDots() {
      var cfg = getConfig();
      if (!wrapper || !cfg.dots) return;

      if (dotsEl) {
        dotsEl.remove();
        dotsEl = null;
      }

      dotsEl = document.createElement('div');
      dotsEl.className = 'easy-portfolio-carousel-dots';

      var pages = getPages();
      for (var p = 0; p < pages; p++) {
        (function (pageIndex) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Vai al gruppo ' + (pageIndex + 1));
          b.addEventListener('click', function () {
            var cfg2 = getConfig();
            var step = Math.max(1, cfg2.slidesToScroll);
            scrollToIndex(track, slides, pageIndex * step);
          });
          dotsEl.appendChild(b);
        })(p);
      }

      wrapper.appendChild(dotsEl);
    }

    function updateDots() {
      if (!dotsEl) return;
      var cfg = getConfig();
      var step = Math.max(1, cfg.slidesToScroll);
      var idx = getClosestIndex(track, slides);
      var page = Math.floor(idx / step);

      var btns = dotsEl.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('is-active', i === page);
      }
    }

    if (wrapper) {
      nav = createNav(
        wrapper,
        function () {
          var cfg = getConfig();
          var step = Math.max(1, cfg.slidesToScroll);
          state.idx = getClosestIndex(track, slides);

          var target = state.idx - step;
          if (cfg.infinite && target < 0) target = Math.max(0, slides.length - step);
          scrollToIndex(track, slides, target);
        },
        function () {
          var cfg = getConfig();
          var step = Math.max(1, cfg.slidesToScroll);
          state.idx = getClosestIndex(track, slides);

          var target = state.idx + step;
          if (cfg.infinite && target > slides.length - 1) target = 0;
          scrollToIndex(track, slides, target);
        }
      );
    }

    function updateNav() {
      if (!nav) return;
      var cfg = getConfig();

      if (cfg.infinite) {
        nav.prev.disabled = false;
        nav.next.disabled = false;
        return;
      }

      var idx = getClosestIndex(track, slides);
      nav.prev.disabled = idx <= 0;
      nav.next.disabled = idx >= slides.length - 1;
    }

    track.addEventListener('scroll', function () {
      // Throttle leggero con rAF
      window.requestAnimationFrame(function () {
        updateNav();
        updateDots();
      });
    }, { passive: true });

    // Prima init
    applySlideWidths();
    updateNav();
    buildDots();
    updateDots();

    // Re-init su resize
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        applySlideWidths();
        updateNav();
        buildDots();
        updateDots();
      }, 120);
    });
  }

  function boot() {
    var tracks = document.querySelectorAll('.easy-portfolio-slider.is-carousel, .easy-portfolio-slider[data-layout="carousel"]');
    if (!tracks || !tracks.length) return;
    for (var i = 0; i < tracks.length; i++) initCarousel(tracks[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();