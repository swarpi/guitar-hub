// Stand-in for `@cloudflare/next-on-pages` when running scripts outside the
// Next.js runtime (see tsconfig.mcp.json, used by `pnpm dev:mcp`).
//
// The real package only ships an ESM `import` export, which Node's CommonJS
// loader (how tsx runs this project's scripts) cannot resolve. Scripts that
// import `src/app/actions.ts` only need the *Logic functions, which take a db
// handle directly — `getRequestContext` is only called by the server-action
// wrappers, which scripts never invoke. If one ever does, fail loudly.
export function getRequestContext(): never {
  throw new Error(
    "getRequestContext is not available outside the Next.js runtime",
  );
}
