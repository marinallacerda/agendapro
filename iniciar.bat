@echo off
echo.
echo  ========================================
echo    AgendaPro - Iniciando...
echo  ========================================
echo.

cd /d "%~dp0"

echo [1/2] Iniciando servidor (porta 3001)...
start "AgendaPro - Servidor" cmd /k "cd server && node_modules\.bin\ts-node-dev.cmd --transpile-only src/index.ts"

timeout /t 4 /nobreak > nul

echo [2/2] Iniciando interface (porta 5173)...
start "AgendaPro - Interface" cmd /k "cd client && node_modules\.bin\vite.cmd"

timeout /t 4 /nobreak > nul

echo.
echo  ========================================
echo    Acesse: http://localhost:5173
echo  ========================================
echo.
start http://localhost:5173
