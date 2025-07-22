#!/bin/bash

# Smart service deployment script
set -e

ENVIRONMENT=${1:-dev}
SERVICE_FILTER=${2:-""}

echo "🚀 Smart service deployment for environment: $ENVIRONMENT"

# Color functions for better output
green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }
blue() { echo -e "\033[34m$1\033[0m"; }

# Function to detect changed services
detect_changed_services() {
    local changed_files=""
    
    # Check if we're in a git repo
    if git rev-parse --git-dir > /dev/null 2>&1; then
        # Get changed files since last commit or in working directory
        changed_files=$(git diff --name-only HEAD~1 2>/dev/null || git diff --name-only 2>/dev/null || echo "")
    fi
    
    # If no git or no changes detected, assume all services changed
    if [ -z "$changed_files" ]; then
        echo "service-auth service-users service-orders service-notifications"
        return
    fi
    
    local services=""
    
    # Check each service directory for changes
    for service in service-auth service-users service-orders service-notifications; do
        if echo "$changed_files" | grep -q "packages/$service/\|$service"; then
            services="$services $service"
        fi
    done
    
    # If shared packages changed, rebuild all services
    if echo "$changed_files" | grep -q "packages/shared-"; then
        yellow "Shared packages changed - will deploy all services"
        services="service-auth service-users service-orders service-notifications"
    fi
    
    # If infrastructure changed, don't deploy services (user should deploy infra first)
    if echo "$changed_files" | grep -q "infrastructure/"; then
        red "⚠️  Infrastructure changes detected!"
        yellow "Please run 'pnpm deploy:infra' first before deploying services"
        exit 1
    fi
    
    echo $services
}

# Function to build specific services
build_services() {
    local services="$1"
    
    if [ -z "$services" ]; then
        blue "No services to build"
        return
    fi
    
    green "🔨 Building services: $services"
    
    # Build shared dependencies first
    echo "Building shared dependencies..."
    pnpm --filter "@shared/*" run build
    
    # Build specific services
    for service in $services; do
        echo "Building $service..."
        pnpm --filter "@service/${service#service-}" run build
    done
}

# Function to deploy specific Lambda functions
deploy_lambda_functions() {
    local services="$1"
    
    if [ -z "$services" ]; then
        blue "No services to deploy"
        return
    fi
    
    green "🚀 Deploying Lambda functions for: $services"
    
    cd infrastructure
    
    # Map service names to Lambda functions
    for service in $services; do
        case $service in
            service-auth)
                echo "Deploying auth functions..."
                cdk deploy ServerlessMicroservices-Lambda-$ENVIRONMENT --exclusively --require-approval never --hotswap
                ;;
            service-users)
                echo "Deploying user functions..."
                cdk deploy ServerlessMicroservices-Lambda-$ENVIRONMENT --exclusively --require-approval never --hotswap
                ;;
            service-orders)
                echo "Deploying order functions..."
                cdk deploy ServerlessMicroservices-Lambda-$ENVIRONMENT --exclusively --require-approval never --hotswap
                ;;
            service-notifications)
                echo "Deploying notification functions..."
                cdk deploy ServerlessMicroservices-Lambda-$ENVIRONMENT --exclusively --require-approval never --hotswap
                ;;
        esac
    done
    
    cd ..
}

# Main execution
main() {
    local services_to_deploy=""
    
    if [ -n "$SERVICE_FILTER" ]; then
        # Specific service provided
        services_to_deploy="service-$SERVICE_FILTER"
        yellow "Deploying specific service: $SERVICE_FILTER"
    else
        # Auto-detect changed services
        services_to_deploy=$(detect_changed_services)
        if [ -z "$services_to_deploy" ]; then
            blue "No service changes detected. Nothing to deploy."
            exit 0
        fi
        yellow "Auto-detected changed services: $services_to_deploy"
    fi
    
    # Confirm deployment
    if [ "$ENVIRONMENT" = "prod" ]; then
        red "⚠️  PRODUCTION DEPLOYMENT"
        echo "Services to deploy: $services_to_deploy"
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Build and deploy
    build_services "$services_to_deploy"
    deploy_lambda_functions "$services_to_deploy"
    
    green "✅ Service deployment completed!"
    echo "Deployed services: $services_to_deploy"
}

# Help function
show_help() {
    echo "Usage: $0 [environment] [service]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (dev/prod) [default: dev]"
    echo "  service        Specific service to deploy (auth/users/orders/notifications) [optional]"
    echo ""
    echo "Examples:"
    echo "  $0                    # Auto-detect and deploy changed services to dev"
    echo "  $0 dev               # Auto-detect and deploy changed services to dev"
    echo "  $0 prod              # Auto-detect and deploy changed services to prod"
    echo "  $0 dev auth          # Deploy only auth service to dev"
    echo "  $0 prod users        # Deploy only users service to prod"
}

# Handle help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main