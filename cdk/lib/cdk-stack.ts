import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {OdmdCrossRefProducer, OdmdEnverCdk, OdmdShareOut, EksManifest} from "@ondemandenv/contracts-lib-base";
import {ContainerImage} from "aws-cdk-lib/aws-ecs";
import {Repository} from "aws-cdk-lib/aws-ecr";
import {
    OndemandContractsSandbox,
    SampleSpringOpenApi3CdkEnver,
} from "@ondemandenv/odmd-contracts-sandbox";
import * as cdk8s from 'cdk8s'
import * as cdk8spl from 'cdk8s-plus-31'

export class CdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as SampleSpringOpenApi3CdkEnver;

        const repository = Repository.fromRepositoryName(this, 'repo', myEnver.appImgRepoRef.getSharedValue(this));
        const image = ContainerImage.fromEcrRepository(
            repository,
            myEnver.appImgLatestRef.getSharedValue(this),
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
                fargate.targetGroup.healthCheck.path = '/bezkoder-api-docs'*/

        new OdmdShareOut(this, new Map<OdmdCrossRefProducer<OdmdEnverCdk>, string>([
            [myEnver.apiEndpoint, repository.repositoryUri],
            [myEnver.apiEndpoint.children![0], repository.repositoryUri],
        ]))


        const chart = new cdk8s.Chart(new cdk8s.App(), 'theChart')
        new cdk8spl.Deployment(chart, 'to-eks', {
            containers: [
                {
                    name: 'my-app-container',
                    image: `${myEnver.appImgLatestRef.getSharedValue(this)}`,
                    ports: [{number: 8000}]
                }
            ]
        })

        new EksManifest(this, 'eks-manifest', {
            targetEksCluster: OndemandContractsSandbox.inst.eksCluster!.envers[0],
            pruneLabels: 'a=b',
            overWrite: true,
            enver: myEnver,
            skipValidate: false,
            manifest: chart
        })
    }
}
