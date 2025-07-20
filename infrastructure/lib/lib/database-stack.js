"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
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
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: environment === 'prod',
            },
            // Streams disabled - can be enabled later for event-driven processing
            // stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
            // Enable deletion protection for production
            deletionProtection: environment === 'prod',
            // TTL attribute for automatic cleanup
            timeToLiveAttribute: 'ttl',
            removalPolicy: environment === 'prod'
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9kYXRhYmFzZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBa0M7QUFDbEMsbUVBQW9EO0FBT3BELE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFCLEtBQUssQ0FBZ0I7SUFFckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEwQjtRQUNsRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUV2QixNQUFNLFdBQVcsR0FBRyxLQUFLLEVBQUUsV0FBVyxJQUFJLEtBQUssQ0FBQTtRQUUvQywrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNqRCxTQUFTLEVBQUUsR0FBRyxXQUFXLDJCQUEyQjtZQUNwRCxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLElBQUk7Z0JBQ1YsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsSUFBSTtnQkFDVixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ2hELGdDQUFnQyxFQUFFO2dCQUNoQywwQkFBMEIsRUFBRSxXQUFXLEtBQUssTUFBTTthQUNuRDtZQUVELHNFQUFzRTtZQUN0RSxzREFBc0Q7WUFFdEQsNENBQTRDO1lBQzVDLGtCQUFrQixFQUFFLFdBQVcsS0FBSyxNQUFNO1lBRTFDLHNDQUFzQztZQUN0QyxtQkFBbUIsRUFBRSxLQUFLO1lBRTFCLGFBQWEsRUFBRSxXQUFXLEtBQUssTUFBTTtnQkFDbkMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtnQkFDMUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUM5QixDQUFDLENBQUE7UUFFRiwyREFBMkQ7UUFDM0QsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUNqQyxTQUFTLEVBQUUsTUFBTTtZQUNqQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1NBQ0YsQ0FBQyxDQUFBO1FBRUYsNkNBQTZDO1FBQzdDLDJFQUEyRTtRQUMzRSxpRUFBaUU7UUFDakUsa0RBQWtEO1FBQ2xELG9GQUFvRjtRQUVwRiw2Q0FBNkM7UUFDN0MsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUztZQUMzQixXQUFXLEVBQUUscUJBQXFCO1lBQ2xDLFVBQVUsRUFBRSxHQUFHLFdBQVcsa0JBQWtCO1NBQzdDLENBQUMsQ0FBQTtRQUVGLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ2xDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVE7WUFDMUIsV0FBVyxFQUFFLG9CQUFvQjtZQUNqQyxVQUFVLEVBQUUsR0FBRyxXQUFXLGlCQUFpQjtTQUM1QyxDQUFDLENBQUE7UUFFRiw2REFBNkQ7UUFDN0QsOENBQThDO1FBQzlDLDRDQUE0QztRQUM1Qyw4Q0FBOEM7UUFDOUMsd0RBQXdEO1FBQ3hELEtBQUs7UUFFTCwwQ0FBMEM7UUFDMUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQTtRQUNqRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLHlCQUF5QixDQUFDLENBQUE7UUFDM0QsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQTtJQUNoRCxDQUFDO0NBQ0Y7QUFuRkQsc0NBbUZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJ1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJ1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cydcblxuZXhwb3J0IGludGVyZmFjZSBEYXRhYmFzZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHJlYWRvbmx5IGVudmlyb25tZW50Pzogc3RyaW5nXG59XG5cbmV4cG9ydCBjbGFzcyBEYXRhYmFzZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHRhYmxlOiBkeW5hbW9kYi5UYWJsZVxuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogRGF0YWJhc2VTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcylcblxuICAgIGNvbnN0IGVudmlyb25tZW50ID0gcHJvcHM/LmVudmlyb25tZW50IHx8ICdkZXYnXG5cbiAgICAvLyBNYWluIER5bmFtb0RCIHRhYmxlIHdpdGggc2luZ2xlLXRhYmxlIGRlc2lnblxuICAgIHRoaXMudGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ01haW5UYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYCR7ZW52aXJvbm1lbnR9LW1pY3Jvc2VydmljZXMtbWFpbi10YWJsZWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ1BLJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnU0snLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeVNwZWNpZmljYXRpb246IHtcbiAgICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeUVuYWJsZWQ6IGVudmlyb25tZW50ID09PSAncHJvZCcsXG4gICAgICB9LFxuICAgICAgXG4gICAgICAvLyBTdHJlYW1zIGRpc2FibGVkIC0gY2FuIGJlIGVuYWJsZWQgbGF0ZXIgZm9yIGV2ZW50LWRyaXZlbiBwcm9jZXNzaW5nXG4gICAgICAvLyBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICAgIFxuICAgICAgLy8gRW5hYmxlIGRlbGV0aW9uIHByb3RlY3Rpb24gZm9yIHByb2R1Y3Rpb25cbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZW52aXJvbm1lbnQgPT09ICdwcm9kJyxcbiAgICAgIFxuICAgICAgLy8gVFRMIGF0dHJpYnV0ZSBmb3IgYXV0b21hdGljIGNsZWFudXBcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnLFxuICAgICAgXG4gICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiBcbiAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pXG5cbiAgICAvLyBHU0kxIC0gR2VuZXJpYyBwdXJwb3NlIGluZGV4IGZvciB2YXJpb3VzIGFjY2VzcyBwYXR0ZXJuc1xuICAgIHRoaXMudGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnR1NJMScsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ0dTSTFQSycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ0dTSTFTSycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICB9KVxuXG4gICAgLy8gQWRkaXRpb25hbCBpbmRleGVzIGNhbiBiZSBhZGRlZCBhcyBuZWVkZWQ6XG4gICAgLy8gR1NJMiAtIEZvciBzdGF0dXMtYmFzZWQgcXVlcmllcyAob3JkZXJzIGJ5IHN0YXR1cywgcHJvZHVjdHMgYnkgY2F0ZWdvcnkpXG4gICAgLy8gR1NJMyAtIEZvciB0aW1lLWJhc2VkIHF1ZXJpZXMgKGNyZWF0ZWRfYXQsIHVwZGF0ZWRfYXQgc29ydGluZylcbiAgICAvLyBMU0kxIC0gRm9yIGFsdGVybmF0ZSBzb3J0IHdpdGhpbiBzYW1lIHBhcnRpdGlvblxuICAgIC8vIE5vdGU6IFN0YXJ0IG1pbmltYWwgYW5kIGFkZCBpbmRleGVzIG9ubHkgd2hlbiBzcGVjaWZpYyBhY2Nlc3MgcGF0dGVybnMgYXJlIG5lZWRlZFxuXG4gICAgLy8gRXhwb3J0IHRhYmxlIG5hbWUgYW5kIEFSTiBmb3Igb3RoZXIgc3RhY2tzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgbmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tbWFpbi10YWJsZS1uYW1lYCxcbiAgICB9KVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RhYmxlQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMudGFibGUudGFibGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tbWFpbi10YWJsZS1hcm5gLFxuICAgIH0pXG5cbiAgICAvLyBTdHJlYW0gQVJOIG91dHB1dCBjb21tZW50ZWQgb3V0IHNpbmNlIHN0cmVhbXMgYXJlIGRpc2FibGVkXG4gICAgLy8gbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RhYmxlU3RyZWFtQXJuJywge1xuICAgIC8vICAgdmFsdWU6IHRoaXMudGFibGUudGFibGVTdHJlYW1Bcm4gfHwgJycsXG4gICAgLy8gICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlIHN0cmVhbSBBUk4nLFxuICAgIC8vICAgZXhwb3J0TmFtZTogYCR7ZW52aXJvbm1lbnR9LW1haW4tdGFibGUtc3RyZWFtLWFybmAsXG4gICAgLy8gfSlcblxuICAgIC8vIFRhZ3MgZm9yIGNvc3QgYWxsb2NhdGlvbiBhbmQgbWFuYWdlbWVudFxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBlbnZpcm9ubWVudClcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ1Byb2plY3QnLCAnU2VydmVybGVzc01pY3Jvc2VydmljZXMnKVxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ0RhdGFiYXNlJylcbiAgfVxufSJdfQ==