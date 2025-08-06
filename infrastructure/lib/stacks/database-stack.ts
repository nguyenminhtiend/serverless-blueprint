import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  readonly environment?: string;
}

export class DatabaseStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: DatabaseStackProps) {
    super(scope, id, props);

    const environment = props?.environment || 'dev';

    // Main DynamoDB table with single-table design
    this.table = new dynamodb.Table(this, 'MainTable', {
      tableName: `${environment}-microservices-main-table`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      // Point-in-Time Recovery: ~20% additional storage cost, prod only
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: environment === 'prod',
      },

      // Streams disabled - can be enabled later for event-driven processing
      // stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,

      // Enable deletion protection for production
      deletionProtection: environment === 'prod',

      // TTL attribute for automatic cleanup
      timeToLiveAttribute: 'ttl',

      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
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
      exportName: `${environment}-main-table-name`,
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN',
      exportName: `${environment}-main-table-arn`,
    });

    // Stream ARN output commented out since streams are disabled
    // new cdk.CfnOutput(this, 'TableStreamArn', {
    //   value: this.table.tableStreamArn || '',
    //   description: 'DynamoDB table stream ARN',
    //   exportName: `${environment}-main-table-stream-arn`,
    // })

  }
}
