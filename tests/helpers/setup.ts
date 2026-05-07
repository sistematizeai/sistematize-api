import Fastify, { FastifyInstance } from 'fastify';

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  return app;
}
