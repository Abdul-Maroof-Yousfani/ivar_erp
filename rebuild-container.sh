#!/bin/bash

# Styling and colors
NC='\033[0m'
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'

# Helper: print themed messages
info() { echo -e "${CYAN}${BOLD}i$NC $1"; }
success() { echo -e "${GREEN}${BOLD}V$NC $1"; }
warn() { echo -e "${YELLOW}${BOLD}! $NC $1"; }
error() { echo -e "${RED}${BOLD}X$NC $1"; }
header() {
    echo -e "\n${BOLD}${CYAN}========================================"
    echo -e "   $1"
    echo -e "========================================${NC}\n"
}

# Store root directory path
ROOT_DIR=$(pwd)

header "Speed Limit ERP - Atomic Zero-Downtime Build & Reload"

# Determine target build mode (from argument or interactive prompt)
TARGET="$1"

if [ -z "$TARGET" ]; then
    echo -e "${BOLD}Select what you would like to build & update:${NC}"
    echo -e "  ${BOLD}${GREEN}1)${NC} Both (Backend + Frontend) ${YELLOW}[Default]${NC}"
    echo -e "  ${BOLD}${CYAN}2)${NC} Backend only (NestJS + Prisma + PM2 backend cluster)"
    echo -e "  ${BOLD}${MAGENTA}3)${NC} Frontend only (Next.js + PM2 frontend2 cluster)"
    echo -e "  ${BOLD}${RED}4)${NC} Cancel / Exit"
    echo ""
    read -p "Enter choice [1-4, default: 1]: " CHOICE
    echo ""

    case "$CHOICE" in
        2|"backend"|"b"|"api")
            TARGET="backend"
            ;;
        3|"frontend"|"f"|"ui")
            TARGET="frontend"
            ;;
        4|"exit"|"q"|"cancel")
            warn "Build cancelled by user."
            exit 0
            ;;
        1|"both"|"all"|"")
            TARGET="both"
            ;;
        *)
            warn "Invalid choice '$CHOICE'. Defaulting to Both (Backend + Frontend)."
            TARGET="both"
            ;;
    esac
fi

# Normalize CLI argument values
case "$TARGET" in
    backend|b|-b|--backend|api)
        TARGET="backend"
        ;;
    frontend|f|-f|--frontend|ui)
        TARGET="frontend"
        ;;
    both|all|a|-a|--all|--both|1)
        TARGET="both"
        ;;
    *)
        error "Unknown target: $TARGET. Available options: both, backend, frontend"
        exit 1
        ;;
esac

info "Selected build mode: ${BOLD}${GREEN}${TARGET^^}${NC}"

# 1. Monorepo Git Pull
info "Attempting to pull latest code..."
if git pull; then
    success "Git pull completed successfully."
else
    warn "Git pull failed or skipped (likely due to local changes). Continuing with current local codebase..."
fi

# ==========================================
# BACKEND UPDATE FLOW (ATOMIC STAGING BUILD + PM2 CLUSTER RELOAD)
# ==========================================
if [ "$TARGET" = "both" ] || [ "$TARGET" = "backend" ]; then
    header "Backend Update (nestjs_backend)"
    if cd "$ROOT_DIR/nestjs_backend"; then
        info "Installing backend dependencies (bun install)..."
        bun install || { error "Backend dependency installation failed!"; exit 1; }

        info "Running Prisma migrations..."
        bun run prisma:master:generate || { error "Prisma master generate failed!"; exit 1; }
        bun run prisma:master:push --accept-data-loss || { error "Prisma master push failed!"; exit 1; }
        bun run prisma:tenant:generate || { error "Prisma tenant generate failed!"; exit 1; }
        bun run prisma:tenant:push || { error "Prisma tenant push failed!"; exit 1; }

        info "Building NestJS backend into staging output (dist_staging)..."
        NODE_OPTIONS="--max-old-space-size=3072" bun run build -- --outDir dist_staging || { error "Backend build failed!"; exit 1; }

        info "Performing atomic directory swap for backend build artifacts..."
        rm -rf dist_old
        [ -d "dist" ] && mv dist dist_old
        mv dist_staging dist
        rm -rf dist_old

        info "Reloading PM2 backend process in zero-downtime cluster mode..."
        if pm2 reload backend --update-env; then
            success "Backend successfully reloaded with zero downtime (PM2 Cluster)."
        else
            warn "PM2 reload failed. Falling back to PM2 restart..."
            pm2 restart backend || { error "PM2 restart backend failed!"; exit 1; }
            success "Backend successfully restarted."
        fi
    else
        error "Backend directory not found at $ROOT_DIR/nestjs_backend"
        exit 1
    fi
fi

# ==========================================
# FRONTEND UPDATE FLOW (ATOMIC STAGING BUILD + PM2 CLUSTER RELOAD)
# ==========================================
if [ "$TARGET" = "both" ] || [ "$TARGET" = "frontend" ]; then
    header "Frontend Update (frontend)"
    if cd "$ROOT_DIR/frontend"; then
        info "Installing frontend dependencies (bun install)..."
        bun install || { error "Frontend dependency installation failed!"; exit 1; }

        info "Building Next.js frontend into staging output (.next_staging)..."
        NEXT_DIST_DIR=".next_staging" NODE_OPTIONS="--max-old-space-size=3072" bun run build || { error "Frontend build failed!"; exit 1; }

        # Check for standalone output and copy static/public directories if needed
        if [ -d ".next_staging/standalone" ]; then
            info "Copying static assets and public files to standalone folder..."
            mkdir -p .next_staging/standalone/.next_staging
            cp -rf .next_staging/static .next_staging/standalone/.next_staging/static
            cp -rf public .next_staging/standalone/public
            success "Standalone staging assets updated."
        fi

        info "Performing atomic directory swap for frontend build artifacts..."
        rm -rf .next_old
        [ -d ".next" ] && mv .next .next_old
        mv .next_staging .next
        rm -rf .next_old

        info "Reloading PM2 frontend process in zero-downtime cluster mode (frontend2)..."
        if pm2 reload frontend2 --update-env; then
            success "Frontend successfully reloaded with zero downtime (PM2 Cluster)."
        else
            warn "PM2 reload failed. Falling back to PM2 restart..."
            pm2 restart frontend2 || { error "PM2 restart frontend2 failed!"; exit 1; }
            success "Frontend successfully restarted."
        fi
    else
        error "Frontend directory not found at $ROOT_DIR/frontend"
        exit 1
    fi
fi

cd "$ROOT_DIR"
header "Update Process Finished (${TARGET^^})!"
pm2 status
