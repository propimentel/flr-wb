#!/bin/bash

echo ""
echo "🚀 Starting development servers..."
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both servers using concurrently
npx concurrently \
  --names "FRONTEND,BACKEND" \
  --prefix-colors "cyan,yellow" \
  "cd frontend && yarn dev" \
  "cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 4000"
