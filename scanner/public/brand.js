(function () {
  const b = (window.BRAND = window.BRAND || {});
  const root = document.documentElement;
  if (b.primary) root.style.setProperty("--accent", b.primary);
  if (b.accent) root.style.setProperty("--accent-2", b.accent);
  if (b.background) root.style.setProperty("--bg", b.background);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  class BrandHeader extends HTMLElement {
    connectedCallback() {
      if (this._rendered) return;
      this._rendered = true;
      const name = this.getAttribute("name") || b.name || "";
      const logo = this.getAttribute("logo") || b.logoUrl || "";
      this.innerHTML =
        '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.75rem">' +
        (logo ? '<img src="' + escapeHtml(logo) + '" alt="' + escapeHtml(name) +
          '" style="height:36px;width:auto;border-radius:6px">' : "") +
        (name ? '<span style="font-weight:700;font-size:1.1rem;letter-spacing:-.01em;color:var(--ink,#14202b)">' +
          escapeHtml(name) + "</span>" : "") +
        "</div>";
    }
  }
  if (!customElements.get("brand-header")) {
    customElements.define("brand-header", BrandHeader);
  }
})();