<<<<<<< HEAD
# Hidden Council Online

Realtime browser party game inspired by hidden-role social deduction gameplay.

## Features
- 5 to 10 players
- Create room / join room by code
- Realtime multiplayer with Socket.IO
- Secret role distribution
- President / Chancellor flow
- Live table voting
- Policy deck, discard pile, election tracker
- Presidential powers (investigate, special election, eliminate, policy peek)
- Basic reconnect support using local browser storage
- Mobile-friendly browser UI

## Project Structure
```text
hidden-council-online/
├─ client/
│  ├─ index.html
│  ├─ style.css
│  └─ app.js
├─ server/
│  ├─ package.json
│  ├─ constants.js
│  ├─ utils.js
│  ├─ gameManager.js
│  ├─ roomManager.js
│  └─ server.js
└─ README.md
```

## Run Locally
1. Install Node.js 18+.
2. Open terminal in `hidden-council-online/server`.
3. Run:
   ```bash
   npm install
   npm start
   ```
4. Open browser at:
   ```
   http://localhost:3001
   ```

## Play Across Multiple Devices
If all devices are on the same Wi‑Fi/LAN:
1. Find the host machine local IP, for example `192.168.1.8`.
2. Start the server on the host machine.
3. Open on every device:
   ```
   http://192.168.1.8:3001
   ```
4. One player creates the room and shares the code.
5. Others join with the code.

## Notes
- This is a simplified original implementation with a custom neutral theme and naming.
- The server is authoritative for the game state.
- Reconnect uses the player's stored browser ID. If the same browser returns to the same room, it can reconnect.
- If a player disconnects after the game starts, they stay in the room as disconnected until they reconnect.

## Deployment
You can deploy the `server` folder to Render, Railway, Fly.io, or any Node-compatible host. The client is already served by the Express server.

## GitHub Upload
You can upload this project directly to a GitHub repository.

Recommended repository layout:
- keep the project root as `hidden-council-online`
- keep the server code inside `server/`
- keep the client code inside `client/`

Basic Git commands:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hidden-council-online.git
git push -u origin main
```

For deployment from GitHub:
- Render / Railway: set the root directory to `server`
- Start command: `npm start`
=======
# hidden-council-online
>>>>>>> eae06b38c633890abf897d908866c55be2ce99eb
