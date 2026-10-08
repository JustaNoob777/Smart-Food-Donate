/*
 * FoodShare — data structures library (C backend)
 * -----------------------------------------------
 * Every structure the project requirement asks for, implemented from scratch
 * with no libc dependency, so the exact same source compiles twice:
 *
 *   1. natively with gcc  -> c-backend/foodshare-server (HTTP API backend)
 *   2. to WebAssembly     -> public/ds.wasm (engine the web page executes)
 *
 * Structures
 *   Stack        (LIFO)  — recent actions history
 *   Queue        (FIFO)  — pending collection requests in arrival order
 *   PriorityQueue        — donations ordered by expiry (most urgent first)
 *   LinkedList           — flexible donor/recipient entries & delivery routes
 *   BinarySearchTree     — fast lookup of donations by id
 *   Graph + BFS/DFS      — connections between donors, hubs and NGOs
 *
 * All values are non-negative ints; -1 is used as the "empty/not found"
 * sentinel on read-only lookups. All structures are fixed-capacity so the
 * backend never mallocs (deterministic, embeddable, WASM friendly).
 */
#ifndef FOODSHARE_DS_H
#define FOODSHARE_DS_H

/* ------------------------------------------------------------------ */
/* Stack (LIFO)                                                       */
/* ------------------------------------------------------------------ */
#define STACK_CAP 64

typedef struct {
  int items[STACK_CAP];
  int top; /* number of elements; next push writes at items[top] */
} Stack;

void stack_init(Stack *s);
int stack_push(Stack *s, int v);       /* 0 ok, -1 overflow */
int stack_pop(Stack *s, int *out);     /* 0 ok, -1 empty    */
int stack_peek(const Stack *s, int *out);
int stack_size(const Stack *s);
int stack_is_empty(const Stack *s);
int stack_at(const Stack *s, int i);   /* 0 = bottom, size-1 = top; -1 if OOB */

/* ------------------------------------------------------------------ */
/* Queue (FIFO, circular buffer)                                      */
/* ------------------------------------------------------------------ */
#define QUEUE_CAP 64

typedef struct {
  int items[QUEUE_CAP];
  int head;
  int tail;
  int count;
} Queue;

void queue_init(Queue *q);
int queue_enqueue(Queue *q, int v);    /* 0 ok, -1 overflow */
int queue_dequeue(Queue *q, int *out); /* 0 ok, -1 empty    */
int queue_front(const Queue *q, int *out);
int queue_size(const Queue *q);
int queue_at(const Queue *q, int i);   /* 0 = front; -1 if OOB */

/* ------------------------------------------------------------------ */
/* Deque (double-ended queue) — dispatch lane                          */
/* ------------------------------------------------------------------ */
#define DEQUE_CAP 64
typedef struct {
  int items[DEQUE_CAP];
  int head;
  int count;
} Deque;
void deque_init(Deque *d);
int deque_push_front(Deque *d, int v);
int deque_push_back(Deque *d, int v);
int deque_pop_front(Deque *d, int *out);
int deque_pop_back(Deque *d, int *out);
int deque_size(const Deque *d);
int deque_at(const Deque *d, int i);

/* ------------------------------------------------------------------ */
/* Priority queue (binary min-heap) — lower priority = expires sooner  */
/* ------------------------------------------------------------------ */
#define PQ_CAP 64

typedef struct {
  int id;       /* donation id */
  int priority; /* minutes until expiry */
} PqItem;

typedef struct {
  PqItem items[PQ_CAP];
  int size;
} PriorityQueue;

void pq_init(PriorityQueue *pq);
int pq_insert(PriorityQueue *pq, int id, int priority); /* 0 ok, -1 full */
int pq_extract_min(PriorityQueue *pq, PqItem *out);     /* 0 ok, -1 empty */
int pq_peek(const PriorityQueue *pq, PqItem *out);
int pq_size(const PriorityQueue *pq);
const PqItem *pq_at(const PriorityQueue *pq, int i); /* raw heap array view */

/* ------------------------------------------------------------------ */
/* Singly linked list — route steps / donor chain (index-based nodes)  */
/* ------------------------------------------------------------------ */
#define LL_POOL_CAP 64

typedef struct {
  int value;
  int next; /* index of next node, -1 = tail */
} LLNode;

typedef struct {
  LLNode pool[LL_POOL_CAP];
  char used[LL_POOL_CAP];
  int head;
  int tail;
  int free_head;
  int size;
} LinkedList;

void ll_init(LinkedList *l);
int ll_push_front(LinkedList *l, int v); /* 0 ok, -1 full */
int ll_push_back(LinkedList *l, int v);
int ll_delete(LinkedList *l, int v);     /* 1 deleted, 0 not found */
int ll_contains(const LinkedList *l, int v);
int ll_size(const LinkedList *l);
int ll_at(const LinkedList *l, int i);   /* 0 = head; -1 if OOB */

/* ------------------------------------------------------------------ */
/* Binary search tree — index of donations by id (index-based nodes)   */
/* ------------------------------------------------------------------ */
#define BST_POOL_CAP 128

typedef struct {
  int key;
  int left;
  int right;
  int height; /* AVL balance metadata; leaf height is 0 */
} BstNode;

typedef struct {
  BstNode pool[BST_POOL_CAP];
  char used[BST_POOL_CAP];
  int root;
  int free_head;
  int size;
} BST;

void bst_init(BST *t);
int bst_insert(BST *t, int key);        /* 0 ok, 1 duplicate, -1 full */
int bst_contains(const BST *t, int key);
int bst_delete(BST *t, int key);        /* 1 deleted, 0 not found */
int bst_size(const BST *t);
int bst_height(const BST *t);           /* balanced BST: single node = 0, empty = -1 */
int bst_search_depth(const BST *t, int key); /* depth of hit (root=0), -1 miss */
int bst_inorder(const BST *t, int *out, int cap); /* ascending; returns count */
int bst_preorder(const BST *t, int *out, int cap);
void bst_clear(BST *t);

/* ------------------------------------------------------------------ */
/* Graph — donor/hub/NGO connections, BFS + DFS traversal              */
/* ------------------------------------------------------------------ */
#define GRAPH_MAX_NODES 16

typedef struct {
  int adj[GRAPH_MAX_NODES][GRAPH_MAX_NODES];
  int n;
} Graph;

void graph_init(Graph *g, int n);                       /* n <= GRAPH_MAX_NODES */
int graph_add_edge(Graph *g, int a, int b);             /* undirected; 0 ok, -1 bad */
int graph_has_edge(const Graph *g, int a, int b);
int graph_node_count(const Graph *g);
int graph_bfs(const Graph *g, int start, int *order, int cap); /* returns visited count */
int graph_dfs(const Graph *g, int start, int *order, int cap);

#endif /* FOODSHARE_DS_H */
