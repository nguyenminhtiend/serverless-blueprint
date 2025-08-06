#!/bin/bash

set -e

ENVIRONMENT=${1:-dev}
REGION=${2:-ap-southeast-1}

echo "🧹 Starting complete CDK cleanup for environment: $ENVIRONMENT in region: $REGION"
echo "⚠️  This will destroy ALL infrastructure resources!"
echo ""

# Confirm with user
read -p "Are you sure you want to proceed? This will delete all resources! (yes/no): " -r
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "🔍 Listing all CloudFormation stacks..."

# Get all stacks that might be related to our project
STACKS=$(aws cloudformation list-stacks \
    --region $REGION \
    --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE \
    --query 'StackSummaries[?contains(StackName, `ServerlessMicroservices`) || contains(StackName, `serverless-blueprint`)].StackName' \
    --output text)

if [ -z "$STACKS" ]; then
    echo "✅ No CDK stacks found to clean up."
else
    echo "📋 Found the following stacks to delete:"
    echo "$STACKS" | tr '\t' '\n'
    echo ""
    
    # Delete each stack
    for stack in $STACKS; do
        echo "🗑️  Deleting stack: $stack"
        aws cloudformation delete-stack --stack-name "$stack" --region $REGION
        echo "   Deletion initiated for $stack"
    done
    
    echo ""
    echo "⏳ Waiting for all stacks to be deleted..."
    
    for stack in $STACKS; do
        echo "   Waiting for $stack to be deleted..."
        aws cloudformation wait stack-delete-complete --stack-name "$stack" --region $REGION || {
            echo "   ⚠️  Stack $stack may have deletion protection or dependency issues"
            echo "   Check the AWS console for details"
        }
    done
fi

echo ""
echo "🧹 Cleaning up CDK assets and metadata..."

# Clean up CDK bootstrap assets (optional - be careful with this)
# Uncomment if you want to clean up bootstrap resources too
# echo "🗑️  Cleaning up CDK bootstrap resources..."
# aws cloudformation delete-stack --stack-name CDKToolkit --region $REGION || echo "   CDKToolkit stack not found or failed to delete"

# Clean up local CDK files
echo "🗑️  Cleaning up local CDK files..."
rm -rf cdk.out/
rm -rf node_modules/.cache/
echo "   Local CDK cache cleaned"

echo ""
echo "🔍 Verifying cleanup - checking remaining resources..."

# Check for any remaining stacks
REMAINING_STACKS=$(aws cloudformation list-stacks \
    --region $REGION \
    --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE \
    --query 'StackSummaries[?contains(StackName, `ServerlessMicroservices`) || contains(StackName, `serverless-blueprint`)].StackName' \
    --output text)

if [ -z "$REMAINING_STACKS" ]; then
    echo "✅ All CDK stacks successfully deleted!"
else
    echo "⚠️  Some stacks may still exist:"
    echo "$REMAINING_STACKS" | tr '\t' '\n'
    echo "   Please check the AWS console for any remaining resources"
fi

echo ""
echo "🔍 Checking for orphaned resources that might need manual cleanup..."

# Check for DynamoDB tables
echo "📊 Checking for DynamoDB tables..."
DYNAMO_TABLES=$(aws dynamodb list-tables \
    --region $REGION \
    --query 'TableNames[?contains(@, `microservices`) || contains(@, `serverless`)]' \
    --output text 2>/dev/null || echo "")

if [ -n "$DYNAMO_TABLES" ]; then
    echo "   ⚠️  Found DynamoDB tables that may need manual deletion:"
    echo "   $DYNAMO_TABLES" | tr '\t' '\n'
fi

# Check for Cognito User Pools
echo "👥 Checking for Cognito User Pools..."
USER_POOLS=$(aws cognito-idp list-user-pools \
    --region $REGION \
    --max-items 50 \
    --query 'UserPools[?contains(Name, `microservices`) || contains(Name, `serverless`)].Name' \
    --output text 2>/dev/null || echo "")

if [ -n "$USER_POOLS" ]; then
    echo "   ⚠️  Found Cognito User Pools that may need manual deletion:"
    echo "   $USER_POOLS" | tr '\t' '\n'
fi

# Check for Lambda functions
echo "⚡ Checking for Lambda functions..."
LAMBDA_FUNCTIONS=$(aws lambda list-functions \
    --region $REGION \
    --query 'Functions[?contains(FunctionName, `'$ENVIRONMENT'`)].FunctionName' \
    --output text 2>/dev/null || echo "")

if [ -n "$LAMBDA_FUNCTIONS" ]; then
    echo "   ⚠️  Found Lambda functions that may need manual deletion:"
    echo "   $LAMBDA_FUNCTIONS" | tr '\t' '\n'
fi

echo ""
echo "✅ Cleanup process completed!"
echo ""
echo "📝 Next steps:"
echo "1. Verify in AWS Console that all resources are deleted"
echo "2. Run: npm run deploy:$ENVIRONMENT"
echo "3. The new nested stack architecture will be deployed cleanly"
echo ""
echo "🔗 AWS Console links:"
echo "   CloudFormation: https://$REGION.console.aws.amazon.com/cloudformation/home?region=$REGION#/stacks"
echo "   DynamoDB: https://$REGION.console.aws.amazon.com/dynamodbv2/home?region=$REGION#tables"
echo "   Cognito: https://$REGION.console.aws.amazon.com/cognito/v2/idp/user-pools?region=$REGION"
echo "   Lambda: https://$REGION.console.aws.amazon.com/lambda/home?region=$REGION#/functions"