import { NextRequest } from "next/server";

const CERTIFICATE_SAVE_API_URL =
  process.env.CERTIFICATE_SAVE_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_CERTIFICATE_SAVE_API_URL?.trim() ||
  "";

function getConfiguredUrl() {
  return CERTIFICATE_SAVE_API_URL;
}

export function getExternalTargets(request: NextRequest) {
  const configuredUrl = getConfiguredUrl();
  if (!configuredUrl) {
    return [];
  }

  try {
    const configured = new URL(configuredUrl);
    const currentOrigin = request.nextUrl.origin;
    if (configured.origin === currentOrigin) {
      return [];
    }

    if (
      configured.protocol === "http:" &&
      configured.hostname === "localhost" &&
      configured.port === "5086"
    ) {
      const httpsLocalUrl = new URL(configured.toString());
      httpsLocalUrl.protocol = "https:";
      httpsLocalUrl.port = "7172";
      return [httpsLocalUrl.toString(), configured.toString()];
    }

    return [configured.toString()];
  } catch {
    return [];
  }
}

export function shouldProxyToExternal(request: NextRequest) {
  return getExternalTargets(request).length > 0;
}

export function getExternalConfigError(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const configuredUrl = getConfiguredUrl();
  if (!configuredUrl) {
    return "Missing CERTIFICATE_SAVE_API_URL in production. In-memory Map storage is disabled on serverless deployment.";
  }

  let parsed: URL;

  try {
    parsed = new URL(configuredUrl);
  } catch {
    return "Invalid CERTIFICATE_SAVE_API_URL. Expected an absolute URL like https://api.example.com/api/Certificates.";
  }

  if (parsed.origin === request.nextUrl.origin) {
    return "CERTIFICATE_SAVE_API_URL points to the same origin as this app. Please configure the real backend API URL instead of this frontend domain.";
  }

  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    return "CERTIFICATE_SAVE_API_URL is set to localhost. Vercel cannot access your local machine; use a publicly reachable backend URL.";
  }

  return null;
}
