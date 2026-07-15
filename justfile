# Meeting Notes — task runner
# https://github.com/casey/just  (install: `cargo install just` or `brew install just`)

# Show available recipes
default:
    @just --list

# Install Tauri v2 system dependencies (Ubuntu 24.04+)
setup-ubuntu:
    sudo apt update
    sudo apt install -y \
        libwebkit2gtk-4.1-dev \
        librsvg2-dev \
        libdbus-1-dev \
        build-essential \
        curl \
        wget \
        file \
        libxdo-dev \
        libssl-dev \
        libayatana-appindicator3-dev \
        pkg-config
    npm install

# Install Tauri v2 system dependencies (Arch Linux)
setup-arch:
    sudo pacman -Syu --needed \
        webkit2gtk-4.1 \
        base-devel \
        curl \
        wget \
        file \
        openssl \
        gtk3 \
        libayatana-appindicator \
        librsvg \
        xdotool \
        dbus \
        pkgconf
    npm install

# Install JS dependencies
install:
    npm install

# Run the desktop app in dev mode
dev:
    npm run tauri dev

# Typecheck + build the frontend
build:
    npm run build

# Typecheck only (no emit)
typecheck:
    npm run typecheck

# Package the desktop app (needs system deps; see `setup-ubuntu`)
package:
    npm run tauri build

# Run all tests (frontend + Rust core logic)
test: test-frontend test-core

# Run frontend tests (vitest)
test-frontend:
    npm test

# Run the pure-logic Rust unit tests
test-core:
    cargo test --manifest-path src-tauri/core/Cargo.toml

# Type-check the whole Rust workspace (requires system deps)
check-rust:
    cargo check --manifest-path src-tauri/Cargo.toml

# Format Rust code
fmt:
    cargo fmt --manifest-path src-tauri/Cargo.toml

# Remove build artifacts
clean:
    rm -rf dist
    cargo clean --manifest-path src-tauri/Cargo.toml
