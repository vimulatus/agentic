#!/bin/sh
# Emit the machine's load state for the fleet: cool, warm or hot.
# One line per crossing, plus every 4th sample while hot or cool.
# For the Monitor tool, persistent: true.
set -u
ncpu=$(sysctl -n hw.ncpu)
state=cool
n=0
while true; do
  l1=$(sysctl -n vm.loadavg | awk '{print $2}')
  free=$(memory_pressure -Q | awk '/free percentage/{print $NF+0}')
  now=$(awk -v l="$l1" -v n="$ncpu" -v f="$free" 'BEGIN{
    print (l/n>1.0 || f<15) ? "hot" : (l/n<0.7 && f>25) ? "cool" : "warm"}')
  if [ "$now" != "$state" ] || { [ "$now" != warm ] && [ $((n % 4)) -eq 0 ]; }; then
    echo "$now: load $l1 on $ncpu cores, memory free ${free}%"
  fi
  state=$now
  n=$((n + 1))
  sleep 30
done
