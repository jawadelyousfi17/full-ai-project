#!/bin/bash

# AI Video Generation Project - Startup Script
# This script uses PM2 to manage both backend and frontend processes

set -e

echo "🚀 Starting AI Video Generation Project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to get PM2 command (global or local)
get_pm2_cmd() {
    if command -v pm2 &> /dev/null; then
        echo "pm2"
    elif [ -f "./node_modules/.bin/pm2" ]; then
        # Use npx to run local PM2
        echo "npx pm2"
    else
        echo -e "${RED}PM2 not found. Please run './run.sh install' first${NC}" >&2
        exit 1
    fi
}

# Function to check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}PM2 not found. Trying to install PM2...${NC}"
        
        # Try global installation first
        if npm install -g pm2 2>/dev/null; then
            echo -e "${GREEN}PM2 installed globally successfully!${NC}"
        else
            echo -e "${YELLOW}Global installation failed. Installing PM2 locally...${NC}"
            npm install pm2 --save-dev
            
            # Add local PM2 to PATH for this session
            export PATH="$PATH:./node_modules/.bin"
            
            if [ -f "./node_modules/.bin/pm2" ]; then
                echo -e "${GREEN}PM2 installed locally successfully!${NC}"
                echo -e "${YELLOW}Note: Using local PM2 installation${NC}"
            else
                echo -e "${RED}Failed to install PM2. Please install manually:${NC}"
                echo -e "${BLUE}  sudo npm install -g pm2${NC}"
                echo -e "${BLUE}  or${NC}"
                echo -e "${BLUE}  npm install pm2 --save-dev${NC}"
                exit 1
            fi
        fi
    else
        echo -e "${GREEN}PM2 is already installed${NC}"
    fi
}

# Function to install dependencies
install_dependencies() {
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    npm install
    
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
    
    echo -e "${GREEN}Dependencies installed successfully!${NC}"
}

# Function to start services with PM2
start_services() {
    echo -e "${BLUE}Starting services with PM2...${NC}"
    
    # Get PM2 command
    PM2_CMD=$(get_pm2_cmd)
    
    # Stop any existing processes
    $PM2_CMD delete ai-backend 2>/dev/null || true
    $PM2_CMD delete ai-frontend 2>/dev/null || true
    
    # Start backend server
    echo -e "${BLUE}Starting backend server...${NC}"
    $PM2_CMD start npm --name "ai-backend" -- run api
    
    # Wait a moment for backend to start
    sleep 3
    
    # Start frontend development server
    echo -e "${BLUE}Starting frontend development server...${NC}"
    cd frontend
    $PM2_CMD start npm --name "ai-frontend" -- run dev -- --host
    cd ..
    
    echo -e "${GREEN}Services started successfully!${NC}"
}

# Function to show status and logs
show_status() {
    # Get PM2 command
    PM2_CMD=$(get_pm2_cmd)
    
    echo -e "${BLUE}Service Status:${NC}"
    $PM2_CMD status
    
    echo -e "\n${YELLOW}Useful PM2 Commands:${NC}"
    echo -e "  ${GREEN}$PM2_CMD status${NC}           - Show process status"
    echo -e "  ${GREEN}$PM2_CMD logs${NC}             - Show all logs"
    echo -e "  ${GREEN}$PM2_CMD logs ai-backend${NC}  - Show backend logs"
    echo -e "  ${GREEN}$PM2_CMD logs ai-frontend${NC} - Show frontend logs"
    echo -e "  ${GREEN}$PM2_CMD restart all${NC}      - Restart all processes"
    echo -e "  ${GREEN}$PM2_CMD stop all${NC}         - Stop all processes"
    echo -e "  ${GREEN}$PM2_CMD delete all${NC}       - Delete all processes"
    
    echo -e "\n${YELLOW}Application URLs:${NC}"
    echo -e "  ${GREEN}Backend API:${NC}  http://localhost:3000"
    echo -e "  ${GREEN}Frontend:${NC}     http://localhost:5173"
    echo -e "  ${GREEN}Health Check:${NC} http://localhost:3000/health"
}

# Main execution
main() {
    echo -e "${BLUE}=== AI Video Generation Project Startup ===${NC}"
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        echo -e "${RED}Error: package.json not found. Please run this script from the project root directory.${NC}"
        exit 1
    fi
    
    # Parse command line arguments
    case "${1:-start}" in
        "install")
            check_pm2
            install_dependencies
            ;;
        "start")
            check_pm2
            start_services
            show_status
            ;;
        "stop")
            # Get PM2 command
            PM2_CMD=$(get_pm2_cmd)
            echo -e "${YELLOW}Stopping all services...${NC}"
            $PM2_CMD stop all
            echo -e "${GREEN}All services stopped${NC}"
            ;;
        "restart")
            # Get PM2 command
            PM2_CMD=$(get_pm2_cmd)
            echo -e "${YELLOW}Restarting all services...${NC}"
            $PM2_CMD restart all
            echo -e "${GREEN}All services restarted${NC}"
            ;;
        "status")
            show_status
            ;;
        "logs")
            # Get PM2 command
            PM2_CMD=$(get_pm2_cmd)
            $PM2_CMD logs
            ;;
        "clean")
            # Get PM2 command
            PM2_CMD=$(get_pm2_cmd)
            echo -e "${YELLOW}Cleaning up PM2 processes...${NC}"
            $PM2_CMD delete all 2>/dev/null || true
            echo -e "${GREEN}Cleanup complete${NC}"
            ;;
        "help")
            echo -e "${BLUE}Usage: ./run.sh [command]${NC}"
            echo -e ""
            echo -e "${YELLOW}Commands:${NC}"
            echo -e "  ${GREEN}install${NC}   - Install PM2 and project dependencies"
            echo -e "  ${GREEN}start${NC}     - Start both backend and frontend (default)"
            echo -e "  ${GREEN}stop${NC}      - Stop all services"
            echo -e "  ${GREEN}restart${NC}   - Restart all services"
            echo -e "  ${GREEN}status${NC}    - Show service status"
            echo -e "  ${GREEN}logs${NC}      - Show logs from all services"
            echo -e "  ${GREEN}clean${NC}     - Stop and remove all PM2 processes"
            echo -e "  ${GREEN}help${NC}      - Show this help message"
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo -e "Use ${GREEN}./run.sh help${NC} for available commands"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
