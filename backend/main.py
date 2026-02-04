from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import cv2
import numpy as np

app = FastAPI()

# CORS Settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- IMAGE PROCESSING LOGIC ---
def process_image_logic(img_bytes):
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return []

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    row_activity = np.sum(np.abs(sobel_y), axis=1)
    
    is_art = row_activity > (np.mean(row_activity) * 0.05)

    rects = []
    start_y = None
    min_panel_h = 300 

    for y in range(h):
        if is_art[y]:
            if start_y is None: start_y = y
        else:
            if start_y is not None:
                panel_h = y - start_y
                if panel_h > min_panel_h:
                    rects.append({"left": 0, "top": start_y, "width": w, "height": panel_h})
                start_y = None

    if start_y is not None and (h - start_y) > min_panel_h:
        rects.append({"left": 0, "top": start_y, "width": w, "height": h - start_y})

    if len(rects) == 0:
        for y in range(0, h, 1200):
            rects.append({"left": 0, "top": y, "width": w, "height": min(1200, h - y)})
            
    return rects

# --- ENDPOINTS ---

@app.post("/detect")
async def detect_panels(file: UploadFile = File(...)):
    contents = await file.read()
    panels = process_image_logic(contents)
    return {"panels": panels}

@app.post("/detect-batch")
async def detect_batch_panels(files: List[UploadFile] = File(...)):
    batch_results = []
    for file in files:
        contents = await file.read()
        panels = process_image_logic(contents)
        batch_results.append({
            "filename": file.filename,
            "panels": panels
        })
    return {"results": batch_results}

# NEW: PADDLE WEBHOOK (Automation for Pakistan) $$
@app.post("/paddle-webhook")
async def paddle_webhook(request: Request):
    # Paddle jab payment successful hogi toh yahan data bheje ga
    data = await request.json()
    
    # Example: Check if it's a successful payment
    event_type = data.get("event_type")
    if event_type == "transaction.completed" or event_type == "subscription.activated":
        customer_email = data['data']['customer']['email']
        print(f"AUTOMATION: User {customer_email} has paid $5 and is now PRO!")
        # Yahan aap database (Supabase/Firebase) mein is email ko is_pro=true mark kar dein
    
    return {"status": "ok"}