import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {OdmdCrossRefProducer, OdmdEnverCdk, OdmdShareOut} from "@ondemandenv/contracts-lib-base";
import {ContainerImage, FargatePlatformVersion} from "aws-cdk-lib/aws-ecs";
import {Repository} from "aws-cdk-lib/aws-ecr";
import {OndemandContractsSandbox, SampleSpringOpenApi3CdkEnver} from "@ondemandenv/odmd-contracts-sandbox";

export class CdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        let tmp = OndemandContractsSandbox.inst.getTargetEnver();
        const myEnver = tmp as SampleSpringOpenApi3CdkEnver;


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
            [myEnver.apiEndpoint, 'gaga+' + repository.repositoryUri],
            [myEnver.apiEndpoint.children![0], 'gaga+' + repository.repositoryUri],
        ]))
    }
}
