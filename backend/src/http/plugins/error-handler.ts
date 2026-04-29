import type { FastifyInstance, FastifyError } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

export async function errorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        type: "https://httpstatuses.com/400",
        title: "Validación fallida",
        status: 400,
        detail: "Los datos enviados no son válidos",
        errors: error.validation,
      });
    }

    const status = error.statusCode ?? 500;
    return reply.status(status).send({
      type: `https://httpstatuses.com/${status}`,
      title: error.message,
      status,
    });
  });
}
