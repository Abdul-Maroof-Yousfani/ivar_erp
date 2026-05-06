#!/bin/bash
# Bash script to start both frontend and backend for development (Linux/Mac)

echo "=== Speed Limit Development Startup ==="
echo ""

# Check if .env files exist
BACKEND_ENV="nestjs_backend/.env"
FRONTEND_ENV="frontend/.env"

if [ ! -f "$BACKEND_ENV" ]; then
    echo "[WARNING] Backend .env file not found!"
    echo "Creating backend .env from template..."
    cat > "$BACKEND_ENV" << EOF
DATABASE_URL=postgresql://speedlimit:speedlimit123@localhost:5432/speedlimit
PORT=3000
FRONTEND_URL=http://localhost:3001
JWT_ACCESS_SECRET=your-super-secret-access-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
NODE_ENV=development
EOF
    echo "[OK] Backend .env created!"
fi

if [ ! -f "$FRONTEND_ENV" ]; then
    echo "[WARNING] Frontend .env file not found!"
    echo "Creating frontend .env from template..."
    cat > "$FRONTEND_ENV" << EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
API_URL=http://localhost:3000/api
NODE_ENV=development
EOF
    echo "[OK] Frontend .env created!"
fi

echo ""
echo "=== Checking Prerequisites ==="

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "[ERROR] Bun is not installed!"
    echo "Please install Bun from: https://bun.sh"
    exit 1
fi
echo "[OK] Bun is installed"

# Check if Postgres is accessible
echo "Checking database connection..."
if docker ps --filter "name=speed-limit-postgres" --format "{{.Names}}" | grep -q "speed-limit-postgres"; then
    echo "[OK] Postgres container is running"
else
    echo "[WARNING] Postgres container not found. Make sure Docker is running."
    echo "Run: docker-compose up -d postgres"
fi

echo ""
echo "=== Installing Dependencies ==="

# Install backend dependencies
echo "Installing backend dependencies..."
cd nestjs_backend
if [ ! -d "node_modules" ]; then
    bun install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install backend dependencies"
        exit 1
    fi
else
    echo "Backend dependencies already installed, skipping..."
fi
cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    bun install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install frontend dependencies"
        exit 1
    fi
else
    echo "Frontend dependencies already installed, skipping..."
fi
cd ..

echo ""
echo "=== Setting up Database ==="
cd nestjs_backend
echo "Generating Prisma client..."
bun run prisma:generate || echo "[WARNING] Prisma generate failed, continuing anyway..."
cd ..

echo ""
echo "=== Starting Development Servers ==="
echo ""
echo "Backend will run on: http://localhost:3000"
echo "Frontend will run on: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start backend in background
echo "Starting backend..."
cd nestjs_backend
export DATABASE_URL="postgresql://speedlimit:speedlimit123@localhost:5432/speedlimit"
export PORT=3000
export FRONTEND_URL="http://localhost:3001"
export NODE_ENV=development
bun run start:dev &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "Starting frontend..."
cd frontend
export NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api"
export API_URL="http://localhost:3000/api"
export NODE_ENV=development
bun run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "[OK] Both servers are starting!"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait

