#!/usr/bin/env bash
set -euo pipefail

STATUS="STATUS.md"
[ -f "$STATUS" ] || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")

# Update timestamp
sed -i.bak "s|^> Last updated:.*|> Last updated: ${TIMESTAMP}|" "$STATUS"
rm -f "${STATUS}.bak"

# Build commits table (last 10 commits)
TMPDIR="${TMPDIR:-/tmp}"
COMMITS_TMP="${TMPDIR}/_ae_commits.tmp"
FILES_TMP="${TMPDIR}/_ae_files.tmp"

{
  echo "**Branch:** \`${BRANCH}\`  "
  echo "**Last commit:** ${TIMESTAMP}"
  echo ""
  echo "| Hash | Date | Message |"
  echo "|------|------|---------|"
  git log --format="| \`%h\` | %ad | %s |" --date=short -10 2>/dev/null || echo "| - | - | No commits yet |"
} > "$COMMITS_TMP"

# Build recent file changes
COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")
{
  echo "**Files changed (last 5 commits):**"
  echo ""
  echo '```'
  if [ "$COMMIT_COUNT" -ge 5 ] 2>/dev/null; then
    git diff --stat HEAD~5..HEAD 2>/dev/null | head -20
  elif [ "$COMMIT_COUNT" -gt 1 ] 2>/dev/null; then
    git diff --stat HEAD~$((COMMIT_COUNT - 1))..HEAD 2>/dev/null | head -20
  else
    echo "Not enough commits yet."
  fi
  echo '```'
} > "$FILES_TMP"

# Replace AUTO:START..AUTO:END and AUTO:FILES:START..AUTO:FILES:END
awk '
/<!-- AUTO:START -->/ { print; while((getline line < "'"$COMMITS_TMP"'") > 0) print line; skip=1; next }
/<!-- AUTO:END -->/ { skip=0 }
/<!-- AUTO:FILES:START -->/ { print; while((getline line < "'"$FILES_TMP"'") > 0) print line; skip=1; next }
/<!-- AUTO:FILES:END -->/ { skip=0 }
skip { next }
{ print }
' "$STATUS" > "${STATUS}.tmp" && mv "${STATUS}.tmp" "$STATUS"

rm -f "$COMMITS_TMP" "$FILES_TMP"
