#!/bin/bash

# Smart infrastructure deployment script
set -e

ENVIRONMENT=${1:-dev}
STACK_FILTER=${2:-""}

echo "🏗️  Smart infrastructure deployment for environment: $ENVIRONMENT"

# Color functions for better output
green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }
blue() { echo -e "\033[34m$1\033[0m"; }

# Function to detect changed stacks
detect_changed_stacks() {
    local changed_files=""
    
    # Check if we're in a git repo
    if git rev-parse --git-dir > /dev/null 2>&1; then
        # Get changed files since last commit or in working directory
        changed_files=$(git diff --name-only HEAD~1 2>/dev/null || git diff --name-only 2>/dev/null || echo "")
    fi
    
    # If no git or no changes detected, assume all stacks changed
    if [ -z "$changed_files" ]; then
        echo "all"
        return
    fi
    
    local stacks=""
    
    # Map file changes to stacks
    if echo "$changed_files" | grep -q "infrastructure/lib/database-stack\|infrastructure/lib/cognito-stack\|shared-database"; then
        stacks="$stacks database cognito"
    fi
    
    if echo "$changed_files" | grep -q "infrastructure/lib/events-stack"; then
        stacks="$stacks events"
    fi
    
    if echo "$changed_files" | grep -q "infrastructure/lib/lambda-stack\|packages/service-"; then
        stacks="$stacks lambda"
    fi
    
    if echo "$changed_files" | grep -q "infrastructure/lib/api-gateway-stack"; then
        stacks="$stacks apigateway"
    fi
    
    if echo "$changed_files" | grep -q "infrastructure/lib/cognito-stack"; then
        stacks="$stacks cognito"
    fi
    
    # If core infrastructure files changed, deploy all
    if echo "$changed_files" | grep -q "infrastructure/bin/app.ts\|infrastructure/cdk.json\|package.json"; then
        yellow "Core infrastructure files changed - will deploy all stacks"
        stacks="all"
    fi
    
    echo $stacks
}

# Function to get stack deployment order
get_deployment_order() {
    local stacks="$1"
    
    if [ "$stacks" = "all" ]; then
        echo "database cognito events lambda apigateway"
        return
    fi
    
    # Ensure proper dependency order
    local ordered=""
    
    # Database and Cognito first (no dependencies)
    echo "$stacks" | grep -q "database" && ordered="$ordered database"
    echo "$stacks" | grep -q "cognito" && ordered="$ordered cognito"
    
    # Events stack
    echo "$stacks" | grep -q "events" && ordered="$ordered events"
    
    # Lambda stack (depends on database, events, cognito)
    echo "$stacks" | grep -q "lambda" && ordered="$ordered lambda"
    
    # API Gateway last (depends on lambda)
    echo "$stacks" | grep -q "apigateway" && ordered="$ordered apigateway"
    
    echo $ordered
}

# Function to deploy specific stacks
deploy_stacks() {
    local stacks="$1"
    
    if [ -z "$stacks" ]; then
        blue "No stacks to deploy"
        return
    fi
    
    green "🚀 Deploying stacks: $stacks"
    
    cd infrastructure
    
    # First, always run synth to catch errors early
    echo "🔍 Synthesizing stacks..."
    pnpm run synth:$ENVIRONMENT
    
    # Deploy in order
    for stack in $stacks; do
        local stack_name=""
        case $stack in
            database)
                stack_name="ServerlessMicroservices-Database-$ENVIRONMENT"
                ;;
            cognito)
                stack_name="ServerlessMicroservices-Cognito-$ENVIRONMENT"
                ;;
            events)
                stack_name="ServerlessMicroservices-Events-$ENVIRONMENT"
                ;;
            lambda)
                stack_name="ServerlessMicroservices-Lambda-$ENVIRONMENT"
                ;;
            apigateway)
                stack_name="ServerlessMicroservices-ApiGateway-$ENVIRONMENT"
                ;;
        esac
        
        if [ -n "$stack_name" ]; then
            echo "Deploying $stack_name..."
            if [ "$ENVIRONMENT" = "dev" ]; then
                # Use hotswap for faster dev deployments
                cdk deploy $stack_name --require-approval never --hotswap --context environment=$ENVIRONMENT
            else
                # Standard deployment for production
                cdk deploy $stack_name --require-approval never --context environment=$ENVIRONMENT
            fi
        fi
    done
    
    cd ..
}

# Function to show diff
show_diff() {
    local stacks="$1"
    
    cd infrastructure
    
    if [ "$stacks" = "all" ] || [ -z "$stacks" ]; then
        echo "📋 Showing diff for all stacks..."
        pnpm run diff:$ENVIRONMENT
    else
        for stack in $stacks; do
            local stack_name=""
            case $stack in
                database) stack_name="ServerlessMicroservices-Database-$ENVIRONMENT" ;;
                cognito) stack_name="ServerlessMicroservices-Cognito-$ENVIRONMENT" ;;
                events) stack_name="ServerlessMicroservices-Events-$ENVIRONMENT" ;;
                lambda) stack_name="ServerlessMicroservices-Lambda-$ENVIRONMENT" ;;
                apigateway) stack_name="ServerlessMicroservices-ApiGateway-$ENVIRONMENT" ;;
            esac
            
            if [ -n "$stack_name" ]; then
                echo "📋 Showing diff for $stack_name..."
                cdk diff $stack_name --context environment=$ENVIRONMENT
            fi
        done
    fi
    
    cd ..
}

# Main execution
main() {
    local stacks_to_deploy=""
    
    # Handle special commands
    if [ "$1" = "diff" ]; then
        stacks_to_deploy=$(detect_changed_stacks)
        show_diff "$stacks_to_deploy"
        exit 0
    fi
    
    if [ -n "$STACK_FILTER" ]; then
        # Specific stack provided
        case $STACK_FILTER in
            db|database) stacks_to_deploy="database" ;;
            auth|cognito) stacks_to_deploy="cognito" ;;
            events) stacks_to_deploy="events" ;;
            lambda|functions) stacks_to_deploy="lambda" ;;
            api|apigateway|gateway) stacks_to_deploy="apigateway" ;;
            all) stacks_to_deploy="all" ;;
            *) 
                red "Unknown stack: $STACK_FILTER"
                echo "Available stacks: database, cognito, events, lambda, apigateway, all"
                exit 1
                ;;
        esac
        yellow "Deploying specific stack: $STACK_FILTER"
    else
        # Auto-detect changed stacks
        stacks_to_deploy=$(detect_changed_stacks)
        if [ -z "$stacks_to_deploy" ] || [ "$stacks_to_deploy" = " " ]; then
            blue "No infrastructure changes detected. Nothing to deploy."
            exit 0
        fi
        yellow "Auto-detected changed stacks: $stacks_to_deploy"
    fi
    
    # Get proper deployment order
    local ordered_stacks=$(get_deployment_order "$stacks_to_deploy")
    
    # Confirm deployment
    if [ "$ENVIRONMENT" = "prod" ]; then
        red "⚠️  PRODUCTION INFRASTRUCTURE DEPLOYMENT"
        echo "Stacks to deploy: $ordered_stacks"
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Build infrastructure TypeScript
    echo "🔨 Building infrastructure..."
    cd infrastructure && pnpm run build && cd ..
    
    # Deploy stacks
    deploy_stacks "$ordered_stacks"
    
    green "✅ Infrastructure deployment completed!"
    echo "Deployed stacks: $ordered_stacks"
    
    # Show useful outputs
    echo ""
    blue "📋 Stack outputs:"
    cd infrastructure
    cdk list --context environment=$ENVIRONMENT | while read stack; do
        if [[ $stack =~ $ENVIRONMENT ]]; then
            echo "Stack: $stack"
        fi
    done
    cd ..
}

# Help function
show_help() {
    echo "Usage: $0 [environment] [stack|command]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (dev/prod) [default: dev]"
    echo "  stack          Specific stack to deploy [optional]"
    echo "                 Options: database, cognito, events, lambda, apigateway, all"
    echo ""
    echo "Commands:"
    echo "  diff           Show infrastructure differences"
    echo ""
    echo "Examples:"
    echo "  $0                      # Auto-detect and deploy changed stacks to dev"
    echo "  $0 dev                  # Auto-detect and deploy changed stacks to dev"
    echo "  $0 prod                 # Auto-detect and deploy changed stacks to prod"
    echo "  $0 dev database         # Deploy only database stack to dev"
    echo "  $0 prod all             # Deploy all stacks to prod"
    echo "  $0 diff                 # Show differences for changed stacks"
}

# Handle help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main