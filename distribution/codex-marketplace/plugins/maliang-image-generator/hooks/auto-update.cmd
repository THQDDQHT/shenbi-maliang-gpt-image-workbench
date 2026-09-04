@echo off
setlocal EnableExtensions EnableDelayedExpansion
where node >nul 2>nul
if not errorlevel 1 (
  node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" >nul 2>nul
  if not errorlevel 1 (
    node "%PLUGIN_ROOT%\hooks\auto-update.mjs"
    exit /b !errorlevel!
  )
)
where bun >nul 2>nul
if not errorlevel 1 (
  bun "%PLUGIN_ROOT%\hooks\auto-update.ts"
  exit /b !errorlevel!
)
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%PLUGIN_ROOT%\hooks\auto-update.ps1"
exit /b !errorlevel!
