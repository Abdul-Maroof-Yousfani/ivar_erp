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

        info "Building NestJS backend..."
        NODE_OPTIONS="--max-old-space-size=3072" bun run build || { error "Backend build failed!"; exit 1; }

        info "Restarting PM2 backend process..."
        BACKEND_RESTARTED=false
        for proc in "backend" "spl-backend" "nestjs-backend"; do
            if pm2 describe "$proc" > /dev/null 2>&1; then
                info "Restarting PM2 process '$proc'..."
                if pm2 restart "$proc" --update-env; then
                    success "Backend successfully restarted ($proc)."
                    BACKEND_RESTARTED=true
                    break
                fi
            fi
        done

        if [ "$BACKEND_RESTARTED" = false ]; then
            warn "No existing PM2 process found among (backend, spl-backend, nestjs-backend). Attempting restart on 'backend'..."
            pm2 restart backend --update-env || warn "PM2 restart backend failed. Please check pm2 list."
        fi
    else
        error "Backend directory not found at $ROOT_DIR/nestjs_backend"
        exit 1
    fi
fi

# ==========================================
# FRONTEND UPDATE FLOW
# ==========================================
if [ "$TARGET" = "both" ] || [ "$TARGET" = "frontend" ]; then
    header "Frontend Update (frontend)"
    if cd "$ROOT_DIR/frontend"; then
        info "Installing frontend dependencies (bun install)..."
        bun install || { error "Frontend dependency installation failed!"; exit 1; }

        info "Building Next.js frontend directly into .next..."
        NODE_OPTIONS="--max-old-space-size=3072" bun run build || { error "Frontend build failed!"; exit 1; }

        # Check for standalone output and copy static/public directories
        if [ -d ".next/standalone" ]; then
            info "Copying static assets and public files to standalone folder..."
            mkdir -p .next/standalone/.next
            cp -rf .next/static .next/standalone/.next/static
            cp -rf public .next/standalone/public

            # If standalone has nested frontend folder (monorepo structure)
            if [ -d ".next/standalone/frontend" ]; then
                mkdir -p .next/standalone/frontend/.next
                cp -rf .next/static .next/standalone/frontend/.next/static
                cp -rf public .next/standalone/frontend/public
            fi
            success "Standalone assets copied successfully."
        fi

        info "Restarting PM2 frontend process..."
        # Try known frontend PM2 process names (frontend2, spl-frontend, frontend)
        FRONTEND_RESTARTED=false
        for proc in "frontend2" "spl-frontend" "frontend"; do
            if pm2 describe "$proc" > /dev/null 2>&1; then
                info "Restarting PM2 process '$proc'..."
                if pm2 restart "$proc" --update-env; then
                    success "Frontend successfully restarted ($proc)."
                    FRONTEND_RESTARTED=true
                    break
                fi
            fi
        done

        if [ "$FRONTEND_RESTARTED" = false ]; then
            warn "No existing PM2 process found among (frontend2, spl-frontend, frontend). Attempting restart on 'frontend2'..."
            pm2 restart frontend2 --update-env || warn "PM2 restart frontend2 failed. Please check pm2 list."
        fi
    else
        error "Frontend directory not found at $ROOT_DIR/frontend"
        exit 1
    fi
fi

cd "$ROOT_DIR"
header "Update Process Finished (${TARGET^^})!"
pm2 status
