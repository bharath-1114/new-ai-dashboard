# main.py
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Body, Request
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


import pandas as pd
import io, os, csv, traceback, json
import re
from urllib.parse import unquote

from pydantic import BaseModel
from dotenv import load_dotenv
# from openai import OpenAI

from cleaning import clean_dataset


# ==================================================
# APP SETUP
# ==================================================
app = FastAPI(title="CSV → JSON uploader (simple)")

# CORS (DEV ONLY)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# PATHS
# ==================================================
PROJECT_DIR = Path(__file__).parent.resolve()
STATIC_DIR = Path("static")
OUTPUT_DIR = PROJECT_DIR / "uploads"

OUTPUT_DIR.mkdir(exist_ok=True)

LAST_JSON_PATH = OUTPUT_DIR / "last_upload.json"
LAST_DF_PATH = OUTPUT_DIR / "last_upload.pkl"
INDEX_PATH = PROJECT_DIR / "index.html"
DASHBOARD_PATH = PROJECT_DIR / "dashboard.html"
AUTH_PATH = PROJECT_DIR / "auth.html"



# ==================================================
# STATIC FILES
# ==================================================
# 1️⃣ Define base directory
BASE_DIR = Path(__file__).resolve().parent

# 2️⃣ Define static directory
STATIC_DIR = BASE_DIR / "static"

# 3️⃣ Create static directory if not exists
STATIC_DIR.mkdir(exist_ok=True)

# 4️⃣ Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ==================================================
# ROOT PAGE
# ==================================================
@app.get("/", response_class=HTMLResponse)
async def home():
    if INDEX_PATH.exists():
        return FileResponse(INDEX_PATH, media_type="text/html")
    return HTMLResponse("<h3>index.html not found</h3>", status_code=404)



@app.get("/index.html", response_class=HTMLResponse)
async def index_page():
    if INDEX_PATH.exists():
        return FileResponse(INDEX_PATH, media_type="text/html")
    return HTMLResponse("<h3>index.html not found</h3>", status_code=404)


@app.get("/dashboard.html", response_class=HTMLResponse)
async def dashboard():
    if DASHBOARD_PATH.exists():
        return FileResponse(DASHBOARD_PATH, media_type="text/html")
    return HTMLResponse("<h3>dashboard.html not found</h3>", status_code=404)

@app.get("/auth.html", response_class=HTMLResponse)
async def auth_page():
    if AUTH_PATH.exists():
        return FileResponse(AUTH_PATH, media_type="text/html")
    return HTMLResponse("<h3>auth.html not found</h3>", status_code=404)




UPLOAD_LIMIT_FILE = OUTPUT_DIR / "upload_limits.json"

def load_upload_limits():
    if UPLOAD_LIMIT_FILE.exists():
        with open(UPLOAD_LIMIT_FILE, "r") as f:
            return json.load(f)
    return {}

def save_upload_limits(data):
    with open(UPLOAD_LIMIT_FILE, "w") as f:
        json.dump(data, f)

# ==================================================
# CSV UPLOAD ENDPOINT
# ==================================================
@app.post("/upload")
async def upload_csv(
    request: Request,
    file: UploadFile = File(...)
):
    user_email = request.headers.get("X-User-Email")
    user_provider = request.headers.get("X-User-Provider", "guest")

    is_guest = user_provider == "guest"
    user_key = user_email or "guest"

    upload_limits = load_upload_limits()
    current_count = upload_limits.get(user_key, 0)

    if is_guest and current_count >= 1:
        raise HTTPException(
            status_code=403,
            detail="Guest upload limit reached. Please upgrade."
        )

    filename = file.filename or "upload.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")

    contents = await file.read()

    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8", errors="ignore")))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid CSV file")

    # clean + process
    df = clean_dataset(df)

    # save dataset
    df.to_json(LAST_JSON_PATH, orient="records")
    df.to_pickle(LAST_DF_PATH)

    # ✅ increment AFTER success
    upload_limits[user_key] = current_count + 1
    save_upload_limits(upload_limits)

    return {
        "filename": filename,
        "rows": len(df),
        "data": df.fillna("").astype(str).to_dict(orient="records")
    }

@app.get("/last-upload")
def last_upload():
    if not LAST_JSON_PATH.exists():
        raise HTTPException(status_code=404, detail="No previous upload found")

    try:
        with open(LAST_JSON_PATH, "r") as f:
            data = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to load dataset")

    return {
        "filename": "last_upload.csv",
        "rows": len(data),
        "data": data
    }


# ==================================================
# DOWNLOAD LAST JSON
# ==================================================
@app.get("/download-json")
async def download_json():
    if not LAST_JSON_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No JSON file found. Upload a CSV first."
        )
    return FileResponse(
        LAST_JSON_PATH,
        filename="converted.json",
        media_type="application/json"
    )


# ==================================================
# GET COLUMN NAMES
# ==================================================
@app.get("/columns")
async def get_columns():
    if not LAST_DF_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No uploaded dataframe found."
        )
    try:
        df = pd.read_pickle(LAST_DF_PATH)
        return {"columns": [str(c) for c in df.columns]}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read dataframe: {e}"
        )


# ==================================================
# CSS VERSION (CACHE BUSTING)
# ==================================================
# -------------------------------
# Mount static files
# -------------------------------

# -------------------------------
# CSS version endpoint
# -------------------------------
@app.get("/api/css-version")
async def css_version(path: str = Query(...)):
    # Normalize path
    path = path.strip().lstrip("/")

    # Security: block traversal
    if ".." in path:
        raise HTTPException(status_code=400, detail="Invalid path")

    file_path = (STATIC_DIR / path).resolve()

    # Ensure path stays inside /static
    if not str(file_path).startswith(str(STATIC_DIR.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    version = str(int(file_path.stat().st_mtime))

    return JSONResponse(
        {"version": version},
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

# -------------------------------
# Test route (optional)
# -------------------------------
@app.get("/")
def root():
    return {"status": "ok"}
# ==================================================
# AI CHAT ENDPOINT
# ==================================================
# class ChatRequest(BaseModel):
#     message: str
#     knowledge: dict


# load_dotenv()
# client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# @app.post("/chat-ai")
# async def chat_ai(payload: ChatRequest):
#     question = payload.message
#     knowledge = payload.knowledge

#     if not question:
#         return {"reply": "Empty question."}

#     system_prompt = f"""
# You are a data analytics assistant.

# Dataset summary:
# Rows: {knowledge.get("rows")}
# Columns: {knowledge.get("columns")}
# Numeric columns: {knowledge.get("numericCols")}
# Categorical columns: {knowledge.get("categoricalCols")}
# Average attendance: {knowledge.get("avgAttendance")}
# Average score: {knowledge.get("avgScore")}
# Low attendance count: {knowledge.get("lowAttendanceCount")}
# """

#     try:
#         response = client.chat.completions.create(
#             model="gpt-3.5-turbo",
#             messages=[
#                 {"role": "system", "content": system_prompt},
#                 {"role": "user", "content": question}
#             ],
#             temperature=0.3,
#             max_tokens=150
#         )

#         return {
#             "reply": response.choices[0].message.content.strip()
#         }

#     except Exception as e:
#         return {"reply": f"AI error: {str(e)}"}
