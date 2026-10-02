# FoodShare — Smart Food Donation & Distribution System

A web app for **SDG 2 · Zero Hunger** that connects food donors (restaurants,
hostels, shops, individuals) with NGOs and volunteers who redistribute surplus
to people in need — built as a data-structures project where **every required
structure does real work**.

**Backend: C** · **Frontend: web (React + Convex)** · **Theme: Claymorphism**

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

The hosted preview stores records with Convex (the platform's managed backend)
using the same function contracts as the C API — `c-backend/README.md` has the
full endpoint table.

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

## Getting started

```bash
bun install
bun convex dev --once     # codegen + push Convex functions
bun tsc -b --noEmit       # typecheck
bun run dev               # web app
```
