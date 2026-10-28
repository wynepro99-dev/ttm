/* Interaksi halaman: smooth scroll, transisi antar-section, galeri, lightbox, form. */

(() => {
  const TTM = (window.TTM = window.TTM || { explode: 0, introStart: 0, active: true });
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const WA_NUMBER = '6281283212599';
  const EMAIL = 'talentateknikmandiri@gmail.com';
  TTM.reduced = reduced;

  const year = new Date().getFullYear();
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = year));
  document.querySelectorAll('[data-years]').forEach((el) => (el.textContent = year - 2012));

  splitWords();
  setupForm();

  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  let lenis = null;
  let galleryST = null;
  let menuOpen = false;

  if (!hasGsap) {
    document.querySelector('.preloader')?.remove();
    root.classList.add('is-loaded');
    TTM.introStart = performance.now();
    setupMenu();
    setupAnchors();
    setupLightbox();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  setupMenu();
  setupAnchors();
  setupLightbox();
  setupPreloader();
  setupScrollScenes();
  setupNav(); // setelah pin dibuat, supaya posisi trigger-nya ikut memperhitungkan pin
  setupMarquee();
  setupServicePreview();
  setupTilt();

  /* ---------- Helpers ---------- */

  function scrollToTarget(target, opts = {}) {
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
      return;
    }
    const top = typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY + (opts.offset || 0);
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  }

  // Bungkus tiap kata supaya bisa dianimasikan muncul dari balik garis
  function splitWords() {
    document.querySelectorAll('[data-split]').forEach((el) => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      el.setAttribute('aria-label', text);
      el.textContent = '';
      text.split(' ').forEach((word, i, all) => {
        const outer = document.createElement('span');
        const inner = document.createElement('span');
        outer.className = 'w';
        inner.className = 'wi';
        outer.setAttribute('aria-hidden', 'true');
        inner.textContent = word;
        outer.appendChild(inner);
        el.appendChild(outer);
        if (i < all.length - 1) el.appendChild(document.createTextNode(' '));
      });
    });
  }

  /* ---------- Preloader & intro ---------- */

  function setupPreloader() {
    const pre = document.querySelector('.preloader');
    const bar = pre?.querySelector('.preloader__bar i');
    const prog = { v: 0 };
    const paint = () => bar && (bar.style.transform = `scaleX(${prog.v})`);
    const crawl = gsap.to(prog, { v: 0.85, duration: 2.6, ease: 'power2.out', onUpdate: paint });

    const sceneReady = new Promise((resolve) => {
      if (TTM.ready) return resolve();
      window.addEventListener('ttm:scene-ready', resolve, { once: true });
      setTimeout(resolve, 2500); // jangan tahan halaman terlalu lama; die set menyusul saat siap
    });
    const fontsReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    const minTime = new Promise((r) => setTimeout(r, reduced ? 0 : 900));

    Promise.all([sceneReady, fontsReady, minTime]).then(() => {
      crawl.kill();
      gsap.to(prog, { v: 1, duration: 0.35, ease: 'power2.inOut', onUpdate: paint, onComplete: reveal });
    });

    function reveal() {
      root.classList.add('is-loaded');
      TTM.introStart = performance.now();
      const tl = gsap.timeline({
        onComplete: () => {
          pre?.remove();
          lenis?.start();
          ScrollTrigger.refresh();
        },
      });

      if (reduced) {
        if (pre) tl.to(pre, { autoAlpha: 0, duration: 0.2 });
        return;
      }

      if (pre) {
        // Tirai keluar dengan sisi bawah miring, mengikuti bidang diagonal di company profile
        const edge = { l: 100, r: 100 };
        const clip = () => (pre.style.clipPath = `polygon(0 0, 100% 0, 100% ${edge.r}%, 0 ${edge.l}%)`);
        tl.to(pre.querySelector('.preloader__inner'), { autoAlpha: 0, y: -24, duration: 0.45, ease: 'power2.in' })
          .to(edge, { r: 0, duration: 1.05, ease: 'expo.inOut', onUpdate: clip }, '-=0.1')
          .to(edge, { l: 0, duration: 1.05, ease: 'expo.inOut', onUpdate: clip }, '<0.16');
      }

      tl.from('.hero h1 .wi', { yPercent: 110, duration: 1.15, ease: 'expo.out', stagger: 0.045 }, pre ? '-=0.7' : 0)
        .from('.hero__lead, .hero__actions, .hero__foot', { autoAlpha: 0, y: 26, duration: 0.9, ease: 'power3.out', stagger: 0.08 }, '-=0.85')
        .from('.nav__inner', { yPercent: -100, autoAlpha: 0, duration: 0.8, ease: 'power3.out' }, '<');
    }
  }

  /* ---------- Navigation ---------- */

  function setupNav() {
    const nav = document.querySelector('.nav');
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate(self) {
        const y = self.scroll();
        nav.classList.toggle('is-solid', y > 40);
        nav.classList.toggle('is-hidden', self.direction === 1 && y > 500 && !menuOpen);
      },
    });

    document.querySelectorAll('.nav__links a').forEach((link) => {
      const section = document.querySelector(link.getAttribute('href'));
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: (self) => link.classList.toggle('is-active', self.isActive),
      });
    });
  }

  function setupMenu() {
    const btn = document.querySelector('.nav__toggle');
    const menu = document.getElementById('menu');
    const label = btn?.querySelector('.nav__toggle-label');
    if (!btn || !menu) return;
    const anim = !!window.gsap && !reduced;

    const open = () => {
      menuOpen = true;
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      if (label) label.textContent = 'Tutup';
      root.classList.add('menu-open');
      lenis?.stop();
      if (anim) {
        gsap.fromTo(menu, { clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' }, { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 0.8, ease: 'expo.out' });
        gsap.fromTo(menu.querySelectorAll('.menu__link'), { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: 'expo.out', stagger: 0.05, delay: 0.1 });
      }
      menu.querySelector('a')?.focus({ preventScroll: true });
    };

    const close = (instant) => {
      if (!menuOpen) return;
      menuOpen = false;
      btn.setAttribute('aria-expanded', 'false');
      if (label) label.textContent = 'Menu';
      root.classList.remove('menu-open');
      lenis?.start();
      if (anim && !instant) {
        gsap.to(menu, { clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)', duration: 0.55, ease: 'expo.in', onComplete: () => (menu.hidden = true) });
      } else {
        menu.hidden = true;
      }
    };

    btn.addEventListener('click', () => (menuOpen ? close() : open()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) {
        close();
        btn.focus();
      }
    });
    window.closeMenu = close;
  }

  function setupAnchors() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute('href');
      const target = id.length > 1 && document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (menuOpen) window.closeMenu?.(true);
      if (link.dataset.panel) goToPanel(target);
      else scrollToTarget(id === '#top' ? 0 : target);
    });
    document.querySelector('.footer__top')?.addEventListener('click', () => scrollToTarget(0));
  }

  // Lompat ke panel kategori di galeri (scroll horizontal di desktop, geser di ponsel)
  function goToPanel(panel) {
    const track = document.querySelector('.gallery__track');
    if (galleryST && track) {
      const total = track.scrollWidth - window.innerWidth;
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const progress = Math.min(1, Math.max(0, (panel.offsetLeft - pad) / total));
      scrollToTarget(galleryST.start + progress * (galleryST.end - galleryST.start) + 2, { duration: 2 });
      return;
    }
    const viewport = document.querySelector('.gallery__viewport');
    scrollToTarget(document.querySelector('.gallery__head'), { offset: -90 });
    viewport?.scrollTo({ left: panel.offsetLeft - (parseFloat(getComputedStyle(track).paddingLeft) || 0), behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ---------- Scroll scenes ---------- */

  function setupScrollScenes() {
    const mm = gsap.matchMedia();

    mm.add({ desktop: '(min-width: 900px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
      const { desktop, motion } = ctx.conditions;
      if (!motion) return;

      // Hero: die set dibongkar saat di-scroll
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '.hero', start: 'top top', end: desktop ? '+=170%' : '+=130%', pin: true, scrub: 0.8, anticipatePin: 1 },
      })
        .to('.hero__copy', { yPercent: -14, autoAlpha: 0, duration: 0.25 }, 0)
        .to('.hero__foot', { autoAlpha: 0, duration: 0.12 }, 0)
        .to(TTM, { explode: 1, duration: 0.55, ease: 'power2.inOut' }, 0.05)
        .fromTo('.hero__caption', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.42)
        .to({}, { duration: 0.25 });

      const gallery = desktop ? setupGalleryPin() : null;
      galleryST = gallery?.st || null;

      return () => {
        TTM.explode = 0;
        galleryST = null;
        gallery?.cleanup();
      };
    });

    // Render 3D hanya saat hero masih terlihat
    ScrollTrigger.create({
      trigger: '#tentang',
      start: 'top top',
      onEnter: () => (TTM.active = false),
      onLeaveBack: () => (TTM.active = true),
    });

    if (reduced) return;

    // Garis diagonal antar-section perlahan rata saat section masuk layar
    gsap.utils.toArray('.slant').forEach((sec) => {
      const right = sec.dataset.slant === 'r';
      const s = { v: 1 };
      const paint = () => {
        if (s.v <= 0.001) {
          sec.style.clipPath = 'none';
          return;
        }
        const d = `${(s.v * 7).toFixed(3)}vw`;
        sec.style.clipPath = right ? `polygon(0 0, 100% ${d}, 100% 100%, 0 100%)` : `polygon(0 ${d}, 100% 0, 100% 100%, 0 100%)`;
      };
      gsap.to(s, { v: 0, ease: 'none', onUpdate: paint, scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 20%', scrub: true } });
    });

    gsap.utils.toArray('[data-split]').forEach((el) => {
      if (el.closest('.hero') || el.dataset.split === 'fill') return;
      gsap.from(el.querySelectorAll('.wi'), {
        yPercent: 110,
        duration: 1.15,
        ease: 'expo.out',
        stagger: 0.04,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      const img = el.querySelector('img');
      gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } })
        .fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.4, ease: 'expo.inOut' })
        .from(img, { scale: 1.3, duration: 1.8, ease: 'expo.out' }, '<0.15');
    });

    const aboutImg = document.querySelector('.about__media img');
    if (aboutImg) {
      gsap.fromTo(aboutImg, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.about__media', start: 'top bottom', end: 'bottom top', scrub: true } });
    }

    // Visi: kata menyala satu per satu mengikuti scroll
    const quoteWords = document.querySelectorAll('.vision__quote .wi');
    gsap.fromTo(quoteWords, { opacity: 0.16 }, {
      opacity: 1,
      ease: 'none',
      stagger: 0.1,
      scrollTrigger: { trigger: '.vision__quote', start: 'top 82%', end: 'bottom 45%', scrub: true },
    });

    gsap.from('.mission li', {
      y: 40, autoAlpha: 0, duration: 1, ease: 'power3.out', stagger: 0.1,
      scrollTrigger: { trigger: '.mission', start: 'top 85%', once: true },
    });

    gsap.from('.client', {
      xPercent: 6, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06,
      scrollTrigger: { trigger: '.client-list', start: 'top 85%', once: true },
    });
  }

  function setupGalleryPin() {
    const pin = document.querySelector('.gallery__pin');
    const track = document.querySelector('.gallery__track');
    const bar = document.querySelector('.gallery__progress i');
    const figs = gsap.utils.toArray('.gpanel__grid figure');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);

    gsap.set(figs, { transformPerspective: 1100 });
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: () => `+=${dist() * 0.8}`,
        pin: true,
        scrub: 0.9,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => bar && (bar.style.transform = `scaleX(${self.progress})`),
      },
    });

    // Foto sedikit berputar di sumbu Y sesuai posisinya terhadap tengah layar
    const tilt = () => {
      if (!tween.scrollTrigger?.isActive) return;
      const vw = window.innerWidth;
      for (const f of figs) {
        const r = f.getBoundingClientRect();
        if (r.right < -200 || r.left > vw + 200) continue;
        const c = (r.left + r.width / 2) / vw - 0.5;
        gsap.set(f, { rotationY: gsap.utils.clamp(-16, 16, -c * 26), z: -Math.abs(c) * 90 });
      }
    };
    gsap.ticker.add(tilt);
    return {
      st: tween.scrollTrigger,
      cleanup: () => {
        gsap.ticker.remove(tilt);
        gsap.set(figs, { clearProps: 'transform' });
      },
    };
  }

  /* ---------- Marquee ---------- */

  function setupMarquee() {
    const track = document.querySelector('.band__track');
    if (!track || reduced) return;
    const loop = gsap.to(track, { xPercent: -50, duration: 34, ease: 'none', repeat: -1 });
    loop.totalTime(loop.duration() * 500);
    let target = 1;
    let current = 1;
    ScrollTrigger.create({
      onUpdate: (self) => (target = self.direction * (1 + Math.min(Math.abs(self.getVelocity()) / 280, 5))),
    });
    gsap.ticker.add(() => {
      const base = Math.sign(target) || 1;
      target += (base - target) * 0.05;
      current += (target - current) * 0.12;
      loop.timeScale(current);
    });
  }

  /* ---------- Services: preview foto mengikuti kursor ---------- */

  function setupServicePreview() {
    const preview = document.querySelector('.svc-preview');
    const list = document.querySelector('.svc-list');
    if (!preview || !list || !finePointer || reduced) return;
    const imgs = preview.querySelectorAll('img');
    gsap.set(preview, { xPercent: -50, yPercent: -55 });
    const xTo = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
    const rTo = gsap.quickTo(preview, 'rotation', { duration: 0.9, ease: 'power3' });
    let lastX = 0;
    let placed = false;

    list.addEventListener('pointermove', (e) => {
      if (!placed) {
        gsap.set(preview, { x: e.clientX, y: e.clientY });
        lastX = e.clientX;
        placed = true;
      }
      xTo(e.clientX);
      yTo(e.clientY);
      rTo(gsap.utils.clamp(-9, 9, (e.clientX - lastX) * 0.5));
      lastX = e.clientX;
    });
    list.querySelectorAll('.svc').forEach((row, i) => {
      row.addEventListener('pointerenter', () => {
        preview.classList.add('is-on');
        imgs.forEach((img, j) => img.classList.toggle('is-active', i === j));
      });
    });
    list.addEventListener('pointerleave', () => {
      preview.classList.remove('is-on');
      placed = false;
    });
  }

  /* ---------- Kartu mesin miring mengikuti kursor ---------- */

  function setupTilt() {
    if (!finePointer || reduced) return;
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      gsap.set(el, { transformPerspective: 900 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 9);
        rx((0.5 - py) * 9);
        el.style.setProperty('--gx', `${px * 100}%`);
        el.style.setProperty('--gy', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => {
        rx(0);
        ry(0);
      });
    });
  }

  /* ---------- Lightbox ---------- */

  function setupLightbox() {
    const lb = document.querySelector('.lightbox');
    if (!lb) return;
    const img = lb.querySelector('img');
    const cap = lb.querySelector('.lightbox__cap');
    const closeBtn = lb.querySelector('.lightbox__close');
    const buttons = [...lb.querySelectorAll('button')];
    const figs = [...document.querySelectorAll('.gpanel__grid figure')];
    let index = 0;
    let opener = null;

    const show = (i) => {
      index = (i + figs.length) % figs.length;
      const fig = figs[index];
      const thumb = fig.querySelector('img');
      const siblings = figs.filter((f) => f.dataset.cat === fig.dataset.cat);
      img.src = thumb.currentSrc || thumb.src;
      img.alt = thumb.alt;
      img.style.width = `${Math.min(thumb.naturalWidth * 1.8 || 600, window.innerWidth * 0.92)}px`;
      cap.textContent = `${fig.dataset.cat}, foto ${siblings.indexOf(fig) + 1} dari ${siblings.length}. ${thumb.alt}.`;
    };

    const open = (i) => {
      opener = document.activeElement;
      show(i);
      lb.hidden = false;
      lenis?.stop();
      closeBtn.focus({ preventScroll: true });
      if (!window.gsap || reduced) return;
      const from = figs[i].getBoundingClientRect();
      gsap.fromTo(lb, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power2.out' });
      requestAnimationFrame(() => {
        const to = img.getBoundingClientRect();
        if (!to.width) return;
        gsap.from(img, {
          x: from.left + from.width / 2 - (to.left + to.width / 2),
          y: from.top + from.height / 2 - (to.top + to.height / 2),
          scale: from.width / to.width,
          duration: 0.9,
          ease: 'expo.out',
          clearProps: 'transform',
        });
      });
    };

    const close = () => {
      const done = () => {
        lb.hidden = true;
        lenis?.start();
        opener?.focus({ preventScroll: true });
      };
      if (window.gsap && !reduced) gsap.to(lb, { autoAlpha: 0, duration: 0.3, ease: 'power2.in', onComplete: done });
      else done();
    };

    const step = (d) => {
      show(index + d);
      if (window.gsap && !reduced) gsap.fromTo(img, { autoAlpha: 0, x: d * 40 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' });
    };

    figs.forEach((fig, i) => fig.querySelector('button')?.addEventListener('click', () => open(i)));
    closeBtn.addEventListener('click', close);
    lb.querySelector('.lightbox__prev').addEventListener('click', () => step(-1));
    lb.querySelector('.lightbox__next').addEventListener('click', () => step(1));
    lb.addEventListener('click', (e) => e.target === lb && close());
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Tab') {
        const at = buttons.indexOf(document.activeElement);
        const next = (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
        e.preventDefault();
        buttons[next].focus();
      }
    });
  }

  /* ---------- Form: susun pesan lalu buka WhatsApp atau email ---------- */

  function setupForm() {
    const form = document.querySelector('.cform');
    if (!form) return;
    const status = form.querySelector('.cform__status');

    form.addEventListener('input', (e) => {
      if (e.target.matches('[aria-invalid="true"]') && e.target.checkValidity()) e.target.removeAttribute('aria-invalid');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const invalid = [...form.querySelectorAll('[required]')].filter((f) => !f.value.trim());
      form.querySelectorAll('[required]').forEach((f) => f.toggleAttribute('aria-invalid', invalid.includes(f)));
      if (invalid.length) {
        const names = invalid.map((f) => form.querySelector(`label[for="${f.id}"]`).textContent.toLowerCase());
        status.textContent = `Lengkapi ${names.join(', ')} dulu sebelum mengirim.`;
        status.classList.add('is-error');
        invalid[0].focus();
        return;
      }
      status.classList.remove('is-error');

      const d = new FormData(form);
      const company = d.get('perusahaan').trim();
      const text = [
        `Halo PT Talenta Teknik Mandiri, saya ${d.get('nama').trim()}${company ? ` dari ${company}` : ''}.`,
        `Jenis pekerjaan: ${d.get('kebutuhan')}`,
        '',
        d.get('pesan').trim(),
      ].join('\n');

      if (e.submitter?.value === 'email') {
        const subject = `Permintaan penawaran: ${d.get('kebutuhan')}`;
        window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        status.textContent = 'Aplikasi email Anda terbuka dengan pesan yang sudah terisi. Kirim dari sana.';
      } else {
        window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        status.textContent = 'WhatsApp terbuka di tab baru dengan pesan yang sudah terisi. Tekan kirim di sana.';
      }
    });
  }
})();
