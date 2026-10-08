# FoodShare — C Backend

The core of this project is written in **C**: a dependency-free HTTP API server
(`server.c`) plus a freestanding data-structures library (`ds.c`) that powers it.

| File            | Purpose                                                            |
| --------------- | ------------------------------------------------------------------ |
| `ds.h` / `ds.c` | Stack, circular Queue, Deque, Priority Queue (binary min-heap), Singly Linked List, Binary Search Tree, Graph with BFS/DFS — written from scratch, **zero libc calls** |
| `server.c`      | POSIX socket HTTP server exposing the JSON API                    |
| `wasm_api.c`    | Same engine compiled to WebAssembly so the web page executes the **real C code** in the browser |
| `tests.c`       | Native test suite with 385 checks across six core structures       |

The native C server is the application's data backend. It starts empty so you
can add each donation yourself; records and structure contents live in memory
and reset when the server stops. The browser build runs the same `ds.c`
algorithms as WebAssembly for interactive visualization. The C Engine Lab loads
the current donations, requests, route, history, and distribution graph from the
server before showing the operations.

## Why each structure fits

| Structure | Food-sharing operation | Main operation cost |
| --- | --- | --- |
| Stack | Show the most recent system actions first. | Push and pop: O(1) |
| Circular queue | Preserve first-come request order. | Enqueue and dequeue: O(1) |
| Deque | Keep the live pickup order: expiring food is urgent by default, and admins can move a pickup to the front or back. | Push and pop at either end: O(1) |
| Min-heap | Select the donation with the earliest expiry. | Insert and remove minimum: O(log n) |
| Linked list | Keep ordered delivery route steps. | Append: O(1); search/delete: O(n) |
| Self-balancing BST | Index donation IDs and show search depth. | O(log n) search and update |
| Graph | Explore donor, hub, and NGO connections. | BFS/DFS: O(V²) with this small adjacency matrix |

The linked list and BST use fixed node pools with free lists, so node allocation
is O(1). The linked list also stores its tail, making route appends O(1). The
BST rebalances after insertions and deletions, avoiding a long chain when IDs
arrive in sorted order.

## Build & run

```bash
make          # builds ./foodshare-server
make test     # builds + runs the data-structures test suite
make run      # starts the API on http://localhost:8080
```

To use the browser screen with this native C server, open two terminals:

```bash
# Terminal 1: C program
make api

# Terminal 2: browser screen
npm run dev
```

Open `http://localhost:5173`. The existing UI pages talk directly to the native
C API. The demo profile is local to the browser and is only for navigation; it
is not production authentication. Records live in memory and reset when the C
server restarts. Set `VITE_C_API_URL` only if the server uses another URL.

## API endpoints (each backed by a data structure)

| Endpoint                    | Data structure | What it does                                    |
| --------------------------- | -------------- | ----------------------------------------------- |
| `GET  /api/donations`       | Priority Queue | Returns donations ordered by soonest expiry     |
| `POST /api/donations`       | BST + PQ       | Registers a donation: `bst_insert` + `pq_insert`|
| `GET  /api/requests`        | Queue (FIFO)   | Requests in arrival order                        |
| `GET  /api/dispatch`        | Deque          | Pending requests with urgent food first          |
| `POST /api/dispatch/reorder`| Deque          | Admin moves a pending pickup to the front or back |
| `POST /api/requests`        | Queue + BST    | Enqueues a request, claims donation via BST hit |
| `POST /api/requests/claim`  | Queue (FIFO)   | Dequeues the **oldest** request                 |
| `POST /api/requests/approve`| Deque          | Approves the next request in the live dispatch order |
| `POST /api/requests/advance`| Linked List    | Advances a delivery and updates donation status |
| `GET  /api/stats`           | Arrays         | Dashboard totals                                  |
| `GET  /api/stats/weekly`    | —              | Weekly meal totals from actual donations          |
| `GET  /api/history`         | Stack (LIFO)   | Recent actions, newest first                    |
| `GET  /api/bst`             | BST            | Size, height and ascending inorder traversal    |
| `GET  /api/bst/search?id=`  | BST            | Search a donation id and report the depth       |
| `GET  /api/route`           | Linked List    | Traverses the delivery route                    |
| `GET  /api/graph/bfs?from=` | Graph          | Breadth-first distribution matching             |
| `GET  /api/graph/dfs?from=` | Graph          | Depth-first exploration                         |
| `GET  /api/health`          | all            | Engine + structure report                       |

Example:

```bash
curl localhost:8080/api/donations
curl localhost:8080/api/dispatch
curl -X POST localhost:8080/api/donations \
  -d '{"title":"Idli Tray","quantity":25,"location":"Kozhikode","expires_in":90}'
curl localhost:8080/api/graph/bfs?from=0
```

## How the web app uses this code

The browser build of the **exact same `ds.c`** is shipped as `public/ds.wasm`
(produced from `wasm_api.c`). The *DS Lab* page drives the algorithms through
that compiled C module and prints the engine's trace. Donation, browse, request,
dashboard, and tracking screens use the native C API. Role selection is a local
demo convenience; the backend is intended for self-study on one machine, not
internet-facing multi-user use. The separate shared demo passwords are only
for local demonstration and do not secure the C API.
