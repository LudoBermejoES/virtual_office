import { createLogger, format, transports } from "winston";

interface LogEntry {
  level: string;
  message: string;
  [key: string]: unknown;
}

export interface TestLogger {
  logger: ReturnType<typeof createLogger>;
  errors: LogEntry[];
  warns: LogEntry[];
  infos: LogEntry[];
  clear: () => void;
}

export function createTestLogger(): TestLogger {
  const errors: LogEntry[] = [];
  const warns: LogEntry[] = [];
  const infos: LogEntry[] = [];

  const memoryTransport = new transports.Stream({
    stream: {
      write(chunk: string) {
        const entry = JSON.parse(chunk) as LogEntry;
        if (entry.level === "error") errors.push(entry);
        else if (entry.level === "warn") warns.push(entry);
        else if (entry.level === "info") infos.push(entry);
      },
    } as NodeJS.WritableStream,
  });

  const logger = createLogger({
    level: "debug",
    format: format.combine(format.timestamp(), format.json()),
    transports: [memoryTransport],
    silent: false,
  });

  return {
    logger,
    errors,
    warns,
    infos,
    clear: () => {
      errors.length = 0;
      warns.length = 0;
      infos.length = 0;
    },
  };
}
