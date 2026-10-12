# syntax=docker/dockerfile:1

# ---- build stage: resolve wheels into an isolated virtualenv ----------------
FROM python:3.12-slim AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
# pip is only needed to build the venv. Its vendored urllib3/msgpack were flagged
# HIGH by Trivy, so it is removed and never ships in the runtime image.
RUN pip install --upgrade pip \
 && pip install -r requirements.txt \
 && python -m pip uninstall -y pip

# ---- runtime stage: no compilers, no pip cache, non-root --------------------
FROM python:3.12-slim AS runtime
LABEL org.opencontainers.image.title="pantrix-backend" \
      org.opencontainers.image.description="Pantrix FastAPI backend" \
      org.opencontainers.image.authors="Dhruv Sharma (Spiritsfuse)" \
      org.opencontainers.image.source="https://github.com/spiritsfuse"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# The base image's own pip and ensurepip wheels are not needed at runtime and
# only add CVE surface.
RUN python -m pip uninstall -y pip setuptools wheel || true \
 && rm -rf /usr/local/lib/python3.12/ensurepip/_bundled /usr/local/bin/pip* \
 && groupadd --system --gid 10001 pantrix \
 && useradd --system --uid 10001 --gid pantrix --no-create-home --shell /usr/sbin/nologin pantrix

WORKDIR /app
COPY --from=build /opt/venv /opt/venv
COPY --chown=root:root alembic.ini ./
COPY --chown=root:root alembic ./alembic
COPY --chown=root:root app ./app
COPY --chown=root:root --chmod=0755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER 10001:10001
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
