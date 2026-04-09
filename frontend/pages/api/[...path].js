import { resolveInternalApiBaseUrl as getInternalApiBaseUrl } from "../../lib/runtime-config";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function buildForwardHeaders(headers) {
  const nextHeaders = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    if (!value || HOP_BY_HOP_HEADERS.has(normalizedKey)) {
      return;
    }
    nextHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
  });
  return nextHeaders;
}

export default async function handler(req, res) {
  const pathSegments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const requestUrl = new URL(req.url || "/", "http://nexora.local");
  const targetUrl = new URL(`${getInternalApiBaseUrl()}/${pathSegments.join("/")}`);
  targetUrl.search = requestUrl.search;

  const body = !["GET", "HEAD"].includes(req.method || "GET") ? await readRequestBody(req) : undefined;
  const upstreamResponse = await fetch(targetUrl, {
    method: req.method,
    headers: buildForwardHeaders(req.headers),
    body: body && body.length ? body : undefined,
    redirect: "manual",
  });

  res.status(upstreamResponse.status);
  upstreamResponse.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return;
    }
    res.setHeader(key, value);
  });

  const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
  res.send(responseBuffer);
}