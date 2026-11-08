# GitHub Actions Workflows

This directory contains all CI/CD workflows for the DeepSea eDNA AI project.

## 📋 Available Workflows

### 1. CI Tests (`ci-tests.yml`)
**Trigger**: Push to main/develop, Pull Requests  
**Purpose**: Automated testing, linting, and code quality checks

**Jobs:**
- **test-backend**: Run backend API tests with coverage
- **test-mlops**: Test MLOps feature imports and functionality
- **security-scan**: Vulnerability scanning with Trivy and Bandit
- **code-quality**: Code complexity and quality analysis

**Usage:**
```bash
# Runs automatically on push/PR
# Manual trigger:
gh workflow run ci-tests.yml
```

---

### 2. Docker Build (`docker-build.yml`)
**Trigger**: Push to main/develop, Tags, Pull Requests  
**Purpose**: Build and push Docker images to Docker Hub

**Jobs:**
- **build-and-push**: Build multi-platform Docker images
- Vulnerability scanning
- Image testing

**Required Secrets:**
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password/token

**Usage:**
```bash
# Automatic on push to main
# Manual trigger:
gh workflow run docker-build.yml

# Create a release:
git tag v1.0.0
git push origin v1.0.0
```

**Image Tags:**
- `latest`: Latest main branch build
- `main-<sha>`: Main branch with commit SHA
- `develop-<sha>`: Develop branch with commit SHA
- `v1.0.0`: Version tags
- `pr-<number>`: Pull request builds (not pushed)

---

### 3. Model Training (`model-training.yml`)
**Trigger**: Manual (workflow_dispatch)  
**Purpose**: Train deep learning models

**Inputs:**
- `dataset`: Training dataset to use (marine_diverse, custom)
- `epochs`: Number of training epochs (default: 50)
- `learning_rate`: Learning rate (default: 0.001)

**Jobs:**
- **train-model**: Train the deep learning model
- **validate-model**: Validate trained model artifacts

**Usage:**
```bash
# Trigger via GitHub UI or CLI:
gh workflow run model-training.yml \
  -f dataset=marine_diverse \
  -f epochs=50 \
  -f learning_rate=0.001
```

**Artifacts:**
- `trained-model-<run-number>`: Model checkpoint and metrics
- `training-report`: Training summary and results

---

### 4. Deployment (`deploy.yml`)
**Trigger**: Tags (v*), Manual  
**Purpose**: Deploy to staging/production environments

**Inputs:**
- `environment`: staging or production

**Jobs:**
- **deploy**: Deploy application
- **post-deploy-tests**: Integration and smoke tests

**Required Secrets:**
- `AWS_ACCESS_KEY_ID`: AWS credentials (if using AWS)
- `AWS_SECRET_ACCESS_KEY`: AWS secret
- `API_URL`: Production API URL

**Usage:**
```bash
# Deploy to staging:
gh workflow run deploy.yml -f environment=staging

# Deploy to production (or push a tag):
git tag v1.0.0
git push origin v1.0.0
```

---

### 5. Pull Request Checks (`pr-checks.yml`)
**Trigger**: Pull Requests to main/develop  
**Purpose**: Validate PRs before merge

**Jobs:**
- **pr-info**: Extract PR metadata
- **lint-pr**: Code formatting and style checks
- **test-pr**: Run tests on changed code
- **check-dependencies**: Dependency conflict detection
- **size-check**: PR size warnings
- **comment-pr**: Post results as PR comment

**Usage:**
```bash
# Runs automatically on PR creation/update
# No manual trigger needed
```

---

### 6. System Monitoring (`monitoring.yml`)
**Trigger**: Schedule (every 6 hours), Manual  
**Purpose**: Monitor production system health

**Jobs:**
- **health-check**: API health checks
- **performance-check**: Response time monitoring
- **database-check**: Database connectivity
- **create-monitoring-report**: Generate reports

**Required Secrets:**
- `PRODUCTION_API_URL`: Production API endpoint

**Usage:**
```bash
# Runs automatically every 6 hours
# Manual trigger:
gh workflow run monitoring.yml
```

---

### 7. MLOps CI/CD (Legacy) (`mlops-ci-cd.yml`)
**Status**: ⚠️ **DEPRECATED**  
**Purpose**: Original monolithic workflow

**Note:** This workflow has been split into modular workflows above. Use the new workflows instead.

---

## 🔧 Setup Instructions

### 1. Configure Secrets

Go to **Settings → Secrets and variables → Actions** and add:

#### Required Secrets:
```
DOCKER_USERNAME=<your-dockerhub-username>
DOCKER_PASSWORD=<your-dockerhub-token>
```

#### Optional Secrets (for deployment):
```
AWS_ACCESS_KEY_ID=<aws-key>
AWS_SECRET_ACCESS_KEY=<aws-secret>
PRODUCTION_API_URL=https://api.deepsea-edna.com
API_URL=<deployment-url>
```

### 2. Enable Workflows

All workflows are enabled by default. To manually trigger:

```bash
# Install GitHub CLI
# https://cli.github.com/

# List workflows
gh workflow list

# Run a workflow
gh workflow run <workflow-name>

# View workflow runs
gh run list

# View specific run
gh run view <run-id>
```

### 3. Set Up Environments

Create environments in **Settings → Environments**:

- **staging**: For testing deployments
- **production**: For production deployments

Configure protection rules and required reviewers.

---

## 📊 Workflow Status Badges

Add these to your README.md:

```markdown
![CI Tests](https://github.com/jackstealec/DeepSea-eDNA/actions/workflows/ci-tests.yml/badge.svg)
![Docker Build](https://github.com/jackstealec/DeepSea-eDNA/actions/workflows/docker-build.yml/badge.svg)
![Security](https://github.com/jackstealec/DeepSea-eDNA/actions/workflows/ci-tests.yml/badge.svg?label=security)
```

---

## 🔄 Workflow Dependencies

```
Push to main
    ↓
ci-tests.yml (tests & linting)
    ↓
docker-build.yml (build image)
    ↓
deploy.yml (if tagged)
    ↓
monitoring.yml (scheduled)
```

```
Pull Request
    ↓
pr-checks.yml
    ├─ Linting
    ├─ Tests
    ├─ Security
    └─ Comment results
```

---

## 🐛 Troubleshooting

### Docker Build Fails

**Issue**: Authentication error  
**Solution**: Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets

**Issue**: Build timeout  
**Solution**: Check Dockerfile, optimize layers

### Tests Fail

**Issue**: Import errors  
**Solution**: Check `PYTHONPATH` is set correctly

**Issue**: Missing dependencies  
**Solution**: Update `requirements.txt`

### Deployment Fails

**Issue**: Secrets not configured  
**Solution**: Add required secrets in repository settings

**Issue**: Health check fails  
**Solution**: Verify API is running and accessible

---

## 📝 Best Practices

### 1. Testing
- All tests must pass before merge
- Maintain >80% code coverage
- Add tests for new features

### 2. Docker
- Keep images small (<500MB)
- Use layer caching
- Tag releases properly

### 3. Security
- Review Trivy/Bandit reports
- Update dependencies regularly
- Rotate secrets periodically

### 4. Deployments
- Always deploy to staging first
- Run smoke tests after deployment
- Have rollback plan ready

---

## 🔗 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [CI/CD Best Practices](https://www.atlassian.com/continuous-delivery/principles/continuous-integration-vs-delivery-vs-deployment)

---

## 📧 Support

For workflow issues, contact the DevOps team or open an issue in the repository.

---

*Last Updated: November 2026*
