@echo off
title Battle App - DEV MODE
color 0E
echo.
echo  ====================================
echo   BATTLE APP - Modo Desarrollo
echo  ====================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descargalo de https://nodejs.org
    pause
    exit /b
)

echo [0/3] Cerrando procesos previos en puertos 3000 y 5173...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000 "') do (
    taskkill /PID %%a /F >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
    taskkill /PID %%a /F >nul 2>nul
)
echo    Listo.

echo [1/3] Instalando dependencias del servidor...
call npm install

echo [2/3] Preparando cliente para Windows...
cd client
if not exist node_modules\.bin\vite.cmd (
    echo    Limpiando node_modules de Linux e instalando para Windows...
    if exist node_modules rmdir /s /q node_modules
    if exist package-lock.json del package-lock.json
)
call npm install
cd ..

echo [3/3] Iniciando en modo desarrollo...
echo.
echo  ====================================
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000
echo   Password admin: admin123
echo  ====================================
echo.

call npm run dev
pause
