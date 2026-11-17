#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
BUILD=0
NO_PULL=0
OPEN=0
SKIP_HEALTH_CHECK=0

for arg in "$@"; do
  case "$arg" in
    --build|-b) BUILD=1 ;;
    --no-pull) NO_PULL=1 ;;
    --open) OPEN=1 ;;
    --skip-health-check) SKIP_HEALTH_CHECK=1 ;;
    --help|-h)
      echo "Usage: ./start.sh [--build] [--no-pull] [--open] [--skip-health-check]"
      exit 0
      ;;
    *)
      echo "Option inconnue: $arg" >&2
      exit 1
      ;;
  esac
done

die() {
  echo "ERREUR: $*" >&2
  exit 1
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

random_b64() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$1" | tr -d '\n'
  else
    head -c "$1" /dev/urandom | base64 | tr -d '\n'
  fi
}

get_env() {
  grep -E "^$1=" .env | head -n 1 | cut -d= -f2- || true
}

set_env() {
  local name="$1"
  local value="$2"
  if grep -qE "^${name}=" .env; then
    sed -i.bak "s|^${name}=.*|${name}=${value}|" .env
    rm -f .env.bak
  else
    printf '%s=%s\n' "$name" "$value" >> .env
  fi
}

command -v docker >/dev/null 2>&1 || die "Docker n'est pas installe."
docker info >/dev/null 2>&1 || die "Docker n'est pas demarre. Lancez Docker Desktop puis relancez ce script."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 n'est pas disponible."

if [ ! -f .env ]; then
  [ -f .env.example ] || die "Fichier .env.example introuvable."
  cp .env.example .env
  echo "Fichier .env cree depuis .env.example."
fi

if [ "$(get_env POSTGRES_USER)" = "your_postgres_user" ] || [ -z "$(get_env POSTGRES_USER)" ]; then
  set_env POSTGRES_USER kayydrive_user
fi

if [ "$(get_env POSTGRES_PASSWORD)" = "your_postgres_password" ] || [ -z "$(get_env POSTGRES_PASSWORD)" ]; then
  set_env POSTGRES_PASSWORD "$(random_hex 24)"
fi

if [ "$(get_env POSTGRES_DB)" = "your_postgres_db" ] || [ -z "$(get_env POSTGRES_DB)" ]; then
  set_env POSTGRES_DB kayydrive_db
fi

if [ -z "$(get_env DATABASE_URL)" ] || printf '%s' "$(get_env DATABASE_URL)" | grep -q 'your_postgres_'; then
  set_env DATABASE_URL "postgresql://$(get_env POSTGRES_USER):$(get_env POSTGRES_PASSWORD)@postgres:5432/$(get_env POSTGRES_DB)"
fi

if [ -z "$(get_env JWT_SECRET)" ] || printf '%s' "$(get_env JWT_SECRET)" | grep -q 'change_in_production'; then
  set_env JWT_SECRET "$(random_b64 48)"
fi

if [ -z "$(get_env CORS_ORIGINS)" ]; then
  set_env CORS_ORIGINS "http://localhost:55555"
fi

if [ -z "$(get_env IMAGE_TAG)" ]; then
  set_env IMAGE_TAG latest
fi

if [ -z "$(get_env ENVIRONMENT)" ]; then
  set_env ENVIRONMENT development
fi

image_prefix="$(get_env IMAGE_PREFIX)"
if [ -z "$image_prefix" ] || printf '%s' "$image_prefix" | grep -q 'CHANGE_ME'; then
  remote="$(git remote get-url origin 2>/dev/null || true)"
  owner="$(printf '%s' "$remote" | sed -nE 's#.*github\.com[:/]([^/]+)/.*#\1#p')"
  [ -n "$owner" ] || owner="lionel-youassa"
  image_prefix="ghcr.io/$owner"
  set_env IMAGE_PREFIX "$image_prefix"
fi

image_tag="$(get_env IMAGE_TAG)"
[ -n "$image_tag" ] || image_tag="latest"
core_port="$(get_env CORE_API_PORT)"
[ -n "$core_port" ] || core_port="3200"

compose_args=(docker compose -f "$COMPOSE_FILE" --env-file .env)
if [ -f osrm-data/cameroon-latest.osrm ]; then
  compose_args+=(--profile osrm)
  echo "Profil OSRM active."
else
  echo "Donnees OSRM absentes : service de navigation non demarre."
fi

if [ "$BUILD" = "1" ]; then
  echo "Construction locale des images..."
  docker build -t "$image_prefix/kayydrive-core-api:$image_tag" ./core-api
  docker build -t "$image_prefix/kayydrive-ia-service:$image_tag" ./ia-service
elif [ "$NO_PULL" != "1" ]; then
  echo "Telechargement des images $image_prefix/*:$image_tag..."
  "${compose_args[@]}" pull || die "Impossible de telecharger les images. Verifiez IMAGE_PREFIX, IMAGE_TAG et l'acces aux packages GHCR. Pour construire localement : ./start.sh --build"
fi

echo "Demarrage des services..."
"${compose_args[@]}" up -d

if [ "$SKIP_HEALTH_CHECK" != "1" ]; then
  if command -v curl >/dev/null 2>&1; then
    echo "Attente de Core API sur http://localhost:$core_port/health..."
    healthy=0
    attempt=0
    while [ "$attempt" -lt 80 ]; do
      if curl -fsS "http://localhost:$core_port/health" >/dev/null 2>&1; then
        healthy=1
        break
      fi
      attempt=$((attempt + 1))
      sleep 3
    done
    if [ "$healthy" != "1" ]; then
      "${compose_args[@]}" logs --tail=100 migrate core-api
      die "Core API n'est pas sain apres 4 minutes."
    fi
  else
    echo "curl absent : verification de sante ignoree."
  fi
fi

echo ""
echo "KayyDrive est demarre."
echo "Core API : http://localhost:$core_port"
echo "Swagger  : http://localhost:$core_port/api/docs"
echo "MinIO    : http://localhost:9001"
echo "Frontend : flutter run -d chrome --web-port=55555 --dart-define=API_URL=http://localhost:$core_port"

if [ "$OPEN" = "1" ]; then
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$core_port/api/docs" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "http://localhost:$core_port/api/docs" >/dev/null 2>&1 || true
  fi
fi
