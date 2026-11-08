# GitHub Actions Setup Guide

Complete guide to setting up and using GitHub Actions for DeepSea eDNA AI.

## 🚀 Quick Start

### 1. One-Time Setup (5 minutes)

#### Configure Docker Hub Secrets

1. Go to your repository on GitHub
2. Click **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Add the following secrets:

```
Name: DOCKER_USERNAME
Value: <your-dockerhub-username>

Name: DOCKER_PASSWORD
Value: <your-dockerhub-access-token>
```

**Get Docker Hub Access Token:**
1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name it "GitHub Actions"
4. Copy the token (you won't see it again!)

#### That's It! 🎉

All workflows are now ready to use. They'll run automatically on:
- ✅ Push to main/develop branches
- ✅ Pull request creation
- ✅ Tag creation (v1.0.0, etc.)

---

## 📚 Workflows Overview

### Automatic Workflows (No Action Needed)

| Workflow | When | What It Does |
|----------|------|--------------|
| **CI Tests** | Push/PR | Runs all tests and linting |
| **Docker Build** | Push to main | Builds and pushes Docker image |
| **PR Checks** | Open PR | Validates code quality |
| **Monitoring** | Every 6 hours | Checks system health |

### Manual Workflows (You Control)

| Workflow | Use Case | How to Trigger |
|----------|----------|----------------|
| **Model Training** | Train new models | GitHub UI or CLI |
| **Deploy** | Deploy to production | Push tag or manual |

---

## 🎯 Common Tasks

### Task 1: Make a Code Change

```bash
# Create a branch
git checkout -b feature/my-feature

# Make changes
# ... edit files ...

# Commit and push
git add .
git commit -m "Add my feature"
git push origin feature/my-feature

# Create PR on GitHub
# → CI Tests will run automatically
# → Docker build will test (but not push)
# → PR checks will validate code
```

**What Happens:**
1. ✅ Tests run
2. ✅ Linting checks code style
3. ✅ Security scan runs
4. ✅ Bot comments on PR with results

### Task 2: Deploy to Production

```bash
# Method 1: Create a release tag
git tag v1.0.0
git push origin v1.0.0

# Method 2: Manual deployment
gh workflow run deploy.yml -f environment=production
```

**What Happens:**
1. ✅ Builds Docker image
2. ✅ Tags as v1.0.0
3. ✅ Pushes to Docker Hub
4. ✅ Runs deployment
5. ✅ Performs health checks

### Task 3: Train a New Model

```bash
# Using GitHub CLI
gh workflow run model-training.yml \
  -f dataset=marine_diverse \
  -f epochs=50 \
  -f learning_rate=0.001

# Or go to:
# Actions → Model Training Pipeline → Run workflow
```

**What Happens:**
1. ✅ Downloads training data
2. ✅ Trains model for 50 epochs
3. ✅ Saves best model
4. ✅ Uploads artifacts (model, plots, metrics)
5. ✅ Validates model works

---

## 🔍 Monitoring Workflows

### View Workflow Runs

**Option 1: GitHub Web UI**
1. Go to your repository
2. Click **Actions** tab
3. See all workflow runs

**Option 2: GitHub CLI**
```bash
# List recent runs
gh run list

# View specific run
gh run view <run-id>

# Watch a running workflow
gh run watch
```

### Check Workflow Status

```bash
# See status of all workflows
gh workflow list

# View specific workflow
gh workflow view ci-tests.yml
```

---

## 🛠️ Advanced Configuration

### Optional: Production Monitoring

To enable production health checks, add:

```
Name: PRODUCTION_API_URL
Value: https://api.deepsea-edna.com
```

The monitoring workflow will then check your live API every 6 hours.

### Optional: Deployment Credentials

For automated deployment, add:

```bash
# For AWS
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>

# For other platforms
API_URL=<deployment-url>
```

### Optional: Slack Notifications

To get Slack notifications on deployment:

1. Create Slack webhook
2. Add secret:
```
Name: SLACK_WEBHOOK_URL
Value: https://hooks.slack.com/...
```

3. Modify deploy.yml to send notifications

---

## 📊 Understanding Results

### Test Results

After tests run, you'll see:

```
✅ test-backend: All tests passed (15/15)
✅ test-mlops: MLOps imports successful
✅ security-scan: No vulnerabilities found
✅ code-quality: Complexity within limits
```

### Docker Build Results

After build completes:

```
✅ Image: jackstealec/deepsea-edna-api:main-abc1234
✅ Size: 1.2GB
✅ Pushed to Docker Hub
✅ Security scan: Clean
```

### Deployment Results

After deployment:

```
✅ Deployed version: v1.0.0
✅ Environment: production
✅ Health check: Passed
✅ Smoke tests: Passed
```

---

## 🐛 Troubleshooting

### "Docker authentication failed"

**Problem:** Docker secrets not configured  
**Solution:**
```bash
# Verify secrets exist
gh secret list

# If missing, add them:
gh secret set DOCKER_USERNAME
gh secret set DOCKER_PASSWORD
```

### "Tests failing in CI but pass locally"

**Problem:** Environment differences  
**Solution:**
```bash
# Check Python version matches
python --version  # Should be 3.11

# Install exact dependencies
pip install -r backend/requirements.txt

# Run tests with same environment
PYTHONPATH=$(pwd) pytest backend/tests/
```

### "Workflow not triggering"

**Problem:** Branch protection or workflow permissions  
**Solution:**
1. Check **Settings → Actions → General**
2. Ensure "Allow all actions" is selected
3. Check branch protection rules

### "Permission denied"

**Problem:** Workflow permissions  
**Solution:**
1. **Settings → Actions → General**
2. Under "Workflow permissions"
3. Select "Read and write permissions"

---

## 🎓 Learning Resources

### GitHub Actions Basics
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)

### Our Workflows
- See `.github/workflows/README.md` for detailed workflow documentation
- Each workflow file has inline comments explaining each step

### Best Practices
- Keep workflows fast (<10 minutes)
- Use caching for dependencies
- Run expensive operations (training) manually
- Always test in staging before production

---

## ✅ Checklist: Before First Use

- [ ] Added `DOCKER_USERNAME` secret
- [ ] Added `DOCKER_PASSWORD` secret
- [ ] Verified workflows are enabled (Actions tab)
- [ ] Made a test commit to trigger CI
- [ ] Reviewed workflow results
- [ ] (Optional) Added production monitoring URL
- [ ] (Optional) Configured deployment secrets

---

## 📞 Need Help?

1. **Check workflow logs**: Actions tab → Click on failed run
2. **Review this guide**: Most issues covered above
3. **GitHub Actions docs**: https://docs.github.com/actions
4. **Open an issue**: If you find a problem with workflows

---

## 🎉 You're All Set!

Your CI/CD pipeline is now configured. Every push will automatically:
- ✅ Run tests
- ✅ Check code quality
- ✅ Build Docker images
- ✅ Scan for security issues

Deploy with confidence! 🚀

---

*Last Updated: November 2026*  
*Questions? Check the Actions tab for workflow run details.*
