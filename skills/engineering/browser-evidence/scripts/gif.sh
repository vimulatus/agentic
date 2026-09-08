#!/bin/sh
# Turn a recording into a GIF that GitHub renders inline from any host.
#   gif.sh <in.webm|in.mp4> [--width <px>]   -> writes <in>.gif beside the input, prints its path
# 10 fps, palette from the take itself, 960 px wide by default.
# Exits 1 above 5 MB: GitHub fetches an external image through its camo proxy, and the
# camo README's default length limit is 5 MB (https://github.com/atmos/camo#configuration).
set -eu
in=${1:?usage: gif.sh <in.webm|in.mp4> [--width <px>]}
shift
width=960
while [ $# -gt 0 ]; do
  case $1 in
    --width) width=${2:?--width needs a value}; shift 2 ;;
    *) echo "gif.sh: unknown argument $1" >&2; exit 2 ;;
  esac
done
out=${in%.*}.gif
ffmpeg -v error -y -i "$in" \
  -vf "fps=10,scale=$width:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
  "$out"
size=$(wc -c < "$out" | tr -d ' ')
if [ "$size" -gt 5242880 ]; then
  echo "gif.sh: $out is $((size / 1048576)) MB, over the 5 MB GitHub proxies for an external image. Cut the take or pass a smaller --width." >&2
  exit 1
fi
echo "$out"
