# Общий список на Ubuntu

После `git pull` на сервере установи Node.js и запусти API, чтобы список был общий для ПК и телефона.

```bash
apt update
apt install -y nodejs npm
cd /var/www/the1priority.ru
npm install
```

Создай systemd-сервис:

```bash
nano /etc/systemd/system/watchlist-api.service
```

Вставь:

```ini
[Unit]
Description=Watch list API
After=network.target

[Service]
WorkingDirectory=/var/www/the1priority.ru
ExecStart=/usr/bin/node /var/www/the1priority.ru/server.js
Restart=always
Environment=PORT=3000
Environment=ADMIN_PASSWORD=101112

[Install]
WantedBy=multi-user.target
```

Запусти API:

```bash
systemctl daemon-reload
systemctl enable --now watchlist-api
systemctl status watchlist-api
```

В конфиг Nginx сайта добавь блок `location /api/` до `location /`:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Проверь и перезагрузи Nginx:

```bash
nginx -t
systemctl reload nginx
```

Проверка:

```bash
curl -I http://localhost/api/items
curl http://localhost/api/items
```

