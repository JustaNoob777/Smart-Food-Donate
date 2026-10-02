/*
 * FoodShare — data structures test suite (native).
 * Build & run:  make test
 * Every structure gets happy-path, boundary and failure-path coverage.
 */
#include <stdio.h>
#include "ds.h"

static int checks = 0;

#define CHECK(cond)                                                          \
  do {                                                                       \
    checks++;                                                                \
    if (!(cond)) {                                                           \
      printf("FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);                \
      return 1;                                                              \
    }                                                                        \
  } while (0)

/* ------------------------------- Stack ---------------------------- */
static int test_stack(void) {
  Stack s;
  int v = -1;
  int i;
  stack_init(&s);
  CHECK(stack_is_empty(&s));
  CHECK(stack_pop(&s, &v) == -1);          /* underflow guarded */
  CHECK(stack_peek(&s, &v) == -1);

  CHECK(stack_push(&s, 10) == 0);
  CHECK(stack_push(&s, 20) == 0);
  CHECK(stack_push(&s, 30) == 0);
  CHECK(stack_size(&s) == 3);
  CHECK(stack_peek(&s, &v) == 0 && v == 30);
  CHECK(stack_pop(&s, &v) == 0 && v == 30); /* LIFO */
  CHECK(stack_pop(&s, &v) == 0 && v == 20);
  CHECK(stack_pop(&s, &v) == 0 && v == 10);
  CHECK(stack_pop(&s, &v) == -1);

  for (i = 0; i < STACK_CAP; i++) CHECK(stack_push(&s, i) == 0);
  CHECK(stack_push(&s, 999) == -1);        /* overflow guarded */
  CHECK(stack_at(&s, 0) == 0);
  CHECK(stack_at(&s, STACK_CAP - 1) == STACK_CAP - 1);
  CHECK(stack_at(&s, STACK_CAP) == -1);
  return 0;
}

/* ------------------------------- Queue ---------------------------- */
static int test_queue(void) {
  Queue q;
  int v = -1;
  int i;
  queue_init(&q);
  CHECK(queue_size(&q) == 0);
  CHECK(queue_dequeue(&q, &v) == -1);
  CHECK(queue_front(&q, &v) == -1);

  CHECK(queue_enqueue(&q, 101) == 0);
  CHECK(queue_enqueue(&q, 102) == 0);
  CHECK(queue_enqueue(&q, 103) == 0);
  CHECK(queue_front(&q, &v) == 0 && v == 101);
  CHECK(queue_dequeue(&q, &v) == 0 && v == 101); /* FIFO */
  CHECK(queue_dequeue(&q, &v) == 0 && v == 102);

  /* exercise the circular buffer wrap-around */
  for (i = 0; i < QUEUE_CAP - 1; i++) CHECK(queue_enqueue(&q, 200 + i) == 0);
  CHECK(queue_enqueue(&q, 999) == -1);      /* overflow guarded */
  CHECK(queue_front(&q, &v) == 0 && v == 103);
  CHECK(queue_at(&q, 0) == 103);
  CHECK(queue_at(&q, queue_size(&q) - 1) == 200 + QUEUE_CAP - 2);
  CHECK(queue_at(&q, queue_size(&q)) == -1);
  CHECK(queue_dequeue(&q, &v) == 0 && v == 103);
  return 0;
}

/* --------------------------- Priority queue ----------------------- */
static int test_pq(void) {
  PriorityQueue pq;
  PqItem it;
  int i;
  static const int prios[8] = {45, 5, 120, 1, 30, 60, 15, 90};
  int last;

  pq_init(&pq);
  CHECK(pq_size(&pq) == 0);
  CHECK(pq_extract_min(&pq, &it) == -1);
  CHECK(pq_peek(&pq, &it) == -1);

  for (i = 0; i < 8; i++) CHECK(pq_insert(&pq, 1000 + i, prios[i]) == 0);
  CHECK(pq_size(&pq) == 8);
  CHECK(pq_peek(&pq, &it) == 0 && it.priority == 1 && it.id == 1003);

  last = -1;
  for (i = 0; i < 8; i++) {                /* extract must be sorted ascending */
    CHECK(pq_extract_min(&pq, &it) == 0);
    CHECK(it.priority >= last);
    last = it.priority;
  }
  CHECK(pq_size(&pq) == 0);
  CHECK(pq_extract_min(&pq, &it) == -1);

  for (i = 0; i < PQ_CAP; i++) CHECK(pq_insert(&pq, i, PQ_CAP - i) == 0);
  CHECK(pq_insert(&pq, 999, 1) == -1);      /* full heap guarded */
  CHECK(pq_at(&pq, 0)->priority == 1);
  CHECK(pq_at(&pq, PQ_CAP) == 0);
  return 0;
}

/* ----------------------------- Linked list ------------------------ */
static int test_linked_list(void) {
  LinkedList l;
  ll_init(&l);
  CHECK(ll_size(&l) == 0);
  CHECK(ll_at(&l, 0) == -1);
  CHECK(ll_delete(&l, 7) == 0);

  CHECK(ll_push_back(&l, 20) == 0);
  CHECK(ll_push_back(&l, 30) == 0);
  CHECK(ll_push_front(&l, 10) == 0);
  CHECK(ll_size(&l) == 3);
  CHECK(ll_at(&l, 0) == 10 && ll_at(&l, 1) == 20 && ll_at(&l, 2) == 30);
  CHECK(ll_contains(&l, 20) == 1);
  CHECK(ll_contains(&l, 99) == 0);

  CHECK(ll_delete(&l, 20) == 1);            /* middle node */
  CHECK(ll_size(&l) == 2);
  CHECK(ll_at(&l, 1) == 30);
  CHECK(ll_delete(&l, 10) == 1);            /* head node */
  CHECK(ll_delete(&l, 30) == 1);            /* last node */
  CHECK(ll_size(&l) == 0 && ll_at(&l, 0) == -1);

  { /* pool exhaustion is reported, not crashed on */
    int i;
    for (i = 0; i < LL_POOL_CAP; i++) CHECK(ll_push_back(&l, i) == 0);
    CHECK(ll_push_back(&l, 12345) == -1);
  }
  return 0;
}

/* ------------------------------- BST ------------------------------ */
static int test_bst(void) {
  BST t;
  int out[32];
  int n;
  bst_init(&t);
  CHECK(bst_size(&t) == 0);
  CHECK(bst_height(&t) == -1);
  CHECK(bst_contains(&t, 5) == 0);
  CHECK(bst_delete(&t, 5) == 0);

  CHECK(bst_insert(&t, 50) == 0);
  CHECK(bst_insert(&t, 30) == 0);
  CHECK(bst_insert(&t, 70) == 0);
  CHECK(bst_insert(&t, 20) == 0);
  CHECK(bst_insert(&t, 40) == 0);
  CHECK(bst_insert(&t, 60) == 0);
  CHECK(bst_insert(&t, 80) == 0);
  CHECK(bst_insert(&t, 40) == 1);           /* duplicate rejected */
  CHECK(bst_size(&t) == 7);
  CHECK(bst_height(&t) == 2);

  CHECK(bst_contains(&t, 40) == 1);
  CHECK(bst_contains(&t, 45) == 0);
  CHECK(bst_search_depth(&t, 40) == 2);     /* 50 -> 30 -> 40 */
  CHECK(bst_search_depth(&t, 45) == -1);

  n = bst_inorder(&t, out, 32);             /* inorder must be ascending */
  CHECK(n == 7);
  CHECK(out[0] == 20 && out[1] == 30 && out[2] == 40 && out[3] == 50);
  CHECK(out[4] == 60 && out[5] == 70 && out[6] == 80);

  CHECK(bst_delete(&t, 20) == 1);           /* leaf */
  CHECK(bst_delete(&t, 30) == 1);           /* one child (after leaf gone) */
  CHECK(bst_delete(&t, 50) == 1);           /* two children (root) */
  CHECK(bst_size(&t) == 4);
  CHECK(bst_contains(&t, 50) == 0);

  n = bst_inorder(&t, out, 32);
  CHECK(n == 4);
  CHECK(out[0] == 40 && out[1] == 60 && out[2] == 70 && out[3] == 80);

  n = bst_preorder(&t, out, 32);
  CHECK(n == 4);
  CHECK(out[0] == 60);                      /* successor promoted to root */

  bst_clear(&t);
  CHECK(bst_size(&t) == 0);
  return 0;
}

/* ------------------------------- Graph ---------------------------- */
static int test_graph(void) {
  Graph g;
  int order[GRAPH_MAX_NODES];
  int n;

  graph_init(&g, 6);
  CHECK(graph_node_count(&g) == 6);
  CHECK(graph_add_edge(&g, 0, 2) == 0);
  CHECK(graph_add_edge(&g, 0, 1) == 0);
  CHECK(graph_add_edge(&g, 2, 3) == 0);
  CHECK(graph_add_edge(&g, 2, 4) == 0);
  CHECK(graph_add_edge(&g, 3, 5) == 0);
  CHECK(graph_add_edge(&g, 9, 9) == -1);    /* out of range rejected */
  CHECK(graph_add_edge(&g, 0, 6) == -1);
  CHECK(graph_has_edge(&g, 0, 2) == 1);
  CHECK(graph_has_edge(&g, 1, 5) == 0);

  n = graph_bfs(&g, 0, order, GRAPH_MAX_NODES); /* breadth-first from donor */
  CHECK(n == 6);
  CHECK(order[0] == 0);
  CHECK(order[1] == 1 && order[2] == 2);    /* level order */
  CHECK(order[3] == 3 && order[4] == 4);

  n = graph_dfs(&g, 0, order, GRAPH_MAX_NODES);
  CHECK(n == 6);
  CHECK(order[0] == 0);
  CHECK(graph_bfs(&g, 42, order, GRAPH_MAX_NODES) == 0); /* bad start */
  return 0;
}

int main(void) {
  int failed = 0;
  failed += test_stack();
  failed += test_queue();
  failed += test_pq();
  failed += test_linked_list();
  failed += test_bst();
  failed += test_graph();

  if (failed) {
    printf("ds_tests: %d check(s) FAILED\n", checks);
    return 1;
  }
  printf("ds_tests: ALL TESTS PASSED (%d checks across 6 data structures)\n", checks);
  return 0;
}
