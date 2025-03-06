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
import {FederatedPrincipal, PolicyDocument, PolicyStatement, Role} from "aws-cdk-lib/aws-iam";
import {ServiceAccount} from "cdk8s-plus-31/lib/service-account";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {Size} from "cdk8s/lib/size";
import {PersistentVolumeClaim, Volume, VolumeMount} from 'cdk8s-plus-31';
import {KubeStorageClass} from "cdk8s-plus-31/lib/imports/k8s";
import {PersistentVolumeAccessMode} from "cdk8s-plus-31/lib/pvc";

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

        const oidcProvider = myEnver.oidcProvider.getSharedValue(this)

        const namespace = EksManifest.sanitizeKubernetesNamespace(myEnver.owner.buildId + myEnver.targetRevision.toPathPartStr())

        const serviceAccountName = namespace

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

        const bucket = new Bucket(this, 'app-bucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        bucket.grantReadWrite(podSaRole)

        const chart = new cdk8s.Chart(new cdk8s.App(), 'theChart')

        // StorageClass
        new KubeStorageClass(chart, 'StorageClass', {
            metadata: {name: 'ebs-sc'},
            provisioner: 'ebs.csi.aws.com',
            volumeBindingMode: 'WaitForFirstConsumer',
            parameters: {type: 'gp3'},
        });

        // PersistentVolumeClaim
        const pvc = new PersistentVolumeClaim(chart, 'PersistentVolumeClaim', {
            metadata: {name: 'my-pvc'},
            accessModes: [PersistentVolumeAccessMode.READ_WRITE_ONCE],
            storage: cdk8s.Size.gibibytes(1),
            storageClassName: 'ebs-sc',
        });

        new cdk8spl.Deployment(chart, 'to-eks', {
            containers: [
                {
                    name: 'my-app-container',
                    image: image.imageName,
                    ports: [{number: 8080}],
                    envVariables: {
                        bucket_arn: {value: bucket.bucketArn},
                        region: {value: this.region}
                    },
                    resources: {
                        cpu: {limit: {amount: '900m'}, request: {amount: '400m'}},
                        memory: {limit: Size.mebibytes(700)},
                    },
                    volumeMounts: [
                        {path: '/tmp', volume: Volume.fromPersistentVolumeClaim(this, 'vol-pvc', pvc)}
                    ]
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
            k8sNamespace: namespace,
            overWrite: true,
            enver: myEnver,
            skipValidate: false,
            manifest: chart
            //todo: outputs:[ 'spec.template.spec.containers[0].env[0].value', 'spec.template.spec.containers[0].IpAddress ... dns '
        })

        /**
         * this is how fragmented k8s is, it's designed to be manually operated
         * to get the value from the deployed manifest, there has to be some kind of loop to watch it and get it back
         * No time to do that, so just put it here
         * //todo: 1) deployedManifest.getValueByJsonPath('spec.template.spec.containers[0].env[0].value')
         * //todo: 2) add ingress and output the dns
         * with fargate, it's just straight forward
         * fargate.loadBalancer.loadBalancerDnsName
         */

        /* example of using fargate which is way simpler
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
        */


    }
}
