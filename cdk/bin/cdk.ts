#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {CdkStack} from '../lib/cdk-stack';
import {OndemandContracts} from "@ondemandenv/odmd-contracts";
import {StackProps} from "aws-cdk-lib";

const app = new cdk.App();


async function main() {

    const buildRegion = process.env.CDK_DEFAULT_REGION;
    const buildAccount = process.env.CDK_DEFAULT_ACCOUNT;
    if (!buildRegion || !buildAccount) {
        throw new Error("buildRegion>" + buildRegion + "; buildAccount>" + buildAccount)
    }

    const props = {
        env: {
            account: buildAccount,
            region: buildRegion
        }
    } as StackProps;

    new OndemandContracts(app)


    console.log(`JSON.stringify(process.env)>>>
    ${JSON.stringify(process.env, undefined, 4)}
    JSON.stringify(process.env)<<<`)


    console.log(`JSON.stringify(OndemandContracts.inst.springOpen3Cdk)>>>
    
    ${JSON.stringify(OndemandContracts.inst.springOpen3Cdk, undefined, 2)}
    
    OndemandContracts.inst.springOpen3Cdk)<<<`)

    new CdkStack(app, OndemandContracts.inst.springOpen3Cdk.theOne.getRevStackNames()[0], props)
}


console.log("main begin.")
main().catch(e => {
    console.error(e)
    throw e
}).finally(() => {
    console.log("main end.")
})