const ACADEMY_GUIDES = Array.isArray(window.IVAN_IMPORTS_ACADEMY)
  ? window.IVAN_IMPORTS_ACADEMY
  : [];

function academyNormalize(value = "") {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function academyEscape(value = "") {
  return String(value).replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[character]));
}

function guideCardMarkup(guide) {
  const label = guide.label
    ? `<span class="guide-card-label">${academyEscape(guide.label)}</span>`
    : "";

  return `
    <article class="guide-card">
      <a class="guide-card-visual guide-card-visual--${academyEscape(guide.image || "default")}" href="${academyEscape(guide.url)}" tabindex="-1" aria-hidden="true">
        <span class="visual-route"><i></i><i></i><i></i></span>
        <span class="visual-plate"><small>ES</small><strong>P · 0164 · BCD</strong></span>
        <span class="visual-stamp">DGT</span>
      </a>
      <div class="guide-card-body">
        <div class="guide-card-meta">
          <span>${academyEscape(guide.category)}</span>
          ${label}
        </div>
        <h2><a href="${academyEscape(guide.url)}">${academyEscape(guide.title)}</a></h2>
        <p>${academyEscape(guide.description)}</p>
        <div class="guide-card-foot">
          <span>${academyEscape(guide.readTime)}</span>
          <a href="${academyEscape(guide.url)}" data-track="academy_open_guide">Leer guía <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </article>`;
}

function initAcademyLibrary() {
  const grid = document.querySelector("[data-guide-grid]");
  const search = document.querySelector("[data-academy-search]");
  const categoryContainer = document.querySelector("[data-academy-categories]");
  const status = document.querySelector("[data-academy-status]");
  const empty = document.querySelector("[data-academy-empty]");
  if (!grid || !search || !categoryContainer || !status || !empty) return;

  const categories = [...new Set(ACADEMY_GUIDES.map((guide) => guide.category).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, "es"));
  categoryContainer.innerHTML = [
    '<button class="category-chip" type="button" data-academy-filter="" aria-pressed="true">Todas</button>',
    ...categories.map((category) => `<button class="category-chip" type="button" data-academy-filter="${academyEscape(category)}" aria-pressed="false">${academyEscape(category)}</button>`),
  ].join("");
  const filterButtons = [...categoryContainer.querySelectorAll("[data-academy-filter]")];

  let activeCategory = "";

  const render = () => {
    const query = academyNormalize(search.value);
    const visibleGuides = ACADEMY_GUIDES.filter((guide) => {
      const haystack = academyNormalize([
        guide.title,
        guide.description,
        guide.category,
        ...(guide.keywords || []),
      ].join(" "));
      const tokens = haystack.split(/[^a-z0-9]+/).filter(Boolean);
      const matchesSearch = !query || (query.length <= 3 ? tokens.includes(query) : haystack.includes(query));
      const matchesCategory = !activeCategory || academyNormalize(guide.category) === activeCategory;
      return matchesSearch && matchesCategory;
    });

    grid.innerHTML = visibleGuides.map(guideCardMarkup).join("");
    empty.hidden = visibleGuides.length > 0;
    const guideWord = visibleGuides.length === 1 ? "guía" : "guías";
    status.textContent = `${visibleGuides.length} ${guideWord}`;
  };

  search.addEventListener("input", render);
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextCategory = academyNormalize(button.dataset.academyFilter);
      activeCategory = nextCategory;
      filterButtons.forEach((candidate) => {
        const selected = academyNormalize(candidate.dataset.academyFilter) === activeCategory;
        candidate.setAttribute("aria-pressed", String(selected));
      });
      render();
    });
  });

  render();
}

function initAcademyTracking() {
  document.querySelectorAll("[data-academy-track]").forEach((link) => {
    link.addEventListener("click", () => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: link.dataset.academyTrack,
        destination: link.href || "",
        page: window.location.pathname,
      });
    });
  });
  window.dataLayer = window.dataLayer || [];
  const viewEvent = document.querySelector("[data-guide-article]") ? "academy_guide_view" : "academia_view";
  window.dataLayer.push({ event: viewEvent, path: window.location.pathname });
}

function initArticleNavigation() {
  const navigation = document.querySelector("[data-article-navigation]");
  if (!navigation) return;

  const details = navigation.querySelector("details");
  const links = [...navigation.querySelectorAll('a[href^="#"]')];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  const desktop = window.matchMedia("(min-width: 981px)");

  const keepDesktopOpen = () => {
    if (details) details.open = desktop.matches;
  };
  keepDesktopOpen();
  desktop.addEventListener?.("change", keepDesktopOpen);

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (desktop.matches || !details) return;
      event.preventDefault();
      const target = document.querySelector(link.getAttribute("href"));
      details.open = false;
      window.history.pushState(null, "", link.hash);
      window.requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
    });
  });

  if (window.location.hash) {
    const initialTarget = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => initialTarget?.scrollIntoView({ block: "start" }));
    });
  }

  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach((link) => {
      const isCurrent = link.getAttribute("href") === `#${visible.target.id}`;
      link.classList.toggle("is-current", isCurrent);
      if (isCurrent) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-18% 0px -68%", threshold: 0 });
  sections.forEach((section) => observer.observe(section));
}

function initReadingProgress() {
  const progress = document.querySelector("[data-reading-progress]");
  const article = document.querySelector("[data-guide-article]");
  if (!progress || !article) return;

  const update = () => {
    const start = article.offsetTop;
    const distance = Math.max(1, article.offsetHeight - window.innerHeight);
    const value = Math.min(1, Math.max(0, (window.scrollY - start) / distance));
    progress.style.transform = `scaleX(${value})`;
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

function initRelatedGuides() {
  const container = document.querySelector("[data-related-guides]");
  if (!container) return;

  const currentSlug = container.dataset.currentGuide || "";
  const currentGuide = ACADEMY_GUIDES.find((guide) => guide.slug === currentSlug);
  const requested = new Set(currentGuide?.related || []);
  const related = ACADEMY_GUIDES
    .filter((guide) => guide.slug !== currentSlug && (!requested.size || requested.has(guide.slug)))
    .slice(0, 3);

  if (related.length) {
    container.innerHTML = related.map(guideCardMarkup).join("");
    return;
  }

  container.innerHTML = `
    <div class="related-empty">
      <span class="related-empty-mark" aria-hidden="true">01</span>
      <div>
        <h3>La biblioteca acaba de empezar</h3>
        <p>Esta es la primera guía. Vuelve a la Academia para consultar las nuevas publicaciones cuando estén disponibles.</p>
      </div>
      <a class="btn btn-secondary" href="/academia/">Ver Academia</a>
    </div>`;
}

initAcademyLibrary();
initArticleNavigation();
initReadingProgress();
initRelatedGuides();
initAcademyTracking();
