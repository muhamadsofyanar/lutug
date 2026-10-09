FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM php:8.3-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-dev libzip-dev unzip \
    && docker-php-ext-install pdo_sqlite zip \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/app
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
COPY config/ ./config/
COPY backend/ ./backend/
COPY --from=frontend /build/dist/ /var/www/html/
COPY deploy/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/start.sh /usr/local/bin/lutug-start
RUN chmod +x /usr/local/bin/lutug-start \
    && mkdir -p /data/database /data/uploads /data/backups /data/sessions \
    && rm -rf /var/www/app/backend/backups \
    && ln -s /data/backups /var/www/app/backend/backups \
    && ln -s /data/uploads /var/www/app/uploads \
    && printf 'session.save_path=/data/sessions\nupload_max_filesize=10M\npost_max_size=12M\nexpose_php=Off\n' > /usr/local/etc/php/conf.d/lutug.ini
ENV DB_CONNECTION=sqlite DB_DATABASE=/data/database/insyarah.sqlite APP_DEBUG=false
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/lutug-start"]
CMD ["apache2-foreground"]
