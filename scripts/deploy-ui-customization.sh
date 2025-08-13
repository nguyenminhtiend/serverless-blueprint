#!/bin/bash

# Deploy Cognito UI Customization
# This script deploys the UI assets stack and updates the Cognito stack with custom styling

set -e

# Configuration
ENVIRONMENT=${1:-dev}
REGION=${AWS_DEFAULT_REGION:-ap-southeast-1}

echo "🎨 Deploying Cognito UI Customization for environment: $ENVIRONMENT"
echo "📍 Region: $REGION"
echo ""

# Change to infrastructure directory
cd "$(dirname "$0")/../infrastructure"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    npm install
    echo ""
fi

# Build the project
echo "🔨 Building CDK project..."
npm run build
echo ""

# Deploy UI Assets stack first
echo "🚀 Deploying UI Assets stack..."
npx cdk deploy "ServerlessMicroservices-UiAssets-$ENVIRONMENT" \
    --context environment="$ENVIRONMENT" \
    --require-approval never \
    --outputs-file "ui-assets-outputs.json"

if [ $? -eq 0 ]; then
    echo "✅ UI Assets stack deployed successfully!"
else
    echo "❌ UI Assets stack deployment failed!"
    exit 1
fi

echo ""

# Deploy Cognito stack with UI customization
echo "🔐 Deploying Cognito stack with custom UI..."
npx cdk deploy "ServerlessMicroservices-Cognito-$ENVIRONMENT" \
    --context environment="$ENVIRONMENT" \
    --require-approval never \
    --outputs-file "cognito-outputs.json"

if [ $? -eq 0 ]; then
    echo "✅ Cognito stack with custom UI deployed successfully!"
else
    echo "❌ Cognito stack deployment failed!"
    exit 1
fi

echo ""
echo "🎉 UI Customization deployment completed!"
echo ""

# Extract and display important URLs
if [ -f "cognito-outputs.json" ]; then
    echo "📋 Important URLs:"
    echo "==================="

    # Extract Cognito domain URL
    COGNITO_DOMAIN_URL=$(jq -r '.["ServerlessMicroservices-Cognito-'$ENVIRONMENT'"].UserPoolDomainUrl // empty' cognito-outputs.json 2>/dev/null || echo "")
    if [ -n "$COGNITO_DOMAIN_URL" ]; then
        echo "🔗 Cognito Hosted UI: $COGNITO_DOMAIN_URL/login"
        echo "🔗 Cognito Hosted UI (Signup): $COGNITO_DOMAIN_URL/signup"
    fi

    # Extract CSS URL if available
    if [ -f "ui-assets-outputs.json" ]; then
        CSS_URL=$(jq -r '.["ServerlessMicroservices-UiAssets-'$ENVIRONMENT'"].CognitoCssUrl // empty' ui-assets-outputs.json 2>/dev/null || echo "")
        if [ -n "$CSS_URL" ]; then
            echo "🎨 Custom CSS URL: $CSS_URL"
        fi

        LOGO_URL=$(jq -r '.["ServerlessMicroservices-UiAssets-'$ENVIRONMENT'"].CognitoLogoUrl // empty' ui-assets-outputs.json 2>/dev/null || echo "")
        if [ -n "$LOGO_URL" ]; then
            echo "🖼️  Custom Logo URL: $LOGO_URL"
        fi
    fi

    echo ""
fi

echo "💡 Next steps:"
echo "1. Test the hosted UI by visiting the Cognito URLs above"
echo "2. The UI should now have your custom styling applied"
echo "3. If you need to update the styling, modify the CSS file and re-run this script"
echo ""
echo "🔧 To customize further:"
echo "   - Edit: infrastructure/assets/cognito-ui.css"
echo "   - Edit: infrastructure/assets/logo.svg"
echo "   - Re-run: ./scripts/deploy-ui-customization.sh $ENVIRONMENT"
