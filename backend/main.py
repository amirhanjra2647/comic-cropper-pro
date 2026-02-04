from fastapi import FastAPI, UploadFile, File, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import cv2
import numpy as np
import asyncio

app = FastAPI()

# CORS Settings for Frontend Connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- IMAGE PROCESSING LOGIC (Sobel Energy Engine) ---
def process_image_logic(img_bytes):
    nparr = np.frombuffer(img_bytes, np.uint8)
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
            if start_y is None: start_y = y
        else:
            if start_y is not None:
                panel_h = y - start_y
                if panel_h > min_panel_h:
                    rects.append({"left": 0, "top": start_y, "width": w, "height": panel_h})
                start_y = None

    if start_y is not None and (h - start_y) > min_panel_h:
        rects.append({"left": 0, "top": start_y, "width": w, "height": h - start_y})

    # Fallback if no panels detected
    if len(rects) == 0:
        for y in range(0, h, 1200):
            rects.append({"left": 0, "top": y, "width": w, "height": min(1200, h - y)})
            
    return rects

# --- ENDPOINTS ---

@app.post("/detect")
async def detect_panels(file: UploadFile = File(...)):
    contents = await file.read()
    # Run CPU intensive task in a thread pool
    panels = await asyncio.to_thread(process_image_logic, contents)
    return {"panels": panels}

# - Batch processing for PRO users
@app.post("/detect-batch")
async def detect_batch_panels(files: List[UploadFile] = File(...)):
    batch_results = []
    for file in files:
        contents = await file.read()
        panels = await asyncio.to_thread(process_image_logic, contents)
        batch_results.append({
            "filename": file.filename,
            "panels": panels
        })
    return {"results": batch_results}

# NEW: PADDLE WEBHOOK (Automation for Pakistan)
@app.post("/paddle-webhook")
async def paddle_webhook(request: Request):
    try:
        data = await request.json()
        event_type = data.get("event_type")
        
        # Payment Logic
        if event_type in ["transaction.completed", "subscription.activated"]:
            customer_email = data['data']['customer']['email']
            product_id = data['data']['items'][0]['product']['id'] # Check specific $5 product
            
            print(f"AUTOMATION: User {customer_email} bought Product {product_id} and is now PRO!")
            
            # TODO: Add your Database logic here (e.g., Supabase/Firebase)
            # db.users.update(email=customer_email, is_pro=True)
        
        return {"status": "success"}
    except Exception as e:
        print(f"Webhook Error: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid Webhook Data")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)