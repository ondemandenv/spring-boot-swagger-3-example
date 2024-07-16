import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {
    ContractsCrossRefProducer,
    ContractsShareOut,
    OndemandContracts
} from "@ondemandenv/odmd-contracts";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {Vpc} from "aws-cdk-lib/aws-ec2";
import {ContainerImage} from "aws-cdk-lib/aws-ecs";
import {Repository} from "aws-cdk-lib/aws-ecr";
import {ContractsEnverCdk} from "@ondemandenv/odmd-contracts/lib/odmd-model/contracts-enver-cdk";

export class CdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);


        const myEnver = OndemandContracts.inst.springOpen3Cdk;
        const fargate = new ApplicationLoadBalancedFargateService(this, 'the', {
            vpc: new Vpc(this, 'vpc', {natGateways: 0}),
            taskImageOptions: {
                image: ContainerImage.fromEcrRepository(
                    Repository.fromRepositoryName(this, 'repo', myEnver.appImgRef.getSharedValue(this)),
                )
            },
            publicLoadBalancer: true
        })

        new ContractsShareOut(this, new Map<ContractsCrossRefProducer<ContractsEnverCdk>, string>([
            [myEnver.apiEndpoint, fargate.loadBalancer.loadBalancerDnsName],
        ]))
    }
}
