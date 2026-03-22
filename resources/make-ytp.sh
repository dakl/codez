#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# YouTube Poop style video generator for Codez
# Edit the SCENES section below, then run: ./make-ytp.sh
# ============================================================

FONT="/Users/daniel.klevebring/Library/Fonts/GeistMono-VariableFont_wght.ttf"
S=1024
TMPDIR="/tmp/codez-ytp"
OUTPUT="icon-ytp-30s.mp4"
DURATION=30

mkdir -p "$TMPDIR"

# ============================================================
# COPY — All editable text lives here
# ============================================================

# Title card
TITLE_MAIN="CODEZ"
TITLE_SUB="AI CODING AGENTS"

# Agents card
AGENTS_HEADING="POWERED BY"
AGENT_1="Claude Code"
AGENT_2="Gemini CLI"
AGENT_3="Mistral Vibe"

# Feature: worktrees
WORKTREES_LINE1="GIT"
WORKTREES_LINE2="WORKTREES"
WORKTREES_SUB="parallel sessions across branches"

# Feature: multi-agent
MULTI_MAIN="MULTI-AGENT"
MULTI_SUB="run agents in parallel"

# Feature: keyboard
KEYBOARD_LINE1="KEYBOARD"
KEYBOARD_LINE2="FIRST"

# Terminal session lines
TERM_CMD='$ claude -p "fix the bug"'
TERM_THINKING='Thinking...'
TERM_FOUND='Found issue in stream-parser.ts:42'
TERM_DETAIL1='Buffer not flushed on chunk'
TERM_DETAIL2='boundaries -> partial JSON lines.'
TERM_FIX1='Fixed: stream-parser.ts'
TERM_FIX2='Tests passing (199/199)'
TERM_COMMIT='$ git commit -m "fix: flush buffer"'
TERM_RESULT1='> Session completed in 4.2s'
TERM_RESULT2='> Files changed: 1'
TERM_RESULT3='> Lines: +3 -1'

# Session management
SESSION_LINE1="SESSIONS"
SESSION_SUB="create, resume, run side by side"

# Desktop app
DESKTOP_LINE1="NATIVE"
DESKTOP_LINE2="DESKTOP APP"
DESKTOP_SUB="not another web wrapper"

# Tech stack (top to bottom)
STACK_1="Electron 40"
STACK_2="React 19"
STACK_3="TypeScript"
STACK_4="Tailwind CSS 4"
STACK_5="SQLite + WAL"
STACK_6="Zustand 5"

# Error flash
ERROR_TEXT="ERROR"

# macOS card
MACOS_TEXT="macOS only"

# ============================================================
# SCENES — Uses the copy above. Edit layout/colors here.
# ============================================================

echo "Creating scenes..."

# --- Title ---
magick -size ${S}x${S} xc:black \
  -font "$FONT" -pointsize 180 -fill "rgb(0,255,200)" \
  -gravity center -annotate +0-50 "$TITLE_MAIN" \
  -pointsize 40 -fill "rgb(255,50,200)" \
  -annotate +0+80 "$TITLE_SUB" \
  -blur 0x2 \
  \( +clone -blur 0x20 \) -compose Screen -composite \
  "$TMPDIR/scene_title.png"

# --- Powered by (agent names) ---
magick -size ${S}x${S} xc:"rgb(10,0,30)" \
  -font "$FONT" -pointsize 60 -fill "rgb(255,100,0)" \
  -gravity center -annotate +0-120 "$AGENTS_HEADING" \
  -pointsize 80 -fill "rgb(0,200,255)" -annotate +0+0 "$AGENT_1" \
  -pointsize 50 -fill "rgb(200,200,200)" -annotate +0+80 "$AGENT_2" \
  -pointsize 50 -fill "rgb(200,200,200)" -annotate +0+140 "$AGENT_3" \
  -blur 0x1 \
  \( +clone -blur 0x15 \) -compose Screen -composite \
  "$TMPDIR/scene_agents.png"

# --- Git Worktrees ---
magick -size ${S}x${S} xc:"rgb(0,5,20)" \
  -font "$FONT" -pointsize 100 -fill "rgb(0,255,100)" \
  -gravity center -annotate +0-80 "$WORKTREES_LINE1" \
  -pointsize 120 -fill "rgb(0,255,100)" -annotate +0+60 "$WORKTREES_LINE2" \
  -pointsize 30 -fill "rgb(100,255,150)" -annotate +0+160 "$WORKTREES_SUB" \
  \( +clone -blur 0x25 \) -compose Screen -composite \
  "$TMPDIR/scene_worktrees.png"

# --- Multi-agent ---
magick -size ${S}x${S} xc:"rgb(20,0,10)" \
  -font "$FONT" -pointsize 90 -fill "rgb(255,0,150)" \
  -gravity center -annotate +0-40 "$MULTI_MAIN" \
  -pointsize 35 -fill "rgb(255,100,200)" -annotate +0+50 "$MULTI_SUB" \
  \( +clone -blur 0x20 \) -compose Screen -composite \
  "$TMPDIR/scene_multi.png"

# --- Keyboard First ---
magick -size ${S}x${S} xc:"rgb(5,5,15)" \
  -font "$FONT" -pointsize 80 -fill "rgb(255,200,0)" \
  -gravity center -annotate +0-40 "$KEYBOARD_LINE1" \
  -pointsize 100 -fill "rgb(255,220,50)" -annotate +0+70 "$KEYBOARD_LINE2" \
  \( +clone -blur 0x18 \) -compose Screen -composite \
  "$TMPDIR/scene_keyboard.png"

# --- Fake terminal session ---
magick -size ${S}x${S} xc:black \
  -font "$FONT" -pointsize 28 -fill "rgb(0,255,0)" \
  -gravity NorthWest \
  -annotate +30+30  "$TERM_CMD" \
  -fill "rgb(150,150,255)" \
  -annotate +30+80  "$TERM_THINKING" \
  -fill "rgb(200,200,200)" \
  -annotate +30+130 "$TERM_FOUND" \
  -annotate +30+170 "$TERM_DETAIL1" \
  -annotate +30+210 "$TERM_DETAIL2" \
  -fill "rgb(0,255,100)" \
  -annotate +30+280 "$TERM_FIX1" \
  -annotate +30+320 "$TERM_FIX2" \
  -fill "rgb(255,200,0)" \
  -annotate +30+390 "$TERM_COMMIT" \
  -fill "rgb(0,200,255)" \
  -annotate +30+460 "$TERM_RESULT1" \
  -annotate +30+500 "$TERM_RESULT2" \
  -annotate +30+540 "$TERM_RESULT3" \
  "$TMPDIR/scene_terminal.png"

# --- Session management ---
magick -size ${S}x${S} xc:"rgb(15,15,25)" \
  -font "$FONT" -pointsize 100 -fill "rgb(100,150,255)" \
  -gravity center -annotate +0-40 "$SESSION_LINE1" \
  -pointsize 30 -fill "rgb(150,180,255)" \
  -annotate +0+50 "$SESSION_SUB" \
  \( +clone -blur 0x20 \) -compose Screen -composite \
  "$TMPDIR/scene_session.png"

# --- Desktop app ---
magick -size ${S}x${S} xc:"rgb(30,30,50)" \
  -font "$FONT" -pointsize 80 -fill "rgb(255,255,255)" \
  -gravity center -annotate +0-80 "$DESKTOP_LINE1" \
  -pointsize 100 -fill "rgb(255,255,255)" -annotate +0+40 "$DESKTOP_LINE2" \
  -pointsize 30 -fill "rgb(150,150,180)" -annotate +0+120 "$DESKTOP_SUB" \
  \( +clone -blur 0x15 \) -compose Screen -composite \
  "$TMPDIR/scene_desktop.png"

# --- Tech stack ---
magick -size ${S}x${S} xc:"rgb(0,10,20)" \
  -font "$FONT" -pointsize 50 -fill "rgb(100,200,255)" \
  -gravity center \
  -annotate +0-200 "$STACK_1" \
  -fill "rgb(100,220,255)" -annotate +0-120 "$STACK_2" \
  -fill "rgb(150,130,255)" -annotate +0-40  "$STACK_3" \
  -fill "rgb(0,200,150)"   -annotate +0+40  "$STACK_4" \
  -fill "rgb(255,180,50)"  -annotate +0+120 "$STACK_5" \
  -fill "rgb(255,100,150)" -annotate +0+200 "$STACK_6" \
  \( +clone -blur 0x12 \) -compose Screen -composite \
  "$TMPDIR/scene_stack.png"

# --- Error flash ---
magick -size ${S}x${S} xc:"rgb(255,0,0)" \
  -font "$FONT" -pointsize 200 -fill white \
  -gravity center -annotate +0+0 "$ERROR_TEXT" \
  "$TMPDIR/scene_error.png"

# --- macOS only ---
magick -size ${S}x${S} xc:black \
  -font "$FONT" -pointsize 60 -fill "rgb(200,200,200)" \
  -gravity center -annotate +0+0 "$MACOS_TEXT" \
  "$TMPDIR/scene_macos.png"

# ============================================================
# GLITCH VARIANTS — auto-generated from scenes above
# ============================================================

echo "Creating glitch variants..."

for scene in "$TMPDIR"/scene_*.png; do
  base=$(basename "$scene" .png)
  # A: RGB shift + oversaturate
  magick "$scene" -modulate 120,350,100 \
    \( +clone -channel R -separate +channel -roll +12+4 \) \
    \( +clone -channel B -separate +channel -roll -8-3 \) \
    -delete 1 -combine "$TMPDIR/${base}_a.png"
  # B: Negate + swirl
  magick "$scene" -negate -swirl 60 -modulate 100,250,140 "$TMPDIR/${base}_b.png"
  # C: Posterize + wave
  magick "$scene" -posterize 4 -wave 12x100 -gravity center \
    -crop ${S}x${S}+0+0 +repage "$TMPDIR/${base}_c.png"
done

# Glitch the logo icons too
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
for icon in "$SCRIPT_DIR"/icon-0?.png "$SCRIPT_DIR"/icon.png; do
  [ -f "$icon" ] || continue
  base=$(basename "$icon" .png)
  magick "$icon" -modulate 120,400,100 -swirl 30 "$TMPDIR/logo_${base}_g.png"
  magick "$icon" -negate -posterize 6 -modulate 100,300,150 "$TMPDIR/logo_${base}_n.png"
done

# ============================================================
# TIMELINE — Edit durations and sequence order here
# Format: "file duration" per line. Shorter = more chaotic.
# ============================================================

echo "Building timeline..."

T="$TMPDIR"
cat > "$TMPDIR/timeline.txt" << EOF
file '$T/scene_title.png'
duration 0.8
file '$T/scene_error.png'
duration 0.06
file '$T/scene_title_a.png'
duration 0.3
file '$T/logo_icon_g.png'
duration 0.15
file '$T/scene_title_b.png'
duration 0.08
file '$T/scene_title.png'
duration 0.5

file '$T/logo_icon-01_g.png'
duration 0.12
file '$T/logo_icon-02_n.png'
duration 0.08
file '$T/logo_icon-03_g.png'
duration 0.10
file '$T/scene_error.png'
duration 0.04
file '$T/logo_icon-04_n.png'
duration 0.06
file '$T/logo_icon-05_g.png'
duration 0.12
file '$T/logo_icon_g.png'
duration 0.3

file '$T/scene_agents.png'
duration 0.7
file '$T/scene_agents_a.png'
duration 0.12
file '$T/scene_agents_c.png'
duration 0.06
file '$T/scene_agents.png'
duration 0.5
file '$T/scene_agents_b.png'
duration 0.08
file '$T/logo_icon-06_n.png'
duration 0.04

file '$T/scene_terminal.png'
duration 1.2
file '$T/scene_terminal_a.png'
duration 0.15
file '$T/scene_terminal.png'
duration 0.8
file '$T/scene_error.png'
duration 0.05
file '$T/scene_terminal_c.png'
duration 0.1
file '$T/scene_terminal.png'
duration 0.4

file '$T/scene_worktrees.png'
duration 0.6
file '$T/scene_worktrees_a.png'
duration 0.1
file '$T/logo_icon-07_g.png'
duration 0.08
file '$T/scene_worktrees.png'
duration 0.5
file '$T/scene_worktrees_b.png'
duration 0.06
file '$T/scene_worktrees_c.png'
duration 0.04

file '$T/scene_session.png'
duration 0.9
file '$T/scene_session_a.png'
duration 0.12
file '$T/scene_session.png'
duration 0.6
file '$T/scene_session_b.png'
duration 0.08
file '$T/scene_error.png'
duration 0.03
file '$T/scene_session_c.png'
duration 0.06

file '$T/scene_multi.png'
duration 0.7
file '$T/scene_multi_a.png'
duration 0.1
file '$T/scene_multi_b.png'
duration 0.06
file '$T/scene_multi.png'
duration 0.4
file '$T/logo_icon-08_n.png'
duration 0.08

file '$T/scene_keyboard.png'
duration 0.6
file '$T/scene_keyboard_a.png'
duration 0.08
file '$T/scene_keyboard_c.png'
duration 0.05
file '$T/scene_keyboard.png'
duration 0.5

file '$T/scene_desktop.png'
duration 0.8
file '$T/scene_desktop_a.png'
duration 0.1
file '$T/scene_desktop.png'
duration 0.5
file '$T/scene_desktop_b.png'
duration 0.06
file '$T/scene_error.png'
duration 0.04

file '$T/scene_stack.png'
duration 0.8
file '$T/scene_stack_a.png'
duration 0.12
file '$T/scene_stack_b.png'
duration 0.06
file '$T/scene_stack.png'
duration 0.5
file '$T/scene_stack_c.png'
duration 0.08

file '$T/scene_macos.png'
duration 0.6
file '$T/scene_macos_a.png'
duration 0.08
file '$T/scene_macos.png'
duration 0.4

file '$T/logo_icon-01_g.png'
duration 0.06
file '$T/logo_icon-02_n.png'
duration 0.05
file '$T/logo_icon-03_g.png'
duration 0.04
file '$T/logo_icon-04_n.png'
duration 0.04
file '$T/logo_icon-05_g.png'
duration 0.03
file '$T/logo_icon-06_n.png'
duration 0.03
file '$T/logo_icon-07_g.png'
duration 0.03
file '$T/logo_icon-08_n.png'
duration 0.03
file '$T/logo_icon-09_g.png'
duration 0.03
file '$T/logo_icon_g.png'
duration 0.06
file '$T/scene_error.png'
duration 0.03

file '$T/scene_terminal_a.png'
duration 0.08
file '$T/scene_agents_b.png'
duration 0.06
file '$T/scene_session_c.png'
duration 0.05
file '$T/scene_worktrees_a.png'
duration 0.04
file '$T/scene_multi_b.png'
duration 0.04
file '$T/scene_keyboard_c.png'
duration 0.03
file '$T/scene_stack_a.png'
duration 0.03

file '$T/scene_title.png'
duration 1.0
file '$T/scene_title_a.png'
duration 0.15
file '$T/scene_error.png'
duration 0.04
file '$T/scene_title.png'
duration 1.5

file '$T/logo_icon_g.png'
duration 0.8
file '$T/logo_icon_n.png'
duration 0.1
file '$T/logo_icon_g.png'
duration 1.0
file '$T/logo_icon_g.png'
duration 0.01
EOF

# ============================================================
# RENDER — Adjust filters and duration here
# ============================================================

echo "Rendering video..."

ffmpeg -y -f concat -safe 0 -i "$TMPDIR/timeline.txt" \
  -vf "scale=${S}:${S},hue=s=2.5:H=0.3*PI*sin(2*PI*t/3),eq=brightness=0.06*sin(2*PI*t/1.2):saturation=1.8+0.8*sin(2*PI*t/2),rgbashift=rh=-3:bh=3:gv=-2,noise=alls=20:allf=t,unsharp=5:5:1.0" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 \
  -r 30 -t "$DURATION" \
  "$SCRIPT_DIR/$OUTPUT" 2>&1 | tail -3

echo ""
echo "Done! Output: $SCRIPT_DIR/$OUTPUT"
ls -lh "$SCRIPT_DIR/$OUTPUT"
