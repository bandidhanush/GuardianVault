# Guardian Vault 𓆩✧𓆪

A full-stack AI-powered system for real-time CCTV monitoring, accident detection, and secure evidence management.

![image alt](https://github.com/bandidhanush/GuardianVault/blob/main/frontend/WorkingScreens/VidoeStream.png?raw=true)
![image alt](https://github.com/bandidhanush/GuardianVault/blob/main/frontend/WorkingScreens/Detection.png?raw=true)

## Evidence 
![image alt](https://github.com/bandidhanush/GuardianVault/blob/main/frontend/WorkingScreens/Evidence1.png?raw=true)
![image alt](https://github.com/bandidhanush/GuardianVault/blob/main/frontend/WorkingScreens/Evidence2.png?raw=true)
## 🚀 Features
- **AI Detection**: YOLOv8-powered accident detection and severity classification.
- **Secure Evidence**: AES-256 encrypted video storage with SHA-256/MD5 hashing for court admissibility (Section 65B compliance).
- **Emergency Alerts**: Twilio SMS integration for instant notifications to emergency services.
- **Futuristic Dashboard**: Glassmorphic dark UI with live feeds, analytics, and incident history.
- **Evidence Page**: Cryptographic verification and certificate generation.

## 🛠 Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS (via custom index.css), Framer Motion, Lucide, Recharts.
- **Backend**: FastAPI, SQLAlchemy, SQLite (default), OpenCV, Ultralytics, FFmpeg.

## 📦 Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- FFmpeg (Required for video processing)
  - Mac: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`

### Backend Setup
1. Navigate to backend: `cd backend`
2. Install dependencies: `pip3 install -r requirements.txt`
3. Configure `.env` with your Twilio credentials.
4. Start server: `python3 -m uvicorn main:app --reload`

### Frontend Setup
1. Navigate to frontend: `cd frontend`
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`

## 🧠 Training Models
If you wish to train the models yourself:
1. Prepare your dataset in the `dataset/` directory.
2. Run accident training: `python3 training/train_accident_model.py`
3. Run severity training: `python3 training/train_severity_model.py`

The models will be saved to `backend/ml/models/`.
