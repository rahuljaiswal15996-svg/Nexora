function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

export function resolvePublicApiBaseUrl() {
  const configured = trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL || "/api");
  return configured || "/api";
}

export function resolveInternalApiBaseUrl() {
  const internalBaseUrl = trimTrailingSlash(process.env.INTERNAL_API_BASE_URL);
  if (internalBaseUrl) {
    return internalBaseUrl;
  }

  const publicBaseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (publicBaseUrl && isAbsoluteHttpUrl(publicBaseUrl)) {
    return publicBaseUrl;
  }

  throw new Error(
    "INTERNAL_API_BASE_URL must be set for server-side frontend requests when NEXT_PUBLIC_API_BASE_URL is not an absolute URL."
  );
}