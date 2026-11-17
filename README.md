# AIRWISE AI — Urban Air Quality Intelligence Platform

AIRWISE AI is a full-stack environmental intelligence web application designed to help families and urban communities understand local air pollution, protect vulnerable household members, optimize indoor air quality, and plan lower-emission daily routines.

## Key Capabilities

1. **Intelligent Air Quality Dashboard**:
   - Real-time regional atmospheric model & observation telemetry via Open-Meteo Air Quality (Copernicus CAMS) and Weather APIs.
   - Multi-standard reporting: **US EPA AQI (2024 breakpoints)**, **European EAQI**, and **WHO 2021 Guideline Ratios**.
   - Pollutant telemetry (`PM2.5`, `PM10`, `NO2`, `O3`, `SO2`, `CO`) alongside temperature, humidity, wind speed, and atmospheric inversion risk evaluation.
   - Strict data-integrity disclosure distinguishing live/forecast model data from clearly marked offline sample baselines whenever upstream APIs are unavailable.

2. **GenAI Air Quality Assistant (`POST /api/ai/ask`)**:
   - Server-side integration with Google Gemini (`@google/genai`, `gemini-4-hydrogen`) grounded in live city telemetry and active household profiles.
   - Structured responses separating verified measurements from general environmental advice, explaining why each recommendation matters, surfacing uncertainty, and maintaining non-diagnostic medical boundaries.

3. **Personalized Family Safety Intelligence**:
   - Supports 7 household profiles (`Adults`, `Children`, `Older Adults`, `Respiratory Sensitivities`, `Outdoor Workers`, `Students`, `Athletes`) with dynamic guidance for outdoor play, exercise, school activities, commuting, and indoor protection.

4. **Smart Indoor Air Quality Advisor**:
   - Live outdoor-to-indoor ventilation decisions, HEPA air purifier CADR room-sizing calculator (`4.8 ACH`), 180-day filter maintenance tracking, evidence-based kitchen/dust/cleaning guidance, realistic scientific expectations regarding indoor plants, and a persistent room-by-room checklist.

5. **Low-Emission Daily Routine Generator (`POST /api/routine/generate`)**:
   - Morning, Afternoon, and Evening plans adapted to current AQI limits (avoiding unsafe active cycling recommendations during severe smog).
   - Calculates CO₂e reductions using cited UK DEFRA 2024 emission factors **only** when the user provides a specific trip distance (`km`).

6. **Air Pollution Science & Impact Explainer + Interactive Analytics**:
   - 8 educational modules plus an interactive Winter Temperature Inversion simulator, 48h/12h SVG trend charts with accessible tabular data view, WHO exceedance bars, and multi-day comparisons.

7. **Configurable Pollution Alerts**:
   - Active-session threshold alerts for Moderate (`51–100`), Poor (`101–150`), Severe (`151–200`), and Hazardous (`201+`) levels with 4-part explanations and optional browser Notification API opt-in.

## Architecture & Security

- **Frontend**: React 19, TypeScript, Tailwind CSS v4 (Light & Dark themes, WCAG 2.2 AA focus rings, reduced-motion support, non-hue-only severity markers).
- **Backend**: Express (`server.ts`) serving Vite middleware in development and `dist/` in production on port `3000`.
- **Security & Privacy**:
  - `GEMINI_API_KEY` stays strictly on the server; never bundled into browser code.
  - Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `x-powered-by` disabled).
  - Sliding-window rate limiting on `/api/ai/*` (20 req/min) and telemetry endpoints (60 req/min).
  - Input sanitization, strict coordinate bounds validation, and coordinate rounding to 2 decimal places (~1.1 km) for privacy-preserving location lookups.

## Environment Variables

Configure via `.env` (or AI Studio **Settings > Secrets**):

| Variable | Required | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Yes (for AI Advisor) | Server-side Google Gemini API key |
| `PORT` | No (default `3000`) | HTTP listening port |
| `NODE_ENV` | No (`production` for deploy) | Serves built `dist/` static assets in production |

## Scripts & Deployment

```bash
# Install dependencies
npm install

# Run full-stack development server (port 3000)
npm run dev

# Type-check & lint
npm run lint

# Run automated unit, security, and API integration tests
npm test

# Build frontend & start production server
npm run build
npm start
```
