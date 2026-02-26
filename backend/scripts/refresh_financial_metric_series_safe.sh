#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-concurrent}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PYTHON_BIN="${PYTHON_BIN:-${BACKEND_DIR}/venv/bin/python}"
REFRESH_SCRIPT="${BACKEND_DIR}/scripts/refresh_financial_metric_series.py"
LOCK_FILE="${LOCK_FILE:-/tmp/financial_metric_series.lock}"
LOG_FILE="${LOG_FILE:-/tmp/financial_metric_series.log}"

REFRESH_ARGS=()
case "${MODE}" in
  concurrent)
    ;;
  no-concurrent|non-concurrent|exclusive)
    REFRESH_ARGS=(--no-concurrent)
    ;;
  *)
    echo "Usage: $0 [concurrent|no-concurrent]" >&2
    exit 2
    ;;
esac

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Python binary not found: ${PYTHON_BIN}" >&2
  exit 1
fi

if [[ ! -f "${REFRESH_SCRIPT}" ]]; then
  echo "Refresh script not found: ${REFRESH_SCRIPT}" >&2
  exit 1
fi

mkdir -p "$(dirname "${LOG_FILE}")"

{
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] refresh start mode=${MODE}"
  if command -v flock >/dev/null 2>&1; then
    if flock -n "${LOCK_FILE}" "${PYTHON_BIN}" "${REFRESH_SCRIPT}" "${REFRESH_ARGS[@]}"; then
      echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] refresh success mode=${MODE}"
    else
      rc=$?
      if [[ ${rc} -eq 1 ]]; then
        echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] refresh skipped (lock busy: ${LOCK_FILE})"
        exit 0
      fi
      echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] refresh failed rc=${rc}"
      exit "${rc}"
    fi
  else
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] flock not found; running without lock"
    "${PYTHON_BIN}" "${REFRESH_SCRIPT}" "${REFRESH_ARGS[@]}"
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] refresh success mode=${MODE}"
  fi
} >>"${LOG_FILE}" 2>&1

