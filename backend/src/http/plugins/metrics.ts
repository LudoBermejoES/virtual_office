import client from "prom-client";
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { Env } from "../../config/env.js";

export const httpRequestsTotal = new client.Counter({
  name: "vo_http_requests_total",
  labelNames: ["method", "route", "status"],
  help: "Total HTTP requests",
});

export const httpDuration = new client.Histogram({
  name: "vo_http_request_duration_seconds",
  labelNames: ["method", "route"],
  help: "HTTP request duration",
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const wsConnectionsActive = new client.Gauge({
  name: "vo_ws_connections_active",
  labelNames: ["office_id"],
  help: "Active WebSocket connections per office",
});

export const wsMessagesSent = new client.Counter({
  name: "vo_ws_messages_sent_total",
  labelNames: ["type"],
  help: "Total WebSocket messages sent",
});

new client.Gauge({
  name: "vo_uptime_seconds",
  help: "Server uptime in seconds",
  collect() {
    this.set(process.uptime());
  },
});

const metricsPlugin: FastifyPluginAsync<{ env: Env }> = async (app, { env }) => {
  app.addHook("onResponse", (req, reply, done) => {
    const route = (req.routeOptions as { url?: string })?.url ?? "unknown";
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status: String(reply.statusCode),
    });
    httpDuration.observe({ method: req.method, route }, reply.elapsedTime / 1000);
    done();
  });

  app.get("/metrics", async (req, reply) => {
    if (!env.BASIC_AUTH_METRICS_USER || !env.BASIC_AUTH_METRICS_PASS) {
      return reply.code(503).send({ reason: "metrics_not_configured" });
    }
    const auth = (req.headers["authorization"] as string | undefined) ?? "";
    const expected =
      "Basic " +
      Buffer.from(`${env.BASIC_AUTH_METRICS_USER}:${env.BASIC_AUTH_METRICS_PASS}`).toString(
        "base64",
      );
    if (auth !== expected) {
      return reply.code(401).header("WWW-Authenticate", 'Basic realm="metrics"').send();
    }
    reply.header("Content-Type", client.register.contentType);
    return client.register.metrics();
  });
};

export const metricsPluginWrapped = fp(metricsPlugin, { name: "metrics" });
