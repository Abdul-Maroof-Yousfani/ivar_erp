#!/bin/bash

# Test Sandwich Rule API
# This script will apply sandwich rules to all Friday-Monday absent pairs

echo "🔧 Testing Sandwich Rule API..."
echo ""

# Get your auth token first
# Replace YOUR_TOKEN with actual token from login
TOKEN="YOUR_TOKEN_HERE"

# Apply sandwich rules for all dates
echo "📅 Applying sandwich rules for all dates..."
curl -X POST http://localhost:3000/api/attendances/apply-sandwich-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  | jq '.'

echo ""
echo "✅ Done! Check attendance records now."
