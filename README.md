# EconoMe — Finance Awareness System

> A full-stack personal finance awareness platform with AI-powered insights, multilingual support, real-time sync, and bank-grade security.

---

## 🌟 Overview

EconoMe helps users understand and improve their financial health through AI-generated insights, interactive learning modules, macroeconomic dashboards, and an AI tutor chatbot. Built with a FastAPI backend and React frontend, it features enterprise-grade security (OTP, device fingerprinting, CSRF protection, encrypted storage) and supports English, Hindi, and Marathi.

---

## ✨ Key Features

- **🔐 Bank-Grade Auth** — Two-step login with OTP email verification, device fingerprinting (SHA-3), HTTP-only cookie sessions, CSRF protection, and account lockout
- **🤖 AI Insights Engine** — Expense categorization (ONNX model), foresight engine for future projections, explainable AI (XAI), and optional local LLM (Mistral-7B)
- **💬 AI Tutor Chat** — WebSocket-powered real-time chat with a financial tutor
- **📊 Finance Tracker** — Transaction management, budget tracking, spending analytics
- **🌍 Macroeconomic Dashboard** — Live commodity prices, forex rates, economic indicators
- **📚 Learning Hub** — Structured financial literacy courses and quizzes
- **🌐 Multilingual** — 500+ translated strings in English, Hindi (`hi`), and Marathi (`mr`)
- **🔄 Real-Time Sync** — WebSocket events + cross-tab BroadcastChannel synchronization
- **🔒 Encrypted Storage** — AES-256-GCM field-level encryption for sensitive financial data
- **⛓️ Blockchain Audit** — Optional Polygon L2 immutable transaction audit trail

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Zustand, React Query |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy (async), Alembic |
| **Database** | MySQL 8 |
| **Cache / Queue** | Redis 7, Celery |
| **AI / ML** | ONNX Runtime, optional Mistral-7B (llama.cpp) |
| **Auth** | RS256 JWT, HTTP-only cookies, OTP via SMTP |
| **Infra** | Docker Compose, GitHub Actions CI/CD |
| **i18n** | i18next (EN / HI / MR) |

---

## 📁 Project Structure

```
econome/
├── backend/
│   ├── modules/
│   │   ├── auth/           # Login, OTP, device verification
│   │   ├── finance/        # Transactions, budgets
│   │   ├── ai_insight/     # AI orchestrator, XAI, simulation
│   │   ├── chat/           # AI tutor chat
│   │   ├── learning/       # Courses and quizzes
│   │   └── macro/          # Macro economy data
│   ├── shared/
│   │   ├── models.py       # SQLAlchemy ORM models
│   │   ├── cookie_auth.py  # HTTP-only cookie management
│   │   ├── otp_service.py  # OTP generation & verification
│   │   ├── encryption_service.py  # AES-256-GCM field encryption
│   │   ├── transaction_manager.py # ACID financial operations
│   │   ├── websocket_manager.py   # Real-time event broadcasting
│   │   ├── rate_limiter.py        # Redis-backed rate limiting
│   │   ├── audit_logger.py        # Immutable audit log
│   │   └── intrusion_detection.py # Anomaly detection
│   ├── workers/tasks.py    # Celery background tasks
│   ├── alembic/            # Database migrations
│   ├── tests/              # Integration & unit tests
│   ├── main.py             # FastAPI app entry point
│   ├── config.py           # Pydantic settings
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/          # All route-level components
│   │   ├── lib/            # API client, hooks, WebSocket
│   │   ├── store/          # Zustand global state
│   │   ├── locales.ts      # EN/HI/MR translations
│   │   └── i18n.ts         # i18next config
│   ├── package.json
│   └── Dockerfile
├── .github/workflows/ci-cd.yml
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

### Quick Start with Docker

```bash
# 1. Clone the repository
git clone https://github.com/sharayu-ctrl/econome-finance-awareness-system.git
cd econome-finance-awareness-system

# 2. Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your values (see Configuration section)

# 3. Generate RSA keys for JWT
mkdir -p backend/keys
openssl genrsa -out backend/keys/private.pem 2048
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem

# 4. Start all services
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Local Development

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Configuration

Copy `backend/.env.example` to `backend/.env` and fill in the required values:

| Variable | Description | Required |
|---|---|---|
| `SECRET_KEY` | 32-byte random secret | ✅ |
| `DATABASE_URL` | MySQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `MASTER_ENCRYPTION_KEY` | Base64-encoded 32-byte key | ✅ |
| `SMTP_HOST` / `SMTP_USERNAME` / `SMTP_PASSWORD` | Email for OTP delivery | ✅ |
| `JWT_PRIVATE_KEY_PATH` | Path to RSA private key | ✅ |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 file storage | Optional |
| `OPEN_EXCHANGE_RATES_KEY` | Forex rates API | Optional |
| `EIA_API_KEY` | Energy/commodity data | Optional |
| `BLOCKCHAIN_WALLET_PRIVATE_KEY` | Polygon L2 audit trail | Optional |

Generate a secure encryption key:
```bash
python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
```

---

## 🔐 Security Architecture

- **Authentication**: Two-step login → password + OTP email code
- **Sessions**: RS256 JWT stored in HTTP-only cookies (access: 15min, refresh: 7 days)
- **CSRF**: Double-submit cookie pattern with constant-time comparison
- **Device Trust**: SHA-3 fingerprinting; new devices trigger email approval
- **Rate Limiting**: Redis-backed per-endpoint limits
- **Encryption**: AES-256-GCM for sensitive database fields
- **Intrusion Detection**: Anomaly scoring on login patterns
- **Audit Trail**: Append-only audit log (optional Polygon L2 blockchain)

---

## 🧪 Running Tests

```bash
cd backend
pytest tests/ -v
```

---

## 🌐 API Reference

Interactive Swagger docs available at `/docs` when running locally.

Main endpoint groups:

| Prefix | Description |
|---|---|
| `/api/v1/auth` | Registration, login, OTP, device management |
| `/api/v2/auth` | Enhanced auth with HTTP-only cookies |
| `/api/v1/finance` | Transactions, budgets, analytics |
| `/api/v1/insights` | AI-powered financial insights |
| `/api/v1/chat` | AI tutor WebSocket chat |
| `/api/v1/learning` | Courses, quizzes, progress |
| `/api/v1/macro` | Macroeconomic indicators |

---

## 🌍 Multilingual Support

EconoMe supports three languages out of the box:

| Language | Code | Status |
|---|---|---|
| English | `en` | ✅ Complete |
| Hindi | `hi` | ✅ Complete |
| Marathi | `mr` | ✅ Complete |

Language is auto-detected from the browser and persisted in `localStorage`. Users can switch at any time via the language selector in the UI.

To add a new language, add entries to `frontend/src/locales.ts` following the existing structure.

---

## 🐳 Docker Services

| Service | Port | Description |
|---|---|---|
| `frontend` | 3000 | React app (Nginx) |
| `backend` | 8000 | FastAPI application |
| `db` | 3306 | MySQL 8 |
| `redis` | 6379 | Cache & Celery broker |
| `celery_worker` | — | Background task processor |
| `celery_beat` | — | Scheduled task scheduler |

---

## 📦 CI/CD

GitHub Actions pipeline at `.github/workflows/ci-cd.yml`:

- Linting (Ruff) and type checking (mypy)
- Backend unit & integration tests (pytest)
- Frontend build check
- Docker image build & push
- Automated deployment on merge to `main`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---
## 🎥 Project Demo Videos

### Video 1 
[![Video 1](https://github.com/user-attachments/assets/8dac34a6-352d-40d5-b297-84e3adf7c3bc)

### Video 2 
[![Video 2](https://github.com/user-attachments/assets/a1df1251-6af0-4889-a9ec-9e7b9a764e9b)

---

## 📄 License

This project is proprietary. All rights reserved by the author.

---

*Built with ❤️ as a finance awareness platform for Indian users.*
