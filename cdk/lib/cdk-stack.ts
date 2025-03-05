import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {EksManifest} from "@ondemandenv/contracts-lib-base";
import {ContainerImage} from "aws-cdk-lib/aws-ecs";
import {Repository} from "aws-cdk-lib/aws-ecr";
import {
    OndemandContractsSandbox,
    SampleSpringOpenApi3CdkEnver,
} from "@ondemandenv/odmd-contracts-sandbox";
import * as cdk8s from 'cdk8s'
import * as cdk8spl from 'cdk8s-plus-31'
import {CfnJson, Fn} from "aws-cdk-lib";
import {ArnPrincipal, FederatedPrincipal, Policy, PolicyDocument, PolicyStatement, Role} from "aws-cdk-lib/aws-iam";
import {ServiceAccount} from "cdk8s-plus-31/lib/service-account";
import {Bucket} from "aws-cdk-lib/aws-s3";

export class CdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as SampleSpringOpenApi3CdkEnver;

        const repository = Repository.fromRepositoryName(this, 'repo', myEnver.appImgRepoRef.getSharedValue(this));


        /**
         * commit -> img tag
         * multiple commits -> multiple tag for same img( digest )
         * 4b56b42e0de64c696685e24e3df8ecc11c1ebd74,4ca845108b999b924eccd603e133f9ea4984646a,67407d1717745557ab861f40db75d45a0b27a305,c67c5104dc856049ba69d03e2b1dcc32d1b045dd,c82af96f96d5170290787ae84f71ace323cc42a3
         * can use 'latest' or take the 1st here
         */
        const tag0 = Fn.select(0, Fn.split(',', myEnver.appImgLatestRef.getSharedValue(this)));
        const image = ContainerImage.fromEcrRepository(
            repository, tag0 // or 'latest' or todo: from param store
        )

        /*
                const vpc = new Vpc(this, 'vpc', {maxAzs: 2, natGateways: 1});
                const fargate = new ApplicationLoadBalancedFargateService(this, 'theAlbFargate', {
                    vpc,
                    cpu: 1024,
                    memoryLimitMiB: 2048,
                    platformVersion: FargatePlatformVersion.VERSION1_4,
                    taskImageOptions: {
                        image: image,
                        containerPort: 8080,
                    },
                    publicLoadBalancer: true
                })

                // @ts-ignore
                fargate.targetGroup.healthCheck.path = '/bezkoder-api-docs'

        new OdmdShareOut(this, new Map<OdmdCrossRefProducer<OdmdEnverCdk>, string>([
            [myEnver.apiEndpoint, repository.repositoryUri],
            [myEnver.apiEndpoint.children![0], repository.repositoryUri],
        ]))

*/


        /**
         * let Eks node load image from my ecr repo
         * this requires the repo is defined in same account/region
         */
        repository.addToResourcePolicy(new PolicyStatement({
            principals: [new ArnPrincipal(myEnver.defaultNodeGroupRoleArn.getSharedValue(this))],
            actions: [
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'ecr:BatchCheckLayerAvailability',
            ],
        }));

        const oidcProvider = myEnver.oidcProvider.getSharedValue(this)

        const serviceAccountName = myEnver.node.id
        const namespace = myEnver.node.id

        /**
         * the role AWS SDK will assume automatically
         */
        const podSaRole = new Role(this, 'podSaRole', {
            assumedBy: new FederatedPrincipal(
                myEnver.oidcProvider.getSharedValue(this),
                {
                    StringEquals: new CfnJson(this, 'podSaRoleOidcProvider', {
                        value: {
                            [`${oidcProvider}:aud`]: 'sts.amazonaws.com',
                            [`${oidcProvider}:sub`]: `system:serviceaccount:${namespace}:${serviceAccountName}`,
                        },
                    }),
                },
                'sts:AssumeRoleWithWebIdentity'
            ),
            inlinePolicies: {
                's3Policy': new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            actions: ['sts:GetCallerIdentity'],
                            resources: ['*'],
                        })
                    ]
                })
            }
        })

        const bucket = new Bucket(this, 'app-bucket', {autoDeleteObjects: true, removalPolicy: cdk.RemovalPolicy.DESTROY});
        bucket.grantReadWrite(podSaRole)


        const chart = new cdk8s.Chart(new cdk8s.App(), 'theChart')

        new cdk8spl.Deployment(chart, 'to-eks', {
            containers: [
                {
                    name: 'my-app-container',
                    image: image.imageName,
                    ports: [{number: 8080}],
                    envVariables: {
                        bucket_arn: {value: bucket.bucketArn},
                        region: {value: this.region}
                    }
                }
            ],
            serviceAccount: new ServiceAccount(chart, 'sa', {
                metadata: {
                    annotations: {'eks.amazonaws.com/role-arn': podSaRole.roleArn, imgNm: image.imageName},
                    namespace, name: serviceAccountName
                },
            })
        })

        const deployedManifest = new EksManifest(this, 'eks-manifest', {
            targetEksCluster: OndemandContractsSandbox.inst.eksCluster!.envers[0],
            pruneLabels: '',
            overWrite: true,
            enver: myEnver,
            skipValidate: false,
            manifest: chart
        })


        //todo: deployedManifest.getValueByJsonPath('spec.template.spec.containers[0].env[0].value')


    }
}
