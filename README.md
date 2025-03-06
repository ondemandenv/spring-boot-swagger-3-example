## Unified Cloud Stacks: Application-Centric Infrastructure with AWS CDK
### Problem Statement
Modern cloud applications often rely on fragmented tools for infrastructure (e.g., CloudFormation) and runtime orchestration (e.g., Kubernetes). This creates silos, complicates updates, and introduces security risks due to inconsistent permissions. Teams struggle with:

Configuration drift between environments.
Over-permissioned roles and insecure defaults.
Manual dependency management across AWS resources and Kubernetes manifests.
### Solution: Application-Centric Infrastructure
This project demonstrates how to unify infrastructure and runtime management using AWS Cloud Development Kit (CDK) , enabling:

Logical Cohesion : Group AWS resources (e.g., S3 buckets, RDS instances) and Kubernetes deployments into a single application stack based on business logic, not technical boundaries.
Security-First Design : Embed least privilege access control directly into infrastructure code via CDK’s IAM constructs.
Simplified Lifecycle Management : Deploy, update, or rollback entire stacks (AWS + Kubernetes) with a single command.
Key Concepts
1. Vertical Slices & Bounded Contexts
   Resources are organized into application stacks , mirroring Domain-Driven Design’s bounded contexts . For example:
   my-application-stack contains an S3 bucket, DynamoDB table, and a Kubernetes Deployment for the same service.
   This ensures logical cohesion, clear ownership, and consistent security boundaries.
2. Platform vs. Application Stacks
   Platform Stack : Shared infrastructure (e.g., VPCs, CI/CD pipelines) used by multiple applications.
   Application Stack : Business-specific resources (e.g., a microservice’s S3 bucket + K8s Deployment).
   CDK constructs enable seamless dependency management between these layers while promoting reusability and separation of concerns.
3. AWS CDK Integration
   CDK unifies infrastructure and Kubernetes definitions into a single codebase using familiar programming languages (e.g., Python, TypeScript):

## Summary of the Project:

This project demonstrates deploying an application to AWS EKS using AWS CDK. The infrastructure (EKS resources) is
defined in the cdk folder, while the containerized application resides in the src directory. Key features include:

### EKS Deployment :

A Kubernetes Deployment with a container image, environment variables, resource limits, and volume mounting.
IAM Role Integration : Uses an IAM role for permissions via pod annotations.
Storage Configuration : Employs EBS-backed Persistent Volume Claims (PVCs) for persistent storage.
Alternative Approach : Comments hint at a Fargate-based deployment using Application Load Balancer (ALB), suggesting
exploration of simpler setups.

### Key Concerns:

#### EKS Manifest Management :

The EksManifest construct applies Kubernetes manifests directly, which bypasses CDK's resource tracking. This could lead
to drift and make updates harder unless strictly managed.

#### Storage Class Prerequisites :

The PVC requires an existing EBS storage class (ebs-sc) in the cluster. Users must ensure this is configured or create
it beforehand.

#### Security Permissions :

IAM roles are tied directly to pods via annotations. Ensure permissions align with least privilege principles to avoid
excessive access risks.

#### CI/CD Pipeline Needs :

The Docker image for src must be built/pushed to a registry (e.g., ECR) before deployment. This requires an external
CI/CD process not included in the codebase.

#### Networking and Exposure :

The current setup lacks a Kubernetes Service or Ingress, making the application inaccessible externally. A Service
definition would expose it.

#### EKS Cluster Prerequisites :

The EKS cluster itself is assumed to exist via OndemandContractsSandbox, meaning users must have an existing cluster
configured with that framework’s contracts: VPC, subnets, Transite Gateway, NAT etc.
Detailed
explanation: https://www.linkedin.com/pulse/embracing-application-centric-infrastructure-cloud-2-gary-yang-6jzje/

# AWS CDK EKS Deployment Example

This repository demonstrates deploying a containerized application to Amazon EKS using the AWS Cloud Development Kit (
CDK). The infrastructure is defined in the `cdk` folder, while the application code resides in the `src` directory.

## Project Structure

- **`src/`**: Container SpringBoot Application source code.
- **`cdk/`**: CDK stack defining EKS resources and Kubernetes deployments.
- **`cdk.json`**: Configuration for the CDK Toolkit.

---

### Prerequisites

1. AWS Account with permissions to create EKS, IAM roles, and EC2 instances.
2. [AWS CLI](https://aws.amazon.com/cli/) installed and configured.
3. [Node.js](https://nodejs.org/) (v14+ recommended).
4. Existing EKS cluster compatible with `OndemandContractsSandbox` framework (see notes below).
5. Docker installed for building application images.

---

### Setup Steps

#### 1. Prepare the Application Image

Build and push your container image to a registry like Amazon ECR:

```bash
# Build the image (replace `<IMAGE_NAME>` with your repository path)
docker build -t <IMAGE_NAME> src/

# Push to ECR or another registry
docker push <IMAGE_NAME>

```

#### 2. Install CDK Dependencies

Navigate to the cdk directory and install dependencies:

```bash
export CDK_DEFAULT_REGION="your-region"
export CDK_DEFAULT_ACCOUNT="your-account-id"

npx cdk deploy
```

### Key Components

#### cdk-stack.ts :

Creates a Kubernetes Deployment in EKS with the specified container image.
Configures environment variables, resource limits (CPU/Memory), and an EBS PVC for persistent storage.
Attaches an IAM role to pods via annotations.

#### Notes & Limitations

EKS Cluster Setup :
The cluster already exist and be configured with OndemandContractsSandbox.
The cluster is defined in https://github.com/ondemandenv/odmd-eks
Contracts between the cluster and this project are defined by  https://github.com/ondemandenv/odmd-contracts-sandbox

#### Networking :

This stack deploys only a Deployment thru Ondemandenv platform, not a Service or Ingress. Add a Kubernetes Service
resource to expose the app
externally.
Ondemandenv platform is responsible for the networking setup defined  https://github.com/ondemandenv/networking

#### Storage Class :

Ensure an EBS storage class (ebs-sc) is available in your cluster for PVC creation, k8s team is responsible for the
storage class setup.

#### IAM Permissions :

The IAM role assigned to pods has permissions defined by the policy in this stack. Review and refine as needed.
IAM roles defined in eks are referenced thru the Ondemandenv platform as dependencies.
IAM roles for the Springboot app is defined here and assumed by application thru oidc.


https://www.linkedin.com/pulse/embracing-application-centric-infrastructure-cloud-2-gary-yang-6jzje/