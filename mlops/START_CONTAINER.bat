@echo off
echo ========================================
echo Starting DeepSea eDNA API Container
echo ========================================
echo.

REM Stop and remove any existing container
docker stop deepsea-edna-api 2>nul
docker rm deepsea-edna-api 2>nul

REM Start the container
docker run -d --name deepsea-edna-api -p 8000:8000 --add-host=host.docker.internal:host-gateway deepsea-edna-api:v1.2

echo.
echo ========================================
echo Container started!
echo ========================================
echo.
echo API available at:
echo   - Main: http://localhost:8000
echo   - Docs: http://localhost:8000/docs
echo   - Health: http://localhost:8000/health
echo.
echo View logs: docker logs -f deepsea-edna-api
echo.
pause
