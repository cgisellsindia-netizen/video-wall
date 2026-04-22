@echo off
echo ==========================================
echo   Instamart Clone - Pentest Environment
echo ==========================================
echo.

:: Check if backend is already running
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% == 0 (
    echo [+] Backend already running on port 3001
) else (
    echo [*] Starting backend server...
    start "Instamart Backend" cmd /k "cd /d C:\temp\instamart-clone\backend && node server.js"
    timeout /t 3 >nul
)

:: Check if frontend is already running
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% == 0 (
    echo [+] Frontend already running on port 3000
) else (
    echo [*] Starting frontend server...
    start "Instamart Frontend" cmd /k "cd /d C:\temp\instamart-clone\frontend && npm start"
)

echo.
echo ==========================================
echo   Access Points:
echo   Frontend: http://localhost:3000
echo   Backend API: http://localhost:3001
echo   API Docs: http://localhost:3001/api/health
echo ==========================================
echo.
echo   Test Credentials:
echo   User: user@test.com / password123
echo   Admin: admin@instamart.com / admin123
echo   Victim: victim@test.com / password123
echo.
echo   Pentest Script: pentest\sqli_exploit.py
echo   Vulnerabilities: VULNERABILITIES.md
echo ==========================================
pause
