import './sentry.client.config'

/**
 * Do not export `onRouterTransitionStart` / `Sentry.captureRouterTransitionStart` here.
 * That hook runs before the App Router is ready in Next.js 15+ (webpack dev) and spams:
 * "Internal Next.js error: Router action dispatched before initialization".
 * Client tracing still works via `browserTracingIntegration` in `sentry.client.config.ts`.
 */
