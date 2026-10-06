# FoodWaste AI — AI-Powered Food Waste Prediction & Reduction System

An end-to-end, multi-tenant sustainability platform engineered for commercial food-service organizations (restaurants, cafeterias, college canteens, and institutional kitchens). FoodWaste AI leverages historical consumption patterns and machine learning to forecast daily food demand, quantify waste risk, and deliver actionable operational recommendations to minimize surplus food and optimize kitchen margins.

---

## 1. Project Overview

Food service operations often struggle with balancing preparation quantities against variable daily demand, resulting in substantial financial loss and preventable food waste. FoodWaste AI addresses this challenge through a three-tier architecture:

- **Historical Record Keeping:** Tracks prepared, sold, and wasted quantities with pure calendar date integrity.
- **Machine Learning Forecasting:** Predicts expected demand quantities and classifies waste risk (Low, Medium, High) using trained scikit-learn models served through a high-performance FastAPI microservice.
- **Sustainability Analytics & Recommendations:** Aggregates waste rates, tracks daily trends, identifies top waste-producing items, and produces prioritized, data-driven operational recommendations.
- **Multi-Tenant Data Isolation:** Ensures strict organization-level data privacy across catalog items, demand logs, analytics, and model predictions.

---

## 2. Key Features

- **Multi-Tenant Organization Architecture:** Organization creation, role-based access, and server-side query scoping guaranteeing strict data isolation between tenants.
- **Food Item Catalog:** Complete CRUD management of food items categorized by course, salad, bakery, seafood, dessert, etc., with flexible serving unit designations (portions, kg, plates, bowls).
- **Demand Logging with Calendar Date Integrity:** Record daily preparation, sales, and waste with pure `YYYY-MM-DD` date consistency across frontend, Express API, and MySQL without timezone drift.
- **AI-Powered Demand & Risk Predictions:**
  - **Demand Forecasting:** Predicts portion demand using trained `LinearRegression` models utilizing day-of-week, rolling lag features, and past sales history.
  - **Waste Risk Classification:** Evaluates overproduction risk (Low / Medium / High) using a trained `LogisticRegression` classifier.
  - **Truthful Refusal Logic:** Refuses to hallucinate predictions when historical sequence data is insufficient, returning structured guidance instead.
- **Sustainability Analytics Dashboard:**
  - Real-time aggregation of prepared, sold, and wasted quantities.
  - Overall waste rate and sell-through rate calculations.
  - Chronological daily waste trends and item-by-item waste distribution.
  - Identification of highest waste-generating food items.
- **Actionable Operational Recommendations:**
  - Automatic classification of items into High, Medium, or Low operational priority.
  - Specific recommendations for preparation volume adjustment, menu scheduling, and inventory control.
- **Responsive & SEO-Optimized Interface:**
  - Custom Vanilla CSS design system with an eco-focused sage-green/warm-sand palette.
  - Fully responsive across mobile (320px–425px), tablet (768px), and desktop viewports.
  - SEO-optimized public landing page with metadata, Open Graph, Twitter cards, JSON-LD structured data, `robots.txt`, and `sitemap.xml`.
  - Privacy-preserving `noindex, nofollow` directives on all authenticated routes.

---

## 3. Tech Stack

### Frontend
- **Framework:** React 19, Vite
- **Routing:** React Router DOM (v7)
- **HTTP Client:** Axios (with centralized interceptors for JWT injection and error normalization)
- **Styling:** Custom Vanilla CSS Design System (CSS variables, glassmorphism, responsive grid/flexbox)
- **Icons:** Inline accessible SVG icons and Lucide React

### Backend API Gateway
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database Driver:** `mysql2/promise` (connection pooling and parameterized queries)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`), password hashing with `bcryptjs`
- **Security:** CORS, input validation middleware, organization scoping guards

### Machine Learning Service
- **Runtime:** Python 3.10+
- **Framework:** FastAPI, Uvicorn
- **ML Libraries:** scikit-learn, pandas, numpy, joblib
- **Data Validation:** Pydantic models
- **Algorithms:** Linear Regression (demand forecasting), Logistic Regression (waste-risk classification)

### Database
- **Engine:** MySQL 8.0+
- **Tables:** `users`, `organizations`, `organization_users`, `food_items`, `demand_records`

---

## 4. Main Modules & Pages

| Route | Page | Access | Description |
|---|---|---|---|
| `/` | Landing / Home | Public | Product overview, interactive feature showcases, UN SDG 12 commitment, and navigation. |
| `/login` | Sign In | Public | Secure user authentication, JWT session generation. |
| `/register` | Sign Up | Public | Account creation with password strength validation. |
| `/dashboard` | Operational Dashboard | Authenticated | High-level metrics (total prepared, sold, wasted, waste %), quick actions, and recent activity. |
| `/food-items` | Food Catalog | Authenticated | Add, edit, search, and manage organizational food menu items. |
| `/demand` | Demand Records | Authenticated | Log and manage daily preparation, sales, and waste data. |
| `/predictions` | AI Predictions | Authenticated | Interactive inference interface for demand forecasting and waste-risk assessment. |
| `/analytics` | Sustainability Analytics | Authenticated | Chronological waste trends, item breakdown, and performance metrics. |
| `/recommendations` | Recommendations | Authenticated | Actionable insights categorized by operational urgency (High / Medium / Low). |
| `/organization` | Organization Profile | Authenticated | Manage organization name, type (restaurant, canteen, cafeteria), and settings. |

---

## 5. Project Structure

```text
FoodWaste-AI/
├── client/                          # React + Vite frontend application
│   ├── public/                      # Static assets (favicon, robots.txt, sitemap.xml)
│   ├── src/
│   │   ├── api/                     # Axios instance & API service modules
│   │   ├── components/              # AppLayout, Navbar, ProtectedRoute
│   │   ├── context/                 # AuthContext (JWT management & session state)
│   │   ├── hooks/                   # useSEO (dynamic title, meta, canonical tags)
│   │   ├── pages/                   # Application views and public pages
│   │   ├── App.jsx                  # Route configuration & route guards
│   │   ├── index.css                # Global styles, variables & responsive rules
│   │   └── main.jsx                 # Client entry point
│   └── package.json
├── server/                          # Node.js + Express backend service
│   ├── config/                      # MySQL database connection pool
│   ├── controllers/                 # Business logic for auth, demand, items, ml, etc.
│   ├── middleware/                  # authMiddleware, requireOrganization
│   ├── routes/                      # API endpoint definitions (/api/*)
│   ├── scripts/                     # Automated integration & regression test suites
│   ├── index.js                     # Express app setup and server listener
│   └── package.json
├── ml/                              # Python Machine Learning microservice
│   ├── artifacts/                   # Serialized model (.joblib) & feature metadata
│   ├── data/                        # Training datasets & feature extraction scripts
│   ├── src/
│   │   ├── api.py                   # FastAPI application & prediction endpoints
│   │   ├── feature_pipeline.py      # Feature engineering & lag calculation
│   │   └── train.py                 # Offline model training pipeline
│   └── requirements.txt             # Python dependencies
└── README.md
```

---

## 6. Testing & Validation

The project includes purpose-built automated test and verification suites in `server/scripts/`:

1. **Multi-Tenant Data Isolation Audit (`test_isolation_audit.js`):**
   - 39 automated assertions validating cross-tenant security.
   - Verifies that Tenant B cannot read, create, modify, or delete Tenant A food items or demand records (enforcing 401, 403, and 404 guards).
   - Validates that dashboard stats, analytics aggregations, and ML predictions never leak cross-tenant data.
2. **Demand Calendar Date Integrity Suite (`test_demand_dates.js`):**
   - Validates pure calendar date (`YYYY-MM-DD`) handling across create, reload, list, edit, and delete operations without UTC or timezone shifts.
3. **Analytics & Recommendations Suite (`test_phase2d.js`):**
   - 32 assertions verifying mathematical correctness of prepared/sold/wasted sums, waste percentages, coverage calculations, and recommendation urgency assignments.
4. **ML Prediction Gateway Suite (`test_phase2c.js`):**
   - 21 assertions testing FastAPI health, Express-to-FastAPI gateway proxying, input validation, and truthful refusal on insufficient historical sequences.
5. **Frontend Production Build:**
   - Validated via `npm run build` with zero compiler warnings or bundle errors.

---

## 7. Local Setup Instructions

### Prerequisites
- **Node.js** (v18.x or later) & **npm**
- **Python** (3.10 or later)
- **MySQL Server** (8.0 or later)

---

### Step 1: Database Setup
1. Start your local MySQL service.
2. Create the database:
   ```sql
   CREATE DATABASE food_waste_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Initialize the database schema (tables are automatically verified on server startup, or execute the initial schema script if provided).

---

### Step 2: Backend Setup (Express API)
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the environment file (`server/.env`):
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=food_waste_db
   JWT_SECRET=your_secure_jwt_secret
   ML_API_URL=http://127.0.0.1:8000
   ```
4. Start the server in development mode:
   ```bash
   npm run dev
   ```
   *The server runs at `http://localhost:5000`.*

---

### Step 3: Machine Learning Service Setup (FastAPI)
1. Open a new terminal and navigate to the `ml` directory:
   ```bash
   cd ml
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI microservice:
   ```bash
   uvicorn ml.src.api:app --host 127.0.0.1 --port 8000 --reload
   ```
   *The ML microservice runs at `http://127.0.0.1:8000` (docs available at `/docs`).*

---

### Step 4: Frontend Setup (React + Vite)
1. Open a new terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the client environment (`client/.env`):
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *The frontend runs at `http://localhost:5173`.*

---

## 8. Environment Variable Guidance

| Variable | Location | Required | Default | Description |
|---|---|---|---|---|
| `PORT` | `server/.env` | No | `5000` | Port for the Express backend server. |
| `DB_HOST` | `server/.env` | Yes | `localhost` | MySQL host address. |
| `DB_USER` | `server/.env` | Yes | `root` | MySQL username. |
| `DB_PASSWORD` | `server/.env` | Yes | - | MySQL user password. |
| `DB_NAME` | `server/.env` | Yes | `food_waste_db` | MySQL database name. |
| `JWT_SECRET` | `server/.env` | Yes | - | Secret key used to sign and verify JWT tokens. |
| `ML_API_URL` | `server/.env` | Yes | `http://127.0.0.1:8000` | URL of the running FastAPI ML microservice. |
| `VITE_API_URL` | `client/.env` | Yes | `http://localhost:5000/api` | Base URL for frontend Axios calls. |

---

## 9. Production Build Command

To compile and produce optimized production assets:

```bash
# In the client directory:
cd client
npm run build
```
The compiled output is located in `client/dist/` ready to be served by any static host or reverse proxy (Nginx, Caddy, etc.).

To start the backend in production mode:
```bash
# In the server directory:
cd server
npm start
```

---

## 10. Security Notes

- **Multi-Tenant Data Segregation:** All database queries for food items, demand records, dashboard metrics, and analytics are explicitly filtered by the authenticated user's `organization_id`. Frontend hiding is backed by strict server-side authorization middleware (`requireOrganization`).
- **Authentication & Token Integrity:** Secure JWT tokens with configurable expiration; tampered or missing tokens immediately return `401 Unauthorized`.
- **Credential Protection:** User passwords are encrypted with `bcryptjs` before storage; raw passwords are never logged or stored.
- **SQL Injection Prevention:** All SQL queries utilize parameterized statements via `mysql2/promise`.
- **Search Privacy:** Authenticated dashboard routes programmatically set `<meta name="robots" content="noindex, nofollow" />` to prevent crawler indexation of tenant data.

---

## 11. Future Scope

- **External Demand Modifiers:** Integration of real-time weather forecasts, regional holiday calendars, and local event schedules into ML feature vectors.
- **Automated Procurement Integration:** Direct generation of recommended raw-ingredient purchase orders based on forecasted demand portions.
- **IoT Smart Scale & Kitchen Telemetry:** Direct webhook intake from connected smart waste bins and kitchen scales to automate logging.
- **Multi-Branch Enterprise Management:** Consolidated reporting for multi-location restaurant chains and district-level school nutrition programs.

---

## 12. Author

**Pranav Rajput**  
B.Tech Computer Science & Engineering  
ABES Engineering College  
GitHub: [@pranavrajput2306-wq](https://github.com/pranavrajput2306-wq)
