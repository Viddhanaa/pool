@echo off
REM VirtualBox Port Forwarding Setup for Windows
REM Save this file as setup-ports.bat and run on HOST machine

SET VM_NAME=ChocoChoco

echo ========================================
echo  VirtualBox Port Forwarding Setup
echo ========================================
echo.
echo VM Name: %VM_NAME%
echo.

REM Check if VBoxManage exists
where VBoxManage >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: VBoxManage not found!
    echo Please add VirtualBox installation directory to PATH
    echo Example: C:\Program Files\Oracle\VirtualBox
    pause
    exit /b 1
)

echo Adding port forwarding rules...
echo.

REM Delete existing rules (ignore errors)
VBoxManage modifyvm "%VM_NAME%" --natpf1 delete "asd-web" 2>nul
VBoxManage modifyvm "%VM_NAME%" --natpf1 delete "asd-admin" 2>nul
VBoxManage modifyvm "%VM_NAME%" --natpf1 delete "asd-backend" 2>nul
VBoxManage modifyvm "%VM_NAME%" --natpf1 delete "blockscout-web" 2>nul
VBoxManage modifyvm "%VM_NAME%" --natpf1 delete "blockscout-api" 2>nul
VBoxManage modifyvm "%VM_NAME%" --natpf1 delete "geth-rpc" 2>nul
VBoxManage modifyvm "%VM_NAME%" --natpf1 delete "grafana" 2>nul

REM Add new rules
echo [1/7] Adding Web Dashboard (4173)...
VBoxManage modifyvm "%VM_NAME%" --natpf1 "asd-web,tcp,127.0.0.1,4173,10.0.2.2,4173"

echo [2/7] Adding Admin Dashboard (4174)...
VBoxManage modifyvm "%VM_NAME%" --natpf1 "asd-admin,tcp,127.0.0.1,4174,10.0.2.2,4174"

echo [3/7] Adding Backend API (4000)...
VBoxManage modifyvm "%VM_NAME%" --natpf1 "asd-backend,tcp,127.0.0.1,4000,10.0.2.2,4000"

echo [4/7] Adding BlockScout Web (4001)...
VBoxManage modifyvm "%VM_NAME%" --natpf1 "blockscout-web,tcp,127.0.0.1,4001,10.0.2.2,4001"

echo [5/7] Adding BlockScout API (4002)...
VBoxManage modifyvm "%VM_NAME%" --natpf1 "blockscout-api,tcp,127.0.0.1,4002,10.0.2.2,4002"

echo [6/7] Adding Geth RPC (8545)...
VBoxManage modifyvm "%VM_NAME%" --natpf1 "geth-rpc,tcp,127.0.0.1,8545,10.0.2.2,8545"

echo [7/7] Adding Grafana (3000)...
VBoxManage modifyvm "%VM_NAME%" --natpf1 "grafana,tcp,127.0.0.1,3000,10.0.2.2,3000"

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Current port forwarding rules:
VBoxManage showvminfo "%VM_NAME%" | findstr "NIC 1 Rule"
echo.
echo You can now access:
echo   Web Dashboard:    http://localhost:4173
echo   Admin Dashboard:  http://localhost:4174
echo   BlockScout:       http://localhost:4001
echo   Backend API:      http://localhost:4000
echo   Grafana:          http://localhost:3000
echo   Geth RPC:         http://localhost:8545
echo.
echo NOTE: If VM is running, restart it for changes to take effect
echo.
pause
