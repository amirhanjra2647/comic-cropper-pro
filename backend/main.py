from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/detect")
async def detect_panels(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. SOBEL ENERGY SCAN: Find visual activity
    sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    row_activity = np.sum(np.abs(sobel_y), axis=1)
    
    # 2. IDENTIFY ART ZONES: Using the 5% threshold you liked
    is_art = row_activity > (np.mean(row_activity) * 0.05)

    rects = []
    start_y = None
    min_panel_h = 300 # Filter: Bubbles are usually under 200px

    for y in range(h):
        if is_art[y]:
            if start_y is None: start_y = y
        else:
            if start_y is not None:
                panel_h = y - start_y
                if panel_h > min_panel_h:
                    # Capture full width panels
                    rects.append({"left": 0, "top": start_y, "width": w, "height": panel_h})
                start_y = None

    if start_y is not None and (h - start_y) > min_panel_h:
        rects.append({"left": 0, "top": start_y, "width": w, "height": h - start_y})

    # Fallback to 1200px slices if nothing detected
    if len(rects) == 0:
        for y in range(0, h, 1200):
            rects.append({"left": 0, "top": y, "width": w, "height": min(1200, h - y)})

    return {"panels": rects}