# ONDEMANDENV Application Example: Spring Boot with Unified Cloud Stacks

**Demonstrating Application-Centric Infrastructure with AWS CDK + Kubernetes**

This repository showcases how ONDEMANDENV enables **Application-Centric Infrastructure** by unifying AWS resources and Kubernetes workloads into a single, coherent codebase using AWS CDK. It demonstrates the **Unified Cloud Stacks** approach where infrastructure and runtime are managed together as a logical unit.

## The Problem with Traditional Approaches

### Fragmented Tool Chains
Modern cloud applications typically suffer from **tool sprawl**:
- **Infrastructure**: CloudFormation, Terraform, CDK
- **Runtime**: Kubernetes manifests, Helm charts, kustomize  
- **Configuration**: ConfigMaps, Secrets, environment variables
- **Dependencies**: Manual tracking of service relationships

This creates:
- **Configuration drift** between environments
- **Over-permissioned roles** and insecure defaults
- **Manual dependency management** across AWS and Kubernetes
- **Deployment complexity** with multiple tool chains

## ONDEMANDENV Solution: Application-Centric Infrastructure

This example demonstrates how ONDEMANDENV solves these problems through **Unified Cloud Stacks**:

### 🏗️ **Single Codebase for Complete Stack**
```
spring-boot-swagger-3-example/
├── src/                    # Spring Boot application code
│   ├── main/java/         # Business logic
│   └── main/resources/    # Application configuration
├── cdk/                   # Complete infrastructure definition
│   └── lib/cdk-stack.ts  # AWS resources + K8s manifests
├── Dockerfile             # Container definition
└── README.md             # This documentation
```

### 🔗 **Logical Cohesion Over Technical Boundaries**
Instead of separating infrastructure and runtime, this application defines its **complete Bounded Context**:
- **AWS Resources**: S3 buckets, IAM roles, ECR repositories
- **Kubernetes Workloads**: Deployments, ServiceAccounts, PersistentVolumeClaims
- **Security Posture**: IRSA (IAM Roles for Service Accounts) with least privilege
- **Dependencies**: Explicit contracts with platform services (EKS, networking)

## Key ONDEMANDENV Concepts Demonstrated

### 1. **Application-Centric Infrastructure**

```typescript
// Single CDK stack defines EVERYTHING for this bounded context
export class CdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        // AWS Resources
        const bucket = new Bucket(this, 'app-bucket');
        const podRole = new Role(this, 'podSaRole', { /* IRSA setup */ });
        
        // Kubernetes Resources (using cdk8s)
        const chart = new cdk8s.Chart(new cdk8s.App(), 'theChart');
        new cdk8spl.Deployment(chart, 'to-eks', {
            containers: [{ /* app container */ }],
            serviceAccount: new ServiceAccount(chart, 'sa', {
                metadata: { annotations: {'eks.amazonaws.com/role-arn': podRole.roleArn} }
            })
        });
        
        // Platform deploys to shared EKS cluster
        new EksManifest(this, 'eks-manifest', {
            targetEksCluster: sharedEksCluster,
            manifest: chart
        });
    }
}
```

### 2. **Platform Service Consumption**

```typescript
// Consumes shared platform services through contracts
const myEnver = OndemandContractsSandbox.inst.getTargetEnver() as SampleSpringOpenApi3CdkEnver;

// Container image from shared registry
const repository = Repository.fromRepositoryName(this, 'repo', 
    myEnver.appImgRepoRef.getSharedValue(this));

// EKS cluster OIDC provider for IRSA
const oidcProvider = myEnver.oidcProvider.getSharedValue(this);
```

### 3. **Security-First Design with IRSA**

```typescript
// Pod-specific IAM role with least privilege
const podSaRole = new Role(this, 'podSaRole', {
    assumedBy: new FederatedPrincipal(oidcProvider, {
        StringEquals: {
            [`${oidcProvider}:aud`]: 'sts.amazonaws.com',
            [`${oidcProvider}:sub`]: `system:serviceaccount:${namespace}:${serviceAccountName}`,
        }
    }, 'sts:AssumeRoleWithWebIdentity'),
    inlinePolicies: {
        's3Policy': new PolicyDocument({
            statements: [new PolicyStatement({
                actions: ['sts:GetCallerIdentity'],
                resources: ['*'],
            })]
        })
    }
});

// Bucket permissions granted explicitly
bucket.grantReadWrite(podSaRole);
```

### 4. **Unified Resource Management**

```typescript
// Storage Class + PVC defined alongside application
new KubeStorageClass(chart, 'StorageClass', {
    metadata: {name: 'ebs-sc'},
    provisioner: 'ebs.csi.aws.com',
    parameters: {type: 'gp3'},
});

const pvc = new PersistentVolumeClaim(chart, 'PersistentVolumeClaim', {
    storage: cdk8s.Size.gibibytes(1),
    storageClassName: 'ebs-sc',
});

// Used directly in container definition
volumeMounts: [
    {path: '/tmp', volume: Volume.fromPersistentVolumeClaim(this, 'vol-pvc', pvc)}
]
```

## Architecture Benefits

### 🔒 **Security by Default**
- **Least Privilege**: Each pod gets exactly the AWS permissions it needs
- **No Shared Secrets**: IRSA eliminates need for long-lived credentials
- **Network Isolation**: Platform-managed VPC and security groups
- **Audit Trail**: All permissions defined in code and tracked

### 🚀 **Operational Simplicity**
- **Single Deployment**: `cdk deploy` handles AWS resources + K8s manifests
- **Atomic Updates**: Infrastructure and application updated together
- **Consistent Environments**: Same code produces identical environments
- **Rollback Safety**: CloudFormation handles complete stack rollbacks

### 📈 **Developer Productivity**
- **Type Safety**: TypeScript for both infrastructure and configuration
- **IDE Support**: Full IntelliSense for AWS and Kubernetes APIs
- **Local Development**: CDK synth for validation without deployment
- **Familiar Tools**: Standard AWS CDK workflow

## Comparison: Traditional vs ONDEMANDENV

| Aspect | Traditional Approach | ONDEMANDENV Approach |
|--------|---------------------|---------------------|
| **Tools** | Multiple (kubectl, helm, terraform) | Unified (AWS CDK) |
| **Configuration** | Scattered YAML files | Single TypeScript codebase |
| **Security** | Manual IAM/RBAC setup | Contract-driven IRSA |
| **Dependencies** | Implicit, undocumented | Explicit in ContractsLib |
| **Environments** | Shared, static | On-demand, isolated |
| **Deployment** | Multi-step, error-prone | Single command |

## Integration with ONDEMANDENV Platform

### Contract-Driven Dependencies
```typescript
// Explicit dependency declaration in contracts-sandbox
eksClusterConsumer: new Consumer(this, 'EksCluster', sharedEksEnver.outputsProduct),
appImageConsumer: new Consumer(this, 'AppImage', imageBuilderEnver.outputsProduct)
```

### On-Demand Environment Cloning
```bash
# Create complete environment for feature branch
git commit -m "feature: new API endpoint

odmd: create@MyAppDev"

# Platform provisions:
# - S3 bucket (isolated)
# - IAM role (feature-specific)
# - K8s namespace (isolated)
# - Complete application stack
```

### Cross-Account Resource Management
The platform handles complex cross-account operations:
- **EKS Deployment**: Application account → Platform account cluster
- **Networking**: Automatic VPC attachment via Transit Gateway
- **Image Access**: Cross-account ECR repository permissions
- **IAM Federation**: OIDC provider trust relationships

## Quick Start

### Prerequisites
- **ONDEMANDENV Platform**: Deployed with EKS and networking services
- **ContractsLib**: Application contracts defined in contracts-sandbox
- **Container Registry**: Application image available in ECR

### Local Development
```bash
# Build and test application
cd src/
./mvnw spring-boot:run

# Validate CDK stack
cd cdk/
npm install
npx cdk synth
```

### Deployment
```bash
# Deploy complete stack (AWS + K8s)
cd cdk/
export CDK_DEFAULT_REGION="us-west-1"
export CDK_DEFAULT_ACCOUNT="<app-account-id>"
npx cdk deploy
```

### Accessing the Application
```bash
# Find application endpoint
kubectl get pods -n <namespace>
kubectl port-forward pod/<pod-name> 8080:8080

# Access Swagger UI
open http://localhost:8080/bezkoder-api-docs
```

## Advanced Patterns

### Fargate Alternative
For simpler requirements, the code includes a commented Fargate example:
```typescript
// Simpler alternative: Fargate with ALB
const fargate = new ApplicationLoadBalancedFargateService(this, 'theAlbFargate', {
    vpc, cpu: 1024, memoryLimitMiB: 2048,
    taskImageOptions: { image: image, containerPort: 8080 },
    publicLoadBalancer: true
});
```

### Multi-Environment Support
The same CDK code deploys to different environments through Enver configurations:
- **Development**: Lower resource limits, development image tags
- **Staging**: Production-like setup with staging data
- **Production**: High availability, production image tags

### Monitoring Integration
```typescript
// Application-specific monitoring
const monitoring = new Namespace(chart, 'monitoring');
// Add Prometheus, Grafana, custom metrics...
```

## Why Not Just Kubernetes?

This example demonstrates why **Kubernetes alone is insufficient** for modern applications:

### K8s Limitations
- **No AWS Integration**: Manual setup for IAM, S3, RDS, etc.
- **Configuration Complexity**: YAML sprawl across multiple files
- **Security Gaps**: Manual secret management, over-broad permissions
- **Tool Fragmentation**: kubectl, helm, kustomize, operators

### ONDEMANDENV Advantages
- **Complete Stack Management**: AWS + K8s in single tool
- **Type Safety**: Compile-time validation of configurations
- **Security Integration**: Native AWS IAM with K8s workloads
- **Platform Abstraction**: Complex operations handled automatically

## Application Structure

### Spring Boot Application (`src/`)
```java
// Standard Spring Boot application
@RestController
public class TutorialController {
    // Business logic focused on domain
    // Infrastructure concerns handled by CDK
}
```

### Infrastructure Definition (`cdk/`)
```typescript
// Complete application infrastructure
export class CdkStack extends cdk.Stack {
    // AWS resources, K8s manifests, security policies
    // Everything needed for this bounded context
}
```

## Related Documentation

- [EKS Platform Service](../odmd-eks/README.md) - Shared Kubernetes clusters
- [Networking Platform](../networking/README.md) - Shared VPC and connectivity
- [ContractsLib](../contracts-sandbox/README.MD) - Service contracts and dependencies
- [ONDEMANDENV Concepts](../ondemandenv.github.io/concepts.html) - Core platform principles

---

**Application-Centric Excellence**: This example proves that **Application-Centric Infrastructure** isn't just theory - it's a practical approach that simplifies operations, improves security, and accelerates development by treating infrastructure and runtime as a unified, logical unit.