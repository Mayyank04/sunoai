#!/bin/zsh
# Native macOS launcher. Keeps the separate model worker visible in this Terminal.
set -eu
fombo_script_dir="${0:A:h}"
fombo_project_dir="${fombo_script_dir:h:h}"
cd -- "$fombo_project_dir"
mkdir -p "$fombo_project_dir/.runtime/logs"
exec > >(tee -a "$fombo_project_dir/.runtime/logs/native-worker.log") 2>&1
fombo_python="$fombo_project_dir/.runtime/ace-step-venv/bin/python"
if [[ ! -x "$fombo_python" ]]; then
  print -r -- 'The native inference environment has not been installed.'
  exit 1
fi
exec "$fombo_python" -u -m workers.ace_step.launch_native
