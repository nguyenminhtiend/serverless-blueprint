# Phase 13: Advanced CDK Patterns - Detailed Implementation Plan

## Overview

This phase focuses on implementing advanced AWS CDK patterns and best practices to create a robust, scalable, and maintainable infrastructure-as-code foundation. We'll establish sophisticated deployment strategies, reusable constructs, and enterprise-grade infrastructure patterns.

## Prerequisites

- Completed Phase 12: CI/CD Pipeline
- Strong understanding of AWS CDK concepts
- TypeScript proficiency
- AWS CLI configured with appropriate permissions
- CDK v2.150+ installed

## 13.1: Infrastructure Patterns

### 13.1.1: Cross-Stack Resource Sharing

**Objective**: Enable efficient resource sharing between stacks while maintaining loose coupling.

#### Implementation Steps

1. **Create Shared Resource Exports**
   ```typescript
   // infrastructure/lib/shared-resources-stack.ts
   export class SharedResourcesStack extends Stack {
     public readonly vpc: IVpc;
     public readonly kmsKey: IKey;
     public readonly logGroup: ILogGroup;
     
     constructor(scope: Construct, id: string, props: StackProps) {
       super(scope, id, props);
       
       this.vpc = new Vpc(this, 'SharedVpc', {
         maxAzs: 3,
         natGateways: 1,
         subnetConfiguration: [
           {
             name: 'Public',
             subnetType: SubnetType.PUBLIC,
             cidrMask: 24,
           },
           {
             name: 'Private',
             subnetType: SubnetType.PRIVATE_WITH_EGRESS,
             cidrMask: 24,
           },
         ],
       });
       
       this.kmsKey = new Key(this, 'SharedKmsKey', {
         description: 'Shared encryption key for microservices',
         keyRotation: true,
       });
       
       this.logGroup = new LogGroup(this, 'SharedLogGroup', {
         logGroupName: '/aws/lambda/shared-logs',
         retention: RetentionDays.ONE_MONTH,
       });
       
       // Export resources for cross-stack references
       new CfnOutput(this, 'VpcId', {
         value: this.vpc.vpcId,
         exportName: 'SharedVpcId',
       });
       
       new CfnOutput(this, 'KmsKeyArn', {
         value: this.kmsKey.keyArn,
         exportName: 'SharedKmsKeyArn',
       });
     }
   }
   ```

2. **Import Shared Resources in Consumer Stacks**
   ```typescript
   // infrastructure/lib/lambda-stack.ts
   export class LambdaStack extends Stack {
     constructor(scope: Construct, id: string, props: StackProps) {
       super(scope, id, props);
       
       // Import shared VPC
       const vpc = Vpc.fromLookup(this, 'ImportedVpc', {
         vpcId: Fn.importValue('SharedVpcId'),
       });
       
       // Import shared KMS key
       const kmsKey = Key.fromKeyArn(this, 'ImportedKmsKey', 
         Fn.importValue('SharedKmsKeyArn')
       );
       
       // Use shared resources in Lambda functions
       new Function(this, 'MyFunction', {
         runtime: Runtime.NODEJS_22_X,
         handler: 'index.handler',
         code: Code.fromAsset('lambda'),
         vpc,
         environment: {
           KMS_KEY_ID: kmsKey.keyId,
         },
       });
     }
   }
   ```

### 13.1.2: Nested Stacks for Complex Deployments

**Objective**: Organize complex infrastructure into manageable nested stack components.

#### Implementation Steps

1. **Create Base Nested Stack Class**
   ```typescript
   // infrastructure/lib/nested/base-nested-stack.ts
   export interface BaseNestedStackProps extends NestedStackProps {
     environment: 'dev' | 'staging' | 'prod';
     projectName: string;
     vpc?: IVpc;
   }
   
   export abstract class BaseNestedStack extends NestedStack {
     protected readonly environment: string;
     protected readonly projectName: string;
     
     constructor(scope: Construct, id: string, props: BaseNestedStackProps) {
       super(scope, id, props);
       
       this.environment = props.environment;
       this.projectName = props.projectName;
       
       // Apply consistent tagging
       Tags.of(this).add('Environment', props.environment);
       Tags.of(this).add('Project', props.projectName);
       Tags.of(this).add('ManagedBy', 'CDK');
     }
   }
   ```

2. **Database Nested Stack**
   ```typescript
   // infrastructure/lib/nested/database-nested-stack.ts
   export class DatabaseNestedStack extends BaseNestedStack {
     public readonly table: ITable;
     
     constructor(scope: Construct, id: string, props: BaseNestedStackProps) {
       super(scope, id, props);
       
       this.table = new Table(this, 'MainTable', {
         tableName: `${props.projectName}-${props.environment}-main-table`,
         partitionKey: { name: 'PK', type: AttributeType.STRING },
         sortKey: { name: 'SK', type: AttributeType.STRING },
         billingMode: BillingMode.PAY_PER_REQUEST,
         pointInTimeRecovery: props.environment === 'prod',
         encryption: props.environment === 'prod' 
           ? TableEncryption.CUSTOMER_MANAGED 
           : TableEncryption.AWS_MANAGED,
       });
       
       // Add GSI
       this.table.addGlobalSecondaryIndex({
         indexName: 'GSI1',
         partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
         sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
       });
     }
   }
   ```

3. **API Gateway Nested Stack**
   ```typescript
   // infrastructure/lib/nested/api-nested-stack.ts
   export interface ApiNestedStackProps extends BaseNestedStackProps {
     authorizer: IAuthorizer;
     lambdaFunctions: { [key: string]: IFunction };
   }
   
   export class ApiNestedStack extends BaseNestedStack {
     public readonly api: HttpApi;
     
     constructor(scope: Construct, id: string, props: ApiNestedStackProps) {
       super(scope, id, props);
       
       this.api = new HttpApi(this, 'Api', {
         apiName: `${props.projectName}-${props.environment}-api`,
         corsPreflight: {
           allowMethods: [CorsHttpMethod.ANY],
           allowOrigins: props.environment === 'prod' 
             ? ['https://yourdomain.com'] 
             : ['*'],
         },
       });
       
       // Add routes
       Object.entries(props.lambdaFunctions).forEach(([name, func]) => {
         this.api.addRoutes({
           path: `/${name.toLowerCase()}`,
           methods: [HttpMethod.GET, HttpMethod.POST],
           integration: new HttpLambdaIntegration(`${name}Integration`, func),
           authorizer: props.authorizer,
         });
       });
     }
   }
   ```

### 13.1.3: Stack Dependencies and Deployment Order

**Objective**: Establish proper stack dependencies and deployment orchestration.

#### Implementation Steps

1. **Main Stack Orchestrator**
   ```typescript
   // infrastructure/lib/main-stack.ts
   export class MainStack extends Stack {
     constructor(scope: Construct, id: string, props: StackProps) {
       super(scope, id, props);
       
       const environment = this.node.tryGetContext('environment') || 'dev';
       const projectName = 'serverless-blueprint';
       
       // 1. Shared resources (foundational)
       const sharedStack = new SharedResourcesStack(this, 'Shared', {
         ...props,
         description: 'Shared resources for all services',
       });
       
       // 2. Database stack (depends on shared KMS)
       const databaseStack = new DatabaseNestedStack(this, 'Database', {
           environment,
           projectName,
           vpc: sharedStack.vpc,
       });
       databaseStack.node.addDependency(sharedStack);
       
       // 3. Lambda functions (depends on database)
       const lambdaStack = new LambdaStack(this, 'Lambda', {
         ...props,
         table: databaseStack.table,
         kmsKey: sharedStack.kmsKey,
       });
       lambdaStack.node.addDependency(databaseStack);
       
       // 4. API Gateway (depends on Lambda)
       const apiStack = new ApiNestedStack(this, 'Api', {
         environment,
         projectName,
         authorizer: lambdaStack.authorizer,
         lambdaFunctions: lambdaStack.functions,
       });
       apiStack.node.addDependency(lambdaStack);
     }
   }
   ```

### 13.1.4: Resource Tagging Strategy

**Objective**: Implement comprehensive and consistent resource tagging.

#### Implementation Steps

1. **Tagging Aspect**
   ```typescript
   // infrastructure/lib/aspects/tagging-aspect.ts
   export interface TaggingConfig {
     environment: string;
     project: string;
     owner: string;
     costCenter?: string;
     dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
   }
   
   export class TaggingAspect implements IAspect {
     constructor(private readonly config: TaggingConfig) {}
     
     visit(node: IConstruct): void {
       // Apply to all CDK constructs
       if (node instanceof CfnResource) {
         Tags.of(node).add('Environment', this.config.environment);
         Tags.of(node).add('Project', this.config.project);
         Tags.of(node).add('Owner', this.config.owner);
         Tags.of(node).add('ManagedBy', 'CDK');
         Tags.of(node).add('DeployedAt', new Date().toISOString());
         
         if (this.config.costCenter) {
           Tags.of(node).add('CostCenter', this.config.costCenter);
         }
         
         if (this.config.dataClassification) {
           Tags.of(node).add('DataClassification', this.config.dataClassification);
         }
         
         // Add backup tags for supported resources
         if (this.isBackupEligible(node)) {
           Tags.of(node).add('Backup', this.config.environment === 'prod' ? 'required' : 'optional');
         }
       }
     }
     
     private isBackupEligible(resource: CfnResource): boolean {
       return ['AWS::DynamoDB::Table', 'AWS::RDS::DBInstance', 'AWS::EFS::FileSystem']
         .includes(resource.cfnResourceType);
     }
   }
   ```

2. **Apply Tagging Aspect**
   ```typescript
   // infrastructure/bin/app.ts
   const app = new App();
   
   const environment = app.node.tryGetContext('environment') || 'dev';
   const taggingConfig: TaggingConfig = {
     environment,
     project: 'serverless-blueprint',
     owner: 'platform-team',
     costCenter: 'engineering',
     dataClassification: 'internal',
   };
   
   const stack = new MainStack(app, `ServerlessBlueprint-${environment}`, {
     env: {
       account: process.env.CDK_DEFAULT_ACCOUNT,
       region: process.env.CDK_DEFAULT_REGION,
     },
   });
   
   Aspects.of(stack).add(new TaggingAspect(taggingConfig));
   ```

## 13.2: CDK Best Practices

### 13.2.1: Reusable Construct Creation

**Objective**: Create reusable CDK constructs for common patterns.

#### Implementation Steps

1. **Secure Lambda Construct**
   ```typescript
   // infrastructure/lib/constructs/secure-lambda.ts
   export interface SecureLambdaProps {
     functionName: string;
     handler: string;
     code: Code;
     environment?: { [key: string]: string };
     vpc?: IVpc;
     kmsKey?: IKey;
     memorySize?: number;
     timeout?: Duration;
     reservedConcurrency?: number;
     deadLetterQueue?: IQueue;
   }
   
   export class SecureLambda extends Construct {
     public readonly function: Function;
     public readonly role: Role;
     public readonly logGroup: LogGroup;
     
     constructor(scope: Construct, id: string, props: SecureLambdaProps) {
       super(scope, id);
       
       // Create dedicated log group
       this.logGroup = new LogGroup(this, 'LogGroup', {
         logGroupName: `/aws/lambda/${props.functionName}`,
         retention: RetentionDays.ONE_MONTH,
         encryption: props.kmsKey,
       });
       
       // Create least-privilege IAM role
       this.role = new Role(this, 'Role', {
         roleName: `${props.functionName}-role`,
         assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
         managedPolicies: [
           ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
         ],
         inlinePolicies: {
           LogsPolicy: new PolicyDocument({
             statements: [
               new PolicyStatement({
                 effect: Effect.ALLOW,
                 actions: [
                   'logs:CreateLogStream',
                   'logs:PutLogEvents',
                 ],
                 resources: [this.logGroup.logGroupArn],
               }),
             ],
           }),
         },
       });
       
       // Create the Lambda function
       this.function = new Function(this, 'Function', {
         functionName: props.functionName,
         runtime: Runtime.NODEJS_22_X,
         architecture: Architecture.ARM_64,
         handler: props.handler,
         code: props.code,
         environment: {
           NODE_ENV: 'production',
           LOG_LEVEL: 'info',
           ...props.environment,
         },
         vpc: props.vpc,
         role: this.role,
         memorySize: props.memorySize || 512,
         timeout: props.timeout || Duration.seconds(30),
         reservedConcurrency: props.reservedConcurrency,
         deadLetterQueue: props.deadLetterQueue,
         tracing: Tracing.ACTIVE, // Enable X-Ray tracing
         insightsVersion: LambdaInsightsVersion.VERSION_1_0_229_0,
         logGroup: this.logGroup,
       });
       
       // Environment variable encryption
       if (props.kmsKey) {
         this.function.addEnvironment('AWS_LAMBDA_EXEC_WRAPPER', '/opt/bootstrap');
         this.role.addToPolicy(new PolicyStatement({
           effect: Effect.ALLOW,
           actions: ['kms:Decrypt'],
           resources: [props.kmsKey.keyArn],
         }));
       }
     }
     
     public grantDynamoDBAccess(table: ITable): void {
       table.grantReadWriteData(this.function);
     }
     
     public grantSecretsAccess(secret: ISecret): void {
       secret.grantRead(this.function);
     }
   }
   ```

2. **Monitored API Gateway Construct**
   ```typescript
   // infrastructure/lib/constructs/monitored-api.ts
   export interface MonitoredApiProps {
     apiName: string;
     environment: string;
     cors?: CorsOptions;
     throttling?: {
       rateLimit: number;
       burstLimit: number;
     };
     wafEnabled?: boolean;
   }
   
   export class MonitoredApi extends Construct {
     public readonly api: HttpApi;
     public readonly dashboard: Dashboard;
     
     constructor(scope: Construct, id: string, props: MonitoredApiProps) {
       super(scope, id);
       
       // Create API Gateway
       this.api = new HttpApi(this, 'Api', {
         apiName: props.apiName,
         corsPreflight: props.cors,
       });
       
       // Add throttling
       if (props.throttling) {
         const throttle = new CfnThrottleRule(this, 'ThrottleRule', {
           throttleSettings: {
             rateLimit: props.throttling.rateLimit,
             burstLimit: props.throttling.burstLimit,
           },
         });
       }
       
       // Create CloudWatch Dashboard
       this.dashboard = new Dashboard(this, 'Dashboard', {
         dashboardName: `${props.apiName}-${props.environment}`,
       });
       
       // Add API Gateway metrics
       this.dashboard.addWidgets(
         new GraphWidget({
           title: 'API Requests',
           left: [
             new Metric({
               namespace: 'AWS/ApiGatewayV2',
               metricName: 'Count',
               dimensionsMap: {
                 ApiId: this.api.apiId,
               },
               statistic: 'Sum',
             }),
           ],
         }),
         new GraphWidget({
           title: 'API Latency',
           left: [
             new Metric({
               namespace: 'AWS/ApiGatewayV2',
               metricName: 'IntegrationLatency',
               dimensionsMap: {
                 ApiId: this.api.apiId,
               },
               statistic: 'Average',
             }),
           ],
         }),
         new GraphWidget({
           title: 'API Errors',
           left: [
             new Metric({
               namespace: 'AWS/ApiGatewayV2',
               metricName: '4XXError',
               dimensionsMap: {
                 ApiId: this.api.apiId,
               },
               statistic: 'Sum',
             }),
             new Metric({
               namespace: 'AWS/ApiGatewayV2',
               metricName: '5XXError',
               dimensionsMap: {
                 ApiId: this.api.apiId,
               },
               statistic: 'Sum',
             }),
           ],
         })
       );
       
       // Create alarms
       new Alarm(this, 'HighErrorRate', {
         alarmName: `${props.apiName}-high-error-rate`,
         metric: new Metric({
           namespace: 'AWS/ApiGatewayV2',
           metricName: '5XXError',
           dimensionsMap: {
             ApiId: this.api.apiId,
           },
           statistic: 'Sum',
         }),
         threshold: 10,
         evaluationPeriods: 2,
       });
     }
   }
   ```

### 13.2.2: Aspect Implementation for Cross-Cutting Concerns

**Objective**: Use CDK Aspects to implement cross-cutting concerns like security and compliance.

#### Implementation Steps

1. **Security Aspect**
   ```typescript
   // infrastructure/lib/aspects/security-aspect.ts
   export class SecurityAspect implements IAspect {
     visit(node: IConstruct): void {
       // Enforce HTTPS for API Gateway
       if (node instanceof HttpApi) {
         // Add security headers
         node.addRoutes({
           path: '/health',
           methods: [HttpMethod.GET],
           integration: new HttpLambdaIntegration('HealthCheck', this.createHealthCheckFunction()),
         });
       }
       
       // Enforce encryption for DynamoDB tables
       if (node instanceof Table) {
         if (!node.encryption) {
           node.node.addWarning('DynamoDB table should use encryption');
         }
       }
       
       // Enforce IAM best practices for Lambda functions
       if (node instanceof Function) {
         const role = node.role;
         if (role instanceof Role) {
           this.validateLambdaRole(role);
         }
       }
       
       // Enforce VPC configuration for Lambda functions in production
       if (node instanceof Function && this.isProduction()) {
         if (!node.vpc) {
           node.node.addError('Lambda functions must be deployed in VPC in production');
         }
       }
     }
     
     private validateLambdaRole(role: Role): void {
       // Check for overly permissive policies
       const statements = role.assumeRolePolicy?.statements || [];
       statements.forEach(statement => {
         if (statement.actions.includes('*')) {
           role.node.addWarning('IAM role contains wildcard permissions');
         }
       });
     }
     
     private isProduction(): boolean {
       return process.env.NODE_ENV === 'production';
     }
   }
   ```

2. **Compliance Aspect**
   ```typescript
   // infrastructure/lib/aspects/compliance-aspect.ts
   export class ComplianceAspect implements IAspect {
     constructor(private readonly complianceLevel: 'basic' | 'enhanced' | 'strict') {}
     
     visit(node: IConstruct): void {
       // Enforce backup requirements
       if (this.requiresBackup(node)) {
         this.enforceBackup(node);
       }
       
       // Enforce logging requirements
       if (this.requiresLogging(node)) {
         this.enforceLogging(node);
       }
       
       // Enforce encryption requirements
       if (this.requiresEncryption(node)) {
         this.enforceEncryption(node);
       }
     }
     
     private requiresBackup(node: IConstruct): boolean {
       return node instanceof Table || node instanceof FileSystem;
     }
     
     private enforceBackup(node: IConstruct): void {
       if (node instanceof Table) {
         if (!node.pointInTimeRecovery) {
           node.node.addError('DynamoDB table must have point-in-time recovery enabled for compliance');
         }
       }
     }
     
     private requiresLogging(node: IConstruct): boolean {
       return node instanceof Function || node instanceof HttpApi;
     }
     
     private enforceLogging(node: IConstruct): void {
       if (node instanceof Function) {
         // Ensure CloudWatch Logs are configured
         const logGroupName = `/aws/lambda/${node.functionName}`;
         new LogGroup(node, 'ComplianceLogGroup', {
           logGroupName,
           retention: this.getLogRetention(),
         });
       }
     }
     
     private getLogRetention(): RetentionDays {
       switch (this.complianceLevel) {
         case 'strict':
           return RetentionDays.ONE_YEAR;
         case 'enhanced':
           return RetentionDays.SIX_MONTHS;
         default:
           return RetentionDays.ONE_MONTH;
       }
     }
   }
   ```

### 13.2.3: Environment Context and Configuration

**Objective**: Implement sophisticated environment-specific configuration management.

#### Implementation Steps

1. **Environment Configuration**
   ```typescript
   // infrastructure/lib/config/environment-config.ts
   export interface EnvironmentConfig {
     environment: 'dev' | 'staging' | 'prod';
     region: string;
     account?: string;
     
     // Lambda configuration
     lambda: {
       memorySize: number;
       timeout: number;
       reservedConcurrency?: number;
       provisionedConcurrency?: number;
     };
     
     // DynamoDB configuration
     dynamodb: {
       billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
       backupEnabled: boolean;
       encryption: 'AWS_MANAGED' | 'CUSTOMER_MANAGED';
     };
     
     // API Gateway configuration
     api: {
       throttling: {
         rateLimit: number;
         burstLimit: number;
       };
       cors: {
         allowOrigins: string[];
         allowMethods: string[];
       };
     };
     
     // Monitoring configuration
     monitoring: {
       logRetention: number;
       detailedMetrics: boolean;
       alarmNotifications: boolean;
     };
   }
   
   export class EnvironmentConfigFactory {
     static create(environment: string): EnvironmentConfig {
       const baseConfig = this.getBaseConfig();
       
       switch (environment) {
         case 'prod':
           return this.getProductionConfig(baseConfig);
         case 'staging':
           return this.getStagingConfig(baseConfig);
         default:
           return this.getDevelopmentConfig(baseConfig);
       }
     }
     
     private static getBaseConfig(): Partial<EnvironmentConfig> {
       return {
         lambda: {
           memorySize: 512,
           timeout: 30,
         },
         api: {
           cors: {
             allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
           },
         },
       };
     }
     
     private static getProductionConfig(base: Partial<EnvironmentConfig>): EnvironmentConfig {
       return {
         ...base,
         environment: 'prod',
         region: 'us-east-1',
         lambda: {
           memorySize: 1024,
           timeout: 30,
           reservedConcurrency: 100,
           provisionedConcurrency: 10,
         },
         dynamodb: {
           billingMode: 'PROVISIONED',
           backupEnabled: true,
           encryption: 'CUSTOMER_MANAGED',
         },
         api: {
           throttling: {
             rateLimit: 1000,
             burstLimit: 2000,
           },
           cors: {
             allowOrigins: ['https://yourdomain.com'],
             allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
           },
         },
         monitoring: {
           logRetention: 365,
           detailedMetrics: true,
           alarmNotifications: true,
         },
       } as EnvironmentConfig;
     }
     
     private static getDevelopmentConfig(base: Partial<EnvironmentConfig>): EnvironmentConfig {
       return {
         ...base,
         environment: 'dev',
         region: 'us-west-2',
         lambda: {
           memorySize: 256,
           timeout: 15,
         },
         dynamodb: {
           billingMode: 'PAY_PER_REQUEST',
           backupEnabled: false,
           encryption: 'AWS_MANAGED',
         },
         api: {
           throttling: {
             rateLimit: 100,
             burstLimit: 200,
           },
           cors: {
             allowOrigins: ['*'],
             allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
           },
         },
         monitoring: {
           logRetention: 7,
           detailedMetrics: false,
           alarmNotifications: false,
         },
       } as EnvironmentConfig;
     }
   }
   ```

2. **Configuration Usage in Stacks**
   ```typescript
   // infrastructure/lib/configured-lambda-stack.ts
   export interface ConfiguredLambdaStackProps extends StackProps {
     config: EnvironmentConfig;
     table: ITable;
   }
   
   export class ConfiguredLambdaStack extends Stack {
     constructor(scope: Construct, id: string, props: ConfiguredLambdaStackProps) {
       super(scope, id, props);
       
       const { config } = props;
       
       // Create Lambda function with environment-specific configuration
       const userFunction = new SecureLambda(this, 'UserFunction', {
         functionName: `${config.environment}-user-service`,
         handler: 'src/handlers/user.handler',
         code: Code.fromAsset('../packages/service-users/dist'),
         memorySize: config.lambda.memorySize,
         timeout: Duration.seconds(config.lambda.timeout),
         reservedConcurrency: config.lambda.reservedConcurrency,
         environment: {
           TABLE_NAME: props.table.tableName,
           ENVIRONMENT: config.environment,
         },
       });
       
       // Apply provisioned concurrency for production
       if (config.lambda.provisionedConcurrency) {
         const version = userFunction.function.currentVersion;
         new Alias(this, 'UserFunctionAlias', {
           aliasName: 'live',
           version,
           provisionedConcurrencyConfig: {
             provisionedConcurrentExecutions: config.lambda.provisionedConcurrency,
           },
         });
       }
       
       // Grant table access
       userFunction.grantDynamoDBAccess(props.table);
     }
   }
   ```

## 13.2: Deployment Strategies

### 13.2.1: Blue-Green Deployments with Lambda Aliases

**Objective**: Implement safe deployment strategies with instant rollback capabilities.

#### Implementation Steps

1. **Blue-Green Lambda Deployment Construct**
   ```typescript
   // infrastructure/lib/constructs/blue-green-lambda.ts
   export interface BlueGreenLambdaProps {
     functionName: string;
     handler: string;
     code: Code;
     environment?: { [key: string]: string };
     canaryConfig?: {
       percentage: number;
       durationMinutes: number;
     };
   }
   
   export class BlueGreenLambda extends Construct {
     public readonly function: Function;
     public readonly liveAlias: Alias;
     public readonly stagingAlias: Alias;
     
     constructor(scope: Construct, id: string, props: BlueGreenLambdaProps) {
       super(scope, id);
       
       this.function = new Function(this, 'Function', {
         functionName: props.functionName,
         runtime: Runtime.NODEJS_22_X,
         handler: props.handler,
         code: props.code,
         environment: props.environment,
       });
       
       // Create staging alias (always points to $LATEST)
       this.stagingAlias = new Alias(this, 'StagingAlias', {
         aliasName: 'staging',
         version: this.function.latestVersion,
       });
       
       // Create live alias with blue-green deployment configuration
       this.liveAlias = new Alias(this, 'LiveAlias', {
         aliasName: 'live',
         version: this.function.latestVersion,
         ...(props.canaryConfig && {
           codeSha256: this.function.latestVersion.codeSha256,
           routingConfig: {
             additionalVersions: [{
               version: this.function.latestVersion,
               weight: props.canaryConfig.percentage / 100,
             }],
           },
         }),
       });
       
       // CloudWatch alarms for automatic rollback
       if (props.canaryConfig) {
         this.createCanaryAlarms();
       }
     }
     
     private createCanaryAlarms(): void {
       // Error rate alarm
       new Alarm(this, 'ErrorRateAlarm', {
         alarmName: `${this.function.functionName}-error-rate`,
         metric: this.liveAlias.metricErrors(),
         threshold: 1,
         evaluationPeriods: 2,
         treatMissingData: TreatMissingData.NOT_BREACHING,
       });
       
       // Duration alarm
       new Alarm(this, 'DurationAlarm', {
         alarmName: `${this.function.functionName}-duration`,
         metric: this.liveAlias.metricDuration(),
         threshold: 5000, // 5 seconds
         evaluationPeriods: 2,
         treatMissingData: TreatMissingData.NOT_BREACHING,
       });
     }
   }
   ```

2. **Deployment Script with Health Checks**
   ```bash
   #!/bin/bash
   # scripts/blue-green-deploy.sh
   
   set -e
   
   FUNCTION_NAME=$1
   ENVIRONMENT=${2:-dev}
   
   if [ -z "$FUNCTION_NAME" ]; then
     echo "Usage: $0 <function-name> [environment]"
     exit 1
   fi
   
   echo "Starting blue-green deployment for $FUNCTION_NAME in $ENVIRONMENT"
   
   # Step 1: Deploy new version to staging alias
   echo "Deploying to staging alias..."
   aws lambda update-function-code \
     --function-name "$FUNCTION_NAME" \
     --zip-file "fileb://dist/$FUNCTION_NAME.zip"
   
   # Step 2: Run health checks against staging
   echo "Running health checks against staging..."
   STAGING_URL=$(aws lambda get-alias \
     --function-name "$FUNCTION_NAME" \
     --name staging \
     --query 'AliasArn' --output text)
   
   # Invoke staging function to verify it works
   aws lambda invoke \
     --function-name "$STAGING_URL" \
     --payload '{"httpMethod": "GET", "path": "/health"}' \
     response.json
   
   if ! grep -q '"statusCode": 200' response.json; then
     echo "Health check failed! Rolling back..."
     exit 1
   fi
   
   echo "Health checks passed. Promoting to live..."
   
   # Step 3: Gradually shift traffic to new version
   for weight in 10 25 50 75 100; do
     echo "Shifting ${weight}% traffic to new version..."
     
     aws lambda update-alias \
       --function-name "$FUNCTION_NAME" \
       --name live \
       --routing-config "AdditionalVersionWeights={'$LATEST':$(echo "scale=2; $weight/100" | bc)}"
     
     # Wait and monitor metrics
     echo "Monitoring for 2 minutes..."
     sleep 120
     
     # Check error rate
     ERROR_RATE=$(aws cloudwatch get-metric-statistics \
       --namespace AWS/Lambda \
       --metric-name Errors \
       --dimensions Name=FunctionName,Value="$FUNCTION_NAME:live" \
       --start-time "$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S)" \
       --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
       --period 300 \
       --statistics Sum \
       --query 'Datapoints[0].Sum' --output text)
     
     if [ "$ERROR_RATE" != "None" ] && [ "$ERROR_RATE" -gt 0 ]; then
       echo "Errors detected! Rolling back..."
       aws lambda update-alias \
         --function-name "$FUNCTION_NAME" \
         --name live \
         --routing-config '{}'
       exit 1
     fi
   done
   
   echo "Blue-green deployment completed successfully!"
   rm -f response.json
   ```

### 13.2.2: CDK Pipelines for Self-Mutating Deployments

**Objective**: Create self-updating infrastructure pipelines that can modify themselves.

#### Implementation Steps

1. **Pipeline Stack**
   ```typescript
   // infrastructure/lib/pipeline-stack.ts
   export interface PipelineStackProps extends StackProps {
     githubRepo: string;
     githubBranch: string;
     githubToken: string;
   }
   
   export class PipelineStack extends Stack {
     constructor(scope: Construct, id: string, props: PipelineStackProps) {
       super(scope, id, props);
       
       // Create the pipeline
       const pipeline = new CodePipeline(this, 'Pipeline', {
         pipelineName: 'ServerlessBlueprintPipeline',
         synth: new ShellStep('Synth', {
           input: CodePipelineSource.gitHub(props.githubRepo, props.githubBranch, {
             authentication: SecretValue.secretsManager('github-token'),
           }),
           commands: [
             'npm ci',
             'npx pnpm install --frozen-lockfile',
             'npx pnpm build',
             'cd infrastructure',
             'npx cdk synth',
           ],
           primaryOutputDirectory: 'infrastructure/cdk.out',
         }),
         selfMutation: true,
         crossAccountKeys: true,
       });
       
       // Add development stage
       const devStage = new ApplicationStage(this, 'Dev', {
         env: {
           account: this.account,
           region: 'us-west-2',
         },
         environment: 'dev',
       });
       
       const devStageDeployment = pipeline.addStage(devStage, {
         pre: [
           new ShellStep('UnitTests', {
             commands: [
               'npx pnpm test:unit',
             ],
           }),
         ],
         post: [
           new ShellStep('IntegrationTests', {
             commands: [
               'npx pnpm test:integration',
             ],
             envFromCfnOutputs: {
               API_URL: devStage.apiUrl,
             },
           }),
         ],
       });
       
       // Add staging stage with manual approval
       const stagingStage = new ApplicationStage(this, 'Staging', {
         env: {
           account: this.account,
           region: 'us-east-1',
         },
         environment: 'staging',
       });
       
       pipeline.addStage(stagingStage, {
         pre: [
           new ManualApprovalStep('PromoteToStaging', {
             comment: 'Please review and approve deployment to staging',
           }),
         ],
         post: [
           new ShellStep('E2ETests', {
             commands: [
               'npx pnpm test:e2e',
             ],
             envFromCfnOutputs: {
               API_URL: stagingStage.apiUrl,
             },
           }),
         ],
       });
       
       // Add production stage with additional safeguards
       const prodStage = new ApplicationStage(this, 'Prod', {
         env: {
           account: process.env.PROD_ACCOUNT,
           region: 'us-east-1',
         },
         environment: 'prod',
       });
       
       pipeline.addStage(prodStage, {
         pre: [
           new ManualApprovalStep('PromoteToProduction', {
             comment: 'Please review and approve deployment to production',
           }),
         ],
         post: [
           new ShellStep('SmokeTests', {
             commands: [
               'npx pnpm test:smoke',
             ],
             envFromCfnOutputs: {
               API_URL: prodStage.apiUrl,
             },
           }),
         ],
       });
     }
   }
   ```

2. **Application Stage**
   ```typescript
   // infrastructure/lib/application-stage.ts
   export interface ApplicationStageProps extends StageProps {
     environment: 'dev' | 'staging' | 'prod';
   }
   
   export class ApplicationStage extends Stage {
     public readonly apiUrl: CfnOutput;
     
     constructor(scope: Construct, id: string, props: ApplicationStageProps) {
       super(scope, id, props);
       
       const config = EnvironmentConfigFactory.create(props.environment);
       
       // Create the main application stack
       const appStack = new MainStack(this, 'App', {
         env: props.env,
         config,
       });
       
       // Output the API URL for testing
       this.apiUrl = new CfnOutput(appStack, 'ApiUrl', {
         value: appStack.api.url!,
         exportName: `${props.environment}-api-url`,
       });
     }
   }
   ```

### 13.2.3: Multi-Environment Management

**Objective**: Implement sophisticated cross-environment deployment and management.

#### Implementation Steps

1. **Environment Promotion Pipeline**
   ```typescript
   // scripts/promote-environment.ts
   import { execSync } from 'child_process';
   import { readFileSync } from 'fs';
   
   interface PromotionConfig {
     sourceEnvironment: string;
     targetEnvironment: string;
     requireApproval: boolean;
     runTests: boolean;
   }
   
   class EnvironmentPromotion {
     constructor(private config: PromotionConfig) {}
     
     async promote(): Promise<void> {
       console.log(`Promoting from ${this.config.sourceEnvironment} to ${this.config.targetEnvironment}`);
       
       try {
         // 1. Validate source environment
         await this.validateSourceEnvironment();
         
         // 2. Run pre-promotion tests
         if (this.config.runTests) {
           await this.runTests();
         }
         
         // 3. Get approval if required
         if (this.config.requireApproval) {
           await this.getApproval();
         }
         
         // 4. Deploy to target environment
         await this.deployToTarget();
         
         // 5. Run post-deployment validation
         await this.validateDeployment();
         
         console.log('Promotion completed successfully!');
       } catch (error) {
         console.error('Promotion failed:', error);
         await this.rollback();
         throw error;
       }
     }
     
     private async validateSourceEnvironment(): Promise<void> {
       console.log(`Validating ${this.config.sourceEnvironment} environment...`);
       
       // Check if source environment is healthy
       const healthCheck = execSync(
         `curl -f ${process.env[`${this.config.sourceEnvironment.toUpperCase()}_API_URL`]}/health`,
         { encoding: 'utf8' }
       );
       
       if (!healthCheck.includes('healthy')) {
         throw new Error('Source environment health check failed');
       }
     }
     
     private async runTests(): Promise<void> {
       console.log('Running tests...');
       
       execSync('pnpm test:unit', { stdio: 'inherit' });
       execSync(`pnpm test:integration --env=${this.config.sourceEnvironment}`, { stdio: 'inherit' });
     }
     
     private async getApproval(): Promise<void> {
       if (process.env.CI === 'true') {
         // In CI/CD, use external approval mechanism
         console.log('Waiting for approval in pipeline...');
         return;
       }
       
       // Interactive approval for local runs
       const readline = require('readline').createInterface({
         input: process.stdin,
         output: process.stdout,
       });
       
       return new Promise((resolve, reject) => {
         readline.question(
           `Do you approve promotion to ${this.config.targetEnvironment}? (yes/no): `,
           (answer: string) => {
             readline.close();
             if (answer.toLowerCase() === 'yes') {
               resolve();
             } else {
               reject(new Error('Promotion not approved'));
             }
           }
         );
       });
     }
     
     private async deployToTarget(): Promise<void> {
       console.log(`Deploying to ${this.config.targetEnvironment}...`);
       
       execSync(
         `cd infrastructure && pnpm cdk deploy --all --context environment=${this.config.targetEnvironment}`,
         { stdio: 'inherit' }
       );
     }
     
     private async validateDeployment(): Promise<void> {
       console.log('Validating deployment...');
       
       // Wait for deployment to stabilize
       await new Promise(resolve => setTimeout(resolve, 30000));
       
       // Run smoke tests
       execSync(`pnpm test:smoke --env=${this.config.targetEnvironment}`, { stdio: 'inherit' });
     }
     
     private async rollback(): Promise<void> {
       console.log('Rolling back deployment...');
       
       // Implement rollback logic here
       // This could involve reverting to previous version or rolling back infrastructure changes
     }
   }
   
   // Usage
   const promotion = new EnvironmentPromotion({
     sourceEnvironment: process.argv[2] || 'staging',
     targetEnvironment: process.argv[3] || 'prod',
     requireApproval: true,
     runTests: true,
   });
   
   promotion.promote().catch(process.exit);
   ```

2. **Configuration Drift Detection**
   ```typescript
   // scripts/detect-drift.ts
   import { CloudFormation } from 'aws-sdk';
   
   class DriftDetector {
     private cloudformation: CloudFormation;
     
     constructor(private region: string) {
       this.cloudformation = new CloudFormation({ region });
     }
     
     async detectDrift(stackName: string): Promise<void> {
       console.log(`Detecting drift for stack: ${stackName}`);
       
       try {
         // Start drift detection
         const driftResponse = await this.cloudformation.detectStackDrift({
           StackName: stackName,
         }).promise();
         
         const driftDetectionId = driftResponse.StackDriftDetectionId!;
         
         // Wait for detection to complete
         await this.waitForDriftDetection(driftDetectionId);
         
         // Get drift results
         const driftResult = await this.cloudformation.describeStackDriftDetectionStatus({
           StackDriftDetectionId: driftDetectionId,
         }).promise();
         
         console.log(`Drift detection status: ${driftResult.DetectionStatus}`);
         console.log(`Drift status: ${driftResult.StackDriftStatus}`);
         
         if (driftResult.StackDriftStatus === 'DRIFTED') {
           await this.reportDriftedResources(stackName);
         }
         
       } catch (error) {
         console.error('Drift detection failed:', error);
         throw error;
       }
     }
     
     private async waitForDriftDetection(driftDetectionId: string): Promise<void> {
       let status = 'DETECTION_IN_PROGRESS';
       
       while (status === 'DETECTION_IN_PROGRESS') {
         await new Promise(resolve => setTimeout(resolve, 5000));
         
         const result = await this.cloudformation.describeStackDriftDetectionStatus({
           StackDriftDetectionId: driftDetectionId,
         }).promise();
         
         status = result.DetectionStatus!;
         console.log(`Detection status: ${status}`);
       }
     }
     
     private async reportDriftedResources(stackName: string): Promise<void> {
       const resources = await this.cloudformation.describeStackResourceDrifts({
         StackName: stackName,
         StackResourceDriftStatusFilters: ['MODIFIED', 'DELETED'],
       }).promise();
       
       console.log('Drifted resources:');
       resources.StackResourceDrifts?.forEach(resource => {
         console.log(`  - ${resource.LogicalResourceId}: ${resource.StackResourceDriftStatus}`);
         if (resource.PropertyDifferences) {
           resource.PropertyDifferences.forEach(diff => {
             console.log(`    Property: ${diff.PropertyPath}`);
             console.log(`    Expected: ${diff.ExpectedValue}`);
             console.log(`    Actual: ${diff.ActualValue}`);
           });
         }
       });
     }
   }
   
   // Usage
   const detector = new DriftDetector(process.env.AWS_REGION || 'us-east-1');
   const stackName = process.argv[2];
   
   if (!stackName) {
     console.error('Usage: ts-node detect-drift.ts <stack-name>');
     process.exit(1);
   }
   
   detector.detectDrift(stackName).catch(console.error);
   ```

## Implementation Timeline

### Week 1: Infrastructure Patterns
- [ ] Implement cross-stack resource sharing patterns
- [ ] Create nested stack architecture
- [ ] Set up stack dependencies and deployment order
- [ ] Implement comprehensive resource tagging strategy

### Week 2: CDK Best Practices
- [ ] Create reusable construct library (SecureLambda, MonitoredApi)
- [ ] Implement security and compliance aspects
- [ ] Set up environment-specific configuration management
- [ ] Create construct testing framework

### Week 3: Advanced Deployment Strategies
- [ ] Implement blue-green deployment constructs
- [ ] Set up canary deployment with automatic rollback
- [ ] Create CDK Pipelines for self-mutating deployments
- [ ] Implement cross-account deployment patterns

### Week 4: Multi-Environment Management
- [ ] Create environment promotion pipeline
- [ ] Implement configuration drift detection
- [ ] Set up cross-environment monitoring and alerting
- [ ] Create environment-specific resource sizing automation

## Success Criteria

**Phase 13 Complete When:**
- [ ] All infrastructure uses advanced CDK patterns and constructs
- [ ] Blue-green deployments work reliably with automatic rollback
- [ ] CDK Pipelines enable self-updating infrastructure
- [ ] Configuration drift is automatically detected and reported
- [ ] Environment promotions are automated and safe
- [ ] Comprehensive tagging and compliance aspects are applied
- [ ] Reusable constructs are documented and tested

**Expected Outcomes:**
- **Infrastructure as Code Maturity**: Enterprise-grade CDK patterns
- **Deployment Safety**: Zero-downtime deployments with instant rollback
- **Environment Parity**: Consistent configuration across environments
- **Operational Excellence**: Automated drift detection and remediation
- **Developer Experience**: Simplified deployment and environment management

## Recommended Infrastructure Folder Structure

Based on CDK best practices and the advanced patterns outlined in this phase, here's the recommended folder organization:

```
infrastructure/
├── bin/
│   ├── app.ts                           # Main CDK app entry point
│   └── pipeline.ts                      # Pipeline-specific entry point
├── lib/
│   ├── stacks/
│   │   ├── main-stack.ts                # Main orchestrator stack
│   │   ├── pipeline-stack.ts            # CI/CD pipeline stack
│   │   ├── shared-resources-stack.ts    # Cross-stack shared resources
│   │   ├── api-gateway-stack.ts         # API Gateway configuration
│   │   ├── cognito-stack.ts             # Authentication/authorization
│   │   ├── database-stack.ts            # DynamoDB tables and configuration
│   │   ├── events-stack.ts              # EventBridge and SQS
│   │   └── lambda-stack.ts              # Lambda functions and layers
│   ├── nested/
│   │   ├── base-nested-stack.ts         # Base class for nested stacks
│   │   ├── database-nested-stack.ts     # Database nested stack
│   │   ├── api-nested-stack.ts          # API Gateway nested stack
│   │   └── monitoring-nested-stack.ts   # CloudWatch resources
│   ├── constructs/
│   │   ├── secure-lambda.ts             # Reusable secure Lambda construct
│   │   ├── monitored-api.ts             # API Gateway with monitoring
│   │   ├── blue-green-lambda.ts         # Blue-green deployment construct
│   │   ├── encrypted-table.ts           # DynamoDB with encryption
│   │   └── vpc-construct.ts             # VPC with best practices
│   ├── aspects/
│   │   ├── tagging-aspect.ts            # Consistent resource tagging
│   │   ├── security-aspect.ts           # Security compliance enforcement
│   │   ├── compliance-aspect.ts         # Regulatory compliance checks
│   │   └── cost-optimization-aspect.ts  # Cost optimization rules
│   ├── config/
│   │   ├── environment-config.ts        # Environment-specific configuration
│   │   ├── stage-config.ts              # Stage configuration factory
│   │   └── constants.ts                 # Global constants and defaults
│   ├── stages/
│   │   ├── application-stage.ts         # Main application stage
│   │   ├── development-stage.ts         # Development environment
│   │   ├── staging-stage.ts             # Staging environment
│   │   └── production-stage.ts          # Production environment
│   └── utils/
│       ├── naming.ts                    # Consistent resource naming
│       ├── tags.ts                      # Tag management utilities
│       ├── permissions.ts               # IAM permission helpers
│       └── validation.ts                # Configuration validation
├── scripts/
│   ├── deploy.sh                        # Standard deployment script
│   ├── blue-green-deploy.sh            # Blue-green deployment script
│   ├── promote-environment.ts           # Environment promotion script
│   ├── detect-drift.ts                  # Configuration drift detection
│   ├── cleanup.sh                       # Resource cleanup script
│   └── validate-deployment.ts           # Post-deployment validation
├── test/
│   ├── unit/
│   │   ├── stacks/                      # Stack unit tests
│   │   ├── constructs/                  # Construct unit tests
│   │   └── aspects/                     # Aspect unit tests
│   ├── integration/
│   │   ├── deployment.test.ts           # Deployment integration tests
│   │   └── cross-stack.test.ts          # Cross-stack integration tests
│   └── fixtures/
│       └── test-data.ts                 # Test data and mocks
├── docs/
│   ├── architecture.md                  # Architecture documentation
│   ├── deployment-guide.md              # Deployment procedures
│   ├── troubleshooting.md               # Common issues and solutions
│   └── constructs/                      # Construct documentation
│       ├── secure-lambda.md
│       ├── monitored-api.md
│       └── blue-green-lambda.md
├── cdk.json                             # CDK configuration
├── package.json                         # Dependencies and scripts
├── tsconfig.json                        # TypeScript configuration
├── jest.config.js                       # Test configuration
└── README.md                            # Infrastructure overview
```

### Key Improvements Over Current Structure

1. **Separation of Concerns**:
   - **Stacks**: High-level infrastructure orchestration
   - **Nested**: Modular sub-components for complex deployments
   - **Constructs**: Reusable, opinionated components
   - **Aspects**: Cross-cutting concerns (security, compliance, tagging)

2. **Configuration Management**:
   - Centralized environment-specific configuration
   - Stage-based deployment configuration
   - Validation utilities for configuration correctness

3. **Deployment Strategies**:
   - Blue-green deployment scripts and constructs
   - Environment promotion automation
   - Drift detection and remediation

4. **Testing Structure**:
   - Unit tests for individual components
   - Integration tests for stack interactions
   - Test fixtures for consistent test data

5. **Documentation**:
   - Architecture and deployment guides
   - Construct-specific documentation
   - Troubleshooting documentation

### Implementation Priority

**Phase 1 (Week 1)**:
```
infrastructure/
├── lib/
│   ├── stacks/           # Refactor existing stacks
│   ├── config/           # Environment configuration
│   └── aspects/          # Tagging and security aspects
└── scripts/              # Deployment automation
```

**Phase 2 (Week 2)**:
```
├── lib/
│   ├── constructs/       # Reusable constructs
│   ├── nested/           # Nested stack patterns
│   └── utils/            # Helper utilities
```

**Phase 3 (Week 3-4)**:
```
├── lib/stages/           # Multi-environment stages
├── test/                 # Comprehensive testing
├── docs/                 # Documentation
└── scripts/              # Advanced deployment scripts
```

### Migration Strategy

1. **Gradual Migration**: Move existing stacks to new structure incrementally
2. **Maintain Compatibility**: Keep existing deployment scripts working during transition
3. **Test Coverage**: Add tests as components are moved to new structure
4. **Documentation**: Document patterns and constructs as they're implemented

This structure supports the advanced CDK patterns outlined in Phase 13 while maintaining clarity and enabling team collaboration.

## Next Steps

After completing Phase 13, proceed to:
- **Phase 14**: Enhanced Security & Operational Excellence
- Focus on advanced security patterns, compliance automation, and operational monitoring
- Implement comprehensive security scanning and vulnerability management