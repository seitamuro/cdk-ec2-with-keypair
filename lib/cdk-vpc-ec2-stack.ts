import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class CdkVpcEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "SampleBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      bucketName: "ec2-sample-bucket",
    });

    const vpc = new ec2.Vpc(this, "SampleVpc", {
      maxAzs: 1,
      natGateways: 0,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      vpcName: "cdk-sample-vpc",
      subnetConfiguration: [
        {
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const cfnKeyPair = new ec2.CfnKeyPair(this, "SampleKeyPair", {
      keyName: "test-key-pair",
    });
    cfnKeyPair.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    new cdk.CfnOutput(this, "GetSSHKeyCommand", {
      value: `aws ssm get-parameter --name /ec2/keypair/${cfnKeyPair.getAtt(
        "KeyPairId"
      )} --region ${
        this.region
      } --with-decryption --query Parameter.Value --output text`,
    });

    const securityGroup = new ec2.SecurityGroup(this, "SampleSecurityGroup", {
      vpc: vpc,
      securityGroupName: "cdk-vpc-ec2-security-group",
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

    const instanceRole = new iam.Role(this, "SampleRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
      description: "cdk-vpc-ec2-instance-role",
    });

    const createInstance = (
      id: string,
      name: string,
      subnet: ec2.SubnetSelection
    ): ec2.Instance => {
      return new ec2.Instance(this, id, {
        vpc,
        vpcSubnets: subnet,
        instanceType: new ec2.InstanceType(
          this.node.tryGetContext("instanceType")
        ),
        machineImage: ec2.MachineImage.latestAmazonLinux2(),
        securityGroup: securityGroup,
        keyPair: ec2.KeyPair.fromKeyPairName(
          this,
          `EC2${name}KeyPair`,
          "test-key-pair"
        ),
      });
    };

    const instance1 = createInstance(
      "SampleInstance1",
      "cdk-vpc-ec2-instance1",
      vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC })
    );
    new cdk.CfnOutput(this, "Instance1PublicIp", {
      value: instance1.instancePublicIp,
    });
    /*const instance2 = createInstance(
      "SampleInstance2",
      "cdk-vpc-ec2-instance2",
      vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS })
    );*/
  }
}
