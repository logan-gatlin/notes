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
deps:
    npm install

# Build the release app and install it to your system (user-level, no sudo)
install:
    #!/usr/bin/env bash
    set -euo pipefail
    # Build only the binary (skip bundling: AppImage/linuxdeploy is not needed
    # for a user-level install and can fail scanning restricted PATH entries).
    npm run tauri build -- --no-bundle
    bin="src-tauri/target/release/meeting-notes"
    [ -f "$bin" ] || { echo "error: $bin not found (build failed?)" >&2; exit 1; }
    install -Dm755 "$bin" "$HOME/.local/bin/meeting-notes"
    install -Dm644 src-tauri/icons/128x128.png \
        "$HOME/.local/share/icons/hicolor/128x128/apps/meeting-notes.png"
    gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
    desktop="$HOME/.local/share/applications/meeting-notes.desktop"
    mkdir -p "$(dirname "$desktop")"
    # Use an absolute Exec path: GNOME's launcher does not always have
    # ~/.local/bin on PATH, so a bare "meeting-notes" can silently fail to run.
    # StartupWMClass lets GNOME match the running window to this launcher icon.
    printf '%s\n' \
        '[Desktop Entry]' \
        'Type=Application' \
        'Name=Meeting Notes' \
        'Comment=Take markdown notes on recurring meetings' \
        "Exec=$HOME/.local/bin/meeting-notes" \
        'Icon=meeting-notes' \
        'Terminal=false' \
        'StartupWMClass=meeting-notes' \
        'Categories=Office;Utility;' > "$desktop"
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    echo "Installed to ~/.local/bin/meeting-notes"
    echo "Launch 'Meeting Notes' from the GNOME app grid (or run 'meeting-notes' if ~/.local/bin is on PATH)."

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
