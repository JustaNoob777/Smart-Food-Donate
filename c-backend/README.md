# FoodShare — C Backend

The core of this project is written in **C**: a dependency-free HTTP API server
(`server.c`) plus a freestanding data-structures library (`ds.c`) that powers it.

| File            | Purpose                                                            |
| --------------- | ------------------------------------------------------------------ |
| `ds.h` / `ds.c` | Stack, Queue, Priority Queue (binary min-heap), Singly Linked List, Binary Search Tree, Graph with BFS/DFS — written from scratch, **zero libc calls** |
| `server.c`      | POSIX socket HTTP server exposing the JSON API                    |
| `wasm_api.c`    | Same engine compiled to WebAssembly so the web page executes the **real C code** in the browser |
| `tests.c`       | Native test suite for all six structures                           |

## Build & run

```bash
make          # builds ./foodshare-server
make test     # builds + runs the data-structures test suite
make run      # starts the API on http://localhost:8080
```

## API endpoints (each backed by a data structure)

| Endpoint                    | Data structure | What it does                                    |
| --------------------------- | -------------- | ----------------------------------------------- |
| `GET  /api/donations`       | Priority Queue | Returns donations ordered by soonest expiry     |
| `POST /api/donations`       | BST + PQ       | Registers a donation: `bst_insert` + `pq_insert`|
| `GET  /api/requests`        | Queue (FIFO)   | Pending collection requests in arrival order    |
| `POST /api/requests`        | Queue + BST    | Enqueues a request, claims donation via BST hit |
| `POST /api/requests/claim`  | Queue (FIFO)   | Dequeues the **oldest** request                 |
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
curl -X POST localhost:8080/api/donations \
  -d '{"title":"Idli Tray","quantity":25,"location":"Kozhikode","expires_in":90}'
curl localhost:8080/api/graph/bfs?from=0
```

## How the web app uses this code

The browser build of the **exact same `ds.c`** is shipped as `public/ds.wasm`
(produced from `wasm_api.c`). The *DS Lab* page drives stack/queue/PQ/list/BST/graph
operations through that compiled C module and prints the engine's own trace log.
The Browse page orders live donations through the C priority queue and searches
donation ids with the C binary search tree.

The hosted preview stores records with Convex (the platform's managed backend)
while mirroring this API's functions; run `make run` locally to talk to the C
HTTP server directly — point the frontend at it with `VITE_C_API_URL`.
