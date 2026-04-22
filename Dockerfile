FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg ca-certificates nginx supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build-frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

RUN cp -r /build-frontend/dist/* /usr/share/nginx/html/
COPY nginx-combined.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

RUN adduser --disabled-password --gecos "" appuser \
    && chown -R appuser:appuser /app

RUN mkdir -p /etc/supervisor/conf.d && cat > /etc/supervisor/conf.d/app.conf <<'EOF'
[supervisord]
nodaemon=true
user=root

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true

[program:uvicorn]
command=uvicorn app.main:app --host 0.0.0.0 --port 8000
directory=/app
user=appuser
environment=HOME="/home/appuser",USER="appuser"
autostart=true
autorestart=true
EOF

EXPOSE 80 8000

CMD ["sh", "-c", "alembic upgrade head && supervisord -c /etc/supervisor/conf.d/app.conf"]
