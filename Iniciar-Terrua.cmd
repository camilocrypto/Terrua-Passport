@echo off
setlocal
cd /d "%~dp0"
py -3 -c "import sys;sys.exit(sys.version_info[:2] < (3,8))" >nul 2>&1
if not errorlevel 1 goto runpy
python -c "import sys;sys.exit(sys.version_info[:2] < (3,8))" >nul 2>&1
if not errorlevel 1 goto runpython
echo Instala Python 3.8 o superior y vuelve a abrir este archivo.
pause
exit /b 1
:runpy
py -3 iniciar.py
goto finish
:runpython
python iniciar.py
:finish
if errorlevel 1 pause
