#!/usr/bin/env bash
# Shared helper: print a shell prompt plus the command, then run it for real.
# Used to produce readable transcripts of genuine command output for docs/evidence.
#   source scripts/lib/term.sh; run kubectl get pods -n pantrix

PROMPT_USER="${PROMPT_USER:-dhruv-sharma}"
PROMPT_HOST="${PROMPT_HOST:-pantrix}"

run() {
  printf '\n\033[1;32m%s@%s\033[0m:\033[1;34m~/pantrix\033[0m$ %s\n' "$PROMPT_USER" "$PROMPT_HOST" "$*"
  eval "$@"
}

note() {
  printf '\n\033[0;33m# %s\033[0m\n' "$*"
}
