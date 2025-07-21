'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== 'default') __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.DatabaseStack = void 0;
const cdk = __importStar(require('aws-cdk-lib'));
const dynamodb = __importStar(require('aws-cdk-lib/aws-dynamodb'));
class DatabaseStack extends cdk.Stack {
  table;
  constructor(scope, id, props) {
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
    // Tags for cost allocation and management
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Project', 'ServerlessMicroservices');
    cdk.Tags.of(this).add('Component', 'Database');
  }
}
exports.DatabaseStack = DatabaseStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9kYXRhYmFzZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBa0M7QUFDbEMsbUVBQW9EO0FBT3BELE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFCLEtBQUssQ0FBZ0I7SUFFckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEwQjtRQUNsRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUV2QixNQUFNLFdBQVcsR0FBRyxLQUFLLEVBQUUsV0FBVyxJQUFJLEtBQUssQ0FBQTtRQUUvQywrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNqRCxTQUFTLEVBQUUsR0FBRyxXQUFXLDJCQUEyQjtZQUNwRCxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsSUFBSTtnQkFDVixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ2hELGtFQUFrRTtZQUNsRSxnQ0FBZ0MsRUFBRTtnQkFDaEMsMEJBQTBCLEVBQUUsV0FBVyxLQUFLLE1BQU07YUFDbkQ7WUFFRCxzRUFBc0U7WUFDdEUsc0RBQXNEO1lBRXRELDRDQUE0QztZQUM1QyxrQkFBa0IsRUFBRSxXQUFXLEtBQUssTUFBTTtZQUUxQyxzQ0FBc0M7WUFDdEMsbUJBQW1CLEVBQUUsS0FBSztZQUUxQixhQUFhLEVBQUUsV0FBVyxLQUFLLE1BQU07Z0JBQ25DLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07Z0JBQzFCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDOUIsQ0FBQyxDQUFBO1FBRUYsMkRBQTJEO1FBQzNELElBQUksQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUM7WUFDakMsU0FBUyxFQUFFLE1BQU07WUFDakIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztTQUNGLENBQUMsQ0FBQTtRQUVGLDZDQUE2QztRQUM3QywyRUFBMkU7UUFDM0UsaUVBQWlFO1FBQ2pFLGtEQUFrRDtRQUNsRCxvRkFBb0Y7UUFFcEYsNkNBQTZDO1FBQzdDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVM7WUFDM0IsV0FBVyxFQUFFLHFCQUFxQjtZQUNsQyxVQUFVLEVBQUUsR0FBRyxXQUFXLGtCQUFrQjtTQUM3QyxDQUFDLENBQUE7UUFFRixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNsQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRO1lBQzFCLFdBQVcsRUFBRSxvQkFBb0I7WUFDakMsVUFBVSxFQUFFLEdBQUcsV0FBVyxpQkFBaUI7U0FDNUMsQ0FBQyxDQUFBO1FBRUYsNkRBQTZEO1FBQzdELDhDQUE4QztRQUM5Qyw0Q0FBNEM7UUFDNUMsOENBQThDO1FBQzlDLHdEQUF3RDtRQUN4RCxLQUFLO1FBRUwsMENBQTBDO1FBQzFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUE7UUFDakQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSx5QkFBeUIsQ0FBQyxDQUFBO1FBQzNELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUE7SUFDaEQsQ0FBQztDQUNGO0FBcEZELHNDQW9GQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYidcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYidcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnXG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YWJhc2VTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBlbnZpcm9ubWVudD86IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgRGF0YWJhc2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSB0YWJsZTogZHluYW1vZGIuVGFibGVcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IERhdGFiYXNlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpXG5cbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHByb3BzPy5lbnZpcm9ubWVudCB8fCAnZGV2J1xuXG4gICAgLy8gTWFpbiBEeW5hbW9EQiB0YWJsZSB3aXRoIHNpbmdsZS10YWJsZSBkZXNpZ25cbiAgICB0aGlzLnRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdNYWluVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke2Vudmlyb25tZW50fS1taWNyb3NlcnZpY2VzLW1haW4tdGFibGVgLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdQSycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ1NLJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIC8vIFBvaW50LWluLVRpbWUgUmVjb3Zlcnk6IH4yMCUgYWRkaXRpb25hbCBzdG9yYWdlIGNvc3QsIHByb2Qgb25seVxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcbiAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IGVudmlyb25tZW50ID09PSAncHJvZCcsXG4gICAgICB9LFxuICAgICAgXG4gICAgICAvLyBTdHJlYW1zIGRpc2FibGVkIC0gY2FuIGJlIGVuYWJsZWQgbGF0ZXIgZm9yIGV2ZW50LWRyaXZlbiBwcm9jZXNzaW5nXG4gICAgICAvLyBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICAgIFxuICAgICAgLy8gRW5hYmxlIGRlbGV0aW9uIHByb3RlY3Rpb24gZm9yIHByb2R1Y3Rpb25cbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIFxuICAgICAgLy8gVFRMIGF0dHJpYnV0ZSBmb3IgYXV0b21hdGljIGNsZWFudXBcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgXG4gICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiBcbiAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pXG5cbiAgICAvLyBHU0kxIC0gR2VuZXJpYyBwdXJwb3NlIGluZGV4IGZvciB2YXJpb3VzIGFjY2VzcyBwYXR0ZXJuc1xuICAgIHRoaXMudGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnR1NJMScsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ0dTSTFQSycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ0dTSTFTSycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgLy8gQWRkaXRpb25hbCBpbmRleGVzIGNhbiBiZSBhZGRlZCBhcyBuZWVkZWQ6XG4gICAgLy8gR1NJMiAtIEZvciBzdGF0dXMtYmFzZWQgcXVlcmllcyAob3JkZXJzIGJ5IHN0YXR1cywgcHJvZHVjdHMgYnkgY2F0ZWdvcnkpXG4gICAgLy8gR1NJMyAtIEZvciB0aW1lLWJhc2VkIHF1ZXJpZXMgKGNyZWF0ZWRfYXQsIHVwZGF0ZWRfYXQgc29ydGluZylcbiAgICAvLyBMU0kxIC0gRm9yIGFsdGVybmF0ZSBzb3J0IHdpdGhpbiBzYW1lIHBhcnRpdGlvblxuICAgIC8vIE5vdGU6IFN0YXJ0IG1pbmltYWwgYW5kIGFkZCBpbmRleGVzIG9ubHkgd2hlbiBzcGVjaWZpYyBhY2Nlc3MgcGF0dGVybnMgYXJlIG5lZWRlZFxuXG4gICAgLy8gRXhwb3J0IHRhYmxlIG5hbWUgYW5kIEFSTiBmb3Igb3RoZXIgc3RhY2tzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgbmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tbWFpbi10YWJsZS1uYW1lYCxcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RhYmxlQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMudGFibGUudGFibGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tbWFpbi10YWJsZS1hcm5gLFxuICAgIH0pXG5cbiAgICAvLyBTdHJlYW0gQVJOIG91dHB1dCBjb21tZW50ZWQgb3V0IHNpbmNlIHN0cmVhbXMgYXJlIGRpc2FibGVkXG4gICAgLy8gbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RhYmxlU3RyZWFtQXJuJywge1xuICAgIC8vICAgdmFsdWU6IHRoaXMudGFibGUudGFibGVTdHJlYW1Bcm4gfHwgJycsXG4gICAgLy8gICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlIHN0cmVhbSBBUk4nLFxuICAgIC8vICAgZXhwb3J0TmFtZTogYCR7ZW52aXJvbm1lbnR9LW1haW4tdGFibGUtc3RyZWFtLWFybmAsXG4gICAgLy8gfSlcblxuICAgIC8vIFRhZ3MgZm9yIGNvc3QgYWxsb2NhdGlvbiBhbmQgbWFuYWdlbWVudFxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBlbnZpcm9ubWVudClcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnU2VydmVybGVzc01pY3Jvc2VydmljZXMnKVxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0RhdGFiYXNlJylcbiAgfVxufSJdfQ==
