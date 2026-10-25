/**
 * Centralized API configuration for EVNet Sentinel frontend.
 *
 * In production (Render), NEXT_PUBLIC_API_URL is set to the deployed API URL.
 * Locally, it falls back to the default FastAPI dev server.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
