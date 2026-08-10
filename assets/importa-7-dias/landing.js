(() => {
  "use strict";

  const config = window.IMPORTA_7_DIAS_CONFIG || {};
  const launchDeadline = new Date(config.launchEndsAt || "2026-08-16T23:59:59+02:00");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const trackedDepths = new Set();
  let countdownTimer = null;
  let countdownExpiredTracked = false;

  function trackEvent(eventName, params = {}) {
    if (!eventName) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...params });
    if (typeof window.gtag === "function") window.gtag("event", eventName, params);
  }

  function isLaunchActive(now = new Date()) {
    return Boolean(config.launchBonus) && Number.isFinite(launchDeadline.getTime()) && now.getTime() <= launchDeadline.getTime();
  }

  function getRemaining(now = new Date()) {
    return Math.max(0, launchDeadline.getTime() - now.getTime());
  }

  function setLaunchState(active) {
    document.body.classList.toggle("launch-active", active);
    document.body.classList.toggle("launch-expired", !active);
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
    const values = {
      days: Math.floor(remaining / 86400000),
      hours: Math.floor((remaining % 86400000) / 3600000),
      minutes: Math.floor((remaining % 3600000) / 60000),
      seconds: Math.floor((remaining % 60000) / 1000),
    };

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
    if (!config.checkoutEnabled || !config.checkoutUrl) return "";

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
        if (new URL(checkoutUrl).origin !== window.location.origin) cta.rel = "noopener noreferrer";
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
          trackEvent("importa7_checkout_click", { placement, value: config.price || 179, currency: config.currency || "EUR" });
          trackEvent("importa7_begin_checkout", { placement, value: config.price || 179, currency: config.currency || "EUR" });
          return;
        }

        event.preventDefault();
        document.querySelector("#comprar")?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
        if (note) note.hidden = false;
      });
    });
  }

  function initHeader() {
    const header = document.querySelector("[data-course-header]");
    if (!header) return;
    let ticking = false;

    const render = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
      ticking = false;
    };

    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(render);
    }, { passive: true });
    render();
  }

  function initReveal() {
    const elements = document.querySelectorAll(".reveal");
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -5%" });

    elements.forEach((element) => observer.observe(element));
  }

  function initProgressScenes() {
    const targets = [
      [document.querySelector("[data-system-console]"), "is-aligned"],
      [document.querySelector("[data-route-section]"), "is-drawn"],
      [document.querySelector("[data-method-timeline]"), "is-drawn"],
    ].filter(([element]) => element);

    if (!("IntersectionObserver" in window) || reducedMotion.matches) {
      targets.forEach(([element, className]) => element.classList.add(className));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = targets.find(([element]) => element === entry.target);
        if (target) entry.target.classList.add(target[1]);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.28 });

    targets.forEach(([element]) => observer.observe(element));
  }

  function initJourney() {
    const component = document.querySelector("[data-journey-component]");
    if (!component) return;

    const explorer = component.querySelector("[data-journey-explorer]");
    const stages = [...component.querySelectorAll("[data-journey-stage]")];
    const stageLinks = [...component.querySelectorAll("[data-journey-link]")];
    const phaseLinks = [...component.querySelectorAll("[data-phase-link]")];
    const externalLinks = [...document.querySelectorAll('.route-map [href^="#etapa-"]')];
    const prev = component.querySelector("[data-stage-prev]");
    const next = component.querySelector("[data-stage-next]");
    const current = component.querySelector("[data-stage-current]");
    const progress = component.querySelector("[data-stage-progress]");
    const live = component.querySelector("[data-stage-live]");
    const journeyList = component.querySelector(".journey-nav ol");
    if (!stages.length) return;

    const ids = stages.map((stage) => stage.id);
    let activeId = ids.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : ids[0];

    const centerStageLink = (link) => {
      if (!journeyList || !link) return;
      const itemRect = link.getBoundingClientRect();
      const listRect = journeyList.getBoundingClientRect();
      const left = journeyList.scrollLeft + itemRect.left - listRect.left - (listRect.width - itemRect.width) / 2;
      journeyList.scrollTo({ left: Math.max(0, left), behavior: reducedMotion.matches ? "auto" : "smooth" });
    };

    const activate = (id, { updateHistory = false, scroll = false, focusHeading = false, source = "unknown", track = false } = {}) => {
      const index = ids.indexOf(id);
      if (index < 0) return;
      activeId = id;
      const activeStage = stages[index];
      const phase = activeStage.dataset.phase;

      stages.forEach((stage) => {
        const active = stage.id === id;
        stage.classList.toggle("is-active", active);
        stage.setAttribute("aria-hidden", String(!active));
        if (active) stage.removeAttribute("inert");
        else stage.setAttribute("inert", "");
      });

      let selectedLink = null;
      stageLinks.forEach((link) => {
        const active = link.dataset.journeyLink === id;
        link.classList.toggle("is-active", active);
        if (active) {
          link.setAttribute("aria-current", "step");
          selectedLink = link;
        } else {
          link.removeAttribute("aria-current");
        }
      });

      phaseLinks.forEach((link) => {
        const active = link.dataset.phaseLink === phase;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });

      if (current) current.textContent = String(index + 1).padStart(2, "0");
      if (progress) progress.style.width = `${((index + 1) / ids.length) * 100}%`;
      if (live) live.textContent = `Etapa ${index + 1} de ${ids.length}: ${activeStage.querySelector("h3")?.textContent || ""}`;
      if (prev) prev.disabled = index === 0;
      if (next) next.disabled = index === ids.length - 1;
      centerStageLink(selectedLink);

      if (updateHistory && window.location.hash !== `#${id}`) window.history.pushState({ journey: id }, "", `#${id}`);
      if (scroll) explorer?.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
      if (focusHeading) activeStage.querySelector("h3")?.focus({ preventScroll: true });
      if (track) trackEvent("importa7_journey_stage_select", { stage_id: id, source });
    };

    const bindLink = (link, id, source, phaseEvent = false) => {
      link.addEventListener("click", (event) => {
        if (!ids.includes(id)) return;
        event.preventDefault();
        activate(id, { updateHistory: true, scroll: true, source, track: true });
        if (phaseEvent) trackEvent("importa7_journey_phase_select", { phase_id: document.getElementById(id)?.dataset.phase || "", target_stage: id });
      });
    };

    stageLinks.forEach((link) => bindLink(link, link.dataset.journeyLink, "journey_nav"));
    phaseLinks.forEach((link) => bindLink(link, link.dataset.stageTarget, "journey_phase", true));
    externalLinks.forEach((link) => bindLink(link, link.getAttribute("href").slice(1), "route_map"));

    prev?.addEventListener("click", () => {
      const index = ids.indexOf(activeId);
      if (index > 0) activate(ids[index - 1], { updateHistory: true, focusHeading: true, source: "journey_previous", track: true });
    });

    next?.addEventListener("click", () => {
      const index = ids.indexOf(activeId);
      if (index < ids.length - 1) activate(ids[index + 1], { updateHistory: true, focusHeading: true, source: "journey_next", track: true });
    });

    explorer?.addEventListener("keydown", (event) => {
      if (!event.altKey || !new Set(["ArrowLeft", "ArrowRight"]).has(event.key)) return;
      event.preventDefault();
      const index = ids.indexOf(activeId);
      const nextIndex = event.key === "ArrowRight" ? Math.min(ids.length - 1, index + 1) : Math.max(0, index - 1);
      if (nextIndex !== index) activate(ids[nextIndex], { updateHistory: true, focusHeading: true, source: "journey_keyboard", track: true });
    });

    const activateFromLocation = () => {
      const id = window.location.hash.slice(1);
      if (ids.includes(id)) activate(id, { scroll: false });
    };
    window.addEventListener("popstate", activateFromLocation);
    window.addEventListener("hashchange", activateFromLocation);

    component.dataset.enhanced = "true";
    activate(activeId);
  }

  function initCounters() {
    const module = document.querySelector("[data-cost-module]");
    if (!module) return;
    const counters = [...module.querySelectorAll("[data-counter]")];
    let completed = false;

    const setFinal = () => {
      counters.forEach((counter) => {
        const value = Number(counter.dataset.counter || 0);
        counter.textContent = `${new Intl.NumberFormat("es-ES").format(value)}${counter.dataset.suffix || ""}`;
      });
    };

    const run = () => {
      if (completed) return;
      completed = true;
      if (reducedMotion.matches) {
        setFinal();
        return;
      }
      const start = performance.now();
      const duration = 700;
      const frame = (now) => {
        const amount = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - amount, 3);
        counters.forEach((counter) => {
          const value = Math.round(Number(counter.dataset.counter || 0) * eased);
          counter.textContent = `${new Intl.NumberFormat("es-ES").format(value)}${counter.dataset.suffix || ""}`;
        });
        if (amount < 1) window.requestAnimationFrame(frame);
      };
      window.requestAnimationFrame(frame);
    };

    if (!("IntersectionObserver" in window)) {
      run();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      run();
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(module);
  }

  function initFaqTracking() {
    document.querySelectorAll(".faq-list details").forEach((details) => {
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        trackEvent("importa7_faq_open", { question: details.querySelector("summary")?.textContent.trim() || "" });
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
        iframe.title = "Iván explica cómo funciona Importa tu coche en 7 días";
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
    const legalFaq = document.querySelector("[data-legal-faq]");
    if (legalFaq) legalFaq.hidden = !config.legal?.purchaseTerms;
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
    const hero = document.querySelector(".hero");
    const suppressors = [...document.querySelectorAll("[data-sticky-suppress], [data-course-footer]")];
    if (!sticky || !hero) return;

    sticky.hidden = false;
    const visibility = new Map([[hero, true], ...suppressors.map((element) => [element, false])]);
    const render = () => {
      const mobile = window.matchMedia("(max-width: 720px)").matches;
      const heroVisible = visibility.get(hero);
      const suppressed = suppressors.some((element) => visibility.get(element));
      sticky.classList.toggle("is-visible", mobile && !heroVisible && !suppressed);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => visibility.set(entry.target, entry.isIntersecting));
        render();
      }, { threshold: 0.04 });
      [hero, ...suppressors].forEach((element) => observer.observe(element));
    }
    window.addEventListener("resize", render, { passive: true });
    render();
  }

  function initVisibilityState() {
    const sync = () => document.body.classList.toggle("is-page-hidden", document.hidden);
    document.addEventListener("visibilitychange", sync);
    sync();
  }

  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  initCountdown();
  initPurchaseCtas();
  initHeader();
  initReveal();
  initProgressScenes();
  initJourney();
  initCounters();
  initFaqTracking();
  initVideo();
  initConfigLinks();
  initReadingProgress();
  initMobilePurchase();
  initVisibilityState();

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
