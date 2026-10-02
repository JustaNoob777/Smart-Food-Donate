/*
 * FoodShare — data structures library implementation.
 * Freestanding: no stdio, no stdlib, no libc calls (compiles for gcc AND wasm).
 */
#include "ds.h"

/* =============================== Stack ============================ */

void stack_init(Stack *s) { s->top = 0; }

int stack_push(Stack *s, int v) {
  if (s->top >= STACK_CAP) return -1;
  s->items[s->top++] = v;
  return 0;
}

int stack_pop(Stack *s, int *out) {
  if (s->top <= 0) return -1;
  s->top--;
  if (out) *out = s->items[s->top];
  return 0;
}

int stack_peek(const Stack *s, int *out) {
  if (s->top <= 0) return -1;
  if (out) *out = s->items[s->top - 1];
  return 0;
}

int stack_size(const Stack *s) { return s->top; }

int stack_is_empty(const Stack *s) { return s->top == 0; }

int stack_at(const Stack *s, int i) {
  if (i < 0 || i >= s->top) return -1;
  return s->items[i];
}

/* =============================== Queue ============================ */

void queue_init(Queue *q) {
  q->head = 0;
  q->tail = 0;
  q->count = 0;
}

int queue_enqueue(Queue *q, int v) {
  if (q->count >= QUEUE_CAP) return -1;
  q->items[q->tail] = v;
  q->tail = (q->tail + 1) % QUEUE_CAP;
  q->count++;
  return 0;
}

int queue_dequeue(Queue *q, int *out) {
  if (q->count <= 0) return -1;
  if (out) *out = q->items[q->head];
  q->head = (q->head + 1) % QUEUE_CAP;
  q->count--;
  return 0;
}

int queue_front(const Queue *q, int *out) {
  if (q->count <= 0) return -1;
  if (out) *out = q->items[q->head];
  return 0;
}

int queue_size(const Queue *q) { return q->count; }

int queue_at(const Queue *q, int i) {
  if (i < 0 || i >= q->count) return -1;
  return q->items[(q->head + i) % QUEUE_CAP];
}

/* ========================== Priority queue ======================== */

static void pq_swap(PqItem *a, PqItem *b) {
  PqItem t = *a;
  *a = *b;
  *b = t;
}

void pq_init(PriorityQueue *pq) { pq->size = 0; }

int pq_insert(PriorityQueue *pq, int id, int priority) {
  int i;
  if (pq->size >= PQ_CAP) return -1;
  i = pq->size++;
  pq->items[i].id = id;
  pq->items[i].priority = priority;
  /* sift up: restore min-heap order */
  while (i > 0) {
    int p = (i - 1) / 2;
    if (pq->items[p].priority <= pq->items[i].priority) break;
    pq_swap(&pq->items[p], &pq->items[i]);
    i = p;
  }
  return 0;
}

static void pq_sift_down(PriorityQueue *pq, int i) {
  for (;;) {
    int l = 2 * i + 1;
    int r = l + 1;
    int m = i;
    if (l < pq->size && pq->items[l].priority < pq->items[m].priority) m = l;
    if (r < pq->size && pq->items[r].priority < pq->items[m].priority) m = r;
    if (m == i) break;
    pq_swap(&pq->items[m], &pq->items[i]);
    i = m;
  }
}

int pq_extract_min(PriorityQueue *pq, PqItem *out) {
  if (pq->size <= 0) return -1;
  if (out) *out = pq->items[0];
  pq->size--;
  if (pq->size > 0) {
    pq->items[0] = pq->items[pq->size];
    pq_sift_down(pq, 0);
  }
  return 0;
}

int pq_peek(const PriorityQueue *pq, PqItem *out) {
  if (pq->size <= 0) return -1;
  if (out) *out = pq->items[0];
  return 0;
}

int pq_size(const PriorityQueue *pq) { return pq->size; }

const PqItem *pq_at(const PriorityQueue *pq, int i) {
  if (i < 0 || i >= pq->size) return 0;
  return &pq->items[i];
}

/* =========================== Linked list ========================== */

static int ll_alloc(LinkedList *l) {
  int i;
  for (i = 0; i < LL_POOL_CAP; i++) {
    if (!l->used[i]) {
      l->used[i] = 1;
      l->pool[i].value = 0;
      l->pool[i].next = -1;
      return i;
    }
  }
  return -1;
}

void ll_init(LinkedList *l) {
  int i;
  l->head = -1;
  l->size = 0;
  for (i = 0; i < LL_POOL_CAP; i++) l->used[i] = 0;
}

int ll_push_front(LinkedList *l, int v) {
  int idx = ll_alloc(l);
  if (idx < 0) return -1;
  l->pool[idx].value = v;
  l->pool[idx].next = l->head;
  l->head = idx;
  l->size++;
  return 0;
}

int ll_push_back(LinkedList *l, int v) {
  int idx = ll_alloc(l);
  int cur;
  if (idx < 0) return -1;
  l->pool[idx].value = v;
  l->pool[idx].next = -1;
  if (l->head == -1) {
    l->head = idx;
  } else {
    cur = l->head;
    while (l->pool[cur].next != -1) cur = l->pool[cur].next;
    l->pool[cur].next = idx;
  }
  l->size++;
  return 0;
}

int ll_delete(LinkedList *l, int v) {
  int prev = -1;
  int cur = l->head;
  while (cur != -1) {
    if (l->pool[cur].value == v) {
      if (prev == -1) {
        l->head = l->pool[cur].next;
      } else {
        l->pool[prev].next = l->pool[cur].next;
      }
      l->used[cur] = 0;
      l->size--;
      return 1;
    }
    prev = cur;
    cur = l->pool[cur].next;
  }
  return 0;
}

int ll_contains(const LinkedList *l, int v) {
  int cur = l->head;
  while (cur != -1) {
    if (l->pool[cur].value == v) return 1;
    cur = l->pool[cur].next;
  }
  return 0;
}

int ll_size(const LinkedList *l) { return l->size; }

int ll_at(const LinkedList *l, int i) {
  int cur = l->head;
  int n = 0;
  if (i < 0 || i >= l->size) return -1;
  while (cur != -1) {
    if (n == i) return l->pool[cur].value;
    n++;
    cur = l->pool[cur].next;
  }
  return -1;
}

/* ========================= Binary search tree ===================== */

static int bst_alloc(BST *t) {
  int i;
  for (i = 0; i < BST_POOL_CAP; i++) {
    if (!t->used[i]) {
      t->used[i] = 1;
      t->pool[i].key = 0;
      t->pool[i].left = -1;
      t->pool[i].right = -1;
      return i;
    }
  }
  return -1;
}

void bst_init(BST *t) {
  int i;
  t->root = -1;
  t->size = 0;
  for (i = 0; i < BST_POOL_CAP; i++) t->used[i] = 0;
}

void bst_clear(BST *t) { bst_init(t); }

int bst_insert(BST *t, int key) {
  int cur;
  if (t->root == -1) {
    int i = bst_alloc(t);
    if (i < 0) return -1;
    t->pool[i].key = key;
    t->root = i;
    t->size = 1;
    return 0;
  }
  cur = t->root;
  for (;;) {
    if (key == t->pool[cur].key) return 1; /* duplicate */
    if (key < t->pool[cur].key) {
      if (t->pool[cur].left == -1) {
        int n = bst_alloc(t);
        if (n < 0) return -1;
        t->pool[n].key = key;
        t->pool[cur].left = n;
        t->size++;
        return 0;
      }
      cur = t->pool[cur].left;
    } else {
      if (t->pool[cur].right == -1) {
        int n = bst_alloc(t);
        if (n < 0) return -1;
        t->pool[n].key = key;
        t->pool[cur].right = n;
        t->size++;
        return 0;
      }
      cur = t->pool[cur].right;
    }
  }
}

int bst_contains(const BST *t, int key) {
  int cur = t->root;
  while (cur != -1) {
    if (key == t->pool[cur].key) return 1;
    cur = (key < t->pool[cur].key) ? t->pool[cur].left : t->pool[cur].right;
  }
  return 0;
}

int bst_search_depth(const BST *t, int key) {
  int cur = t->root;
  int depth = 0;
  while (cur != -1) {
    if (key == t->pool[cur].key) return depth;
    cur = (key < t->pool[cur].key) ? t->pool[cur].left : t->pool[cur].right;
    depth++;
  }
  return -1;
}

static int bst_delete_rec(BST *t, int *slot, int key) {
  int cur = *slot;
  if (cur == -1) return 0;
  if (key < t->pool[cur].key) return bst_delete_rec(t, &t->pool[cur].left, key);
  if (key > t->pool[cur].key) return bst_delete_rec(t, &t->pool[cur].right, key);

  if (t->pool[cur].left == -1 && t->pool[cur].right == -1) {
    *slot = -1;
  } else if (t->pool[cur].left == -1) {
    *slot = t->pool[cur].right;
  } else if (t->pool[cur].right == -1) {
    *slot = t->pool[cur].left;
  } else {
    /* two children: replace key with inorder successor (leftmost of right) */
    int parent = cur;
    int succ = t->pool[cur].right;
    int *succ_slot;
    while (t->pool[succ].left != -1) {
      parent = succ;
      succ = t->pool[succ].left;
    }
    t->pool[cur].key = t->pool[succ].key;
    succ_slot = (parent == cur) ? &t->pool[cur].right : &t->pool[parent].left;
    *succ_slot = t->pool[succ].right;
    t->used[succ] = 0;
    t->size--;
    return 1;
  }
  t->used[cur] = 0;
  t->size--;
  return 1;
}

int bst_delete(BST *t, int key) { return bst_delete_rec(t, &t->root, key); }

int bst_size(const BST *t) { return t->size; }

static int bst_height_rec(const BST *t, int node) {
  int lh, rh;
  if (node == -1) return -1;
  lh = bst_height_rec(t, t->pool[node].left);
  rh = bst_height_rec(t, t->pool[node].right);
  return 1 + ((lh > rh) ? lh : rh);
}

int bst_height(const BST *t) { return bst_height_rec(t, t->root); }

static int bst_inorder_rec(const BST *t, int node, int *out, int cap, int n) {
  if (node == -1 || n >= cap) return n;
  n = bst_inorder_rec(t, t->pool[node].left, out, cap, n);
  if (n < cap) out[n++] = t->pool[node].key;
  n = bst_inorder_rec(t, t->pool[node].right, out, cap, n);
  return n;
}

int bst_inorder(const BST *t, int *out, int cap) {
  return bst_inorder_rec(t, t->root, out, cap, 0);
}

static int bst_preorder_rec(const BST *t, int node, int *out, int cap, int n) {
  if (node == -1 || n >= cap) return n;
  if (n < cap) out[n++] = t->pool[node].key;
  n = bst_preorder_rec(t, t->pool[node].left, out, cap, n);
  n = bst_preorder_rec(t, t->pool[node].right, out, cap, n);
  return n;
}

int bst_preorder(const BST *t, int *out, int cap) {
  return bst_preorder_rec(t, t->root, out, cap, 0);
}

/* ============================== Graph ============================= */

void graph_init(Graph *g, int n) {
  int i, j;
  if (n > GRAPH_MAX_NODES) n = GRAPH_MAX_NODES;
  if (n < 0) n = 0;
  g->n = n;
  for (i = 0; i < GRAPH_MAX_NODES; i++)
    for (j = 0; j < GRAPH_MAX_NODES; j++) g->adj[i][j] = 0;
}

int graph_add_edge(Graph *g, int a, int b) {
  if (a < 0 || b < 0 || a >= g->n || b >= g->n || a == b) return -1;
  g->adj[a][b] = 1;
  g->adj[b][a] = 1;
  return 0;
}

int graph_has_edge(const Graph *g, int a, int b) {
  if (a < 0 || b < 0 || a >= g->n || b >= g->n) return 0;
  return g->adj[a][b];
}

int graph_node_count(const Graph *g) { return g->n; }

int graph_bfs(const Graph *g, int start, int *order, int cap) {
  int visited[GRAPH_MAX_NODES];
  int q[GRAPH_MAX_NODES];
  int qh = 0, qt = 0;
  int count = 0;
  int i;
  if (start < 0 || start >= g->n || cap <= 0) return 0;
  for (i = 0; i < g->n; i++) visited[i] = 0;

  visited[start] = 1;
  q[qt++] = start;
  while (qh < qt && count < cap) {
    int u = q[qh++];
    order[count++] = u;
    for (i = 0; i < g->n; i++) {
      if (g->adj[u][i] && !visited[i]) {
        visited[i] = 1;
        if (qt < GRAPH_MAX_NODES) q[qt++] = i;
      }
    }
  }
  return count;
}

static void graph_dfs_rec(const Graph *g, int u, int *visited, int *order,
                          int cap, int *count) {
  int i;
  if (*count >= cap) return;
  visited[u] = 1;
  order[(*count)++] = u;
  for (i = 0; i < g->n; i++) {
    if (g->adj[u][i] && !visited[i]) graph_dfs_rec(g, i, visited, order, cap, count);
  }
}

int graph_dfs(const Graph *g, int start, int *order, int cap) {
  int visited[GRAPH_MAX_NODES];
  int count = 0;
  int i;
  if (start < 0 || start >= g->n || cap <= 0) return 0;
  for (i = 0; i < g->n; i++) visited[i] = 0;
  graph_dfs_rec(g, start, visited, order, cap, &count);
  return count;
}
