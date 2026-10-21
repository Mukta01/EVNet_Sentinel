"""
Generate the narration: one WAV per scene in src/scenes.json, spoken by the
macOS Siri voices Aman and Tara (English, India), plus src/durations.json,
which the composition reads to time every scene.

Usage (from video/):
    python3 narrate.py
"""

import json
import os
import re
import subprocess

VOICES = {"Aman": "Aman (English (India))", "Tara": "Tara (English (India))"}
RATE = "175"  # words per minute

os.makedirs("public/voice", exist_ok=True)
scenes = json.load(open("src/scenes.json"))
durations = {}
for s in scenes:
    aiff, wav = f"public/voice/{s['id']}.aiff", f"public/voice/{s['id']}.wav"
    subprocess.run(["say", "-v", VOICES[s["voice"]], "-r", RATE, "-o", aiff, s["text"]], check=True)
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@44100", aiff, wav], check=True)
    subprocess.run(["rm", aiff], check=True)
    info = subprocess.run(["afinfo", wav], capture_output=True, text=True, check=True).stdout
    durations[s["id"]] = round(float(re.search(r"estimated duration: ([\d.]+)", info).group(1)), 2)

json.dump(durations, open("src/durations.json", "w"), indent=1)
print(durations, f"total {sum(durations.values()):.1f}s")
