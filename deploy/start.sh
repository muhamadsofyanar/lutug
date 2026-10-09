#!/bin/sh
set -eu
mkdir -p /data/database /data/uploads /data/backups /data/sessions
chown -R www-data:www-data /data
exec docker-php-entrypoint "$@"
