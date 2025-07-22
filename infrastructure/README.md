# Infrastructure - Phase 3

This directory contains the AWS CDK infrastructure code for the Serverless Microservices project.

## Current Implementation Status

**Phase 3 Complete** - AWS CDK Infrastructure Foundation:
- ✅ AWS CDK project initialized with TypeScript
- ✅ Database Stack with DynamoDB single-table design
- ✅ Basic CDK configuration and deployment setup
- ✅ CDK app entry point created
- ✅ Infrastructure synthesis tested successfully

## Database Design

The main DynamoDB table implements a single-table design pattern with:

- **Primary Key**: PK (Partition Key) + SK (Sort Key)
- **Global Secondary Index**: GSI1 (GSI1PK + GSI1SK) - general purpose
- **Streams**: Disabled (can be enabled for event-driven processing)

### Current Access Patterns

1. User profile: `PK=USER#123, SK=PROFILE`
2. User orders: `PK=USER#123, SK=begins_with(ORDER#)`
3. Generic queries: `GSI1PK=TYPE, GSI1SK=VALUE`

### When to Add More Indexes

**Add GSI2 when you need:**
- Status-based queries: `GSI2PK=STATUS, GSI2SK=TIMESTAMP`
- Category-based queries: `GSI2PK=CATEGORY, GSI2SK=NAME`
- Any cross-entity queries that can't use GSI1

**Add GSI3 when you need:**
- Time-based sorting: `GSI3PK=TYPE, GSI3SK=CREATED_AT`
- Complex filtering on different attributes
- High-volume queries that would conflict with GSI1/GSI2

**Add LSI when you need:**
- Alternative sort within same partition
- Multiple sort orders for same PK
- Example: `PK=USER#123, LSI1SK=LAST_LOGIN` vs `SK=EMAIL`

**Enable Streams when you need:**
- Event-driven processing (Lambda triggers)
- Real-time data replication
- Audit logging
- Change data capture for analytics

### Cost Considerations

- Each GSI costs ~25% of base table cost
- LSI shares capacity with main table
- Streams add $0.02 per 100K records
- Point-in-Time Recovery adds ~20% of storage cost (prod only)
- Encryption at rest is free with AWS managed keys
- Start minimal, add features as needed

## Commands

```bash
# Build TypeScript
pnpm build

# List stacks
npx cdk list

# Synthesize templates
npx cdk synth

# Deploy using recommended approach
pnpm deploy              # Deploy to dev (default)
pnpm deploy:dev          # Deploy to dev explicitly
pnpm deploy:prod         # Deploy to prod with PITR

# Or use script directly
./scripts/deploy.sh      # Deploy to dev (default)
./scripts/deploy.sh prod # Deploy to prod

# Manual CDK deploy (not recommended)
npx cdk deploy -c environment=dev

# Destroy resources
npx cdk destroy
```

## Environment Configuration

- **Default environment**: `dev`
- **Default region**: `ap-southeast-1` (Singapore)
- **AWS User**: `cdk` (IAM user for deployment)

Deploy to different environments:
```bash
# Development (no PITR, no deletion protection)
npx cdk deploy -c environment=dev

# Production (with PITR, deletion protection enabled)
npx cdk deploy -c environment=prod
```

Override region if needed:
```bash
npx cdk deploy -c region=ap-southeast-1
```

## Next Steps - Phase 4

1. Lambda Stack: Function definitions with proper IAM roles
2. API Gateway Stack: HTTP API with custom authorizers
3. Test basic infrastructure deployment

## Security Features

- Encryption at rest (AWS managed)
- Point-in-time recovery enabled
- DynamoDB streams for event processing
- Deletion protection for production
- TTL for automatic cleanup
- Proper tagging for cost allocation