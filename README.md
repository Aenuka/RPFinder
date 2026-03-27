# RP Finder (MERN + MVC)

RP Finder is a MERN stack project for finding research group members.

## Features

- Register groups with 1 to 4 members.
- Two main interfaces:
  - Register group (1, 2, 3, or 4 members)
  - View all groups split into 1/2/3/4 member lists
- Member details captured:
  - Full name
  - IT number (`ITXXXXXXXX`)
  - Phone number
  - GPA (optional)
  - GitHub username (optional)
  - Tech stack expertise (multi-select)
  - Internship status (optional: doing intern, finished, not yet)
  - LinkedIn (optional)
- Group logic by size:
  - 4 members: status auto-set to `solid group - we stay as group forever`
  - 3 or 2 members: must provide newcomer expectations and current member description
  - 1 member: must provide newcomer expectations and reason for leaving previous group

## Architecture (MVC)

### Backend

- Model: `server/src/models/groupModel.js`
- Controller: `server/src/controllers/groupController.js`
- Route: `server/src/routes/groupRoutes.js`
- App bootstrap: `server/src/app.js`, `server/src/server.js`

### Frontend

- View/UI: `client/src/App.jsx` and styles in `client/src/App.css`
- API client: `client/src/api/groupApi.js`

## Prerequisites

- Node.js 16+
- MongoDB local or cloud connection

## Setup

1. Install dependencies:
   - `npm install`
   - `cd server && npm install`
   - `cd ../client && npm install`
2. Create env files:
   - Copy `server/.env.example` to `server/.env`
   - Copy `client/.env.example` to `client/.env`
3. Start both apps from project root:
   - `npm run dev`

## API Endpoints

- `POST /api/groups` - Create a group
- `GET /api/groups` - Get all groups
- `GET /api/groups/size/:size` - Get groups by member size (`1` to `4`)

## Notes

- IT number format validation is enforced as `IT` followed by 8 digits.
- Each member must have at least one tech stack selected.
- Optional fields can be left empty and will only be stored if provided.
