# 📦 GitHub Container Registry Setup

## Automatic Publishing

Your Docker images are automatically built and published to GitHub Container Registry (ghcr.io) whenever you push to the `main` branch.

---

## ✅ What's Already Configured

1. **GitHub Actions Workflow**: `.github/workflows/docker-build.yml`
   - Builds on every push to `main`
   - Pushes to `ghcr.io/jackstealer/deepsea-edna`
   - Creates tags: `latest`, `main`, SHA-based

2. **Permissions**: Workflow has `packages: write` permission

3. **Authentication**: Uses `GITHUB_TOKEN` (automatically provided)

---

## 🔧 One-Time Setup Required

### Step 1: Make Package Public (Optional but Recommended)

After the first successful build:

1. Go to: https://github.com/jackstealer/DeepSea-eDNA/pkgs/container/deepsea-edna
2. Click "Package settings" (right sidebar)
3. Scroll to "Danger Zone"
4. Click "Change visibility"
5. Select "Public"
6. Confirm

**Why?** Makes `docker pull` work without authentication.

### Step 2: Verify First Build

After pushing this commit:

1. Go to: https://github.com/jackstealer/DeepSea-eDNA/actions
2. Click on "Docker Build and Push to GHCR" workflow
3. Wait for completion (~5-10 minutes)
4. Check for green checkmark ✅

### Step 3: Test the Package

Once build completes:

```bash
# Pull the image (no login needed if public)
docker pull ghcr.io/jackstealer/deepsea-edna:latest

# Run it
docker run -d -p 8000:8000 ghcr.io/jackstealer/deepsea-edna:latest

# Verify
curl http://localhost:8000/health
```

---

## 📋 Package Details

**After successful build, your package will be available at:**

- **Registry**: GitHub Container Registry (ghcr.io)
- **Full Image Name**: `ghcr.io/jackstealer/deepsea-edna`
- **Package URL**: https://github.com/jackstealer/DeepSea-eDNA/pkgs/container/deepsea-edna
- **Pull Command**: `docker pull ghcr.io/jackstealer/deepsea-edna:latest`

---

## 🏷️ Available Tags

After the first build, these tags will be created automatically:

| Tag | Description | Updated When |
|-----|-------------|--------------|
| `latest` | Latest stable release | Every push to `main` |
| `main` | Current main branch | Every push to `main` |
| `main-abc1234` | Specific commit | Every push (SHA-based) |
| `v1.0.0` | Semantic version | When you create a tag like `v1.0.0` |

---

## 🔐 Private vs Public Package

### Public Package (Recommended)

**Pros:**
- ✅ No authentication needed
- ✅ Works everywhere: `docker pull ghcr.io/jackstealer/deepsea-edna:latest`
- ✅ Great for open-source projects
- ✅ Easy for users to try

**Cons:**
- ⚠️ Anyone can pull (but not push)

### Private Package (Default)

**Pros:**
- ✅ Access control
- ✅ Only authorized users can pull

**Cons:**
- ⚠️ Requires authentication to pull
- ⚠️ Need to login: `echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin`

**For this project, PUBLIC is recommended** since it's open-source.

---

## 🚀 How to Use in Production

### Railway

```bash
# Railway will pull automatically from ghcr.io
# Just configure in railway.toml or railway.json
```

### Render

```yaml
# render.yaml
services:
  - type: web
    name: deepsea-edna
    env: docker
    dockerfilePath: ./Dockerfile
    # Or use pre-built image:
    # image:
    #   url: ghcr.io/jackstealer/deepsea-edna:latest
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deepsea-edna
spec:
  template:
    spec:
      containers:
      - name: api
        image: ghcr.io/jackstealer/deepsea-edna:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  api:
    image: ghcr.io/jackstealer/deepsea-edna:latest
    ports:
      - "8000:8000"
```

---

## 🔄 Updating the Package

Simply push to main:

```bash
git add .
git commit -m "Update application"
git push origin main

# GitHub Actions will automatically:
# 1. Build new image
# 2. Push to ghcr.io
# 3. Update 'latest' tag
```

---

## 📊 Monitoring Builds

### GitHub Actions

1. **View workflow runs**: https://github.com/jackstealer/DeepSea-eDNA/actions
2. **Workflow file**: `.github/workflows/docker-build.yml`
3. **Build logs**: Click any workflow run to see logs

### Package Page

1. **View package**: https://github.com/jackstealer/DeepSea-eDNA/pkgs/container/deepsea-edna
2. **See all tags**: Listed on package page
3. **Download stats**: Shown on package page

---

## 🐛 Troubleshooting

### Build Fails

```bash
# Check workflow logs
# Go to: https://github.com/jackstealer/DeepSea-eDNA/actions
# Click the failed run
# Check error messages
```

### Can't Pull Image

```bash
# If package is private, login first:
echo $GITHUB_TOKEN | docker login ghcr.io -u jackstealer --password-stdin

# Then pull:
docker pull ghcr.io/jackstealer/deepsea-edna:latest
```

### Package Not Found

1. Wait for first build to complete
2. Check Actions tab for build status
3. Verify package exists: https://github.com/jackstealer?tab=packages

---

## 📈 Best Practices

### 1. Semantic Versioning

Create version tags for releases:

```bash
# Tag a release
git tag v1.0.0
git push origin v1.0.0

# This creates image: ghcr.io/jackstealer/deepsea-edna:v1.0.0
```

### 2. Use SHA Tags for Debugging

```bash
# Pull specific commit
docker pull ghcr.io/jackstealer/deepsea-edna:main-abc1234
```

### 3. Keep Latest Stable

Only push to `main` when code is tested:

```bash
# Work on feature branch
git checkout -b feature/new-thing
git push origin feature/new-thing

# Merge to main when ready
git checkout main
git merge feature/new-thing
git push origin main  # This triggers Docker build
```

### 4. Document Breaking Changes

When updating image:

```bash
git commit -m "feat: Add new feature

BREAKING CHANGE: Environment variable REDIS_URL is now required"
```

---

## 📝 Notes

- **First build takes ~5-10 minutes**
- **Subsequent builds are faster** (uses cache)
- **No secrets needed** - GITHUB_TOKEN is automatic
- **Package inherits repo visibility** (public/private)
- **250MB free storage** on GitHub (plenty for this project)

---

## ✅ Checklist

After pushing this commit:

- [ ] Wait for GitHub Actions build to complete
- [ ] Go to package page: https://github.com/jackstealer/DeepSea-eDNA/pkgs/container/deepsea-edna
- [ ] Make package public (optional but recommended)
- [ ] Test pulling the image: `docker pull ghcr.io/jackstealer/deepsea-edna:latest`
- [ ] Test running it: `docker run -d -p 8000:8000 ghcr.io/jackstealer/deepsea-edna:latest`
- [ ] Update README badge (already done ✅)
- [ ] Share the pull command with users!

---

**Last Updated:** 2026-11-08
**Status:** Ready to Deploy
**Documentation:** See DOCKER_PACKAGE.md for usage guide
