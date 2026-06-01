#!/bin/bash

# Styling and colors
NC='\033[0m'
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'

# Helper: print themed messages
info() { echo -e "${CYAN}${BOLD}ℹ$NC $1"; }
success() { echo -e "${GREEN}${BOLD}✔$NC $1"; }
warn() { echo -e "${YELLOW}${BOLD}⚠$NC $1"; }
error() { echo -e "${RED}${BOLD}✖$NC $1"; }
header() {
    echo -e "\n${BOLD}${CYAN}========================================"
    echo -e "   $1"
    echo -e "========================================${NC}\n"
}

# Helper: prompt with default yes (Enter = y)
confirm() {
    local message="$1"
    read -p "$message [Y/n]: " input
    input="${input:-y}"
    [[ "$input" =~ ^[Yy]$ ]]
}

# Helper: prompt with default no (Enter = n)
confirm_no() {
    local message="$1"
    read -p "$message [y/N]: " input
    input="${input:-n}"
    [[ "$input" =~ ^[Yy]$ ]]
}

# Store root directory path
ROOT_DIR=$(pwd)

header "Speed Limit ERP Update System"

echo "Select deployment type to update:"
echo "1) PM2 / Normal (Local/VPS Setup)"
echo "2) Docker Compose Setup"
echo "3) Exit"
read -p "Enter 1, 2, or 3: " DEPLOY_MODE

case $DEPLOY_MODE in
  1)
    DEPLOY_NAME="PM2 (Local/VPS)"
    ;;
  2)
    DEPLOY_NAME="Docker Compose"
    ;;
  *)
    info "Exiting."
    exit 0
    ;;
esac

header "Updating: $DEPLOY_NAME"

# 1. Monorepo Git Pull (Optional)
if confirm "Do you want to pull the latest code from git?"; then
    info "Fetching latest commits and submodules..."
    git pull || { error "Git pull failed! Please resolve conflicts before running the script again."; exit 1; }
    git submodule update --init --recursive || warn "Submodule update failed. Continuing..."
    success "Codebase updated successfully!"
else
    info "Skipping git pull."
fi

# ==========================================
# PM2 UPDATE FLOW
# ==========================================
if [ "$DEPLOY_MODE" -eq 1 ]; then
    echo ""
    echo "Which component do you want to update?"
    echo "1) Frontend (PM2: frontend2)"
    echo "2) Backend (PM2: backend)"
    echo "3) Both"
    read -p "Enter 1, 2, or 3: " COMPONENT_CHOICE

    UPDATE_FRONTEND=false
    UPDATE_BACKEND=false

    case $COMPONENT_CHOICE in
      1) UPDATE_FRONTEND=true ;;
      2) UPDATE_BACKEND=true ;;
      3) UPDATE_FRONTEND=true; UPDATE_BACKEND=true ;;
      *) error "Invalid choice. Exiting."; exit 1 ;;
    esac

    # Backend Flow
    if [ "$UPDATE_BACKEND" = true ]; then
        header "Backend Update (nestjs_backend)"
        cd "$ROOT_DIR/nestjs_backend" || { error "Backend directory not found!"; exit 1; }

        if confirm "Install backend dependencies (bun install)?"; then
            info "Installing dependencies..."
            bun install || { error "Dependency installation failed!"; exit 1; }
            success "Dependencies installed."
        fi

        if confirm "Apply Prisma DB pushes?"; then
            info "Running prisma:master:push..."
            bun run prisma:master:push --accept-data-loss || { error "Master DB push failed!"; exit 1; }
            info "Running prisma:tenant:push..."
            bun run prisma:tenant:push || { error "Tenant DB push failed!"; exit 1; }
            success "Database schemas pushed successfully."
        fi

        if confirm "Build backend?"; then
            info "Building backend..."
            NODE_OPTIONS="--max-old-space-size=3072" bun run build || { error "Backend build failed!"; exit 1; }
            success "Backend built successfully."
        fi

        if confirm "Restart PM2 backend process?"; then
            info "Restarting PM2 backend..."
            pm2 restart backend || { error "PM2 restart failed! Check if process name 'backend' exists in 'pm2 list'."; exit 1; }
            success "Backend PM2 process restarted."
        fi
    fi

    # Frontend Flow
    if [ "$UPDATE_FRONTEND" = true ]; then
        header "Frontend Update (frontend)"
        cd "$ROOT_DIR/frontend" || { error "Frontend directory not found!"; exit 1; }

        if confirm "Install frontend dependencies (bun install)?"; then
            info "Installing dependencies..."
            bun install || { error "Dependency installation failed!"; exit 1; }
            success "Dependencies installed."
        fi

        if confirm "Build frontend?"; then
            info "Building frontend (with NODE_OPTIONS)..."
            NODE_OPTIONS="--max-old-space-size=3072" bun run build || { error "Frontend build failed!"; exit 1; }
            
            # Check for standalone output and copy static/public directories if needed
            if [ -d ".next/standalone" ]; then
                info "Copying static assets and public files to .next/standalone..."
                cp -rf .next/static .next/standalone/.next/static
                cp -rf public .next/standalone/public
                success "Standalone folder assets updated."
            fi
            success "Frontend built successfully."
        fi

        if confirm "Restart PM2 frontend process (frontend2)?"; then
            info "Restarting PM2 frontend2..."
            pm2 restart frontend2 || { error "PM2 restart failed! Check if process name 'frontend2' exists in 'pm2 list'."; exit 1; }
            success "Frontend PM2 process restarted."
        fi
    fi

    header "PM2 Update Complete!"
    pm2 status
    exit 0
fi

# ==========================================
# DOCKER COMPOSE FLOW
# ==========================================
if [ "$DEPLOY_MODE" -eq 2 ]; then
    COMPOSE_FILE="docker-compose.prod.yml"

    echo ""
    echo "Which container do you want to rebuild?"
    echo "1) Frontend"
    echo "2) Backend"
    echo "3) Both"
    read -p "Enter 1, 2, or 3: " DOCKER_CHOICE

    case $DOCKER_CHOICE in
      1)
        CONTAINERS=("frontend")
        ;;
      2)
        CONTAINERS=("backend")
        ;;
      3)
        CONTAINERS=("frontend" "backend")
        ;;
      *)
        error "Invalid choice. Exiting."
        exit 1
        ;;
    esac

    # Optional prune
    if confirm_no "Do you want to prune builder cache and unused images to free up space?"; then
        info "Pruning builder cache..."
        docker builder prune -f
        info "Pruning unused images..."
        docker image prune -f
    fi

    # Build Images (Optional)
    BUILD_DOCKER=false
    if confirm "Do you want to build/rebuild the docker images?"; then
        BUILD_DOCKER=true
    fi

    if [ "$BUILD_DOCKER" = true ]; then
        for CONTAINER in "${CONTAINERS[@]}"; do
            header "Building Docker Image: $CONTAINER"
            docker compose -f $COMPOSE_FILE build --no-cache $CONTAINER || {
                error "Build failed for $CONTAINER! The old container is still running safely."
                exit 1
            }
        done
    fi

    # Restart/Swap Containers
    if confirm "Do you want to restart/swap the selected docker containers now?"; then
        for CONTAINER in "${CONTAINERS[@]}"; do
            header "Swapping Container: $CONTAINER"
            docker compose -f $COMPOSE_FILE up -d --no-deps $CONTAINER || {
                error "Failed to start $CONTAINER container!"
                exit 1
            }
        done
        success "Containers updated and started successfully!"
    else
        info "Skipping container restart."
    fi

    header "Docker Compose Update Complete!"
    docker compose -f $COMPOSE_FILE ps
    exit 0
fi
