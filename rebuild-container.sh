#!/bin/bash

# Production docker-compose file
COMPOSE_FILE="docker-compose.prod.yml"

echo "Which container do you want to rebuild?"
echo "1) frontend"
echo "2) backend"
read -p "Enter 1 or 2: " choice

case $choice in
  1)
    CONTAINER="frontend"
    SERVICE_DIR="frontend"
    ;;
  2)
    CONTAINER="backend"
    SERVICE_DIR="nestjs_backend"
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo "You chose to rebuild: $CONTAINER"

# Confirm action
read -p "Do you want to proceed with fetch, pull, and rebuild $CONTAINER? (y/n): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
fi

# Go to service directory and pull latest code
echo "Fetching latest code for $CONTAINER..."
cd "$SERVICE_DIR" || { echo "Directory $SERVICE_DIR not found!"; exit 1; }

git fetch origin
git pull origin main || { echo "Git pull failed! Aborting."; exit 1; }

cd - > /dev/null

# Optional prune
read -p "Do you want to prune builder cache and unused images? (y/n): " prune
if [[ "$prune" == "y" || "$prune" == "Y" ]]; then
    echo "Pruning builder cache..."
    docker builder prune -f
    echo "Pruning unused images..."
    docker image prune -f
fi

# Build the container WITHOUT stopping the old one first
echo "Building new image for $CONTAINER..."
docker compose -f $COMPOSE_FILE build --no-cache $CONTAINER || { 
    echo "❌ Build failed! The old $CONTAINER is still running safely."
    exit 1
}

# Swap the container (Downtime: seconds)
echo "Swapping $CONTAINER (stopping old, starting new)..."
docker compose -f $COMPOSE_FILE up -d --no-deps $CONTAINER

echo "✅ $CONTAINER has been fetched, rebuilt, and started successfully!"
