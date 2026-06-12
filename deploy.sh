#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Katondo Queue — Deploy Script (VPS local)                  ║
# ║  Usage: ./deploy.sh                                         ║
# ╚══════════════════════════════════════════════════════════════╝
#
# Requer: ssh acesso ao VPS, Docker + Docker Compose instalados
#
# Fluxo:
#   1. Cria diretórios no VPS
#   2. Copia ficheiros do projeto (exclui node_modules, .git)
#   3. Gera .env a partir do template (se não existir)
#   4. Inicializa o MySQL (cria DB e tabelas)
#   5. Faz build e levanta os containers

set -euo pipefail

# ── Cores ──────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERR]${NC}   $1" >&2; }

# ── Defaults ────────────────────────────────────────────────────
SSH_HOST="${SSH_HOST:-10.245.80.114}"
SSH_USER="${SSH_USER:-katondo}"
SSH_PORT="${SSH_PORT:-22}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/$SSH_USER/katondo-queue}"
BACKUP_DIR="$DEPLOY_DIR/backups"
ENV_FILE="$DEPLOY_DIR/.env"

# ── Helpers ────────────────────────────────────────────────────
ssh_run() {
    sshpass -p 'qwerty1234' ssh -p "$SSH_PORT" -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$@"
}

scp_file() {
    sshpass -p 'qwerty1234' scp -P "$SSH_PORT" -o StrictHostKeyChecking=no "$@"
}

rsync_push() {
    rsync -avz --progress -e "sshpass -p 'qwerty1234' ssh -p $SSH_PORT -o StrictHostKeyChecking=no" \
        --exclude='node_modules/' \
        --exclude='.git/' \
        --exclude='client/node_modules/' \
        --exclude='server/node_modules/' \
        --exclude='android/' \
        --exclude='.gradle/' \
        --exclude='keystore.properties' \
        --exclude='*.jks' \
        --exclude='*.keystore' \
        --exclude='dist/' \
        --exclude='.env' \
        --exclude='*.log' \
        --exclude='.DS_Store' \
        "$@" \
        "${SSH_USER}@${SSH_HOST}:${DEPLOY_DIR}/"
}

# ── Checks ─────────────────────────────────────────────────────
check_dependencies() {
    info "A verificar dependências locais..."
    for cmd in ssh scp rsync; do
        if ! command -v $cmd &>/dev/null; then
            error "Falta: $cmd. Instale com brew install $cmd"
            exit 1
        fi
    done
    success "Dependências locais OK"
}

# ── Step 1: Setup remote ─────────────────────────────────────────
setup_remote() {
    info "A configurar diretórios no VPS..."
    ssh_run "mkdir -p $DEPLOY_DIR $BACKUP_DIR && echo 'OK'"
    success "Diretórios criados"
}

# ── Step 2: Sync files ──────────────────────────────────────────
sync_files() {
    info "A sincronizar ficheiros (exclui node_modules, .git, dist)..."
    rsync_push .

    # Garantir que os diretórios de backup existem no remote
    ssh_run "mkdir -p $DEPLOY_DIR/backups $DEPLOY_DIR/ssl"

    success "Ficheiros sincronizados"
}

# ── Step 3: Env setup ───────────────────────────────────────────
setup_env() {
    info "A configurar variáveis de ambiente..."

    if ssh_run "test -f $ENV_FILE" 2>/dev/null; then
        warn ".env já existe no VPS — a usar existente"
    else
        info "A gerar .env com valores padrão..."
        ssh_run bash -c "cat > $ENV_FILE << 'ENVEOF'
# ── Database ──────────────────────────────────────────────────────
MYSQL_ROOT_PASSWORD=Katondo2024!SecureDB
MYSQL_DATABASE=katondo_queue

# ── JWT (mude em produção!) ───────────────────────────────────
JWT_SECRET=\$(openssl rand -hex 64)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── App ─────────────────────────────────────────────────────────
APP_PORT=80
TZ=Africa/Luanda
ENVEOF
"
        success ".env criado — EDITE $ENV_FILE no VPS para personalizar"
    fi
}

# ── Step 4: MySQL init ──────────────────────────────────────────
init_mysql() {
    info "A inicializar MySQL (criar DB + schema)..."

    # Ensure MySQL container is started
    ssh_run "cd $DEPLOY_DIR && docker compose up -d mysql"

    # Get MySQL password from .env
    local MYSQL_PW
    MYSQL_PW=$(ssh_run "grep "MYSQL_ROOT_PASSWORD" $ENV_FILE | cut -d= -f2")

    # Wait for MySQL to be ready
    info "A aguardar MySQL iniciar (até 60s)..."
    local retries=30
    until ssh_run "docker exec katondo-mysql mysqladmin ping -h localhost -u root -p$MYSQL_PW --silent" 2>/dev/null; do
        ((retries--))
        if [ $retries -eq 0 ]; then
            error "MySQL não iniciou a tempo"
            exit 1
        fi
        sleep 2
    done
    success "MySQL online"

    # Create database if not exists
    ssh_run "docker exec katondo-mysql mysql -u root -p$MYSQL_PW -e \
        \"CREATE DATABASE IF NOT EXISTS katondo_queue CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
    success "Database katondo_queue pronta"
}

# ── Step 5: Build & Deploy ──────────────────────────────────────
deploy() {
    info "A fazer build e deploy (pode demorar 5-10 min na primeira vez)..."

    ssh_run "cd $DEPLOY_DIR && docker compose down --remove-orphans 2>/dev/null || true"
    ssh_run "cd $DEPLOY_DIR && docker compose build --no-cache"
    ssh_run "cd $DEPLOY_DIR && docker compose up -d"

    # Wait for app health (proxied via Nginx port 80 to host)
    info "A aguardar aplicação ficar pronta..."
    local retries=30
    until ssh_run "curl -sf http://localhost/api/health >/dev/null" 2>/dev/null; do
        ((retries--))
        if [ $retries -eq 0 ]; then
            error "Aplicação não respondeu a tempo"
            exit 1
        fi
        sleep 3
    done
    success "Aplicação online"

    # ── Step 6: Run database seed ─────────────────────────────────
    info "A executar seed (criar utilizador root)..."
    sleep 3  # Give app a moment to fully start
    if ssh_run "docker exec katondo-app node dist/db/seed.js" 2>/dev/null; then
        success "Seed executado — root/root@123 criado"
    else
        warn "Seed pode já ter sido executado (OK se root existir)"
    fi
}

# ── Step 6: Status ──────────────────────────────────────────────
show_status() {
    echo ""
    echo -e "${BOLD}══════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Katondo Queue — Deploy Completo${NC}"
    echo -e "${BOLD}══════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  🌐  URL:       http://${SSH_HOST}"
    echo -e "  🔑  Login:    root / root@123 (MUDE IMEDIATAMENTE!)"
    echo -e "  📁  Projeto:  $DEPLOY_DIR"
    echo -e "  🗄️   MySQL:   127.0.0.1:3306 (só acesso interno)"
    echo ""
    ssh_run "cd $DEPLOY_DIR && docker compose ps --format table"
    echo ""
    echo -e "  Comandos úteis:"
    echo -e "  Ver logs:     ssh $SSH_USER@$SSH_HOST 'docker logs -f katondo-app'"
    echo -e "  Reiniciar:    ssh $SSH_USER@$SSH_HOST 'cd $DEPLOY_DIR && docker compose restart'"
    echo -e "  Atualizar:    ./deploy.sh  (reescreve .env se existir backup)"
    echo ""
}

# ── Main ────────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${BOLD}Katondo Queue — Deploy${NC}"
    echo -e "  Servidor: ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
    echo -e "  Destino:  $DEPLOY_DIR"
    echo ""

    read -p "Continuar? [Y/n] " confirm
    [[ "${confirm:-Y}" =~ ^[Yy]$ ]] || { echo "Abortado."; exit 0; }

    check_dependencies
    setup_remote
    sync_files
    setup_env
    init_mysql
    deploy
    show_status
}

main "$@"
