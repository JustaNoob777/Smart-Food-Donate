# FoodShare — Smart Food Donation & Distribution System

A web app for **SDG 2 · Zero Hunger** that connects food donors (restaurants,
hostels, shops, individuals) with NGOs and volunteers who redistribute surplus
to people in need — built as a data-structures project where **every required
structure does real work**.

**Backend: C** · **Frontend: React + TypeScript** · **Theme: Claymorphism**

## C-first self-study demo

The native C program is the core. The browser is a friendly interface to its
HTTP API. Three fixed demo accounts use local passwords; there is no email
verification or production authentication.

---

## Quick start

### Prerequisites
| Tool | Needed for | Check |
| --- | --- | --- |
| Node.js 20+ with npm | web app | `node --version` |
| gcc + make | C backend & tests | `gcc --version` |

### Install

```bash
npm ci
```

### Run — two terminals

```bash
# Terminal 1 — native C backend
make api
```

```bash
# Terminal 2 — browser interface
npm run dev
```

Open `http://localhost:5173`. The C server starts with an empty board. Sign in
as the donor, NGO, or admin demo account, then add donations manually. The main screens and `/c-demo`
use the native C server at `localhost:8080`. No `.env` file or remote account
is required. Records reset when the C server stops.

Demo sign-ins: `donor` / `donor123`, `ngo` / `ngo123`, and `admin` /
`admin123`. Each has a separate identity; all three see the same donation board.

Useful commands: `make check`, `make test`, `make api`, and `make web`.

---

## Data structures → product features

| Structure | Role in the product | Example operation |
| --- | --- | --- |
| **Circular queue (FIFO)** | Pending collection requests, served oldest-first with reusable buffer slots | `queue_enqueue` / `queue_dequeue` |
| **Priority queue** (binary min-heap) | Orders available donations by expiry — soonest spoils first | `pq_insert` / `pq_extract_min` |
| **Stack (LIFO)** | Recent-actions history feed | `stack_push` / `stack_pop` |
| **Linked list** | Delivery route steps (received → assigned → picked up → in transit → delivered) | `ll_push_back` / `ll_delete` |
| **Binary search tree** | Donation index by integer id, with reported search depth | `bst_insert` / `bst_search` |
| **Deque** | Dispatch lane: urgent requests at the front, routine requests at the back | `deque_push_front` / `deque_push_back` |
| **Graph + BFS/DFS** | Donor ↔ hub ↔ NGO distribution network | `graph_bfs` / `graph_dfs` |

## The C backend (`c-backend/`)

| File | Purpose |
| --- | --- |
| `ds.h` / `ds.c` | Stack, circular queue, deque, heap, linked list, BST and graph, written from scratch, **zero libc calls** |
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
curl localhost:8080/api/dispatch         # deque urgent-first view
curl -X POST localhost:8080/api/donations \
  -d '{"title":"Idli Tray","quantity":25,"location":"Kozhikode","expires_in":90}'
curl localhost:8080/api/graph/bfs?from=0 # distribution paths
```

Endpoints: `/api/health`, `/api/donations`, `/api/requests`, `/api/dispatch`,
`/api/requests/claim`, `/api/history`, `/api/bst`, `/api/bst/search?id=`,
`/api/route`, `/api/graph/bfs`, `/api/graph/dfs`.

### The same C runs in the browser
`public/ds.wasm` is the **same `ds.c`** compiled with clang to WebAssembly
(rebuild with `./c-backend/build-wasm.sh <wasi-sdk-dir>`):

- **DS Lab** (`/ds`) drives stack/queue/deque/heap/list/BST/graph operations through
  the compiled C module and prints the engine's own trace log.
- **Donate** (`/donate`) sends the saved donation id through the C BST and expiry heap.
- **Browse** (`/browse`) orders the live board through the C min-heap, resolves id
  searches with the C BST, and records successful requests in the C queue/deque.
- **Track** (`/track`) orders pending dispatches through the C deque and advances
  delivery steps in the C linked list.
- Every signed-in page has a collapsible **C engine** trace showing operations
  emitted by the compiled C module during product actions.

The main pages call the native C HTTP server for records and operations. The
interactive DS Lab also runs the same `ds.c` algorithms as WebAssembly in the
browser. Demo identity and role are kept in local browser storage; this is for
local study and does not provide production authentication or multi-user
security. The C server keeps records in memory, so its data resets on restart.

## Web app routes

| Route | Access | What it shows |
| --- | --- | --- |
| `/` | public | Landing: hero, live urgency board, features, DS showcase |
| `/auth` | public | Donor, NGO, and admin demo sign-in |
| `/dashboard` | demo profile | Role-aware workspace: donor / NGO / coordinator panel |
| `/donate` | demo profile | Add food donation (BST insert + heap insert) |
| `/browse` | demo profile | Request food — PQ-ordered board, BST id search |
| `/track` | demo profile | Linked-list delivery timeline + route map |
| `/profile` | demo profile | Profile settings; sign out to change account |
| `/c-demo` | public | Direct C backend operation screen |
| `/ds` | public | **C Engine Lab** — live FoodShare data with interactive C operations |
| `/about` | public | Mission, rules, cheat-sheet table, tech stack |

## Rules enforced by the C backend

- Only **available, unclaimed, unexpired** donations can be requested.
- Donation states: `AVAILABLE → CLAIMED → COLLECTED → DISTRIBUTED`.
- Expiry must be later than "now"; quantity must be positive.
- Separate donor, NGO, and admin demo accounts select their matching screens.
  Their shared passwords are for local study, not secure authentication.
- Requests are validated and enqueued **FIFO**; ids are checked for uniqueness
  by inserting into a **BST** before allocation.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Browser says the C backend is unavailable | Start it from the project root with `make api` |
| Cannot reach the C API from another host | Set `VITE_C_API_URL` in `.env` to the C server's address |
| Wrong demo account | Sign out, then enter the other account's username/password on `/auth` |
| Edited `c-backend/ds.c` but UI unchanged | Rebuild: `./c-backend/build-wasm.sh <wasi-sdk-dir>` |
| Port 5173/8080 busy | Stop the other process or change the port in `vite.config.ts` |
