# ciview — local build, codesign, multi-arch release (NO GitHub Actions CI)
#
# Dev / local install (macOS):
#   make build | sign | install | deploy | uninstall
#
# Multi-platform release artifacts (local only — never GitHub CI):
#   make release-binaries   # darwin (this Mac) + linux-x64 via SSH root@vm.services
#   make release            # tag + GitHub Release with binaries from dist/release/
#
# Env overrides:
#   SSH_HOST=vm.services  SSH_USER=root  SSH_TARGET=root@vm.services
#   VERSION=v0.1.0        CODESIGN_IDENTITY=-
#   PREFIX=/usr/local

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c

NAME           := ciview
ENTRY          := src/ciview/main.tsx
DIST_DIR       := dist
RELEASE_DIR    := $(DIST_DIR)/release
BIN            := $(DIST_DIR)/$(NAME)

PREFIX         ?= /usr/local
BINDIR         ?= $(PREFIX)/bin
INSTALL_PATH   := $(BINDIR)/$(NAME)

# Local machine identity for Apple codesign (ad-hoc default)
CODESIGN_IDENTITY ?= -

# Remote Linux builder (native OpenTUI native deps — do not cross-compile from macOS)
SSH_HOST       ?= vm.services
SSH_USER       ?= root
SSH_TARGET     ?= $(SSH_USER)@$(SSH_HOST)
REMOTE_BUILD   ?= /tmp/ciview-build
REMOTE_BUN     ?= $$HOME/.bun/bin/bun

# Version for tags/releases (v-prefix added if missing)
VERSION_RAW    ?= $(shell sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)
VERSION        ?= v$(VERSION_RAW)

UNAME_S        := $(shell uname -s)
UNAME_M        := $(shell uname -m)

ifeq ($(UNAME_M),arm64)
  DARWIN_ARCH  := arm64
else ifeq ($(UNAME_M),aarch64)
  DARWIN_ARCH  := arm64
else
  DARWIN_ARCH  := x64
endif

DARWIN_BIN     := $(RELEASE_DIR)/$(NAME)-darwin-$(DARWIN_ARCH)
LINUX_BIN      := $(RELEASE_DIR)/$(NAME)-linux-x64
CHECKSUMS      := $(RELEASE_DIR)/SHA256SUMS

ifeq ($(CODESIGN_IDENTITY),-)
  CODESIGN_CMD = codesign --force --sign "-" --timestamp=none "$(1)"
else
  CODESIGN_CMD = codesign --force --sign "$(CODESIGN_IDENTITY)" --options runtime --timestamp "$(1)"
endif

.PHONY: help all print-config \
	start test typecheck lint check validate clean \
	build sign verify-sign install deploy uninstall \
	build-darwin build-linux release-binaries checksums \
	release tag push-main ensure-repo \
	ssh-check remote-bun

.DEFAULT_GOAL := help

help: ## Show targets
	@echo "ciview Makefile (local builds only — GitHub Actions CI is DISABLED)"
	@echo ""
	@echo "  Dev:"
	@echo "    make start | test | check | build | sign | deploy | uninstall"
	@echo ""
	@echo "  Multi-arch release (no GHA):"
	@echo "    make build-darwin       → $(DARWIN_BIN)"
	@echo "    make build-linux        → $(LINUX_BIN)  via $(SSH_TARGET)"
	@echo "    make release-binaries   → both + SHA256SUMS"
	@echo "    make release            → git tag $(VERSION) + gh release + assets"
	@echo ""
	@echo "  Env: SSH_TARGET=$(SSH_TARGET)  VERSION=$(VERSION)  CODESIGN_IDENTITY=$(CODESIGN_IDENTITY)"

print-config:
	@echo "VERSION=$(VERSION)"
	@echo "DARWIN_BIN=$(DARWIN_BIN)"
	@echo "LINUX_BIN=$(LINUX_BIN)"
	@echo "SSH_TARGET=$(SSH_TARGET)"
	@echo "REMOTE_BUILD=$(REMOTE_BUILD)"
	@echo "CODESIGN_IDENTITY=$(CODESIGN_IDENTITY)"

# --- dev -------------------------------------------------------------------

start:
	bun run $(ENTRY)

test:
	bun test

typecheck:
	bun run typecheck

lint:
	bun run lint

validate:
	speckit validate

check: test typecheck lint validate

# --- local single binary (host arch) ---------------------------------------

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

build: $(DIST_DIR)
	@command -v bun >/dev/null || { echo "error: bun not found"; exit 1; }
	bun build $(ENTRY) --compile --outfile $(BIN)
	@chmod +x $(BIN)
	@echo "built: $(BIN) ($$(du -h $(BIN) | cut -f1))"
	@file $(BIN)

sign: build
	@command -v codesign >/dev/null || { echo "error: codesign not found (macOS)"; exit 1; }
	$(call CODESIGN_CMD,$(BIN))
	@echo "signed: $(BIN) identity=$(CODESIGN_IDENTITY)"
	@codesign -dv --verbose=2 $(BIN) 2>&1 | head -20

verify-sign:
	@test -x $(BIN) || { echo "error: missing $(BIN)"; exit 1; }
	codesign --verify --verbose=2 $(BIN)

install: sign
	@command -v sudo >/dev/null || { echo "error: sudo not found"; exit 1; }
	sudo install -d "$(BINDIR)"
	sudo install -m 755 "$(BIN)" "$(INSTALL_PATH)"
	@if [ "$(CODESIGN_IDENTITY)" = "-" ]; then \
		sudo codesign --force --sign "-" --timestamp=none "$(INSTALL_PATH)"; \
	else \
		sudo codesign --force --sign "$(CODESIGN_IDENTITY)" --options runtime --timestamp "$(INSTALL_PATH)"; \
	fi
	@echo "installed: $(INSTALL_PATH)"
	@ls -lh "$(INSTALL_PATH)"

deploy: install
	@echo "deploy complete: $(INSTALL_PATH)"

uninstall:
	@if [ -e "$(INSTALL_PATH)" ]; then \
		sudo rm -f "$(INSTALL_PATH)"; \
		echo "removed $(INSTALL_PATH)"; \
	else \
		echo "not installed: $(INSTALL_PATH)"; \
	fi

# --- multi-platform release artifacts (local + SSH Linux) ------------------

$(RELEASE_DIR):
	mkdir -p $(RELEASE_DIR)

## macOS host binary (this machine). Signed with CODESIGN_IDENTITY.
build-darwin: $(RELEASE_DIR)
	@command -v bun >/dev/null || { echo "error: bun not found"; exit 1; }
	@echo "==> build darwin-$(DARWIN_ARCH) on $$(hostname)"
	bun build $(ENTRY) --compile --outfile $(DARWIN_BIN)
	@chmod +x $(DARWIN_BIN)
	@if [ "$$(uname -s)" = "Darwin" ]; then \
		command -v codesign >/dev/null && $(call CODESIGN_CMD,$(DARWIN_BIN)) || true; \
	fi
	@file $(DARWIN_BIN)
	@ls -lh $(DARWIN_BIN)

ssh-check:
	@ssh -o BatchMode=yes -o ConnectTimeout=10 $(SSH_TARGET) 'echo ok:$$(uname -s)-$$(uname -m)' || { \
		echo "error: cannot SSH to $(SSH_TARGET) (BatchMode). Fix keys / HostName."; \
		exit 1; \
	}

## Ensure bun exists on the Linux builder (install if missing).
remote-bun: ssh-check
	@ssh $(SSH_TARGET) 'set -e; \
		export BUN_INSTALL="$$HOME/.bun"; export PATH="$$BUN_INSTALL/bin:$$PATH"; \
		if ! command -v bun >/dev/null 2>&1; then \
			command -v unzip >/dev/null || (export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq unzip curl ca-certificates); \
			curl -fsSL https://bun.sh/install | bash; \
		fi; \
		export PATH="$$HOME/.bun/bin:$$PATH"; \
		bun --version'

## Linux x64 binary: rsync sources → build natively on $(SSH_TARGET) → scp back.
## Do NOT cross-compile OpenTUI natives from macOS (optional packages missing).
build-linux: remote-bun $(RELEASE_DIR)
	@echo "==> rsync → $(SSH_TARGET):$(REMOTE_BUILD)"
	@ssh $(SSH_TARGET) "rm -rf $(REMOTE_BUILD) && mkdir -p $(REMOTE_BUILD)"
	rsync -az --delete \
		--exclude node_modules \
		--exclude dist \
		--exclude .git \
		--exclude '.specify' \
		--exclude 'doc/.specify' \
		--exclude '*.db' \
		--exclude '*.db-*' \
		./ $(SSH_TARGET):$(REMOTE_BUILD)/
	@echo "==> bun install + compile on Linux"
	ssh $(SSH_TARGET) 'set -euo pipefail; \
		export BUN_INSTALL="$$HOME/.bun"; export PATH="$$BUN_INSTALL/bin:$$PATH"; \
		cd $(REMOTE_BUILD); \
		bun install --frozen-lockfile || bun install; \
		mkdir -p dist/release; \
		bun build $(ENTRY) --compile --outfile dist/release/$(NAME)-linux-x64; \
		chmod +x dist/release/$(NAME)-linux-x64; \
		file dist/release/$(NAME)-linux-x64; \
		ls -lh dist/release/$(NAME)-linux-x64'
	scp $(SSH_TARGET):$(REMOTE_BUILD)/dist/release/$(NAME)-linux-x64 $(LINUX_BIN)
	@chmod +x $(LINUX_BIN)
	@file $(LINUX_BIN)
	@ls -lh $(LINUX_BIN)
	@echo "linux artifact: $(LINUX_BIN)"

checksums: $(RELEASE_DIR)
	@set -e; \
	cd $(RELEASE_DIR); \
	rm -f SHA256SUMS; \
	for f in $(NAME)-*; do \
		[ -f "$$f" ] || continue; \
		shasum -a 256 "$$f" >> SHA256SUMS; \
	done; \
	echo "checksums:"; cat SHA256SUMS

## Build all release binaries + checksums (no git / no GitHub).
release-binaries: build-darwin build-linux checksums
	@echo ""
	@echo "Release artifacts ready in $(RELEASE_DIR)/:"
	@ls -lh $(RELEASE_DIR)
	@echo ""
	@echo "Next: make release   # tag $(VERSION) + gh release upload"

# --- git / GitHub release (binaries from this machine, not CI) -------------

ensure-repo:
	@command -v gh >/dev/null || { echo "error: gh CLI required"; exit 1; }
	@if ! git remote get-url origin >/dev/null 2>&1; then \
		echo "creating public GitHub repo farchanjo/ciview …"; \
		gh repo create farchanjo/ciview --public \
			--description "Terminal CI cockpit for GitLab — Bun + OpenTUI (local builds only, no GHA CI)" \
			--source=. --remote=origin; \
	fi

push-main: ensure-repo
	@git push -u origin HEAD
	@# Prefer main tracking if we are on a feature branch that should be main tip:
	@if [ "$$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then \
		echo "note: pushed branch $$(git rev-parse --abbrev-ref HEAD); also update main if needed"; \
	fi

tag:
	@git rev-parse "$(VERSION)" >/dev/null 2>&1 && { echo "tag $(VERSION) already exists"; exit 0; } || true
	git tag -a "$(VERSION)" -m "ciview $(VERSION)"
	@echo "tagged $(VERSION)"

## Create/update GitHub Release and upload local binaries. Never triggers CI builds.
release: release-binaries ensure-repo
	@test -f "$(DARWIN_BIN)" || { echo "missing $(DARWIN_BIN)"; exit 1; }
	@test -f "$(LINUX_BIN)" || { echo "missing $(LINUX_BIN)"; exit 1; }
	@test -f "$(CHECKSUMS)" || { echo "missing $(CHECKSUMS)"; exit 1; }
	@echo "==> ensuring tag $(VERSION)"
	@git rev-parse "$(VERSION)" >/dev/null 2>&1 || git tag -a "$(VERSION)" -m "ciview $(VERSION)"
	@echo "==> push commits + tags"
	git push origin HEAD
	git push origin "$(VERSION)" 2>/dev/null || git push origin "refs/tags/$(VERSION)"
	@echo "==> GitHub Release (assets from local build — CI disabled)"
	@if gh release view "$(VERSION)" >/dev/null 2>&1; then \
		gh release upload "$(VERSION)" \
			"$(DARWIN_BIN)" "$(LINUX_BIN)" "$(CHECKSUMS)" --clobber; \
	else \
		gh release create "$(VERSION)" \
			"$(DARWIN_BIN)" "$(LINUX_BIN)" "$(CHECKSUMS)" \
			--title "ciview $(VERSION)" \
			--notes "$$(printf '%s\n' \
				'## ciview $(VERSION)' \
				'' \
				'Local multi-arch build (**GitHub Actions CI is disabled**).' \
				'' \
				'### Assets' \
				'- `$(notdir $(DARWIN_BIN))` — macOS $(DARWIN_ARCH), Apple codesign (ad-hoc or Developer ID)' \
				'- `$(notdir $(LINUX_BIN))` — Linux x86_64 (built on $(SSH_TARGET))' \
				'- `SHA256SUMS`' \
				'' \
				'### Install' \
				'```bash' \
				'chmod +x $(notdir $(DARWIN_BIN))' \
				'sudo mv $(notdir $(DARWIN_BIN)) /usr/local/bin/ciview' \
				'ciview -h' \
				'```' \
				'' \
				'Auth: `glab auth login` (glab-only).' \
			)"; \
	fi
	@echo ""
	@echo "Release URL:"
	@gh release view "$(VERSION)" --json url -q .url

clean:
	rm -rf $(DIST_DIR)

all: check release-binaries
