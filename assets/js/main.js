/* ============================================================
   FORGEHAUS® — main.js
   Custom interaction engine: preloader, cursor, header, menu,
   marquees, reveal system, counters, drag gallery, forms.
   Written in vanilla JS — no frameworks, no build step.
   ============================================================ */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer  = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ============================================================
     1. PRELOADER — counts to 100 while assets stream in
     ============================================================ */
  const initPreloader = () => {
    const pre   = $("#preloader");
    const count = $("#preloader-count");
    const bar   = $("#preloader-bar");
    if (!pre) return finish();

    if (reduceMotion) { pre.remove(); return finish(); }

    const start = performance.now();
    const DURATION = 1400;                       // minimum on-screen time
    let done = false;

    const tick = (now) => {
      if (done) return;
      const t = Math.min((now - start) / DURATION, 1);
      // ease the counter so it "settles" at 100 like a real boot
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(eased * 100);
      count.textContent = String(val).padStart(3, "0");
      bar.style.width = val + "%";
      if (t < 1) requestAnimationFrame(tick);
      else {
        done = true;
        pre.classList.add("is-done");
        setTimeout(() => { pre.remove(); finish(); }, 950);
      }
    };
    requestAnimationFrame(tick);

    function finish() {
      document.body.removeAttribute("data-loading");
      document.body.classList.add("is-loaded");
    }
  };

  /* ============================================================
     2. CUSTOM CURSOR — dot + trailing ring, hover & drag states
     ============================================================ */
  const initCursor = () => {
    if (!finePointer || reduceMotion) return;
    const cursor = $("#cursor");
    const dot    = $("#cursor-dot");
    const ring   = $("#cursor-ring");
    const label  = $("#cursor-label");

    document.body.classList.add("cursor-on");

    const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    const pos   = { dot: { ...mouse }, ring: { ...mouse } };
    let visible = false;

    addEventListener("mousemove", (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (!visible) { visible = true; cursor.style.opacity = "1"; }
    }, { passive: true });
    document.addEventListener("mouseleave", () => { visible = false; cursor.style.opacity = "0"; });
    addEventListener("mousedown", () => cursor.classList.add("is-down"));
    addEventListener("mouseup",   () => cursor.classList.remove("is-down"));

    // state targets
    addEventListener("mouseover", (e) => {
      const t = e.target.closest("[data-cursor], a, button, input, textarea, label, .gcard");
      cursor.classList.toggle("is-hover", !!t && t.dataset?.cursor !== "drag");
      const drag = e.target.closest('[data-cursor="drag"]');
      cursor.classList.toggle("is-drag", !!drag);
      if (drag) label.textContent = "drag";
    }, { passive: true });

    const render = () => {
      pos.dot.x  = lerp(pos.dot.x,  mouse.x, 0.55);
      pos.dot.y  = lerp(pos.dot.y,  mouse.y, 0.55);
      pos.ring.x = lerp(pos.ring.x, mouse.x, 0.16);
      pos.ring.y = lerp(pos.ring.y, mouse.y, 0.16);
      dot.style.transform  = `translate(${pos.dot.x}px, ${pos.dot.y}px)`;
      ring.style.transform = `translate(${pos.ring.x}px, ${pos.ring.y}px)`;
      requestAnimationFrame(render);
    };
    cursor.style.opacity = "0";
    cursor.style.transition = "opacity .3s";
    render();
  };

  /* ============================================================
     3. HEADER — blur on scroll, hides on the way down,
        section-aware active link
     ============================================================ */
  const initHeader = () => {
    const header = $("#site-header");
    const links  = $$(".site-nav__link");
    const targets = links
      .map((l) => ({ link: l, sec: $(l.getAttribute("href")) }))
      .filter((x) => x.sec);

    let lastY = scrollY;
    const onScroll = () => {
      const y = scrollY;
      header.classList.toggle("is-scrolled", y > 24);
      header.classList.toggle("is-hidden", y > 320 && y > lastY);
      lastY = y;

      const probe = y + innerHeight * 0.35;
      let current = targets[0];
      for (const t of targets) if (t.sec.offsetTop <= probe) current = t;
      links.forEach((l) => l.classList.toggle("is-active", l === current.link));
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  };

  /* ============================================================
     4. MENU OVERLAY
     ============================================================ */
  const initMenu = () => {
    const burger  = $("#burger");
    const overlay = $("#menu-overlay");
    const toggle = (force) => {
      const open = force ?? !overlay.classList.contains("is-open");
      overlay.classList.toggle("is-open", open);
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      overlay.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", () => toggle());
    $$("[data-menu-close]").forEach((el) => el.addEventListener("click", () => toggle(false)));
    addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });
  };

  /* ============================================================
     5. MARQUEES — set duration once; subtle speed-up with scroll
     ============================================================ */
  const initMarquees = () => {
    if (reduceMotion) return;
    const tickers = $$("[data-marquee]");
    if (!tickers.length) return;

    // base duration from content width so every ticker moves at the same px/s
    const measure = () => tickers.forEach((tk) => {
      const speed = parseFloat(tk.dataset.marqueeSpeed || "1");
      const half = tk.querySelector(".ticker__track").scrollWidth / 2;
      tk.style.setProperty("--marquee-t", (half / (46 * speed)) + "s");
    });
    measure();
    addEventListener("resize", measure);

    // velocity kick: scrolling briefly boosts the marquee
    let boost = 1, lastY = scrollY;
    const loop = () => {
      const dy = Math.abs(scrollY - lastY);
      lastY = scrollY;
      boost = lerp(boost, 1 + Math.min(dy / 60, 2.2), 0.08);
      tickers.forEach((tk) => {
        tk.querySelector(".ticker__track").style.animationDuration =
          `calc(var(--marquee-t) / ${boost.toFixed(3)})`;
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  /* ============================================================
     6. REVEAL SYSTEM — IO + tiny stagger per group
     ============================================================ */
  const initReveals = () => {
    const els = $$("[data-reveal], [data-reveal-title], [data-media-reveal]");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in-view"));
      return;
    }
    // stagger siblings sharing a parent for a hand-timed feel
    const groups = new Map();
    els.forEach((el) => {
      const key = el.parentElement;
      const idx = groups.get(key) || 0;
      el.style.setProperty("--d", Math.min(idx * 0.08, 0.5) + "s");
      groups.set(key, idx + 1);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in-view"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach((el) => io.observe(el));
  };

  /* ============================================================
     7. COUNTERS
     ============================================================ */
  const initCounters = () => {
    const nums = $$("[data-counter]");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target;
        const target   = parseFloat(el.dataset.counterTarget || "0");
        const decimals = parseInt(el.dataset.counterDecimals || "0", 10);
        const pad      = parseInt(el.dataset.counterPad || "0", 10);
        const suffix   = el.dataset.counterSuffix || "";
        const t0 = performance.now();
        const D = 1600;
        const step = (now) => {
          const t = Math.min((now - t0) / D, 1);
          const eased = 1 - Math.pow(1 - t, 4);
          let out = (target * eased).toFixed(decimals);
          if (pad) out = out.padStart(pad, "0");
          el.textContent = out + suffix;
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    nums.forEach((n) => io.observe(n));
  };

  /* ============================================================
     8. DRAG GALLERY — pointer drag with momentum + edge clamp
     ============================================================ */
  const initGallery = () => {
    const wrap   = $("#gallery");
    const track  = $("#gallery-track");
    const progEl = $("#gallery-progress");
    if (!wrap) return;

    let x = 0, targetX = 0, startX = 0, startTarget = 0, down = false, moved = false;

    const maxScroll = () => Math.max(track.scrollWidth - wrap.clientWidth, 0);
    const clamp = () => { targetX = Math.min(Math.max(targetX, -maxScroll()), 0); };

    wrap.addEventListener("pointerdown", (e) => {
      down = true; moved = false;
      startX = e.clientX; startTarget = targetX;
      wrap.classList.add("is-dragging");
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 6) moved = true;
      targetX = startTarget + dx * 1.15;
      clamp();
    });
    const release = (e) => {
      if (!down) return;
      down = false;
      wrap.classList.remove("is-dragging");
      // momentum flick
      const dx = e.clientX - startX;
      targetX += dx * 0.14; clamp();
    };
    wrap.addEventListener("pointerup", release);
    wrap.addEventListener("pointercancel", release);

    // block accidental clicks after a real drag
    wrap.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);

    // wheel: horizontal intent scrolls the gallery, vertical stays natural
    wrap.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        targetX -= e.deltaX * 1.4; clamp();
      }
    }, { passive: false });

    const render = () => {
      x = lerp(x, targetX, 0.12);
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      const m = maxScroll();
      if (progEl && m) progEl.style.width = 12 + ((-x / m) * 88) + "%";
      requestAnimationFrame(render);
    };
    render();
    addEventListener("resize", clamp);
  };

  /* ============================================================
     9. MAGNETIC BUTTONS
     ============================================================ */
  const initMagnetic = () => {
    if (!finePointer || reduceMotion) return;
    $$("[data-magnetic]").forEach((el) => {
      const strength = 0.28;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${mx * strength}px, ${my * strength}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  };

  /* ============================================================
     10. FORMS — front-end validation + simulated async send
     ============================================================ */
  const initForms = () => {
    // newsletter
    const nl = $("#newsletter-form");
    if (nl) nl.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#newsletter-email");
      const box   = $("#newsletter-privacy");
      const msg   = $("#newsletter-msg");
      const fail = (txt) => { msg.textContent = txt; msg.classList.add("is-error"); };
      msg.classList.remove("is-error");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
        return fail("× please enter a valid email address.");
      if (!box.checked)
        return fail("× please accept the privacy policy first.");
      msg.textContent = "✓ you're on the list — first issue lands friday.";
      nl.reset();
    });

    // contact
    const cf = $("#contact-form");
    if (cf) cf.addEventListener("submit", (e) => {
      e.preventDefault();
      const status = $("#form-status");
      status.classList.remove("is-error");
      let valid = true;
      $$(".field__input", cf).forEach((inp) => {
        const bad = !inp.value.trim() || (inp.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim()));
        inp.closest(".field").classList.toggle("is-invalid", bad);
        if (bad) valid = false;
      });
      if (!valid) {
        status.textContent = "× a few fields still need attention.";
        status.classList.add("is-error");
        return;
      }
      const btn = $(".contact__send .btn__text", cf);
      btn.textContent = "Sending…";
      // demo stub — wire this to your endpoint / Formspree later
      setTimeout(() => {
        btn.textContent = "Send";
        cf.reset();
        status.textContent = "✓ message sent — we reply within 48 hours.";
      }, 900);
    });

    // clear invalid state as the user types
    $$(".field__input").forEach((inp) =>
      inp.addEventListener("input", () => inp.closest(".field")?.classList.remove("is-invalid")));
  };

  /* ============================================================
     11. FOOTER — live studio clock, year, back-to-top
     ============================================================ */
  const initFooter = () => {
    const timeEl = $("#studio-time");
    if (timeEl) {
      const fmt = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Europe/Berlin",
      });
      const tick = () => { timeEl.textContent = fmt.format(new Date()) + " — DÜSSELDORF, DE"; };
      tick(); setInterval(tick, 1000);
    }
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
    const top = $("#to-top");
    if (top) top.addEventListener("click", () =>
      scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
  };

  /* ---------- boot ---------- */
  const boot = () => {
    initPreloader();
    initCursor();
    initHeader();
    initMenu();
    initMarquees();
    initReveals();
    initCounters();
    initGallery();
    initMagnetic();
    initForms();
    initFooter();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
