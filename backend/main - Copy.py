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
    # Convert to LAB color space to sharpen without ruining colors
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    cl = clahe.apply(l)
    limg = cv2.merge((cl, a, b))
    enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    return enhanced

@app.post("/detect")
async def detect_panels(
    file: UploadFile = File(...), 
    thresh: int = Form(220), 
    blur: int = Form(99),
    enhance: bool = Form(False) # New Toggle
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if enhance:
        img = enhance_image(img)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    proc = cv2.medianBlur(gray, blur) if blur > 1 else gray
    _, binary = cv2.threshold(proc, thresh, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    rects = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w >= 300 and h >= 300: 
            rects.append({"left": x, "top": y, "width": w, "height": h})
            
    return {"panels": rects}