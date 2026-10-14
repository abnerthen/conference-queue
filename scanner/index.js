export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Intercept requests heading to your API endpoint
    if (url.pathname === "/api/scan" && request.method === "POST") {
      try {
        const scriptId = env.GOOGLE_SCRIPT_ID;
        if (!scriptId) {
          throw new Error("GOOGLE_SCRIPT_ID secret is not configured.");
        }

        const googleUrl = `https://script.google.com/macros/s/${scriptId}/exec`;
        const requestData = await request.text();

        // Securely talk to Google Apps Script from Cloudflare's servers
        const googleResponse = await fetch(googleUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: requestData,
        });

        const responseText = await googleResponse.text();

        return new Response(responseText, {
          status: googleResponse.status,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ ok: false, error: "Server error: " + error.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 2. For everything else (index.html, config.js, brand.js), serve the static file
    return env.ASSETS.fetch(request);
  },
};