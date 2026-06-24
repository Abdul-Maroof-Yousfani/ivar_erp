# Helper: prompt with default yes (Enter = y)
confirm() {
    local message="$1"
    read -p "$message [Y/n]: " input
    input="${input:-y}"
    [[ "$input" =~ ^[Yy]$ ]]
}

echo "============================================="
echo "🚀 Speed Limit PM2 Rebuild & Deploy Script"
echo "============================================="
echo "Which service do you want to rebuild and restart?"
echo "1) Frontend (speed-limit-frontend)"
echo "2) Backend (speed-limit-backend)"
echo "3) Both"
read -p "Enter 1, 2, or 3: " choice

case $choice in
  1)
    SERVICES=("frontend")
    ;;
  2)
    SERVICES=("backend")
    ;;
  3)
    SERVICES=("backend" "frontend") # Rebuild backend first
    ;;
  *)
    echo "❌ Invalid choice. Exiting."
    exit 1
    ;;
esac

echo "You selected: ${SERVICES[*]}"

confirm "Do you want to proceed with git pull and rebuild?" || { echo "Aborted."; exit 0; }

# Get the script root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || { echo "❌ Failed to change directory to script root!"; exit 1; }

# Rebuild backend
rebuild_backend() {
    echo ""
    echo "⚙️  Rebuilding Backend (nestjs_backend)..."
    cd "$SCRIPT_DIR/nestjs_backend" || { echo "❌ Directory nestjs_backend not found!"; exit 1; }

    echo "📥 Pulling latest code for backend..."
    git fetch origin
    git pull origin main || { echo "❌ Backend Git pull failed! Aborting."; exit 1; }

    echo "📦 Installing backend dependencies..."
    bun install || { echo "❌ Backend dependencies installation failed!"; exit 1; }

    echo "🗄️ Running Prisma migrations/push..."
    bun run prisma:master:generate || { echo "❌ Prisma Master Generate failed!"; exit 1; }
    bun run prisma:master:push || { echo "❌ Prisma Master Push failed!"; exit 1; }
    bun run prisma:tenant:generate || { echo "❌ Prisma Tenant Generate failed!"; exit 1; }
    bun run prisma:tenant:push || { echo "❌ Prisma Tenant Push failed!"; exit 1; }

    echo "🔨 Building NestJS application..."
    bun run build || { echo "❌ Backend build failed!"; exit 1; }

    echo "🔄 Restarting / Starting PM2 backend process..."
    if pm2 show speed-limit-backend > /dev/null 2>&1; then
        pm2 restart speed-limit-backend
    else
        pm2 start dist/src/main.js --name "speed-limit-backend"
    fi
    echo "✅ Backend successfully updated and running!"
}

# Rebuild frontend
rebuild_frontend() {
    echo ""
    echo "🎨 Rebuilding Frontend (frontend)..."
    cd "$SCRIPT_DIR/frontend" || { echo "❌ Directory frontend not found!"; exit 1; }

    echo "📥 Pulling latest code for frontend..."
    git fetch origin
    git pull origin main || { echo "❌ Frontend Git pull failed! Aborting."; exit 1; }

    echo "📦 Installing frontend dependencies..."
    bun install || { echo "❌ Frontend dependencies installation failed!"; exit 1; }

    echo "🔨 Building Next.js application..."
    bun run build || { echo "❌ Frontend build failed!"; exit 1; }

    echo "🔄 Restarting / Starting PM2 frontend process..."
    if pm2 show speed-limit-frontend > /dev/null 2>&1; then
        pm2 restart speed-limit-frontend
    else
        pm2 start "bun run start" --name "speed-limit-frontend" -- --port 3001
    fi
    echo "✅ Frontend successfully updated and running!"
}

for SERVICE in "${SERVICES[@]}"; do
    if [ "$SERVICE" = "backend" ]; then
        rebuild_backend
    elif [ "$SERVICE" = "frontend" ]; then
        rebuild_frontend
    fi
done

echo ""
echo "🎉 Rebuild and update complete for: ${SERVICES[*]}"
