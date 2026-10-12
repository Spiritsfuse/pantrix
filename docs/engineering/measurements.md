# Measurements

Only numbers that were actually measured are listed, each with how it was
measured. All were taken on the single build computer (Windows 11, Docker
Desktop with an 8 GB VM, single-node kind cluster) on 12–13 October 2026.
They describe this laptop setup, not production capacity.

| Measure | Value | Method / source |
|---------|-------|-----------------|
| Backend image size | 311 MB | `docker image ls` on `pantrix-backend:local` (`docs/evidence/docker-nonroot-users.png`) |
| Frontend image size | 114 MB | same command, `pantrix-frontend:local` |
| SBOM size | 119 (backend) / 71 (frontend) components | `trivy image --format cyclonedx`, counted components (`docs/evidence/sbom-generation.png`) |
| Backend test suite | 31 passed in 0.45 s | `pytest -v` wall time reported by pytest (`pytest-results.png`) |
| Backend line coverage | 96% (448 statements, 19 missed) | `pytest --cov=app` |
| Frontend tests | 10 passed | `vitest run` |
| First `docker compose build` | 35.4 s wall clock | `time docker compose build` (`docs/evidence/transcripts/.compose-build.raw`); base images may already have been in the local Docker cache |
| Frontend production bundle | 255.5 kB JS (80.0 kB gzip), 16.6 kB CSS | `vite build` output during development |
| HPA scale-out | 2 → 6 backend replicas; CPU reached 397% of the 60% target | 12 parallel `generate-traffic.sh` loops for 150 s against the Ingress, `kubectl get hpa` every 18 s (`docs/evidence/hpa-scaling.png`); event `SuccessfulRescale New size: 6` |
| Prometheus targets during scale-out | 6/6 backend targets UP | Prometheus Targets page (`prometheus-targets.png`) |
| Availability during a failed release | 3 of 3 requests returned 200 | Troubleshooting drill 5: `helm upgrade` with a non-existent tag, then 3 sequential `curl`s 1 s apart (`troubleshooting-05-rollback.png`). A small sample, not a load test |
| Terraform resource graph | 62 resources planned; 54 created and 54 destroyed in the emulator | `terraform plan/apply/destroy` against Moto 5.2.4, **not AWS** (ADR 0014) |

## Not measured

The following were not measured and are therefore not claimed:
- request throughput limits;
- p95 latency under a defined load (the dashboard shows latency for the
  generated traffic only);
- recovery time;
- real EKS provisioning time;
- CI pipeline duration.
