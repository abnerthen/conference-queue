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
      const link = this.getAttribute("link") || b.linkUrl || "";
      const inner =
        (logo ? '<img src="' + escapeHtml(logo) + '" alt="' + escapeHtml(name) +
          '" style="height:36px;width:auto;border-radius:6px">' : "") +
        (name ? '<span style="font-weight:700;font-size:1.1rem;letter-spacing:-.01em;color:var(--ink,#14202b)">' +
          escapeHtml(name) + "</span>" : "");
      this.innerHTML = link
        ? '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener" ' +
          'style="display:flex;align-items:center;gap:.6rem;text-decoration:none;color:inherit">' + inner + "</a>"
        : '<div style="display:flex;align-items:center;gap:.6rem">' + inner + "</div>";
    }
  }
  if (!customElements.get("brand-header")) {
    customElements.define("brand-header", BrandHeader);
  }

  class BrandFooter extends HTMLElement {
    connectedCallback() {
      if (this._rendered) return;
      this._rendered = true;
      const text = this.getAttribute("text") || b.footerText || "";
      const url = this.getAttribute("url") || b.footerUrl || "";
      if (!text && !url) { this.style.display = "none"; return; }
      const label = text || url;
      this.innerHTML = url
        ? '<footer style="text-align:center;color:var(--muted,#52606d);font-size:.85rem;margin-top:1rem">' +
          '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" style="color:var(--accent,#0b5c8a);text-decoration:none">' +
          escapeHtml(label) + "</a></footer>"
        : '<footer style="text-align:center;color:var(--muted,#52606d);font-size:.85rem;margin-top:1rem">' +
          escapeHtml(label) + "</footer>";
    }
  }
  if (!customElements.get("brand-footer")) {
    customElements.define("brand-footer", BrandFooter);
  }
})();