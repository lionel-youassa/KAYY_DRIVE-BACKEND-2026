# Utilise une image Python officielle
FROM python:3.9-slim-buster

# Définit le répertoire de travail dans le conteneur
WORKDIR /app

# Copie le fichier de dépendances et installe-les
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=300 -r requirements.txt

# Copie le reste du code de l'application
COPY app/ ./app/

# Expose le port sur lequel FastAPI s'exécute
EXPOSE 8000

# Commande pour démarrer l'application FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
