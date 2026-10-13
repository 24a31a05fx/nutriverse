const backendBaseUrl =
  process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8000";

export function getServerApiUrl(path: string): URL {
  return new URL(path.replace(/^\/+/, ""), `${backendBaseUrl.replace(/\/+$/, "")}/`);
}
