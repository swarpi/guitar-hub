# Python Conventions

## Tooling

- **Package/project manager**: uv (not pip, poetry, or pipenv)
- **Formatter/Linter**: Ruff
- **Type checker**: Pyright (strict mode)
- **Test runner**: pytest

## Project Setup

```bash
uv init project-name
cd project-name
uv add --dev ruff pyright pytest
```

## Code Style

### Type Hints

- Type hints on all function signatures
- Use `from __future__ import annotations` for forward references
- Use `typing` module for generics and unions

```python
from __future__ import annotations
from typing import TypeVar, Sequence

T = TypeVar("T")

def first(items: Sequence[T]) -> T | None:
    return items[0] if items else None
```

### Functions

- Prefer pure functions over methods when no state is needed
- Use dataclasses or named tuples for structured data
- Avoid mutable default arguments

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class User:
    id: str
    name: str
    email: str

def get_user(user_id: str) -> User | None:
    ...
```

### Error Handling

- Use explicit exception types
- Prefer returning `None` or a result type over raising for expected cases
- Document raised exceptions in docstrings

```python
class ParseError(Exception):
    pass

def parse_config(raw: str) -> Config:
    """Parse configuration from string.
    
    Raises:
        ParseError: If the configuration is invalid.
    """
    ...
```

### Imports

- Use absolute imports
- Group: standard library, third-party, local
- One import per line for `from` imports with multiple items

```python
import json
from pathlib import Path

import httpx

from myproject.config import settings
from myproject.models import User
```

## File Organization

- One module per file, named after the primary class/function
- Use `__init__.py` for package exports only
- Co-locate tests in `tests/` directory mirroring `src/` structure

## Naming

- `snake_case` for functions, variables, modules
- `PascalCase` for classes
- `SCREAMING_SNAKE_CASE` for constants
- `_private` prefix for internal names

## Async

- Use `asyncio` for concurrent I/O
- Prefer `async/await` over callbacks
- Use `asyncio.gather` for concurrent operations
