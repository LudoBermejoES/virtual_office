import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import { env } from "./env.js";

const logTransports: transports.StreamTransportInstance[] = [new transports.Console()];

if (env.NODE_ENV === "production") {
  logTransports.push(
    new transports.DailyRotateFile({
      filename: "logs/app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }) as unknown as transports.StreamTransportInstance,
  );
}

export const logger = createLogger({
  level: env.LOG_LEVEL,
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  defaultMeta: { service: "virtual-office" },
  transports: logTransports,
});
