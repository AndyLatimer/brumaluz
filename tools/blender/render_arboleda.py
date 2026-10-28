"""Regenerate review images from the current .blend without rebuilding assets."""
import sys
import json
from pathlib import Path
import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_arboleda as kit

bpy.ops.wm.open_mainfile(filepath=str(kit.ART/'brumaluz-arboleda.blend'))
kit.h.ASSETS=json.loads((kit.ART/'manifest.json').read_text(encoding='utf-8'))['assets']
kit.render_gallery()
