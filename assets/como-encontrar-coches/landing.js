// Ocultar el CTA fijo cuando el CTA final ya es visible evita duplicar acciones.
const sticky = document.querySelector(".rev-sticky");
const pricing = document.querySelector("#pricing_cta");
if (sticky && pricing && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(([entry]) => {
    sticky.hidden = entry.isIntersecting;
  });
  observer.observe(pricing);
}
