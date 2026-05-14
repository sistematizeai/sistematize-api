import type { RouteHandlerMethod } from 'fastify';

export function routeHandler(handler: unknown): RouteHandlerMethod {
  return handler as RouteHandlerMethod;
}
