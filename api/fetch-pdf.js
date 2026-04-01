const MAX_PDF_BYTES = 35 * 1024 * 1024;

function isPrivateIpv4(hostname) {
  const match = String(hostname || "").match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const [first, second] = [Number(match[1]), Number(match[2])];
  return (
    first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
  );
}

function isBlockedHostname(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return (
    !normalized
    || normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "::1"
    || isPrivateIpv4(normalized)
  );
}

function looksLikePdf(bytes) {
  return (
    bytes?.length >= 4
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
  );
}

function errorResponse(message, status) {
  return new Response(message, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function buildFetchHeaders(targetUrl) {
  const origin = `${targetUrl.protocol}//${targetUrl.host}`;
  return {
    Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: origin,
  };
}

async function readCandidateResponse(response) {
  if (!response.ok) {
    const bodyText = await response.text();
    return {
      ok: false,
      status: response.status,
      error: bodyText || `Remote PDF download failed (${response.status}).`,
    };
  }

  const announcedLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(announcedLength) && announcedLength > MAX_PDF_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "Remote PDF is too large to download safely.",
    };
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "Remote PDF is too large to download safely.",
    };
  }

  const bytes = new Uint8Array(arrayBuffer);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const contentDisposition = String(response.headers.get("content-disposition") || "").toLowerCase();
  const pdfLike =
    looksLikePdf(bytes)
    || contentType.includes("pdf")
    || contentType.includes("octet-stream")
    || contentDisposition.includes(".pdf");

  return {
    ok: pdfLike,
    status: pdfLike ? 200 : 415,
    error: pdfLike ? "" : "Remote file did not look like a PDF.",
    arrayBuffer,
    contentType: response.headers.get("content-type") || "application/pdf",
    contentDisposition: response.headers.get("content-disposition") || 'inline; filename="paper.pdf"',
  };
}

async function fetchPdfCandidate(url, fetchInit = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    ...fetchInit,
  });
  return readCandidateResponse(response);
}

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "GET",
          "cache-control": "no-store",
        },
      });
    }

    const requestUrl = new URL(request.url);
    const target = String(requestUrl.searchParams.get("url") || "").trim();
    if (!target) {
      return errorResponse("Missing url query parameter.", 400);
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(target);
    } catch {
      return errorResponse("Invalid remote PDF URL.", 400);
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return errorResponse("Only http and https URLs are allowed.", 400);
    }

    if (isBlockedHostname(parsedUrl.hostname)) {
      return errorResponse("That host is not allowed.", 400);
    }

    try {
      const attempts = [
        () => fetchPdfCandidate(parsedUrl, { headers: buildFetchHeaders(parsedUrl) }),
      ];

      let lastFailure = { status: 502, error: "Remote PDF download failed." };
      for (const runAttempt of attempts) {
        const result = await runAttempt();
        if (result.ok) {
          return new Response(result.arrayBuffer, {
            status: 200,
            headers: {
              "cache-control": "no-store",
              "content-disposition": result.contentDisposition,
              "content-length": String(result.arrayBuffer.byteLength),
              "content-type": result.contentType,
            },
          });
        }
        lastFailure = result;
      }

      if (lastFailure.status === 415) {
        return errorResponse("Publisher blocked automated PDF download. Open the PDF in a browser tab and save/import it manually.", 415);
      }
      return errorResponse(lastFailure.error, lastFailure.status);
    } catch (error) {
      console.error("fetch-pdf proxy failed", error);
      return errorResponse(error?.message || "Remote PDF download failed.", 502);
    }
  },
};
