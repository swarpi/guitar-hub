# Java Conventions

## Runtime and Build

- **Java version**: 21 (LTS)
- **Build tool**: Gradle with Kotlin DSL (`build.gradle.kts`)
- **Framework**: Spring Boot 3.x (unless otherwise specified)

## Code Style

### Modern Java Features

- **Records** over POJOs for immutable data
- **Pattern matching** with `switch` expressions and `instanceof`
- **Virtual threads** for concurrent I/O (Project Loom)
- **Sealed classes** for closed hierarchies
- **No Lombok** — use records and IDE generation instead

```java
public record User(String id, String name, String email) {}

public sealed interface Result<T> permits Success, Failure {
    record Success<T>(T value) implements Result<T> {}
    record Failure<T>(String error) implements Result<T> {}
}

String describe(Object obj) {
    return switch (obj) {
        case User u -> "User: " + u.name();
        case String s -> "String: " + s;
        case null -> "null";
        default -> "Unknown";
    };
}
```

### Null Handling

- Prefer `Optional<T>` for return types that may be absent
- Use `@Nullable` and `@NonNull` annotations from JSpecify
- Avoid returning `null` from public methods

```java
public Optional<User> findUser(String id) {
    return Optional.ofNullable(repository.get(id));
}
```

### Dependency Injection

- Constructor injection (not field injection)
- Final fields for injected dependencies
- `@RequiredArgsConstructor` is forbidden (no Lombok)

```java
@Service
public class UserService {
    private final UserRepository repository;
    private final EmailService emailService;
    
    public UserService(UserRepository repository, EmailService emailService) {
        this.repository = repository;
        this.emailService = emailService;
    }
}
```

### Streams and Collections

- Prefer immutable collections: `List.of()`, `Set.of()`, `Map.of()`
- Use streams for transformations, not side effects
- Avoid nested streams; extract to methods

```java
var activeUsers = users.stream()
    .filter(User::isActive)
    .toList();
```

## File Organization

- One public class per file
- Package-private classes for implementation details
- Test classes in parallel `src/test/java` hierarchy

## Naming

- `camelCase` for methods, variables, parameters
- `PascalCase` for classes, interfaces, enums, records
- `SCREAMING_SNAKE_CASE` for constants
- Interfaces: noun or adjective, no `I` prefix
- Implementations: descriptive name, not `Impl` suffix

## Async / Concurrency

- Use virtual threads for blocking I/O (not reactive)
- `CompletableFuture` for async composition when needed
- Prefer structured concurrency (preview feature) when stable

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> processRequest(request));
}
```

## Testing

- JUnit 5 with AssertJ for assertions
- Mockito for mocking (sparingly)
- Testcontainers for integration tests
