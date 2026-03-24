@echo off
title Battle App - Terra Epica
color 0A
echo.
echo  ====================================
echo   BATTLE APP - Terra Epica
echo  ====================================
echo.

:: Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descargalo de https://nodejs.org
    pause
    exit /b
)

echo [1/4] Instalando dependencias del servidor...
call npm install

echo [2/4] Instalando dependencias del cliente...
cd client
call npm install

echo [3/4] Compilando frontend...
call npm run build
cd ..

echo [4/4] Iniciando servidor...
echo.
echo  ====================================
echo   App lista en: http://localhost:3000
echo   Password admin: admin123
echo  ====================================
echo.
echo  Pulsa Ctrl+C para detener el servidor
echo.

set NODE_ENV=production
node server/index.js
pause
