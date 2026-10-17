# Service IA (FastAPI) pour Render
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=300 -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

# Render fournit le port dans PORT ; 8000 par défaut en local.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]