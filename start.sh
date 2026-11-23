#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT > 0 && PORT < 65536 )) || { echo "Invalid PORT: $PORT" >&2; exit 1; }
build_dir="$PROJECT_DIR/dist"
output_file="/home/runner/work/_temp/omgithub-web/deployment-output.json"
timed() { /usr/bin/time -p "$@"; }

timed npm install --ignore-scripts --no-audit --no-fund --package-lock=false
timed mkdir -p "$build_dir" "$(dirname "$output_file")"
timed cp "$PROJECT_DIR/index.html" "$PROJECT_DIR/styles.css" "$PROJECT_DIR/game.js" "$build_dir/"
timed /usr/bin/printf '{"project":"%s","directory":"%s"}\n' "$PROJECT_DIR" "$build_dir" > "$output_file"

echo "Serving $build_dir on port $PORT"
timed python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$build_dir"
