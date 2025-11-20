# Multi-stage Dockerfile for RAG Service

# =========================
# Builder stage (Python deps only)
# =========================
FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies (no heavy OCR/office tools here)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.7.1

# Configure Poetry to use a project-local virtualenv
ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Set work directory
WORKDIR /app

# Copy Poetry files
COPY pyproject.toml ./
COPY poetry.lock* ./

# Install only production dependencies into .venv
RUN poetry install --only=main --no-root && rm -rf "$POETRY_CACHE_DIR"

# Copy source code (for any build-time hooks)
COPY . .

# =========================
# Development stage (keeps Poetry + dev deps)
# =========================
FROM python:3.11-slim AS development

# Dev environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies including OCR/office tools for dev
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    libmagic1 \
    poppler-utils \
    tesseract-ocr \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.7.1

# Configure Poetry (dev image can use global env)
ENV POETRY_NO_INTERACTION=1 \
    POETRY_VENV_IN_PROJECT=0 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Copy project metadata and source
COPY pyproject.toml ./
COPY poetry.lock* ./
COPY . .

# Install dependencies including dev
RUN poetry install --with dev --no-root && rm -rf "$POETRY_CACHE_DIR"

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 8082

# Default command for development (with reload)
CMD ["poetry", "run", "uvicorn", "src.rag_service.main:app", "--host", "0.0.0.0", "--port", "8082", "--reload"]

# =========================
# Production runtime stage
# =========================
FROM python:3.11-slim AS production

# Runtime environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install only runtime system dependencies, including OCR/office tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    libmagic1 \
    poppler-utils \
    tesseract-ocr \
    libreoffice \
    && rm -rf /var/lib/apt/lists/*

# Set home and cache directories for non-root user and ensure writable
ENV HOME=/home/rag XDG_CACHE_HOME=/home/rag/.cache

# Create non-root user
RUN groupadd -r rag && useradd -r -g rag rag && \
    mkdir -p /home/rag/.cache && chown -R rag:rag /home/rag

# Set work directory
WORKDIR /app

# Copy virtualenv from builder (keep same path to preserve shebang)
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Create necessary directories and fix ownership
RUN mkdir -p /app/uploads /app/logs && \
    chown -R rag:rag /app

# Copy source code as non-root owner
COPY --chown=rag:rag . .

# Switch to non-root user
USER rag

# Expose port
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8082/health || exit 1

# Default command for production: run via uvicorn directly (no Poetry at runtime)
CMD ["uvicorn", "src.rag_service.main:app", "--host", "0.0.0.0", "--port", "8082", "--workers", "4"]
