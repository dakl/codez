#!/usr/bin/env bash
#
# Split a 3x3 grid of icons into individual 1024x1024 PNGs
# with transparent background and Apple-style squircle mask.
#
# Usage: ./scripts/split-icons.sh [input] [output_dir]
#
# Defaults:
#   input:      resources/upscaled.png
#   output_dir: resources/
#
# Requirements: ImageMagick 7+ (brew install imagemagick), Python 3

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

INPUT="${1:-${PROJECT_DIR}/resources/upscaled.png}"
OUTPUT_DIR="${2:-${PROJECT_DIR}/resources}"
TARGET_SIZE=1024
OVERSCAN_SIZE=1180  # ~15% overscan so the mask cuts well inside the icon's dark edge
FUZZ_PERCENT=30
GRID=3

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

if ! command -v magick &>/dev/null; then
  echo "Error: ImageMagick 7+ required. Install with: brew install imagemagick"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "Error: Python 3 required for squircle mask generation."
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: Input file not found: $INPUT"
  exit 1
fi

echo "Input:    $INPUT"
echo "Output:   $OUTPUT_DIR/icon-{01..09}.png"
echo "Size:     ${TARGET_SIZE}x${TARGET_SIZE}"
echo "Shape:    Apple squircle (superellipse n=5)"
echo ""

# Step 1: Generate Apple-style squircle mask using superellipse formula
# |x/a|^n + |y/b|^n = 1, where n=5 matches Apple's continuous corners
MASK="$TMPDIR/mask.png"
python3 -c "
import math

size = ${TARGET_SIZE}
n = 5
a = size / 2
b = size / 2
cx = size / 2
cy = size / 2
num_points = 720

points = []
for i in range(num_points):
    theta = 2 * math.pi * i / num_points
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)
    x = cx + a * abs(cos_t)**(2/n) * (1 if cos_t >= 0 else -1)
    y = cy + b * abs(sin_t)**(2/n) * (1 if sin_t >= 0 else -1)
    points.append(f'{x:.2f},{y:.2f}')

svg = f'''<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\">
  <rect width=\"{size}\" height=\"{size}\" fill=\"black\"/>
  <polygon points=\"{' '.join(points)}\" fill=\"white\"/>
</svg>'''

with open('$TMPDIR/mask.svg', 'w') as f:
    f.write(svg)
"
magick "$TMPDIR/mask.svg" -resize ${TARGET_SIZE}x${TARGET_SIZE} "$MASK"
echo "Squircle mask generated."

# Step 2: Crop grid into tiles
echo "Splitting ${GRID}x${GRID} grid..."
magick "$INPUT" -crop ${GRID}x${GRID}@ +repage "$TMPDIR/tile-%02d.png"

# Step 3: Process each tile
for i in $(seq 0 $(( GRID * GRID - 1 ))); do
  idx=$(printf "%02d" "$i")
  num=$(printf "%02d" $((i + 1)))
  tile="$TMPDIR/tile-${idx}.png"
  output="${OUTPUT_DIR}/icon-${num}.png"

  # Get tile dimensions for corner floodfill coordinates
  w=$(magick identify -format "%w" "$tile")
  h=$(magick identify -format "%h" "$tile")
  maxX=$((w - 1))
  maxY=$((h - 1))

  echo "  icon-${num}: ${w}x${h} -> ${TARGET_SIZE}x${TARGET_SIZE}"

  # Remove pink background via floodfill from all 4 corners
  magick "$tile" \
    -fuzz ${FUZZ_PERCENT}% \
    -fill none \
    -draw "color 0,0 floodfill" \
    -draw "color ${maxX},0 floodfill" \
    -draw "color 0,${maxY} floodfill" \
    -draw "color ${maxX},${maxY} floodfill" \
    "$TMPDIR/nopink-${idx}.png"

  # Trim transparent padding
  magick "$TMPDIR/nopink-${idx}.png" -trim +repage "$TMPDIR/trimmed-${idx}.png"

  tw=$(magick identify -format "%w" "$TMPDIR/trimmed-${idx}.png")
  th=$(magick identify -format "%h" "$TMPDIR/trimmed-${idx}.png")
  size=$((tw > th ? tw : th))

  # Icon-09 (tile 08) has a sparkle artifact that inflates its bounding box.
  # Compensate by using a larger overscan so it ends up the same visual size.
  if [[ "$idx" == "08" ]]; then
    icon_overscan=1228
  else
    icon_overscan=${OVERSCAN_SIZE}
  fi

  # Pad to square, resize with overscan, crop to target, apply squircle mask
  magick "$TMPDIR/trimmed-${idx}.png" \
    -gravity center \
    -background none \
    -extent ${size}x${size} \
    -resize ${icon_overscan}x${icon_overscan} \
    -gravity center \
    -extent ${TARGET_SIZE}x${TARGET_SIZE} \
    "$TMPDIR/resized-${idx}.png"

  # Icon-09: nudge content down+right to compensate for sparkle shifting the trim box
  if [[ "$idx" == "08" ]]; then
    magick "$TMPDIR/resized-${idx}.png" \
      -page +30+24 -background none -flatten \
      "$TMPDIR/resized-${idx}.png"
  fi

  magick "$TMPDIR/resized-${idx}.png" "$MASK" \
    -alpha off -compose CopyOpacity -composite \
    "$output"
done

echo ""
echo "Done! Generated $(( GRID * GRID )) icons in $OUTPUT_DIR/"
ls -lh "${OUTPUT_DIR}"/icon-*.png
