#!/bin/bash

COMPOSE="docker compose -f docker-compose.prod.yml"
domains=(
  auth.spl.inplsoftwares.com
  hr.spl.inplsoftwares.com
  master.spl.inplsoftwares.com
  pos.spl.inplsoftwares.com
  erp.spl.inplsoftwares.com
  admin.spl.inplsoftwares.com
)
rsa_key_size=4096
data_path="./certbot"
email="admin@inplsoftwares.com"  # Change to your email
staging=0  # Set 1 for testing

# -----------------------
# Step 0: Prepare folders
# -----------------------
mkdir -p "$data_path/conf"

# Download TLS params if missing
[ ! -f "$data_path/conf/options-ssl-nginx.conf" ] && \
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"

[ ! -f "$data_path/conf/ssl-dhparams.pem" ] && \
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"

# -----------------------
# Step 1: Create dummy certs for all domains (for safe Nginx start)
# -----------------------
echo "### Creating dummy certificates for all domains ..."
for domain in "${domains[@]}"; do
  path="/etc/letsencrypt/live/$domain"
  mkdir -p "$data_path/conf/live/$domain"
  $COMPOSE run --rm --entrypoint "\
    openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 \
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
done

# -----------------------
# Step 2: Start Nginx with dummy certs
# -----------------------
echo "### Starting Nginx with dummy certificates ..."
$COMPOSE up --force-recreate -d nginx

# -----------------------
# Step 3: Request real certificates (only once)
# -----------------------
echo "### Requesting real Let's Encrypt certificates ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

email_arg="--register-unsafely-without-email"
[ -n "$email" ] && email_arg="-m $email"

staging_arg=""
[ "$staging" != "0" ] && staging_arg="--staging"

$COMPOSE run --rm --entrypoint "\
certbot certonly --webroot -w /var/www/certbot \
  $staging_arg \
  $email_arg \
  $domain_args \
  --rsa-key-size $rsa_key_size \
  --agree-tos \
  --force-renewal" certbot

# -----------------------
# Step 4: Reload Nginx to pick up real certs
# -----------------------
echo "### Reloading Nginx with real certificates ..."
$COMPOSE exec nginx nginx -s reload

echo "✅ SSL setup complete! Certificates are generated and Nginx is running."
echo "They will auto-renew via Certbot, no need to request again unless manually deleted."
