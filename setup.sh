#!/bin/bash

# Setup script for IT Equipment Management System
# This script initializes the development environment

set -e

echo "🚀 Setting up IT Equipment Manager..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+."
    exit 1
fi

echo "✅ Node.js $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env and configure DATABASE_URL, JWT_SECRET"
else
    echo "✅ .env file already exists"
fi

# Create database data directory
mkdir -p server/data

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure .env with your database:"
echo "   - PostgreSQL: postgresql://user:pass@host/dbname"
echo "   - Or Neon: https://neon.tech"
echo "   - Or Railway: https://railway.app"
echo ""
echo "2. Initialize users (optional):"
echo "   npm run init-users"
echo ""
echo "3. Start development:"
echo "   npm run dev:all"
echo ""
echo "4. Or start separately:"
echo "   Terminal 1: npm run backend"
echo "   Terminal 2: npm run dev"
echo ""
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend:  http://localhost:4000"
echo "📍 API:      http://localhost:4000/api"
echo ""
