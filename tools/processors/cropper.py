"""
Image cropping processor - ported from FastAPI backend
"""
import cv2
import numpy as np
from io import BytesIO
from PIL import Image


def process_image(image_bytes):
    """
    Detect panels in comic/manga images using Sobel edge detection
    Returns list of rectangles: [{'left': x, 'top': y, 'width': w, 'height': h}, ...]
    """
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return []

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Sobel Detection for Panel Gutters
    sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    row_activity = np.sum(np.abs(sobel_y), axis=1)
    
    # Sensitivity threshold
    is_art = row_activity > (np.mean(row_activity) * 0.05)

    rects = []
    start_y = None
    min_panel_h = 300 

    for y in range(h):
        if is_art[y]:
            if start_y is None:
                start_y = y
        else:
            if start_y is not None:
                panel_h = y - start_y
                if panel_h > min_panel_h:
                    rects.append({
                        "left": 0,
                        "top": start_y,
                        "width": w,
                        "height": panel_h
                    })
                start_y = None

    if start_y is not None and (h - start_y) > min_panel_h:
        rects.append({
            "left": 0,
            "top": start_y,
            "width": w,
            "height": h - start_y
        })

    # Fallback if no panels detected
    if len(rects) == 0:
        for y in range(0, h, 1200):
            rects.append({
                "left": 0,
                "top": y,
                "width": w,
                "height": min(1200, h - y)
            })
            
    return rects


def crop_image(image_bytes, rect):
    """
    Crop image based on rectangle coordinates
    Returns cropped image bytes
    """
    img = Image.open(BytesIO(image_bytes))
    
    left = rect['left']
    top = rect['top']
    right = left + rect['width']
    bottom = top + rect['height']
    
    cropped = img.crop((left, top, right, bottom))
    
    output = BytesIO()
    cropped.save(output, format='PNG')
    return output.getvalue()
