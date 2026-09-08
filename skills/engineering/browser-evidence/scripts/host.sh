#!/bin/sh
# Host one evidence file and print its public URL.
#   host.sh <task> <file>      -> https://.../evidence/<task>/<basename>
# The URL is the only credential: anyone who holds it reads the file. Crop to the claim, never a secret.
set -eu
task=${1:?usage: host.sh <task> <file>}
file=${2:?usage: host.sh <task> <file>}
fs put "$file" --bucket evidence --key "$task/$(basename "$file")"
