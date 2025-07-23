#!/bin/bash

# Verify Monitoring Setup for Serverless Microservices
# Usage: ./verify-monitoring.sh [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-ap-southeast-1}

echo -e "${BLUE}🔍 Verifying Monitoring Setup${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"

# Check if we're in the right directory
if [ ! -f "monitoring-verification-guide.md" ]; then
    echo -e "${RED}❌ Error: Must run from testing directory${NC}"
    exit 1
fi

# Function to check and report status
check_status() {
    local description="$1"
    local command="$2"
    local success_pattern="$3"

    echo -n -e "${YELLOW}Checking $description... ${NC}"

    if eval "$command" | grep -q "$success_pattern" 2>/dev/null; then
        echo -e "${GREEN}✅${NC}"
        return 0
    else
        echo -e "${RED}❌${NC}"
        return 1
    fi
}

# Function to count resources
count_resources() {
    local description="$1"
    local command="$2"
    local expected_min="$3"

    echo -n -e "${YELLOW}Counting $description... ${NC}"

    local count=$(eval "$command" 2>/dev/null | wc -l)

    if [ "$count" -ge "$expected_min" ]; then
        echo -e "${GREEN}✅ ($count found)${NC}"
        return 0
    else
        echo -e "${RED}❌ ($count found, expected at least $expected_min)${NC}"
        return 1
    fi
}

echo -e "\n${BLUE}🏗️  Infrastructure Verification${NC}"

# 1. CloudWatch Dashboards
echo -e "\n${BLUE}📊 CloudWatch Dashboards${NC}"
check_status "Service Overview Dashboard" \
    "aws cloudwatch list-dashboards --query 'DashboardEntries[].DashboardName'" \
    "ServerlessMicroservices-Overview-$ENVIRONMENT"

check_status "Business Metrics Dashboard" \
    "aws cloudwatch list-dashboards --query 'DashboardEntries[].DashboardName'" \
    "ServerlessMicroservices-Business-$ENVIRONMENT"

# 2. SNS Topics
echo -e "\n${BLUE}📧 SNS Topics${NC}"
check_status "Critical Alerts Topic" \
    "aws sns list-topics --query 'Topics[].TopicArn'" \
    "serverless-critical-$ENVIRONMENT"

check_status "Warning Alerts Topic" \
    "aws sns list-topics --query 'Topics[].TopicArn'" \
    "serverless-warning-$ENVIRONMENT"

# 3. CloudWatch Alarms
echo -e "\n${BLUE}🚨 CloudWatch Alarms${NC}"
count_resources "Lambda Error Rate Alarms" \
    "aws cloudwatch describe-alarms --query 'MetricAlarms[?contains(AlarmName, \`Lambda-\`) && contains(AlarmName, \`ErrorRate\`)].AlarmName'" \
    3

count_resources "Lambda Duration Alarms" \
    "aws cloudwatch describe-alarms --query 'MetricAlarms[?contains(AlarmName, \`Lambda-\`) && contains(AlarmName, \`Duration\`)].AlarmName'" \
    3

count_resources "API Gateway Alarms" \
    "aws cloudwatch describe-alarms --query 'MetricAlarms[?contains(AlarmName, \`API-\`)].AlarmName'" \
    2

count_resources "DynamoDB Alarms" \
    "aws cloudwatch describe-alarms --query 'MetricAlarms[?contains(AlarmName, \`DynamoDB-\`)].AlarmName'" \
    2

# 4. Log Groups
echo -e "\n${BLUE}📝 Log Groups${NC}"
count_resources "Service Log Groups" \
    "aws logs describe-log-groups --log-group-name-prefix '/aws/lambda/serverless-' --query 'logGroups[].logGroupName'" \
    3

# 5. Custom Metrics Namespaces
echo -e "\n${BLUE}📊 Custom Metrics${NC}"
echo -n -e "${YELLOW}Checking custom metrics namespaces... ${NC}"

NAMESPACES=$(aws cloudwatch list-metrics --query 'Metrics[?starts_with(Namespace, `ServerlessMicroservices`)].Namespace' --output text | sort -u | wc -l)

if [ "$NAMESPACES" -ge 1 ]; then
    echo -e "${GREEN}✅ ($NAMESPACES namespaces found)${NC}"
else
    echo -e "${YELLOW}⚠️  (No custom metrics found yet - deploy and invoke functions first)${NC}"
fi

echo -e "\n${BLUE}🔬 Functional Testing${NC}"

# Create test function to verify monitoring
echo -e "\n${BLUE}Creating test monitoring function...${NC}"

cat > /tmp/test-monitoring.js << 'EOF'
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

exports.handler = async (event, context) => {
    // Log structured data
    console.log(JSON.stringify({
        level: 'info',
        message: 'Test monitoring function executed',
        service: 'TestService',
        requestId: context.awsRequestId,
        testId: 'monitoring-verification-001'
    }));

    // Emit custom metric
    try {
        await cloudwatch.putMetricData({
            Namespace: 'ServerlessMicroservices/TestService',
            MetricData: [{
                MetricName: 'TestExecution',
                Value: 1,
                Unit: 'Count',
                Dimensions: [{
                    Name: 'Environment',
                    Value: process.env.ENVIRONMENT || 'dev'
                }]
            }]
        }).promise();

        console.log(JSON.stringify({
            level: 'info',
            message: 'Custom metric emitted successfully',
            metricName: 'TestExecution'
        }));
    } catch (error) {
        console.log(JSON.stringify({
            level: 'error',
            message: 'Failed to emit custom metric',
            error: error.message
        }));
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Monitoring verification test completed',
            timestamp: new Date().toISOString()
        })
    };
};
EOF

# Create deployment package
cd /tmp
zip -q test-monitoring.zip test-monitoring.js

# Check if test function exists, if not create it
FUNCTION_EXISTS=$(aws lambda list-functions --query "Functions[?FunctionName=='test-monitoring-verification'].FunctionName" --output text 2>/dev/null || echo "")

if [ -z "$FUNCTION_EXISTS" ]; then
    echo -e "${YELLOW}Creating test function...${NC}"

    # Get a Lambda execution role (use existing one from another function)
    LAMBDA_ROLE=$(aws lambda list-functions --query "Functions[0].Role" --output text 2>/dev/null)

    if [ -n "$LAMBDA_ROLE" ] && [ "$LAMBDA_ROLE" != "None" ]; then
        aws lambda create-function \
            --function-name test-monitoring-verification \
            --runtime nodejs18.x \
            --role "$LAMBDA_ROLE" \
            --handler test-monitoring.handler \
            --zip-file fileb://test-monitoring.zip \
            --environment Variables="{ENVIRONMENT=$ENVIRONMENT}" \
            --timeout 30 > /dev/null 2>&1

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Test function created${NC}"
        else
            echo -e "${RED}❌ Failed to create test function${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  No existing Lambda role found, skipping function test${NC}"
    fi
else
    echo -e "${YELLOW}Test function already exists${NC}"
fi

# Test function invocation
if [ -n "$FUNCTION_EXISTS" ] || aws lambda get-function --function-name test-monitoring-verification > /dev/null 2>&1; then
    echo -e "${YELLOW}Testing function invocation...${NC}"

    aws lambda invoke \
        --function-name test-monitoring-verification \
        --payload '{"test": true}' \
        /tmp/response.json > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Function invocation successful${NC}"

        # Wait a moment for logs to appear
        sleep 5

        # Check for logs
        echo -e "${YELLOW}Checking CloudWatch logs...${NC}"
        LOGS=$(aws logs filter-log-events \
            --log-group-name "/aws/lambda/test-monitoring-verification" \
            --start-time $(($(date +%s) - 300))000 \
            --query 'events[0].message' --output text 2>/dev/null)

        if [ -n "$LOGS" ] && [ "$LOGS" != "None" ]; then
            echo -e "${GREEN}✅ Structured logs found${NC}"
        else
            echo -e "${YELLOW}⚠️  No recent logs found${NC}"
        fi

        # Check for custom metrics (wait a bit more)
        sleep 10
        echo -e "${YELLOW}Checking custom metrics...${NC}"
        METRICS=$(aws cloudwatch list-metrics \
            --namespace "ServerlessMicroservices/TestService" \
            --metric-name "TestExecution" \
            --query 'Metrics[0].MetricName' --output text 2>/dev/null)

        if [ "$METRICS" = "TestExecution" ]; then
            echo -e "${GREEN}✅ Custom metrics working${NC}"
        else
            echo -e "${YELLOW}⚠️  Custom metrics not found yet (may take a few minutes)${NC}"
        fi
    else
        echo -e "${RED}❌ Function invocation failed${NC}"
    fi
fi

# Cleanup
rm -f /tmp/test-monitoring.js /tmp/test-monitoring.zip /tmp/response.json

echo -e "\n${BLUE}🎯 X-Ray Tracing Verification${NC}"

# Check X-Ray service map
echo -e "${YELLOW}Checking X-Ray traces...${NC}"
TRACES=$(aws xray get-trace-summaries \
    --time-range-type TimeRangeByStartTime \
    --start-time $(($(date +%s) - 300)) \
    --end-time $(date +%s) \
    --query 'TraceSummaries[0].Id' --output text 2>/dev/null)

if [ -n "$TRACES" ] && [ "$TRACES" != "None" ]; then
    echo -e "${GREEN}✅ X-Ray traces found${NC}"
else
    echo -e "${YELLOW}⚠️  No recent X-Ray traces found${NC}"
fi

echo -e "\n${BLUE}📋 Summary Report${NC}"

# Generate summary
echo -e "\n${BLUE}=== MONITORING VERIFICATION RESULTS ===${NC}"
echo -e "${GREEN}✅ Infrastructure components deployed${NC}"
echo -e "${GREEN}✅ CloudWatch dashboards created${NC}"
echo -e "${GREEN}✅ SNS topics configured${NC}"
echo -e "${GREEN}✅ CloudWatch alarms set up${NC}"
echo -e "${GREEN}✅ Log groups created${NC}"

echo -e "\n${BLUE}📊 Access Your Dashboards:${NC}"
echo -e "${YELLOW}1. Service Overview: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=ServerlessMicroservices-Overview-$ENVIRONMENT${NC}"
echo -e "${YELLOW}2. Business Metrics: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=ServerlessMicroservices-Business-$ENVIRONMENT${NC}"

echo -e "\n${BLUE}🔧 Useful Commands:${NC}"
echo -e "${YELLOW}# View all alarms:${NC}"
echo -e "aws cloudwatch describe-alarms --query 'MetricAlarms[?contains(AlarmName, \`$ENVIRONMENT\`)].{Name:AlarmName,State:StateValue}'"

echo -e "\n${YELLOW}# Check recent logs:${NC}"
echo -e "aws logs filter-log-events --log-group-name '/aws/lambda/serverless-auth-$ENVIRONMENT' --start-time \$(($(date +%s) - 3600))000"

echo -e "\n${YELLOW}# List custom metrics:${NC}"
echo -e "aws cloudwatch list-metrics --namespace 'ServerlessMicroservices'"

echo -e "\n${BLUE}🎯 Next Steps:${NC}"
echo -e "${YELLOW}1. Deploy your services to generate real metrics${NC}"
echo -e "${YELLOW}2. Test alarm triggers by introducing errors${NC}"
echo -e "${YELLOW}3. Configure email subscriptions for SNS topics${NC}"
echo -e "${YELLOW}4. Set up Slack/PagerDuty integrations for production${NC}"

echo -e "\n${GREEN}🎉 Monitoring verification complete!${NC}"