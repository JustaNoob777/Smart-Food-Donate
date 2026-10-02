/*
 * FoodShare — WebAssembly bindings for the C data-structure engine.
 *
 * This file exposes ds.c to JavaScript through a flat, integer-only ABI:
 *   - every operation is traced into a ring-style text log the UI can read,
 *   - a small bump arena provides buffers for JS <-> C data exchange.
 *
 * Built with:  clang --target=wasm32-unknown-unknown -nostdlib ... ds.c wasm_api.c
 * Native builds compile this file to an empty object (guarded by __wasm__).
 */
#ifdef __wasm__

#include <stddef.h>
#include "ds.h"

#define WASM_EXPORT(name) __attribute__((export_name(name)))

/* Freestanding mem primitives: the compiler may emit calls to these even
 * though the module links without libc. */
void *memcpy(void *dst, const void *src, size_t n) {
  unsigned char *d = (unsigned char *)dst;
  const unsigned char *s = (const unsigned char *)src;
  while (n--) *d++ = *s++;
  return dst;
}
void *memmove(void *dst, const void *src, size_t n) {
  unsigned char *d = (unsigned char *)dst;
  const unsigned char *s = (const unsigned char *)src;
  if (d < s) {
    while (n--) *d++ = *s++;
  } else if (d > s) {
    d += n;
    s += n;
    while (n--) *--d = *--s;
  }
  return dst;
}
void *memset(void *dst, int c, size_t n) {
  unsigned char *d = (unsigned char *)dst;
  while (n--) *d++ = (unsigned char)c;
  return dst;
}

/* ------------------------------------------------------------------ */
/* Operation trace log                                                 */
/* ------------------------------------------------------------------ */
#define TRACE_CAP 4096
static char trace_buf[TRACE_CAP];
static int trace_len = 0;

static void t_putc(char c) {
  if (trace_len < TRACE_CAP - 1) trace_buf[trace_len++] = c;
}
static void t_str(const char *s) {
  while (*s) t_putc(*s++);
}
static void t_int(int v) {
  char tmp[12];
  int n = 0;
  int neg = 0;
  if (v == 0) {
    t_putc('0');
    return;
  }
  if (v < 0) {
    neg = 1;
    v = -v;
  }
  while (v > 0 && n < 11) {
    tmp[n++] = (char)('0' + (v % 10));
    v /= 10;
  }
  if (neg) t_putc('-');
  while (n > 0) t_putc(tmp[--n]);
}
static void t_nl(void) {
  if (trace_len > (TRACE_CAP * 3) / 4) {
    trace_len = 0;
    t_str("[trace buffer recycled]\n");
  }
  t_putc('\n');
}

/* ------------------------------------------------------------------ */
/* Shared state + arena                                                */
/* ------------------------------------------------------------------ */
static Stack g_stack;
static Queue g_queue;
static PriorityQueue g_pq;
static LinkedList g_ll;
static BST g_bst;
static Graph g_graph;
static int g_last_pq_id = -1;
static int g_last_pq_prio = -1;

#define ARENA_CAP (512 * 1024)
static unsigned char arena[ARENA_CAP];
static int arena_off = 0;

static int ptr_to_i(void *p) { return (int)(size_t)p; }
static void *i_to_ptr(int i) { return (void *)(size_t)(unsigned int)i; }

WASM_EXPORT("c_alloc") int c_alloc(int bytes) {
  int ptr;
  if (bytes <= 0) return 0;
  bytes = (bytes + 7) & ~7;
  if (arena_off + bytes > ARENA_CAP) return 0;
  ptr = ptr_to_i(arena + arena_off);
  arena_off += bytes;
  return ptr;
}

WASM_EXPORT("c_arena_reset") void c_arena_reset(void) { arena_off = 0; }

WASM_EXPORT("c_trace_ptr") int c_trace_ptr(void) { return ptr_to_i(trace_buf); }
WASM_EXPORT("c_trace_len") int c_trace_len(void) { return trace_len; }
WASM_EXPORT("c_trace_clear") void c_trace_clear(void) { trace_len = 0; }

WASM_EXPORT("c_engine_name") int c_engine_name(void) {
  return ptr_to_i("FoodShare C/DS engine (ds.c compiled to WebAssembly)");
}

WASM_EXPORT("c_engine_reset") void c_engine_reset(void) {
  stack_init(&g_stack);
  queue_init(&g_queue);
  pq_init(&g_pq);
  ll_init(&g_ll);
  bst_init(&g_bst);
  graph_init(&g_graph, 0);
  g_last_pq_id = -1;
  g_last_pq_prio = -1;
  trace_len = 0;
  t_str("c_engine_reset(): stack, queue, priority queue, linked list, BST and graph cleared");
  t_nl();
}

/* ------------------------------------------------------------------ */
/* Stack                                                               */
/* ------------------------------------------------------------------ */
WASM_EXPORT("c_stack_push") int c_stack_push(int v) {
  int r = stack_push(&g_stack, v);
  t_str("stack_push(");
  t_int(v);
  t_str(") -> ");
  if (r == 0) {
    t_str("pushed at index ");
    t_int(stack_size(&g_stack) - 1);
    t_str(", size=");
    t_int(stack_size(&g_stack));
  } else {
    t_str("OVERFLOW (capacity ");
    t_int(STACK_CAP);
    t_str(")");
  }
  t_nl();
  return r;
}

WASM_EXPORT("c_stack_pop") int c_stack_pop(void) {
  int out = -1;
  int r = stack_pop(&g_stack, &out);
  t_str("stack_pop() -> ");
  if (r == 0) {
    t_str("popped ");
    t_int(out);
    t_str(", size=");
    t_int(stack_size(&g_stack));
  } else {
    t_str("UNDERFLOW (stack empty)");
  }
  t_nl();
  return (r == 0) ? out : -1;
}

WASM_EXPORT("c_stack_peek") int c_stack_peek(void) {
  int out = -1;
  int r = stack_peek(&g_stack, &out);
  t_str("stack_peek() -> ");
  if (r == 0) t_int(out);
  else t_str("EMPTY");
  t_nl();
  return (r == 0) ? out : -1;
}

WASM_EXPORT("c_stack_size") int c_stack_size(void) { return stack_size(&g_stack); }
WASM_EXPORT("c_stack_at") int c_stack_at(int i) { return stack_at(&g_stack, i); }
WASM_EXPORT("c_stack_clear") void c_stack_clear(void) {
  stack_init(&g_stack);
  t_str("stack_clear() -> size=0");
  t_nl();
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */
WASM_EXPORT("c_queue_enqueue") int c_queue_enqueue(int v) {
  int r = queue_enqueue(&g_queue, v);
  t_str("queue_enqueue(");
  t_int(v);
  t_str(") -> ");
  if (r == 0) {
    t_str("added at tail, size=");
    t_int(queue_size(&g_queue));
  } else {
    t_str("OVERFLOW (capacity ");
    t_int(QUEUE_CAP);
    t_str(")");
  }
  t_nl();
  return r;
}

WASM_EXPORT("c_queue_dequeue") int c_queue_dequeue(void) {
  int out = -1;
  int r = queue_dequeue(&g_queue, &out);
  t_str("queue_dequeue() -> ");
  if (r == 0) {
    t_str("served head ");
    t_int(out);
    t_str(", size=");
    t_int(queue_size(&g_queue));
  } else {
    t_str("EMPTY (nothing pending)");
  }
  t_nl();
  return (r == 0) ? out : -1;
}

WASM_EXPORT("c_queue_front") int c_queue_front(void) {
  int out = -1;
  int r = queue_front(&g_queue, &out);
  t_str("queue_front() -> ");
  if (r == 0) t_int(out);
  else t_str("EMPTY");
  t_nl();
  return (r == 0) ? out : -1;
}

WASM_EXPORT("c_queue_size") int c_queue_size(void) { return queue_size(&g_queue); }
WASM_EXPORT("c_queue_at") int c_queue_at(int i) { return queue_at(&g_queue, i); }
WASM_EXPORT("c_queue_clear") void c_queue_clear(void) {
  queue_init(&g_queue);
  t_str("queue_clear() -> size=0");
  t_nl();
}

/* ------------------------------------------------------------------ */
/* Priority queue (min-heap on minutes-to-expiry)                      */
/* ------------------------------------------------------------------ */
WASM_EXPORT("c_pq_insert") int c_pq_insert(int id, int prio) {
  int r = pq_insert(&g_pq, id, prio);
  t_str("pq_insert(id=");
  t_int(id);
  t_str(", expires_in=");
  t_int(prio);
  t_str("m) -> ");
  if (r == 0) {
    t_str("sift-up done, heap size=");
    t_int(pq_size(&g_pq));
  } else {
    t_str("HEAP FULL");
  }
  t_nl();
  return r;
}

WASM_EXPORT("c_pq_extract") int c_pq_extract(void) {
  PqItem it;
  int r = pq_extract_min(&g_pq, &it);
  t_str("pq_extract_min() -> ");
  if (r == 0) {
    g_last_pq_id = it.id;
    g_last_pq_prio = it.priority;
    t_str("id=");
    t_int(it.id);
    t_str(" (expires in ");
    t_int(it.priority);
    t_str("m), heap size=");
    t_int(pq_size(&g_pq));
  } else {
    t_str("EMPTY (no pending donations)");
  }
  t_nl();
  return (r == 0) ? it.id : -1;
}

WASM_EXPORT("c_pq_extract_prio") int c_pq_extract_prio(void) { return g_last_pq_prio; }

WASM_EXPORT("c_pq_peek") int c_pq_peek(void) {
  PqItem it;
  int r = pq_peek(&g_pq, &it);
  return (r == 0) ? it.id : -1;
}
WASM_EXPORT("c_pq_peek_prio") int c_pq_peek_prio(void) {
  PqItem it;
  int r = pq_peek(&g_pq, &it);
  return (r == 0) ? it.priority : -1;
}
WASM_EXPORT("c_pq_size") int c_pq_size(void) { return pq_size(&g_pq); }
WASM_EXPORT("c_pq_id_at") int c_pq_id_at(int i) {
  const PqItem *it = pq_at(&g_pq, i);
  return it ? it->id : -1;
}
WASM_EXPORT("c_pq_prio_at") int c_pq_prio_at(int i) {
  const PqItem *it = pq_at(&g_pq, i);
  return it ? it->priority : -1;
}
WASM_EXPORT("c_pq_clear") void c_pq_clear(void) {
  pq_init(&g_pq);
  t_str("pq_clear() -> heap size=0");
  t_nl();
}

/* ------------------------------------------------------------------ */
/* Linked list                                                         */
/* ------------------------------------------------------------------ */
WASM_EXPORT("c_ll_push_front") int c_ll_push_front(int v) {
  int r = ll_push_front(&g_ll, v);
  t_str("ll_push_front(");
  t_int(v);
  t_str(") -> ");
  if (r == 0) { t_str("ok, size="); t_int(ll_size(&g_ll)); }
  else t_str("POOL FULL");
  t_nl();
  return r;
}

WASM_EXPORT("c_ll_push_back") int c_ll_push_back(int v) {
  int r = ll_push_back(&g_ll, v);
  t_str("ll_push_back(");
  t_int(v);
  t_str(") -> ");
  if (r == 0) { t_str("ok, size="); t_int(ll_size(&g_ll)); }
  else t_str("POOL FULL");
  t_nl();
  return r;
}

WASM_EXPORT("c_ll_delete") int c_ll_delete(int v) {
  int r = ll_delete(&g_ll, v);
  t_str("ll_delete(");
  t_int(v);
  t_str(") -> ");
  if (r == 1) { t_str("node unlinked, size="); t_int(ll_size(&g_ll)); }
  else t_str("NOT FOUND");
  t_nl();
  return r;
}

WASM_EXPORT("c_ll_contains") int c_ll_contains(int v) { return ll_contains(&g_ll, v); }
WASM_EXPORT("c_ll_size") int c_ll_size(void) { return ll_size(&g_ll); }
WASM_EXPORT("c_ll_at") int c_ll_at(int i) { return ll_at(&g_ll, i); }
WASM_EXPORT("c_ll_clear") void c_ll_clear(void) {
  ll_init(&g_ll);
  t_str("ll_clear() -> size=0");
  t_nl();
}

/* ------------------------------------------------------------------ */
/* Binary search tree                                                  */
/* ------------------------------------------------------------------ */
WASM_EXPORT("c_bst_insert") int c_bst_insert(int k) {
  int r = bst_insert(&g_bst, k);
  t_str("bst_insert(");
  t_int(k);
  t_str(") -> ");
  if (r == 0) {
    t_str("inserted, size=");
    t_int(bst_size(&g_bst));
    t_str(", height=");
    t_int(bst_height(&g_bst));
  } else if (r == 1) {
    t_str("DUPLICATE key rejected");
  } else {
    t_str("TREE FULL");
  }
  t_nl();
  return r;
}

WASM_EXPORT("c_bst_delete") int c_bst_delete(int k) {
  int r = bst_delete(&g_bst, k);
  t_str("bst_delete(");
  t_int(k);
  t_str(") -> ");
  if (r == 1) {
    t_str("removed, size=");
    t_int(bst_size(&g_bst));
  } else {
    t_str("NOT FOUND");
  }
  t_nl();
  return r;
}

WASM_EXPORT("c_bst_contains") int c_bst_contains(int k) { return bst_contains(&g_bst, k); }

WASM_EXPORT("c_bst_search") int c_bst_search(int k) {
  int cur = g_bst.root;
  int depth = 0;
  int found = -1;
  t_str("bst_search(");
  t_int(k);
  t_str("): ");
  if (cur == -1) {
    t_str("empty tree, NOT FOUND");
    t_nl();
    return -1;
  }
  for (;;) {
    int key = g_bst.pool[cur].key;
    if (k == key) {
      found = depth;
      t_str("node(");
      t_int(key);
      t_str(") MATCH, depth=");
      t_int(depth);
      break;
    }
    t_str("node(");
    t_int(key);
    t_str(") ");
    if (k < key) {
      t_str("go left -> ");
      cur = g_bst.pool[cur].left;
    } else {
      t_str("go right -> ");
      cur = g_bst.pool[cur].right;
    }
    if (cur == -1) {
      t_str("NULL: NOT FOUND after ");
      t_int(depth + 1);
      t_str(" step(s)");
      break;
    }
    depth++;
  }
  t_nl();
  return found;
}

WASM_EXPORT("c_bst_size") int c_bst_size(void) { return bst_size(&g_bst); }
WASM_EXPORT("c_bst_height") int c_bst_height(void) { return bst_height(&g_bst); }

WASM_EXPORT("c_bst_inorder") int c_bst_inorder(int out_ptr, int cap) {
  int n = bst_inorder(&g_bst, (int *)i_to_ptr(out_ptr), cap);
  t_str("bst_inorder() -> ");
  t_int(n);
  t_str(" key(s) written ascending");
  t_nl();
  return n;
}

WASM_EXPORT("c_bst_clear") void c_bst_clear(void) {
  bst_init(&g_bst);
  t_str("bst_clear() -> size=0");
  t_nl();
}

/* ------------------------------------------------------------------ */
/* Graph                                                               */
/* ------------------------------------------------------------------ */
static void t_order(const char *label, const int *order, int n) {
  int i;
  t_str(label);
  t_str(" -> ");
  for (i = 0; i < n; i++) {
    if (i) t_str(" ");
    t_int(order[i]);
  }
  t_str("  (");
  t_int(n);
  t_str(" visited)");
}

WASM_EXPORT("c_graph_reset") void c_graph_reset(int n) {
  graph_init(&g_graph, n);
  t_str("graph_reset(nodes=");
  t_int(n);
  t_str(")");
  t_nl();
}

WASM_EXPORT("c_graph_add_edge") int c_graph_add_edge(int a, int b) {
  int r = graph_add_edge(&g_graph, a, b);
  t_str("graph_add_edge(");
  t_int(a);
  t_str(", ");
  t_int(b);
  t_str(") -> ");
  if (r == 0) t_str("linked");
  else t_str("INVALID node id");
  t_nl();
  return r;
}

WASM_EXPORT("c_graph_edge") int c_graph_edge(int a, int b) { return graph_has_edge(&g_graph, a, b); }
WASM_EXPORT("c_graph_node_count") int c_graph_node_count(void) { return graph_node_count(&g_graph); }

WASM_EXPORT("c_graph_bfs") int c_graph_bfs(int start, int out_ptr, int cap) {
  int n = graph_bfs(&g_graph, start, (int *)i_to_ptr(out_ptr), cap);
  t_str("graph_bfs(");
  t_int(start);
  t_str(")");
  t_order("", (int *)i_to_ptr(out_ptr), n);
  t_nl();
  return n;
}

WASM_EXPORT("c_graph_dfs") int c_graph_dfs(int start, int out_ptr, int cap) {
  int n = graph_dfs(&g_graph, start, (int *)i_to_ptr(out_ptr), cap);
  t_str("graph_dfs(");
  t_int(start);
  t_str(")");
  t_order("", (int *)i_to_ptr(out_ptr), n);
  t_nl();
  return n;
}

#endif /* __wasm__ */
