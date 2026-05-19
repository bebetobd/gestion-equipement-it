@echo off
REM Setup script for IT Equipment Management System (Windows)
REM This script initializes the development environment

echo.
echo 🚀 Setting up IT Equipment Manager...
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo ✅ Node.js %NODE_VER%

REM Install dependencies
echo.
echo 📦 Installing dependencies...
call npm install

if not exist .env (
    echo.
    echo 📝 Creating .env file...
    copy .env.example .env
    echo ⚠️  Please edit .env and configure DATABASE_URL, JWT_SECRET
) else (
    echo ✅ .env file already exists
)

REM Create database data directory
if not exist server\data mkdir server\data

echo.
echo ✅ Setup complete!
echo.
echo 📋 Next steps:
echo 1. Configure .env with your database:
echo    - PostgreSQL: postgresql://user:pass@host/dbname
echo    - Or Neon: https://neon.tech
echo    - Or Railway: https://railway.app
echo.
echo 2. Initialize users (optional):
echo    npm run init-users
echo.
echo 3. Start development:
echo    npm run dev:all
echo.
echo 4. Or start separately:
echo    Terminal 1: npm run backend
echo    Terminal 2: npm run dev
echo.
echo 📍 Frontend: http://localhost:5173
echo 📍 Backend:  http://localhost:4000
echo 📍 API:      http://localhost:4000/api
echo.
pause
