export function getAllowedOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS;

  if (!raw || raw.trim() === '') {
    return process.env.NODE_ENV === 'production' ? false : true;
  }

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return process.env.NODE_ENV === 'production' ? false : true;
  }

  return origins;
}
