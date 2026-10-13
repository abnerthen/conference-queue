# conference-queue

A simple webapp using Google Apps Script and Cloudflare Pages to generate QR codes for participants, and mark attendance by scanning these personal QR codes.

### Getting Started

WIP

## Design customisation (branding)

Both landing surfaces support component-based branding.

### Attendee page (Apps Script)

Files live in `apps-script/`. Branding is driven by **Script Properties**
(Project Settings -> Script Properties) plus reusable HTML partials:

- `BRAND_NAME` — organisation/app name shown in the header.
- `BRAND_LOGO_URL` — URL of a logo image (leave empty to hide).
- `BRAND_PRIMARY` — primary colour (hex).
- `BRAND_ACCENT` — accent colour (hex).
- `BRAND_BG` — page background (hex).
- `BRAND_FOOTER` — optional footer text.

Reusable partials (GAS "components") are included with `<?!= include('PartialName') ?>`:

- `BrandHeader.html` — logo + name, shown at the top of `index.html`.
- `BrandFooter.html` — optional footer text.

To add a new component, create a new `.html` partial in `apps-script/` and include it
from `index.html` (or another partial) via `<?!= include('YourPartial') ?>`. Partial
files receive the same template variables (`brand`, `prefill`, etc.).

### Scanner (Cloudflare Pages)

Files live in `scanner/public/`. Branding is configured in `scanner/public/config.js`
and rendered by the `brand-header` custom element defined in `scanner/public/brand.js`.

To customise, edit `config.js`:

```js
window.BRAND = {
  name: "Your organisation",
  logoUrl: "https://example.com/logo.png",
  primary: "#123456",
  accent: "#abcdef",
  background: "#f5f7fa"
};
```

To add new components, create a new custom element in `brand.js` (or a new module
loaded from `index.html`) and drop it into the markup, e.g. `<brand-footer></brand-footer>`.

### Tips

- Keep colour values as hex strings.
- Logo URLs must be publicly reachable from the attendee's browser.
- After changing Apps Script branding, redeploy (or push via clasp) so changes apply.