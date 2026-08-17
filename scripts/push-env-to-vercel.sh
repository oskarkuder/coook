#!/usr/bin/env bash
# Copies .env.local into a Vercel project, one variable per call.
#
#   ./scripts/push-env-to-vercel.sh production
#   ./scripts/push-env-to-vercel.sh preview
#
# Run `vercel login` and `vercel link` first. Values are piped in on stdin so
# they never appear in your shell history or in the process list.

set -euo pipefail

TARGET="${1:-production}"
ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "No $ENV_FILE here. Run this from the project root." >&2
  exit 1
fi

# NEXT_PUBLIC_APP_ORIGIN must be the deployed URL, never localhost, or Google
# sign-in and Stripe redirects bounce back to a machine nobody can reach.
if grep -q '^NEXT_PUBLIC_APP_ORIGIN=http://localhost' "$ENV_FILE"; then
  echo "!! NEXT_PUBLIC_APP_ORIGIN is still localhost." >&2
  echo "   Set it to your real Vercel URL before running this." >&2
  exit 1
fi

if grep -q '^NEXT_PUBLIC_DEMO_MODE=1' "$ENV_FILE"; then
  echo "!! NEXT_PUBLIC_DEMO_MODE is 1 — the deploy would save nothing." >&2
  echo "   Set it to 0 before running this." >&2
  exit 1
fi

pushed=0
skipped=0

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in \#*|"") continue ;; esac

  key="${line%%=*}"
  value="${line#*=}"

  if [ -z "$value" ]; then
    echo "   skip   $key (empty)"
    skipped=$((skipped + 1))
    continue
  fi

  # Remove it first so re-running updates rather than erroring on a duplicate.
  vercel env rm "$key" "$TARGET" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$key" "$TARGET" >/dev/null 2>&1

  echo "   pushed $key"
  pushed=$((pushed + 1))
done < "$ENV_FILE"

echo ""
echo "$pushed pushed, $skipped skipped, target: $TARGET"
echo "Redeploy for them to take effect:  vercel --prod"
