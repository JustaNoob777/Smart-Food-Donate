# FoodShare — Smart Food Donation & Distribution System

A web app for **SDG 2 · Zero Hunger** that connects food donors (restaurants,
hostels, shops, individuals) with NGOs and volunteers who redistribute surplus
to people in need — built as a data-structures project where **every required
structure does real work**.

**Backend: C** · **Frontend: web (React + Convex)** · **Theme: Claymorphism**

---

## Quick start (download → VS Code → run)

### 1. Download the project
Use the **Download / Export** button on your Freebuff project to get the `.zip`,
then unzip it anywhere.

### 2. Prerequisites
| Tool | Needed for | Check |
| --- | --- | --- |
| [Bun](https://bun.sh) (or Node 20+) | web app | `bun --version` |
| gcc + make | C backend & tests | `gcc --version` |
| VS Code | editor | — |

### 3. Open & install
```bash
cd foodshare-project
code .                    # open in VS Code
bun install               # JS dependencies
```
VS Code extensions worth installing: **Tailwind CSS IntelliSense**, **ESLint**,
**Prettier**, **Convex**.

### 4. Environment (`.env`)
The app needs your Convex deployment URL. Copy the value from Freebuff's
**Keys / API keys** tab (or from `.env.local` if it came with your download)
into a `.env` file at the project root:

```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

> No `.env`? Create one. The app shows a clear configuration screen instead of a
> blank page if this is missing.

### 5. Run — three terminals
```bash
# Terminal A — Convex backend (watch mode)
bun convex dev

# Terminal B — web app → http://localhost:5173
bun run dev

# Terminal C — the C backend → http://localhost:8080
make api
```
The same steps exist as make targets: `make setup`, `make check`,
`make convex`, `make web`, `make api`, `make test`.

### 6. Verify
- `/` → landing page · `/ds` → **C Engine Lab** (works fully offline — pure WASM)
- `make test` → `ALL TESTS PASSED (385 checks across 6 data structures)`
- `curl localhost:8080/api/donations` → priority-queue ordered JSON
- `bunx convex dev --once && bunx tsc -b --noEmit` → clean

---

## Data structures → product features

| Structure | Role in the product | Example operation |
| --- | --- | --- |
| **Queue (FIFO)** | Pending collection requests, served oldest-first | `queue_enqueue` / `queue_dequeue` |
| **Priority queue** (binary min-heap) | Orders available donations by expiry — soonest spoils first | `pq_insert` / `pq_extract_min` |
| **Stack (LIFO)** | Recent-actions history feed | `stack_push` / `stack_pop` |
| **Linked list** | Delivery route steps (received → assigned → picked up → in transit → delivered) | `ll_push_back` / `ll_delete` |
| **Binary search tree** | Donation index by integer id, with reported search depth | `bst_insert` / `bst_search` |
| **Graph + BFS/DFS** | Donor ↔ hub ↔ NGO distribution network | `graph_bfs` / `graph_dfs` |

## The C backend (`c-backend/`)

| File | Purpose |
| --- | --- |
| `ds.h` / `ds.c` | All six structures, written from scratch, **zero libc calls** |
| `server.c` | POSIX-socket HTTP/1.1 JSON server driving those structures |
| `wasm_api.c` | Flat integer ABI + operation trace log for the browser build |
| `tests.c` | Native test suite — **385 checks across 6 structures** |
| `Makefile` | `make` · `make test` · `make run` |
| `build-wasm.sh` | Rebuild `public/ds.wasm` with wasi-sdk/clang |

```bash
cd c-backend
make test      # builds + runs the DS test suite
make run       # API on http://localhost:8080
curl localhost:8080/api/donations        # priority-queue (urgency) order
curl -X POST localhost:8080/api/donations \
  -d '{"title":"Idli Tray","quantity":25,"location":"Kozhikode","expires_in":90}'
curl localhost:8080/api/graph/bfs?from=0 # distribution paths
```

Endpoints: `/api/health`, `/api/donations`, `/api/requests`,
`/api/requests/claim`, `/api/history`, `/api/bst`, `/api/bst/search?id=`,
`/api/route`, `/api/graph/bfs`, `/api/graph/dfs`.

### The same C runs in the browser
`public/ds.wasm` is the **same `ds.c`** compiled with clang to WebAssembly
(rebuild with `./c-backend/build-wasm.sh <wasi-sdk-dir>`):

- **DS Lab** (`/ds`) drives stack/queue/heap/list/BST/graph operations through
  the compiled C module and prints the engine's own trace log.
- **Browse** (`/browse`) orders the live board through the C min-heap and
  resolves id searches with the C binary search tree.

Records and auth live in Convex (the platform's managed backend) using the same
function contracts as the C API — `c-backend/README.md` has the endpoint table.

## Web app routes

| Route | Access | What it shows |
| --- | --- | --- |
| `/` | public | Landing: hero, live urgency board, features, DS showcase |
| `/auth` | public | Passwordless email OTP sign-in + role choice |
| `/dashboard` | signed in | Role-aware workspace: donor / NGO / admin panel |
| `/donate` | signed in | Add food donation (BST insert + heap insert) |
| `/browse` | signed in | Request food — PQ-ordered board, BST id search |
| `/track` | signed in | Linked-list delivery timeline + route map |
| `/profile` | signed in | Profile settings + role switcher |
| `/ds` | public | **C Engine Lab** — interactive DS visualizer |
| `/about` | public | Mission, rules, cheat-sheet table, tech stack |

## Rules enforced server-side

- Only **available, unclaimed, unexpired** donations can be requested.
- Donation states: `AVAILABLE → CLAIMED → COLLECTED → DISTRIBUTED`.
- Expiry must be later than "now"; quantity must be positive.
- Role checks: donors post, NGOs request, admins approve/complete.
- Requests are validated and enqueued **FIFO**; ids are checked for uniqueness
  by inserting into a **BST** before allocation.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "FoodShare needs its backend URL" | Set `VITE_CONVEX_URL` in `.env` (Keys / API keys tab) |
| Blank page in dev | Check the browser console; `bunx convex dev --once && bunx tsc -b --noEmit` |
| "Did you forget to run convex dev?" | Start Terminal A: `bun convex dev` |
| Convex auth / login prompt | `bunx convex login`, then re-run `bun convex dev` |
| Edited `c-backend/ds.c` but UI unchanged | Rebuild: `./c-backend/build-wasm.sh <wasi-sdk-dir>` |
| Port 5173/8080 busy | Stop the other process or change the port in `vite.config.ts` |
