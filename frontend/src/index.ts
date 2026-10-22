import { serve } from "bun";
import index from "./index.html";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const PORT = Number(process.env.PORT) || 3000;

const server = serve({
  port: PORT,
  routes: {
    // Proxy health checks to backend
    "/api/health": async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`);
        const data = await res.json();
        return Response.json(data);
      } catch (err) {
        return Response.json({ status: "offline", error: String(err) }, { status: 502 });
      }
    },

    // Proxy evaluation requests to FastAPI backend
    "/api/evaluate": {
      async POST(req) {
        try {
          const body = await req.json();
          const res = await fetch(`${BACKEND_URL}/evaluate/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          const data = await res.json();
          return Response.json(data, { status: res.status });
        } catch (err) {
          return Response.json(
            { error: "Failed to connect to backend", details: String(err) },
            { status: 502 }
          );
        }
      },
    },

    // Proxy batch evaluation requests
    "/api/batch": {
      async POST(req) {
        try {
          const body = await req.json();
          const res = await fetch(`${BACKEND_URL}/evaluate/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          return Response.json(data, { status: res.status });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 502 });
        }
      },
    },

    // Proxy comparison requests
    "/api/compare": {
      async POST(req) {
        try {
          const body = await req.json();
          const res = await fetch(`${BACKEND_URL}/evaluate/compare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          return Response.json(data, { status: res.status });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 502 });
        }
      },
    },

    // Proxy standalone LLM-as-a-Judge requests to FastAPI backend
    "/api/judge": {
      async POST(req) {
        try {
          const body = await req.json();
          const res = await fetch(`${BACKEND_URL}/evaluate/judge`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          const data = await res.json();
          return Response.json(data, { status: res.status });
        } catch (err) {
          return Response.json(
            { error: "Failed to connect to backend judge", details: String(err) },
            { status: 502 }
          );
        }
      },
    },

    // Proxy API key configuration requests to FastAPI backend
    "/api/api-key": {
      async GET() {
        try {
          const res = await fetch(`${BACKEND_URL}/evaluate/api-key`);
          const data = await res.json();
          return Response.json(data, { status: res.status });
        } catch (err) {
          return Response.json({ status: "error", message: String(err) }, { status: 502 });
        }
      },
      async POST(req) {
        try {
          const body = await req.json();
          const res = await fetch(`${BACKEND_URL}/evaluate/api-key`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          const data = await res.json();
          return Response.json(data, { status: res.status });
        } catch (err) {
          return Response.json(
            { status: "error", message: String(err) },
            { status: 502 }
          );
        }
      },
    },

    // Fallback info endpoint
    "/api/info": async () => {
      return Response.json({
        name: "RAGOps Frontend Server",
        backend: BACKEND_URL,
        version: "0.2.0",
      });
    },

    // Serve index.html for all unmatched routes
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 RAGOps Frontend running at ${server.url}`);
console.log(`📡 Connected to Backend at ${BACKEND_URL}`);
