FROM postgis/postgis:15-3.3

# Install pgAdmin4 via pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libpq-dev \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install pgAdmin4
RUN pip3 install --no-cache-dir pgadmin4

# Configure pgAdmin4
ENV PGADMIN_CONFIG_SERVER_MODE=False
ENV PGADMIN_DEFAULT_EMAIL=admin@kayydrive.local
ENV PGADMIN_DEFAULT_PASSWORD=admin123
ENV PGADMIN_LISTEN_PORT=5050

# Create config directory
RUN mkdir -p /var/lib/pgadmin && chown -R postgres:postgres /var/lib/pgadmin

# Create startup script
RUN echo '#!/bin/bash\n\
# Start PostgreSQL\n\
su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data start"\n\
sleep 5\n\
# Start pgAdmin4 in server mode\n\
cd /usr/local/lib/python3.9/dist-packages/pgadmin4\n\
PYTHONPATH=/usr/local/lib/python3.9/dist-packages/pgadmin4 python3 pgAdmin4.py &\n\
tail -f /dev/null' > /start.sh && chmod +x /start.sh

CMD ["/start.sh"]
