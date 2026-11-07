# NexGen Receptionist

An AI phone receptionist for NexGen Hair Transplant (Patna). "Riya" answers calls in Hindi, English or Hinglish, answers questions from the clinic's knowledge base, qualifies leads, books consultations with Dr. Nilesh Kumar, and hands calls to the front desk. Staff follow everything from a web dashboard and a mobile app.

```
Caller ──► Exotel number ──► ElevenLabs agent "Riya"
                                 │  during the call: check_availability, book_appointment,
                                 │  save_lead, request_callback, log_unanswered_question
                                 ▼
                           server/ (Express + PostgreSQL)  ◄── post-call webhook (transcript, summary, lead fields)
                                 │        └─► WhatsApp, Clinic OS, Google Sheet
                                 ▼  REST + realtime (socket.io)
                     web/ (React dashboard)    mobile/ (React Native app)
```

| Folder | What it is |
| --- | --- |
| `server/` | Node 22, Express 5, TypeScript, PostgreSQL with Drizzle ORM, socket.io |
| `web/` | React 19, Vite, Tailwind CSS 4, TanStack Query |
| `mobile/` | React Native with Expo (SDK 58) and Expo Router |

The ElevenLabs agent already exists: **`agent_6401m6rq5wm9f8e9g9np047anfaw`** ("NexGen Receptionist – Riya"), with its prompt, post-call data fields (name, city, concern, outcome…), evaluation criteria and guardrails set up.

---

## 1. Database and API

```bash
cd server
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, AGENT_TOOL_SECRET, SEED_ADMIN_*
npm install
npm run db:migrate            # creates the tables
npm run db:seed               # first admin, default settings, starter knowledge base
# npm run db:seed:demo        # same, plus sample calls so the dashboard isn't empty
npm run dev                   # http://localhost:4000
```

Or with Docker: `docker compose up -d --build`, then `docker compose exec api node dist/db/seed.js`.

### Tables

`users` (admin / front_desk / counsellor) · `leads` (one per phone number) · `calls` + `transcript_turns` · `appointments` · `callbacks` · `knowledge_docs` · `unanswered_questions` · `agent_settings` (one row, JSON).

Change the schema in `src/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`.

## 2. Connect the ElevenLabs agent

The server has to be reachable on a public **https** address (ElevenLabs calls it during phone calls). Deploy it, or use a tunnel such as ngrok while testing.

1. In `server/.env` set `PUBLIC_URL`, `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`.
2. Run **`npm run elevenlabs:setup`**. This:
   - registers the 5 webhook tools pointing at `PUBLIC_URL/api/agent-tools/*` (secured with `AGENT_TOOL_SECRET`),
   - uploads the knowledge-base documents,
   - pushes the prompt, voice, first message and transfer number to the agent.
   It's safe to run again.
3. In the ElevenLabs dashboard → **Agents → Settings → Post-call webhook**, add `https://<your-server>/api/webhooks/elevenlabs`, enable transcription events, and copy the signing secret into `ELEVENLABS_WEBHOOK_SECRET`.
4. **Phone number (Exotel):** in ElevenLabs → **Phone numbers → Import number**, choose Exotel (or SIP trunk with your Exotel credentials), and assign it to the Riya agent. Point the clinic's Exotel number to it.

After that, every change in **Agent settings** or the **Knowledge base** in the web app updates the live agent.

### Voice

The agent was created with a built-in voice ("Jessica") because voices from the ElevenLabs Voice Library must first be added to your account. For a natural Hindi voice: add a Hindi customer-care voice from the Voice Library (for example "Tripti – Natural & Expressive Agent"), copy its voice ID, and paste it in **Agent settings → Voice ID**.

## 3. Web dashboard

```bash
cd web
npm install
npm run dev        # http://localhost:5173 (proxies /api to :4000)
npm run build      # production build in web/dist; set VITE_API_URL to the API address
```

Screens: Overview (KPIs, live calls, recent calls, upcoming consultations, why people called), Calls, Call detail (recording, transcript, AI summary, lead, notes), Leads, Lead detail (edit, stage, assign counsellor, book), Bookings, Callbacks, Knowledge base (with unanswered questions), Agent settings.

## 4. Mobile app

```bash
cd mobile
npm install
cp .env.example .env    # EXPO_PUBLIC_API_URL = your API address (LAN IP while developing)
npx expo start          # scan the QR code with Expo Go
```

Tabs: Overview, Calls, Leads, Bookings, Callbacks; plus call and lead detail screens with one-tap call-back. For store builds use EAS: `npx eas build -p android` / `-p ios`. Bundle id: `in.nexgenhair.receptionist`.

## 5. Lead delivery (optional)

| Destination | Set in `server/.env` |
| --- | --- |
| WhatsApp confirmations, reminders and counsellor alerts (Meta WhatsApp Cloud API) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `COUNSELLOR_WHATSAPP`, and approved template names `WHATSAPP_TPL_*` |
| Clinic OS | `CLINIC_OS_WEBHOOK_URL` (+ `CLINIC_OS_WEBHOOK_TOKEN`). Receives `lead.upserted` and `appointment.booked` events as JSON. |
| Google Sheet | `GOOGLE_SHEET_WEBHOOK_URL` of an Apps Script web app that appends rows |

Each can be switched on or off in **Agent settings → Where leads go**. Anything not configured is skipped and logged.

## Before going live

- [ ] Fill in every `[BRACKET]` in the knowledge base: prices, address, timings, doctor profile, treatment details.
- [ ] Set real clinic hours and the front-desk number in Agent settings.
- [ ] Choose a Hindi voice and paste its ID.
- [ ] Create and get approval for the three WhatsApp templates.
- [ ] Make a few test calls and check transcripts, bookings and leads in the dashboard.

## API overview

All `/api/*` routes except login, webhooks and agent tools need `Authorization: Bearer <token>`.

| Route | |
| --- | --- |
| `POST /api/auth/login`, `GET /api/auth/me` | Sign in |
| `GET/POST/PATCH /api/users` | Staff accounts (admin) |
| `GET /api/stats?range=today\|7d\|30d` | Dashboard numbers |
| `GET /api/calls`, `GET /api/calls/live`, `GET/PATCH /api/calls/:id`, `GET /api/calls/:id/audio` | Calls |
| `GET /api/leads`, `GET/PATCH /api/leads/:id` | Leads |
| `GET/POST /api/appointments`, `GET /api/appointments/availability`, `PATCH /api/appointments/:id` | Bookings |
| `GET /api/callbacks`, `PATCH /api/callbacks/:id` | Callback requests |
| `GET/PUT /api/settings`, `POST /api/settings/sync` | Agent settings (admin to change) |
| `GET/POST/PUT/DELETE /api/knowledge`, `/api/knowledge/unanswered` | Knowledge base |
| `POST /api/agent-tools/*` | Called by the agent (header `x-agent-secret`) |
| `POST /api/webhooks/elevenlabs` | ElevenLabs post-call webhook (HMAC-signed) |
