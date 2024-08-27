import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {ContractsCrossRefProducer, ContractsShareOut, OndemandContracts} from "@ondemandenv/odmd-contracts";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {Vpc} from "aws-cdk-lib/aws-ec2";
import {ContainerImage, FargatePlatformVersion} from "aws-cdk-lib/aws-ecs";
import {Repository} from "aws-cdk-lib/aws-ecr";
import {ContractsEnverCdk} from "@ondemandenv/odmd-contracts/lib/odmd-model/contracts-enver-cdk";
import {
    SampleSpringOpenApi3CdkEnver
} from "@ondemandenv/odmd-contracts/lib/repos/sample-spring-openapi3/sample-spring-open-api3-cdk";

export class CdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        let tmp = OndemandContracts.inst.getTargetEnver();
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

        new ContractsShareOut(this, new Map<ContractsCrossRefProducer<ContractsEnverCdk>, string>([
            [myEnver.apiEndpoint, 'gaga+' + repository.repositoryUri],
            [myEnver.apiEndpoint.children![0], 'gaga+' + repository.repositoryUri],
        ]))
    }
}
