@echo off
echo Starting Chat App Backend...
echo.

cd backend

echo Testing backend setup...
python test_setup.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Backend setup test failed. Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo Starting backend server...
python run_local.py

pause