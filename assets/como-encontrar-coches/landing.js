// El CTA permanece oculto al inicio, al volver al hero y mientras el pricing es visible.
const sticky = document.querySelector(".rev-sticky");
const hero = document.querySelector(".rev-hero");
const pricing = document.querySelector(".rev-pricing");

if (sticky && hero && pricing && "IntersectionObserver" in window) {
  const updateSticky = () => {
    const heroPassed = hero.getBoundingClientRect().bottom <= 0;
    const priceBounds = pricing.getBoundingClientRect();
    const pricingVisible = priceBounds.top < window.innerHeight && priceBounds.bottom > 0;
    sticky.hidden = !heroPassed || pricingVisible;
  };
  const observer = new IntersectionObserver(updateSticky, { threshold: 0 });
  observer.observe(hero);
  observer.observe(pricing);
  window.addEventListener("resize", updateSticky);
  updateSticky();
}

 // Movimiento breve al entrar; el contenido siempre está visible incluso sin JS.
if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add("rev-reveal");
      reveal.unobserve(entry.target);
    }
  }, { threshold: .08 });
  document.querySelectorAll(".rev-source-map, .rev-flow, .rev-video-grid").forEach((node) => reveal.observe(node));
}
