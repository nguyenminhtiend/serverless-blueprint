import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { Construct } from 'constructs';

export interface UiAssetsStackProps extends cdk.StackProps {
  readonly environment?: string;
}

export class UiAssetsStack extends cdk.Stack {
  public readonly assetsBucket: s3.Bucket;
  public readonly cssUrl: string;
  public readonly logoUrl: string;

  constructor(scope: Construct, id: string, props?: UiAssetsStackProps) {
    super(scope, id, props);

    const environment = props?.environment || 'dev';

    // S3 bucket for hosting UI assets
    this.assetsBucket = new s3.Bucket(this, 'UiAssetsBucket', {
      bucketName: `${environment}-cognito-ui-assets-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,

      // Public read access for Cognito
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),

      // CORS configuration for web access
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 86400, // 1 day
        },
      ],

      // Lifecycle management
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],

      // Deletion policy
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
    });

    // Deploy assets to S3
    const assetsDeployment = new s3deploy.BucketDeployment(this, 'UiAssetsDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../assets'))],
      destinationBucket: this.assetsBucket,
      destinationKeyPrefix: 'ui/',

      // Cache settings for better performance
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(cdk.Duration.days(30)),
      ],

      // Content types
      contentType: 'text/css',
      metadata: {
        'Content-Type': 'text/css',
      },
    });

    // Set proper content type for CSS files
    new s3deploy.BucketDeployment(this, 'CssAssetsDeployment', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../assets'), {
          exclude: ['*.svg', '*.png', '*.jpg', '*.jpeg', '*.gif'],
        }),
      ],
      destinationBucket: this.assetsBucket,
      destinationKeyPrefix: 'ui/',
      contentType: 'text/css',
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(cdk.Duration.days(30)),
      ],
    });

    // Set proper content type for SVG files
    new s3deploy.BucketDeployment(this, 'SvgAssetsDeployment', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../assets'), {
          exclude: ['*.css'],
        }),
      ],
      destinationBucket: this.assetsBucket,
      destinationKeyPrefix: 'ui/',
      contentType: 'image/svg+xml',
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(cdk.Duration.days(30)),
      ],
    });

    // Generate URLs for the assets
    this.cssUrl = `https://${this.assetsBucket.bucketName}.s3.${cdk.Aws.REGION}.amazonaws.com/ui/cognito-ui.css`;
    this.logoUrl = `https://${this.assetsBucket.bucketName}.s3.${cdk.Aws.REGION}.amazonaws.com/ui/logo.svg`;

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'UiAssetsBucketName', {
      value: this.assetsBucket.bucketName,
      description: 'S3 bucket for UI assets',
      exportName: `${environment}-ui-assets-bucket-name`,
    });

    new cdk.CfnOutput(this, 'CognitoCssUrl', {
      value: this.cssUrl,
      description: 'URL for Cognito custom CSS',
      exportName: `${environment}-cognito-css-url`,
    });

    new cdk.CfnOutput(this, 'CognitoLogoUrl', {
      value: this.logoUrl,
      description: 'URL for Cognito custom logo',
      exportName: `${environment}-cognito-logo-url`,
    });

    new cdk.CfnOutput(this, 'UiAssetsBucketUrl', {
      value: `https://${this.assetsBucket.bucketName}.s3.${cdk.Aws.REGION}.amazonaws.com`,
      description: 'Base URL for UI assets bucket',
      exportName: `${environment}-ui-assets-bucket-url`,
    });
  }
}
