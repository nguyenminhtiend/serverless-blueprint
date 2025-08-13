#!/bin/bash

# Setup AWS Cognito Managed Login
# This script deploys the updated Cognito stack and provides configuration instructions

set -e

ENVIRONMENT=${1:-dev}
REGION=${AWS_DEFAULT_REGION:-ap-southeast-1}

echo "🚀 Setting up AWS Cognito Managed Login"
echo "📍 Environment: $ENVIRONMENT"
echo "📍 Region: $REGION"
echo ""

# Change to infrastructure directory
cd "$(dirname "$0")/../infrastructure"

# Build the project
echo "🔨 Building CDK project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build successful"
echo ""

# Deploy the Cognito stack
echo "🚀 Deploying Cognito stack..."
npx cdk deploy ServerlessMicroservices-Cognito-$ENVIRONMENT \
    --context environment="$ENVIRONMENT" \
    --require-approval never

if [ $? -eq 0 ]; then
    echo "✅ Cognito stack deployed successfully!"
else
    echo "❌ Cognito stack deployment failed!"
    exit 1
fi

echo ""
echo "🎨 Next Steps for Managed Login Configuration:"
echo "============================================="
echo ""

# Get User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "ServerlessMicroservices-Cognito-$ENVIRONMENT" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$USER_POOL_ID" ]; then
    echo "🆔 User Pool ID: $USER_POOL_ID"
    echo ""

    # Construct the console URL
    CONSOLE_URL="https://${REGION}.console.aws.amazon.com/cognito/v2/idp/user-pools/${USER_POOL_ID}/managed-login/branding"

    echo "🎨 Open this URL in your browser to configure Managed Login:"
    echo "$CONSOLE_URL"
    echo ""

    echo "📋 Configuration Steps:"
    echo "1. Click the link above to open AWS Console"
    echo "2. Switch from 'Classic' to 'Managed login' if not already selected"
    echo "3. Click 'Create style' to create a new branding style"
    echo "4. In the branding editor:"
    echo "   • Upload your logo (use the logo-managed-login.svg converted to PNG)"
    echo "   • Set primary color to: #3b82f6"
    echo "   • Set font family to: Inter"
    echo "   • Configure layout and spacing to match your web app"
    echo "5. Save and assign the style to your app client"
    echo ""

    # Get domain URL
    DOMAIN_URL=$(aws cloudformation describe-stacks \
        --stack-name "ServerlessMicroservices-Cognito-$ENVIRONMENT" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`UserPoolDomainUrl`].OutputValue' \
        --output text 2>/dev/null || echo "")

    if [ -n "$DOMAIN_URL" ]; then
        echo "🔗 Test your Managed Login UI:"
        echo "   • Login: $DOMAIN_URL/login"
        echo "   • Signup: $DOMAIN_URL/signup"
    fi

else
    echo "⚠️  Could not retrieve User Pool ID. Please check the deployment."
fi

echo ""
echo "💡 Benefits of Managed Login:"
echo "   ✅ Complete visual customization"
echo "   ✅ No CSS restrictions"
echo "   ✅ Modern, responsive design"
echo "   ✅ Easy logo and color customization"
echo "   ✅ Professional appearance"
