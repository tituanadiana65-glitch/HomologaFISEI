@echo off
rem Doble clic para levantar HomologaFISEI (Sprint 1)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar.ps1"
