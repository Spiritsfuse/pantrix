# Cleanup (laptop)

```bash
# Docker Compose stack and its database volume
docker compose down -v

# Troubleshooting lab namespace (if a drill was interrupted)
bash scripts/troubleshooting/run-drill.sh cleanup

# The whole local Kubernetes platform: app, monitoring, Argo CD, Git daemon
kind delete cluster --name pantrix
rm -f ~/.kube/pantrix.kubeconfig

# Locally built images (optional)
docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E 'pantrix-(backend|frontend|git-server)' | xargs -r docker image rm

# Terraform emulator scratch copy and Moto (if used)
rm -rf /c/Codeing/.pantrix-tf-emulator      # or the TF_EMULATOR_DIR you set
```

For AWS resources, follow the *Tear down* and *Verify* sections of
[aws-provision-and-teardown.md](aws-provision-and-teardown.md). Deleting the kind
cluster does not touch anything in AWS.
