# TypeScript Conventions

## Compiler Settings

- **Strict mode**: Always enable `"strict": true` in tsconfig
- **Target**: ES2022 or later
- **Module**: ESNext with bundler module resolution

## Tooling

- **Formatter/Linter**: Biome (not ESLint + Prettier)
- **Test runner**: Vitest
- **Package manager**: pnpm preferred, npm acceptable

## Code Style

### Types

- Prefer `interface` for object shapes, `type` for unions/intersections
- Always annotate function parameters and return types
- Use `unknown` over `any`; narrow with type guards
- Prefer `readonly` for immutable data

```typescript
interface User {
  readonly id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<User | null> {
  // ...
}
```

### Functions

- Prefer arrow functions for callbacks and short functions
- Use named function declarations for top-level functions
- Avoid classes unless modeling stateful entities

```typescript
// Preferred: named function at module level
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Preferred: arrow for inline callbacks
const activeUsers = users.filter((u) => u.isActive);
```

### Error Handling

- Use explicit error types, not `catch (e: any)`
- Prefer returning `Result<T, E>` types over throwing for expected failures
- Reserve exceptions for unexpected/unrecoverable errors

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

function parseConfig(raw: string): Result<Config, ParseError> {
  // ...
}
```

### Imports

- Use named imports, avoid default exports
- Group imports: external, then internal, then relative
- Use `type` imports for type-only imports

```typescript
import { readFile } from "node:fs/promises";
import type { Config } from "@/types";
import { parseConfig } from "./parser";
```

## File Organization

- One primary export per file
- Co-locate tests: `foo.ts` and `foo.test.ts` in the same directory
- Use `index.ts` only for re-exports, not implementation

## Naming

- `camelCase` for variables, functions, parameters
- `PascalCase` for types, interfaces, classes, enums
- `SCREAMING_SNAKE_CASE` for constants
- Prefix booleans with `is`, `has`, `should`, `can`

## Async

- Always use `async/await` over raw Promises
- Handle all promise rejections
- Use `Promise.all` for independent concurrent operations
