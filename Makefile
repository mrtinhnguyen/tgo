# Convenience Makefile for TGO deploy workflows (macOS-friendly notifications)
# Usage examples:
#   make build SERVICE=tgo-api          # build+restart one service
#   make build-all                      # build+restart all services
#   make build-api                      # shorthand for tgo-api

SHELL := /bin/sh
OS := $(shell uname)

# Notification command (macOS: play system sound; otherwise: terminal bell)
ifeq ($(OS),Darwin)
  NOTIFY := afplay /System/Library/Sounds/Glass.aiff
else
  NOTIFY := printf '\a'
endif

.PHONY: help build build-all \
	build-api build-ai build-rag build-rag-worker build-rag-beat build-rag-flower \
	build-web build-widget build-platform

help:
	@echo "Targets:"
	@echo "  build SERVICE=<name>   Build+restart a single service (docker compose up -d --build <name>)"
	@echo "  build-all              Build+restart all services"
	@echo "  build-<svc>           Convenience shorthands (api, ai, rag, rag-worker, rag-beat, rag-flower, web, widget, platform)"

# Build a single service by name; always play a sound; propagate original exit status
build:
	@if [ -z "$(SERVICE)" ]; then \
		echo "Usage: make build SERVICE=<service-name>"; \
		$(NOTIFY); \
		exit 1; \
	fi
	@status=0; \
	docker compose up -d --build $(SERVICE) || status=$$?; \
	$(NOTIFY); \
	exit $$status

# Build all services; always play a sound; propagate original exit status
build-all:
	@status=0; \
	docker compose up -d --build || status=$$?; \
	$(NOTIFY); \
	exit $$status

# Convenience shorthands (call the generic build target)
build-api:
	@$(MAKE) build SERVICE=tgo-api

build-ai:
	@$(MAKE) build SERVICE=tgo-ai

build-rag:
	@$(MAKE) build SERVICE=tgo-rag

build-rag-worker:
	@$(MAKE) build SERVICE=tgo-rag-worker

build-rag-beat:
	@$(MAKE) build SERVICE=tgo-rag-beat

build-rag-flower:
	@$(MAKE) build SERVICE=tgo-rag-flower


build-web:
	@$(MAKE) build SERVICE=tgo-web

build-widget:
	@$(MAKE) build SERVICE=tgo-widget-app

build-platform:
	@$(MAKE) build SERVICE=tgo-platform

