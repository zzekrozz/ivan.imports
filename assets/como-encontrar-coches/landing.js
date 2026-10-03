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
