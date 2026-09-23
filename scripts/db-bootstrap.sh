#!/usr/bin/env bash
# Bootstraps a fresh local Supabase database with the full application schema.
#
# The repository does not keep a clean Supabase CLI migration history: the base
# schema lives in supabase/schema.sql, a second phase in supabase/migrations.sql,
# and incremental changes in supabase/migrations/*.sql (some filenames do not
# match the CLI's <timestamp>_name.sql pattern). This script applies them in the
# order documented in README.md against the local stack started by `supabase start`.
set -uo pipefail

DB_CONTAINER="${DB_CONTAINER:-supabase_db_workspace}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql_file() {
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=0 -U postgres -d postgres < "$1" 2>&1
}

# Build the ordered file list documented in README.md:
#   1. base bootstrap snapshot   -> profiles, quotes, material_items, ...
#   2. phase-two consolidated    -> clients, variations, ...
#   3. incremental dated migrations, in filename order
FILES=("$REPO_ROOT/supabase/schema.sql" "$REPO_ROOT/supabase/migrations.sql")
while IFS= read -r f; do FILES+=("$f"); done < <(ls "$REPO_ROOT"/supabase/migrations/*.sql | sort)

# Two passes: several same-date migrations sort in an order that references a
# table before its sibling create migration (e.g. job_line_items before
# jobs_table). A second pass lets those resolve now that the dependency exists.
# Statements are idempotent enough (create ... if not exists / drop ... if
# exists) that re-running is safe; residual errors are pre-existing repo gaps
# (tables like directory_listing / packages are referenced but never created
# in tracked SQL - see README.md's note that schema.sql is not the live schema).
for pass in 1 2; do
  echo "=== bootstrap pass $pass ==="
  for f in "${FILES[@]}"; do
    errs=$(psql_file "$f" | grep -c '^ERROR:')
    echo "  [pass $pass] ${f#"$REPO_ROOT"/}: $errs error(s)"
  done
done

# Recreate untracked-but-required production objects for local dev.
echo "=== applying local-dev supplement ==="
supp_errs=$(psql_file "$REPO_ROOT/scripts/db-local-supplement.sql" | grep -c '^ERROR:')
echo "  db-local-supplement.sql: $supp_errs error(s)"

echo "Database bootstrap complete (best-effort from tracked SQL)."
