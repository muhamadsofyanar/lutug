# LUTUG / InsyaRah — paket instalasi bersih

Aplikasi React + PHP + SQLite, dikemas untuk Dockerfile di Coolify.
Mulai dari `PANDUAN-COOLIFY.md` dalam paket unduhan.

Build frontend: `cd frontend && npm ci && npm run build`.
Docker membangun frontend otomatis dan memasang dependensi PHP dari composer.lock.
Jangan unggah node_modules, vendor, database, .env, lampiran, atau materi kursus.

Paket ini untuk instalasi baru. Database lama tidak disertakan dan migrasi seluruh
varian database lama belum diuji. Jangan menimpa instalasi lama tanpa cadangan.
