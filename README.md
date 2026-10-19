# SaansCast: AQI Forecast and Advisory System

**Know tomorrow's air today.**

---

## Easy Steps to Run This Project

Follow these 7 steps in order. The full explanation of every step is further down in this file.

**Step 1: Install these 4 programs**
- Git
- Python 3.11 or newer
- Node.js (version 22 recommended)
- PostgreSQL (remember the password you set during installation)

**Step 2: Download the project**
```
git clone https://github.com/vaishnavighule504-cmyk/AQI-Forecast-and-Advisory-System.git
cd AQI-Forecast-and-Advisory-System
```

**Step 3: Create the database**

Open the PostgreSQL command line (`psql -U postgres`, or "SQL Shell" on Windows) and type:
```sql
ALTER USER postgres WITH PASSWORD 'choose-a-password';
CREATE DATABASE "aqi_DB";
\q
```

**Step 4: Create the settings file**

Copy the file `.env.example` and name the copy `.env`. Open `.env` and write your database password next to `DB_PASSWORD=`. Leave everything else as it is.
```
cp .env.example .env          (Linux)
copy .env.example .env        (Windows)
```

**Step 5: Start the backend** (keep this window open)
```
python -m venv venv
venv\Scripts\activate            (Windows)   or   source venv/bin/activate   (Linux)
pip install -r requirements.txt
cd aqi_backend
python manage.py migrate
python manage.py seed_aqi_data
python manage.py runserver
```

**Step 6: Start the frontend** (open a second window, and go to the project folder first)
```
cd AQI-Forecast-and-Advisory-System
cd frontend
npm ci
npx ng serve
```

**Step 7: Open the website**

Go to **http://localhost:4200** in your browser.

If the page shows "UNAVAILABLE", the backend in Step 5 is not running. If something fails, see the Troubleshooting section below.

---

## About the project

SaansCast shows live air quality for seven Indian cities (Delhi, Mumbai, Bengaluru, Chennai, Hyderabad, Ahmedabad, Kolkata), forecasts the AQI **one and two days ahead**, and turns the result into guidance for the user's health profile.

---

## Easy steps: run it in 7 steps

Short version. The full explanation of every step is in the [Full guide](#full-guide-every-step-in-detail) further down.

**1. Install these four programs:** Git, Python 3.11 or newer, Node.js 22, PostgreSQL.

**2. Download the project**
```
git clone https://github.com/vaishnavighule504-cmyk/AQI-Forecast-and-Advisory-System.git
cd AQI-Forecast-and-Advisory-System
```

**3. Create the database and choose a password.** Open `psql` (Windows: "SQL Shell (psql)" from the Start menu. Linux: `sudo -u postgres psql`) and run:
```
ALTER USER postgres WITH PASSWORD 'choose-a-password';
CREATE DATABASE "aqi_DB";
```

**4. Create the settings file.** Copy `.env.example` to a new file named `.env`, and write your password after `DB_PASSWORD=`.

**5. Start the backend.** In a terminal in the project folder:

Windows (PowerShell):
```
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd aqi_backend
python manage.py migrate
python manage.py seed_aqi_data
python manage.py runserver
```

Linux:
```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd aqi_backend
python manage.py migrate
python manage.py seed_aqi_data
python manage.py runserver
```

**6. Start the frontend.** Open a **second** terminal in the project folder:
```
cd frontend
npm ci
npx ng serve
```

**7. Open the website:** http://localhost:4200

Backend runs on port 8000, frontend on port 4200. Keep both terminals open. If something fails, see [Troubleshooting](#7-troubleshooting).

---

## About the project

**What it includes**

- Live CPCB readings, station data and pollutant breakdown
- 1-day and 2-day AQI forecast, compared against a "tomorrow equals today" baseline
- Interactive map, trend chart and seven-city comparison
- Health advisory by profile (General Public, Asthma, Elderly, Outdoor Worker)
- Today's Air Plan, local alerts and a rule-based assistant
- A "How we forecast" page with the model method and offline evaluation results

**Tech stack:** Python, Django REST Framework, PostgreSQL, scikit-learn, Angular 21, Leaflet.

```
CPCB data (CSV + live API) -> Django API + PostgreSQL -> forecasting models -> Angular dashboard
```

---

## Contents

1. [What you need installed](#1-what-you-need-installed)
2. [Folder layout](#2-folder-layout)
3. [Quick start](#3-quick-start-after-the-one-time-setup-below)
4. [One-time setup](#4-one-time-setup)
   - [Step 1: Get the code](#step-1-get-the-code)
   - [Step 2: PostgreSQL and password](#step-2-set-up-postgresql-and-choose-a-password)
   - [Step 3: Configuration file](#step-3-create-the-configuration-file)
   - [Step 4: Backend](#step-4-install-and-prepare-the-backend)
   - [Step 5: Frontend](#step-5-install-and-run-the-frontend)
5. [Using the application](#5-using-the-application)
6. [Running on a server](#6-running-on-a-server-and-opening-it-from-other-computers)
7. [Troubleshooting](#7-troubleshooting)
8. [Resetting](#8-resetting)
9. [About the forecasting](#9-about-the-forecasting)
10. [Security notes](#10-security-notes)
11. [Project team](#11-project-team)

---

## 1. What you need installed

| Tool | Version | Check with |
|---|---|---|
| Git | any recent | `git --version` |
| Python | 3.11 or newer | `python --version` (on Linux: `python3 --version`) |
| Node.js and npm | Node 22 LTS recommended (20.19 or newer) | `node -v` and `npm -v` |
| PostgreSQL | 14 or newer | `psql --version` |

Ollama (a local language model) is **optional**. Without it the health advice uses built-in rules.

## 2. Folder layout

```
.
├── aqi_backend/      Django REST API (manage.py, settings, "forecast" app)
├── frontend/         Angular 21 web application
├── models/           Saved forecasting models (.pkl) loaded by the API
├── ml_models/        Archived earlier experiments (not used by the API)
├── .env.example      Template for configuration (copy to .env)
├── requirements.txt  Python dependencies
└── README.md
```

The API loads the model files from the `models/` folder in the project root, so always run the project from the full cloned repository.

---

## 3. Quick start (after the one-time setup below)

Open two terminals in the project root.

**Terminal 1 (backend)**
```
cd aqi_backend
python manage.py runserver
```

**Terminal 2 (frontend)**
```
cd frontend
npx ng serve
```

Open **http://localhost:4200** in a browser. The API runs on http://127.0.0.1:8000.

---

## 4. One-time setup

### Step 1: Get the code

```
git clone https://github.com/vaishnavighule504-cmyk/AQI-Forecast-and-Advisory-System.git
cd AQI-Forecast-and-Advisory-System
```

### Step 2: Set up PostgreSQL and choose a password

The project needs PostgreSQL. You choose the password; it is **never stored in the repository**.

**Linux (Ubuntu or Debian)**
```
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql
```

**Windows**
1. Install PostgreSQL from https://www.postgresql.org/download/windows/. During setup, set a password for the `postgres` user and keep port `5432`.
2. Open "SQL Shell (psql)" from the Start menu, or add `C:\Program Files\PostgreSQL\<version>\bin` to your PATH and run `psql -U postgres`.

**Inside the psql prompt**, run these commands. The database name `aqi_DB` is case-sensitive and must stay in double quotes.

```sql
ALTER USER postgres WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE "aqi_DB";
\q
```

(`ALTER USER` sets or changes the password. Skip it if you already know the `postgres` password. Use the same password in the `.env` file in the next step.)

Check that the connection works:
```
psql -U postgres -h localhost -d aqi_DB
```
Type `\q` to exit.

### Step 3: Create the configuration file

In the **project root** (the folder that contains this README), copy the template:

```
cp .env.example .env          # Linux or macOS
copy .env.example .env        # Windows (Command Prompt)
```

Open `.env` and fill it in:

```
SECRET_KEY=paste-a-long-random-string
DEBUG=True
DB_NAME=aqi_DB
DB_USER=postgres
DB_PASSWORD=the-password-you-set-in-step-2
DB_HOST=localhost
DB_PORT=5432
CPCB_API_KEY=
```

| Variable | Meaning |
|---|---|
| `SECRET_KEY` | Any long random string. Generate one with the command below. |
| `DEBUG` | Keep `True` for evaluation and local use. |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | PostgreSQL connection from Step 2. |
| `CPCB_API_KEY` | Optional. A free key from https://data.gov.in enables live readings. If left empty, the app serves the last stored reading and labels it "LAST STORED READING". |

Generate a secret key (after Step 4 has installed the packages):
```
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Never commit the `.env` file. It is already ignored by git.

### Step 4: Install and prepare the backend

Run these from the project root.

**Linux or macOS**
```
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**Windows (PowerShell)**
```
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks the activation script, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first.

Do not upgrade scikit-learn by hand. The saved models were created with specific versions, and `requirements.txt` holds the tested ones. A scikit-learn version warning at startup is a warning, not an error.

Create the database tables and load the historical data:

```
cd aqi_backend
python manage.py check
python manage.py migrate
python manage.py seed_aqi_data
```

`seed_aqi_data` loads about 10,487 historical readings into PostgreSQL. It takes a short while. Run it **once**.

Start the backend:
```
python manage.py runserver
```

Test it by opening these two addresses in a browser. Each should show JSON.

- http://127.0.0.1:8000/api/forecast/?city=Delhi&profile=General+Public
- http://127.0.0.1:8000/api/live-aqi/?city=Delhi

Leave this terminal running.

### Step 5: Install and run the frontend

Open a **second terminal**.

```
cd frontend
npm ci
npx ng serve
```

Wait for "Application bundle generation complete", then open **http://localhost:4200**.

Use `npm ci` (not `npm install`) so the exact tested package versions are installed.

---

## 5. Using the application

1. Open the landing page and choose **Get Started**. Register with any name, email and password. Login in this version is a frontend demonstration stored in the browser. If you are signed out after a refresh, register again.
2. Complete the short onboarding (city, purpose, optional sensitivity, outdoor times, alert threshold).
3. On the **Dashboard**, check the status badge:
   - **LIVE**: a fresh CPCB reading.
   - **LAST STORED READING**: the backend returned its saved reading.
   - **UNAVAILABLE**: the frontend cannot reach the backend. Check that the backend is running.
4. Click a city on the map, press **Load all 7 cities**, or open **Compare**.
5. Change the profile to see the guidance change. Open **Alerts** and **Model** for the other pages.

A live request to CPCB can take up to about 15 seconds before the app falls back to the stored reading.

**Frontend without the backend:** open `http://localhost:4200/?mock=1` to see the interface with clearly labelled DEMO DATA. This is only for checking the layout.

---

## 6. Running on a server and opening it from other computers

If you open the browser on the **same machine** that runs the project, no change is needed.

To open it from **another computer**, do all three of the following. Replace `SERVER_IP` with the server's IP address.

1. **Allow the backend host.** In `aqi_backend/aqi_backend/settings.py`, set:
   ```python
   ALLOWED_HOSTS = ['SERVER_IP', 'localhost', '127.0.0.1']
   ```
   (With `DEBUG=True` and an empty list, Django accepts only localhost.)
2. **Point the frontend at the backend.** In `frontend/src/app/services/aqi.service.ts`, change the API base address from `http://127.0.0.1:8000` to `http://SERVER_IP:8000`. A browser on another computer would otherwise look for the API on its own machine.
3. **Start both servers so they listen on all interfaces:**
   ```
   cd aqi_backend
   python manage.py runserver 0.0.0.0:8000
   ```
   ```
   cd frontend
   npx ng serve --host 0.0.0.0
   ```
   Then open `http://SERVER_IP:4200`. Open ports 4200 and 8000 in the server firewall. Use the IP address in the browser. If you use a hostname and the page is blocked, add the hostname to the `allowedHosts` setting of the `serve` options in `frontend/angular.json`.

The development servers above are enough for evaluation. They are not hardened for public production use.

---

## 7. Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `psql` is not recognised | PostgreSQL's `bin` folder is not on PATH (Windows). Add it, or use SQL Shell (psql). |
| `password authentication failed for user "postgres"` | `DB_PASSWORD` in `.env` does not match the password set in Step 2. Reset it with `ALTER USER postgres WITH PASSWORD '...'`. |
| `database "aqi_DB" does not exist` | Create it with `CREATE DATABASE "aqi_DB";` (keep the capital letters and quotes). |
| `connection refused` on port 5432 | PostgreSQL is not running. Linux: `sudo systemctl start postgresql`. |
| `ModuleNotFoundError` when starting Django | The virtual environment is not active, or `pip install -r requirements.txt` did not finish. |
| Dashboard shows UNAVAILABLE | The backend is not running, or the API address in `aqi.service.ts` is wrong. Open the API links in Step 4 to test. |
| `Invalid HTTP_HOST header` | Add the address to `ALLOWED_HOSTS` (Section 6). |
| Browser console shows a CORS error | The backend must be running with the project's `settings.py` (CORS is enabled for the demo). |
| `npm ci` fails | Check `node -v` meets the requirement above, delete `frontend/node_modules`, and run it again. |
| `LAST STORED READING` instead of `LIVE` | `CPCB_API_KEY` is empty or the data.gov.in service is slow. The app works without it. |
| Port already in use | Stop the old server, or run `python manage.py runserver 8001` / `npx ng serve --port 4300` (and update the API address if you change the backend port). |

---

## 8. Resetting

To reload the historical data from scratch, drop and recreate the database, then repeat Step 4's `migrate` and `seed_aqi_data`:

```sql
DROP DATABASE "aqi_DB";
CREATE DATABASE "aqi_DB";
```

---

## 9. About the forecasting

- **Data:** CPCB city-day readings, 7 cities, 2015 to mid-2020 (10,487 cleaned rows).
- **Features:** AQI lags (1, 3, 7 days), 3-day and 7-day rolling mean, 7-day rolling standard deviation, day of week and month.
- **Models:** linear and ridge regression for Delhi, Mumbai and Kolkata. A persistence baseline (tomorrow equals today) is used for the other four cities because no model beat it on the test period.
- **Validation:** chronological split, trained up to 2019-12-31 and tested on 2020-01-01 to 2020-07-01. The 2-day model is trained directly on the day-2 target.
- **AQI calculation:** the CPCB National AQI method. Each pollutant gets a sub-index, and the highest sub-index is the AQI.
- **Limits:** no weather inputs, a short test window, no prediction intervals. The detailed results are on the application's **Model** page.

Health guidance in the application is rule-based and is **not medical advice**.

### Live CPCB data pipeline

1. Fetch the hourly JSON feed from data.gov.in.
2. Group readings by station.
3. Average each pollutant across all stations.
4. Apply the CPCB piecewise sub-index formulas to those averages to get the city AQI. Station AQIs are never averaged to produce the city AQI.

- Carbon monoxide values from the API are divided by 1000 to convert from micrograms per cubic metre to milligrams per cubic metre before the sub-index is calculated.
- A reading is valid only if at least 3 pollutants are present, including PM2.5 or PM10.
- Live readings are stored in a separate `LiveAQIReading` table. Historical data and model inference use the `AQIReading` table, so a live-feed outage cannot affect the models.

---

## 10. Security notes

- Keep `.env` private and never commit it.
- Use a strong database password and a new `SECRET_KEY` on any shared server.
- Set `DEBUG=False` and restrict `ALLOWED_HOSTS` and CORS before any public deployment.

## 11. Project team

Built by the SaansCast project team as a final-year project.
