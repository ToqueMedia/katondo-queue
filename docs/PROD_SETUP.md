# Katondo Queue — Configuração de Produção (VPS)

Copiar para `katondo-queue/.env` e editar valores.

## Variáveis obrigatórias

```bash
MYSQL_ROOT_PASSWORD=<gerar-com-openssl-rand-hex-64>
MYSQL_DATABASE=katondo_queue

JWT_SECRET=<gerar-com-openssl-rand-hex-64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

APP_PORT=80
TZ=Africa/Luanda
NODE_ENV=production
```

## Gerar segredos

```bash
# Gerar JWT_SECRET
openssl rand -hex 64

# Gerar MySQL_PASSWORD
openssl rand -hex 32
```