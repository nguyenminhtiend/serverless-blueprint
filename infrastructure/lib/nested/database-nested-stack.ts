import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { BaseNestedStack, BaseNestedStackProps } from './base-nested-stack';

export interface DatabaseNestedStackProps extends BaseNestedStackProps {
  // Additional database-specific props can be added here
}

export class DatabaseNestedStack extends BaseNestedStack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseNestedStackProps) {
    super(scope, id, props);

    // Main DynamoDB table with single-table design
    this.table = new dynamodb.Table(this, 'MainTable', {
      tableName: `${this.environment}-${this.projectName}-main-table`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: this.environment === 'prod' 
        ? dynamodb.TableEncryption.CUSTOMER_MANAGED 
        : dynamodb.TableEncryption.AWS_MANAGED,
      
      // Point-in-Time Recovery: ~20% additional storage cost, prod only
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: this.environment === 'prod',
      },

      // Streams disabled - can be enabled later for event-driven processing
      // stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,

      // Enable deletion protection for production
      deletionProtection: this.environment === 'prod',

      // TTL attribute for automatic cleanup
      timeToLiveAttribute: 'ttl',

      removalPolicy: this.environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI1 - Generic purpose index for various access patterns
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Additional indexes can be added as needed:
    // GSI2 - For status-based queries (orders by status, products by category)
    // GSI3 - For time-based queries (created_at, updated_at sorting)
    // LSI1 - For alternate sort within same partition
    // Note: Start minimal and add indexes only when specific access patterns are needed

    // Export table name and ARN for other stacks
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name',
      exportName: `${this.environment}-main-table-name`,
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN',
      exportName: `${this.environment}-main-table-arn`,
    });

    // Stream ARN output commented out since streams are disabled
    // new cdk.CfnOutput(this, 'TableStreamArn', {
    //   value: this.table.tableStreamArn || '',
    //   description: 'DynamoDB table stream ARN',
    //   exportName: `${this.environment}-main-table-stream-arn`,
    // })

    // Additional tag for component identification
    cdk.Tags.of(this).add('Component', 'Database');
  }
}