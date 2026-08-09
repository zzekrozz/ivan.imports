(() => {
  "use strict";

  const config = window.IMPORTA_7_DIAS_CONFIG || {};
  const launchDeadline = new Date(config.launchEndsAt || "2026-08-16T23:59:59+02:00");
  const trackedDepths = new Set();
  let countdownTimer = null;
  let countdownExpiredTracked = false;

  function trackEvent(eventName, params = {}) {
    if (!eventName) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...params });
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
  }

  function isLaunchActive(now = new Date()) {
    return Boolean(config.launchBonus) && Number.isFinite(launchDeadline.getTime()) && now.getTime() <= launchDeadline.getTime();
  }

  function getRemaining(now = new Date()) {
    return Math.max(0, launchDeadline.getTime() - now.getTime());
  }

  function setLaunchState(active) {
    document.querySelectorAll("[data-launch-only]").forEach((element) => {
      element.hidden = !active;
    });

    const activeFaq = document.querySelector("[data-launch-faq-active]");
    const expiredFaq = document.querySelector("[data-launch-faq-expired]");
    if (activeFaq) activeFaq.hidden = !active;
    if (expiredFaq) expiredFaq.hidden = active;
  }

  function renderCountdown() {
    const active = isLaunchActive();
    setLaunchState(active);

    if (!active) {
      if (countdownTimer) window.clearInterval(countdownTimer);
      if (!countdownExpiredTracked) {
        countdownExpiredTracked = true;
        trackEvent("importa7_countdown_expired", { deadline: config.launchEndsAt });
      }
      return;
    }

    const remaining = getRemaining();
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const values = { days, hours, minutes, seconds };

    document.querySelectorAll("[data-countdown]").forEach((countdown) => {
      Object.entries(values).forEach(([unit, value]) => {
        const field = countdown.querySelector(`[data-${unit}]`);
        if (field) field.textContent = String(value).padStart(2, "0");
      });
    });
  }

  function initCountdown() {
    renderCountdown();
    if (isLaunchActive()) countdownTimer = window.setInterval(renderCountdown, 1000);
  }

  function checkoutUrlWithAttribution() {
    if (!config.checkoutUrl) return "";

    try {
      const checkout = new URL(config.checkoutUrl, window.location.origin);
      const current = new URLSearchParams(window.location.search);
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"].forEach((key) => {
        const value = current.get(key);
        if (value && !checkout.searchParams.has(key)) checkout.searchParams.set(key, value);
      });
      return checkout.toString();
    } catch (error) {
      return "";
    }
  }

  function initPurchaseCtas() {
    const checkoutUrl = checkoutUrlWithAttribution();
    const note = document.querySelector("[data-checkout-note]");

    document.querySelectorAll("[data-purchase-cta]").forEach((cta) => {
      const placement = cta.dataset.placement || "unknown";

      if (checkoutUrl) {
        cta.href = checkoutUrl;
        if (new URL(checkoutUrl).origin !== window.location.origin) {
          cta.rel = "noopener noreferrer";
        }
      } else {
        cta.href = "#comprar";
        cta.setAttribute("aria-describedby", "checkout-configuration-note");
      }

      cta.addEventListener("click", (event) => {
        trackEvent(`importa7_cta_${placement}`, {
          placement,
          price: config.price || 179,
          currency: config.currency || "EUR",
          page: window.location.pathname,
        });

        if (checkoutUrl) {
          trackEvent("importa7_begin_checkout", {
            placement,
            value: config.price || 179,
            currency: config.currency || "EUR",
          });
          return;
        }

        event.preventDefault();
        document.querySelector("#comprar")?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (note) {
          note.id = "checkout-configuration-note";
          note.hidden = false;
        }
      });
    });
  }

  function initReveal() {
    const elements = document.querySelectorAll(".reveal");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -4%" });

    elements.forEach((element) => observer.observe(element));
  }

  function initJourney() {
    const stages = document.querySelectorAll("[data-journey-stage]");
    if (!stages.length) return;

    const setActive = (id) => {
      document.querySelectorAll("[data-journey-link]").forEach((link) => {
        const active = link.dataset.journeyLink === id;
        link.classList.toggle("is-active", active);
        if (active && window.matchMedia("(max-width: 860px)").matches) {
          link.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      });
    };

    setActive(stages[0].id);
    if (!("IntersectionObserver" in window)) return;

    const visibleStages = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleStages.set(entry.target.id, entry.intersectionRatio);
        else visibleStages.delete(entry.target.id);
      });

      const current = [...visibleStages.entries()].sort((a, b) => b[1] - a[1])[0];
      if (current) setActive(current[0]);
    }, { threshold: [0.15, 0.3, 0.5, 0.7], rootMargin: "-15% 0px -45%" });

    stages.forEach((stage) => observer.observe(stage));
  }

  function initGallery() {
    const gallery = document.querySelector("[data-preview-gallery]");
    const dialog = document.querySelector("[data-preview-dialog]");
    if (!gallery) return;

    const scrollAmount = () => Math.min(gallery.clientWidth * 0.86, 430);
    document.querySelector("[data-gallery-prev]")?.addEventListener("click", () => {
      gallery.scrollBy({ left: -scrollAmount(), behavior: "smooth" });
    });
    document.querySelector("[data-gallery-next]")?.addEventListener("click", () => {
      gallery.scrollBy({ left: scrollAmount(), behavior: "smooth" });
    });

    if (!dialog) return;
    const dialogImage = dialog.querySelector("[data-preview-dialog-image]");
    const dialogTitle = dialog.querySelector("[data-preview-dialog-title]");

    gallery.querySelectorAll("[data-preview-src]").forEach((button) => {
      button.addEventListener("click", () => {
        const source = button.dataset.previewSrc;
        const title = button.dataset.previewTitle || "Vista de la guía";
        if (dialogImage) {
          dialogImage.src = source;
          dialogImage.alt = `Vista ampliada: ${title}`;
        }
        if (dialogTitle) dialogTitle.textContent = title;
        trackEvent("importa7_preview_open", { preview: title, source });

        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      });
    });

    const closeDialog = () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
    dialog.querySelector("[data-preview-close]")?.addEventListener("click", closeDialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
  }

  function initFaqTracking() {
    document.querySelectorAll(".faq-list details").forEach((details) => {
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        const question = details.querySelector("summary")?.textContent.trim() || "";
        trackEvent("importa7_faq_open", { question });
      });
    });
  }

  function initVideo() {
    const section = document.querySelector("[data-video-section]");
    if (!section || !config.videoUrl) return;

    section.hidden = false;
    const poster = section.querySelector("[data-video-poster]");
    const posterButton = section.querySelector("[data-video-play]");
    const frame = section.querySelector("[data-video-frame]");
    if (poster && config.videoPoster) poster.src = config.videoPoster;
    if (!config.videoPoster) poster?.remove();

    posterButton?.addEventListener("click", () => {
      if (!frame || frame.childElementCount) return;
      const videoUrl = String(config.videoUrl);
      const youtubeMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);

      if (youtubeMatch) {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}?autoplay=1`;
        iframe.title = "Ivan explica cómo funciona Importa tu coche en 7 días";
        iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        frame.appendChild(iframe);
      } else {
        const video = document.createElement("video");
        video.src = videoUrl;
        video.controls = true;
        video.preload = "metadata";
        if (config.videoPoster) video.poster = config.videoPoster;
        frame.appendChild(video);
        video.play().catch(() => {});
      }

      posterButton.hidden = true;
      trackEvent("importa7_video_play", { source: videoUrl });
    });
  }

  function initConfigLinks() {
    document.querySelectorAll("[data-social-link]").forEach((link) => {
      const url = config.social?.[link.dataset.socialLink];
      if (!url) return;
      link.href = url;
      link.hidden = false;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });

    let legalLinksVisible = false;
    document.querySelectorAll("[data-legal-link]").forEach((link) => {
      const url = config.legal?.[link.dataset.legalLink];
      if (!url) return;
      link.href = url;
      link.hidden = false;
      legalLinksVisible = true;
    });

    const legalGroup = document.querySelector("[data-legal-links]");
    if (legalGroup) legalGroup.hidden = !legalLinksVisible;

    const purchaseTerms = config.legal?.purchaseTerms;
    const legalFaq = document.querySelector("[data-legal-faq]");
    if (legalFaq) legalFaq.hidden = !purchaseTerms;
  }

  function initReadingProgress() {
    const bar = document.querySelector("[data-reading-progress]");
    let ticking = false;

    const update = () => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const percent = Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100));
      if (bar) bar.style.width = `${percent}%`;

      [25, 50, 75, 90].forEach((depth) => {
        if (percent < depth || trackedDepths.has(depth)) return;
        trackedDepths.add(depth);
        trackEvent(`importa7_scroll_${depth}`, { percent: depth });
      });
      ticking = false;
    };

    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function initMobilePurchase() {
    const sticky = document.querySelector("[data-mobile-purchase]");
    const hero = document.querySelector(".course-hero");
    const price = document.querySelector(".price-section");
    const footer = document.querySelector("[data-course-footer]");
    if (!sticky || !hero) return;

    sticky.hidden = false;
    const state = { heroVisible: true, priceVisible: false, footerVisible: false };
    const render = () => {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      sticky.classList.toggle("is-visible", isMobile && !state.heroVisible && !state.priceVisible && !state.footerVisible);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.target === hero) state.heroVisible = entry.isIntersecting;
          if (entry.target === price) state.priceVisible = entry.isIntersecting;
          if (entry.target === footer) state.footerVisible = entry.isIntersecting;
        });
        render();
      }, { threshold: 0.04 });
      [hero, price, footer].filter(Boolean).forEach((element) => observer.observe(element));
    }

    window.addEventListener("resize", render, { passive: true });
    render();
  }

  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  initCountdown();
  initPurchaseCtas();
  initReveal();
  initJourney();
  initGallery();
  initFaqTracking();
  initVideo();
  initConfigLinks();
  initReadingProgress();
  initMobilePurchase();

  trackEvent("importa7_view", {
    price: config.price || 179,
    currency: config.currency || "EUR",
    launch_active: isLaunchActive(),
  });

  Object.defineProperty(window, "IMPORTA_7_DIAS_TEST", {
    value: Object.freeze({ isLaunchActive, getRemaining }),
    configurable: false,
    enumerable: false,
    writable: false,
  });
})();
