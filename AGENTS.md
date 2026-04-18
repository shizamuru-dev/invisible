# Agent Guidelines for invisible-backend

## Project Overview

Rust project using Cargo. Edition 2024. Minimal setup with no external dependencies yet.

---

## Build / Lint / Test Commands

```bash
# Build
cargo build

# Build release
cargo build --release

# Run
cargo run

# Run a single test by name (partial match works)
cargo test test_name

# Run tests with output captured (fails on first test)
cargo test -- --test-threads=1

# Run all tests including integration tests
cargo test --all

# Lint with clippy
cargo clippy

# Clippy with strict warnings
cargo clippy -- -D warnings

# Format code
cargo fmt

# Check formatting
cargo fmt -- --check

# Build and run all tests
cargo all

# Generate docs
cargo doc
```

---

## Code Style Guidelines

### General

- Follow Rust idioms; prefer idiomatic solutions over Java/C-style patterns
- Keep functions small and focused (under 50 lines ideally)
- Avoid premature optimization; make it correct first, then fast
- Use `cargo clippy` and `cargo fmt` before committing

### Formatting

- Run `cargo fmt` before every commit
- Maximum line length: 100 characters (default in rustfmt)
- Use 4-space indentation
- Place `use` statements in groups separated by blank lines:
  1. `std` library
  2. `core` / `alloc`
  3. External crates (e.g., `anyhow`, `serde`)
  4. `crate` local imports
  5. `super` / `self`

### Naming Conventions

| Item | Convention | Example |
|------|-------------|---------|
| Functions / variables | snake_case | `fn get_user`, `let max_count` |
| Types / Traits / Structs | PascalCase | `struct UserService`, `trait Validator` |
| Constants / Static items | SCREAMING_SNAKE_CASE | `const MAX_RETRIES: u32` |
| Enum variants | PascalCase | `Some(Error::Timeout)` |
| Boolean variables | prefix with `is_`, `has_`, `can_` | `is_valid`, `has_permission` |
| Modules | snake_case | `mod auth_service;` |

### Imports

```rust
use std::collections::HashMap;          // std
use core::fmt;                           // core/alloc

use serde::{Deserialize, Serialize};     // external
use crate::error::AppError;              // local
use super::utils;                        // super/self
```

- Avoid full paths after imports: `use crate::foo::Bar;` then `Bar::new()`, not `crate::foo::Bar::new()`
- Group imports by std → external → local

### Error Handling

- Use `Result<T, E>` for fallible operations; `Option<T>` when absence is the only failure mode
- Use the `?` operator instead of manual `match`/`unwrap`
- Prefer `anyhow::Result<T>` for application-layer error handling (easy error context chaining)
- Use `thiserror` for library-layer error types with explicit variants
- Never use `unwrap()` in production code unless you can justify why panicking is correct behavior
- Avoid `expect()` unless the context makes failure truly impossible
- Wrap errors with context using `anyhow!` macro or `context()` method

```rust
// Bad
fn read_config() -> Config {
    std::fs::read_to_string("config.toml").unwrap()
}

// Good
fn read_config() -> anyhow::Result<Config> {
    let content = std::fs::read_to_string("config.toml")?;
    let config: Config = toml::from_str(&content)?;
    Ok(config)
}
```

### Documentation

- Add doc comments (`///`) on public API items (functions, structs, traits)
- Doc comments explain *what* and *why*, not *how*
- Include examples in doc comments when behavior is non-obvious

```rust
/// Parses a configuration file from the given path.
///
/// # Errors
///
/// Returns an error if the file cannot be read or parsed.
/// # Example
/// ```
/// let config = Config::parse("app.toml")?;
/// ```
pub fn parse(path: &Path) -> anyhow::Result<Config> { ... }
```

### Struct and Type Design

- Use struct updates for value-based types with many fields
- Prefer `#[derive(Debug, Clone, PartialEq, Eq)]` on data structs
- Use `#[non_exhaustive]` on types intended for future extension
- Keep structs' fields private; expose through getters/setters as appropriate
- Use `newtype` patterns (tuple structs) for type safety

### Async Code

- Use `async`/`await` with a runtime like `tokio`
- Spawn tasks with `tokio::spawn` for concurrent work
- Use channel-based communication between tasks
- Avoid blocking in async contexts; use `tokio::fs` for file I/O

### Testing

- Place unit tests in the same file, after the code they test, behind `#[cfg(test)]`
- Integration tests go in `tests/` directory at crate root
- Test names: `fn given_precondition_when_action_then_result()`
- Use `#[should_panic]` for tests that verify error conditions explicitly
- Mock external dependencies with traits and concrete implementations

### Modules

- One module per file; file name matches module name (snake_case)
- Use `mod.rs` or directory name as module root when module has submodules
- Re-export public API through `crate::` root `lib.rs` for libraries

---

## Cargo Workspace (when dependencies grow)

- Add workspace members in `Cargo.toml`
- External dependency versions go in `[workspace.dependencies]`
- Use `cargo update` to update lockfile

---

## Dependencies Philosophy

- Add dependencies sparingly; prefer std library where possible
- For new dependencies: research alternatives, prefer well-maintained crates
- Pin exact versions for security-critical dependencies
- Document why each dependency is needed in a comment above the line
