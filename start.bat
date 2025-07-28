@echo off
echo Starting End-to-End Encrypted Chat App...
echo.

echo Starting Backend Server...
start "Backend" cmd /k "cd backend && python run.py"

echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Open your browser to http://localhost:3000 to start chatting!
pause