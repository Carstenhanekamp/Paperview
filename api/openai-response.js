const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function resolveApiKey(request) {
  const clientKey = String(request.headers.get("x-openai-api-key") || "").trim();
  return clientKey || String(process.env.OPENAI_API_KEY || "").trim();
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "POST",
          "cache-control": "no-store",
        },
      });
    }

    const apiKey = resolveApiKey(request);
    if (!apiKey) {
      return json(
        {
          error: "No OpenAI API key is configured. Add one in Settings or set OPENAI_API_KEY on the backend.",
        },
        { status: 401 },
      );
    }

    try {
      const payload = await request.json();
      const upstream = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const bodyText = await upstream.text();
      return new Response(bodyText, {
        status: upstream.status,
        headers: {
          "cache-control": "no-store",
          "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        },
      });
    } catch (error) {
      console.error("openai-response proxy failed", error);
      return json(
        {
          error: error?.message || "OpenAI proxy request failed.",
        },
        { status: 500 },
      );
    }
  },
};
