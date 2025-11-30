/**
 * Get the API base URL for making requests.
 *
 * In development:
 * - If VITE_API_URL is set, use it
 * - Otherwise, use relative path (relies on Vite proxy)
 *
 * In StackBlitz:
 * - When on localhost:5173, use localhost:3001 for API calls
 * - When on StackBlitz domain with --5173--, construct server URL with --3001--
 */
export function getApiBaseUrl(): string {
  // Check for explicit API URL from environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Check if we're in StackBlitz or similar environment
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;

    // If on localhost with client port, use localhost:3001 for server
    if (hostname === "localhost" && port === "5173") {
      return `${protocol}//localhost:3001`;
    }

    // If on StackBlitz domain (webcontainer.io or stackblitz.io)
    if (
      hostname.includes("webcontainer.io") ||
      hostname.includes("stackblitz.io")
    ) {
      // If already on server port/pattern, use same origin
      if (port === "3001" || hostname.includes("--3001--")) {
        return "";
      }

      // If on client port/pattern, construct server URL
      if (port === "5173" || hostname.includes("--5173--")) {
        // Replace --5173-- with --3001-- in hostname
        const serverHostname = hostname.replace("--5173--", "--3001--");
        return `${protocol}//${serverHostname}`;
      }
    }
  }

  // Default: use relative path (works with Vite proxy in local dev)
  return "";
}
