from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def enhance_image(img):
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    cl = clahe.apply(l)
    limg = cv2.merge((cl, a, b))
    return cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)

@app.post("/detect")
async def detect_panels(
    file: UploadFile = File(...), 
    thresh: int = Form(220), 
    blur: int = Form(99),
    enhance: bool = Form(False),
    invert: bool = Form(False)
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if enhance:
        img = enhance_image(img)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply Blur to smooth out noise in the gutters
    proc = cv2.medianBlur(gray, blur) if blur > 1 else gray

    # AUTOMATIC OTSU THRESHOLDING
    # This ignores the 'thresh' slider and finds the best value itself
    if not invert:
        # Standard: Light background, Dark panels
        _, binary = cv2.threshold(proc, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else:
        # Inverted: Dark background, Light panels
        _, binary = cv2.threshold(proc, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # If Otsu fails (e.g., very low contrast), fallback to manual threshold
    if cv2.countNonZero(binary) == 0:
        _, binary = cv2.threshold(proc, thresh, 255, cv2.THRESH_BINARY if invert else cv2.THRESH_BINARY_INV)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    rects = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        # Filter for panel-sized objects
        if w >= 150 and h >= 150: 
            rects.append({"left": x, "top": y, "width": w, "height": h})
            
    return {"panels": rects}