import axios from "axios"

const getBaseURL = () => {
  const envUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_API_URL
  if (envUrl) return envUrl
  if (typeof window !== "undefined") {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return ""
    }
  }
  return "http://localhost:5001"
}

const API = axios.create({
  baseURL: getBaseURL(),
})

API.interceptors.request.use((req) => {
  if (typeof window !== "undefined") {
    // If running in production on Vercel without external server, use relative API routes
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      if (!process.env.NEXT_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL.includes("localhost")) {
        req.baseURL = ""
        if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("http")) {
          req.url = `/api${req.url.startsWith("/") ? req.url : "/" + req.url}`
        }
      }
    }

    const token = localStorage.getItem("token")
    if (token) {
      req.headers.Authorization = `Bearer ${token}`
    } else {
      const profile = localStorage.getItem("Profile") || localStorage.getItem("profile")
      if (profile) {
        try {
          const parsed = JSON.parse(profile)
          if (parsed?.token) {
            req.headers.Authorization = `Bearer ${parsed.token}`
          }
        } catch (err) {}
      }
    }
  }
  return req;
});


API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      if (error?.response?.status === 401) {
        const msg = String(error?.response?.data?.message || error?.response?.data?.error || "");
        if (msg.toLowerCase().includes("token") || msg.toLowerCase().includes("expired")) {
          try {
            localStorage.removeItem("token");
          } catch (e) {}
        }
      }
      // Handle Network Error (connection refused, backend offline, or cross-port block)
      if (!error.response && (error.message === "Network Error" || error.code === "ERR_NETWORK")) {
        console.warn(
          "[API Network Notice] Request to " +
            (error.config?.url || "endpoint") +
            " failed due to Network Error. Returning safe offline fallback."
        );
        return Promise.resolve({
          data: null,
          status: 0,
          statusText: "Offline/Network Error",
          headers: {},
          config: error.config,
          isOffline: true,
        });
      }
    }
    return Promise.reject(error);
  }
);

export default API

