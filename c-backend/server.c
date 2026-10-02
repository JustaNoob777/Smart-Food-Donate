/*
 * FoodShare — C backend HTTP server
 * ---------------------------------
 * A dependency-free POSIX socket server exposing the food-share API.
 * Every endpoint is backed by a real data structure from ds.c:
 *
 *   GET  /api/health             engine + structure report
 *   GET  /api/donations          donations ordered by the PRIORITY QUEUE
 *                                (soonest expiry first)
 *   POST /api/donations          register donation -> BST insert + PQ insert
 *   GET  /api/requests           pending requests in FIFO QUEUE order
 *   POST /api/requests           new request -> enqueue + mark CLAIMED
 *   POST /api/requests/claim     collect the OLDEST request (dequeue)
 *   GET  /api/history            recent actions from the STACK (newest first)
 *   GET  /api/bst                BST size / height / inorder traversal
 *   GET  /api/bst/search?id=N    BST search with reported depth
 *   GET  /api/route              delivery route via LINKED LIST traversal
 *   GET  /api/graph/bfs?from=0   distribution network BFS
 *   GET  /api/graph/dfs?from=0   distribution network DFS
 *
 * Build & run:  make && ./foodshare-server 8080
 */
#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#include "ds.h"

#define MAX_DONATIONS 128
#define MAX_REQUESTS 128
#define REQ_BUF 16384
#define RESP_BUF 131072

typedef struct {
  int id;
  char title[64];
  int quantity; /* meals */
  char location[48];
  long expires_at;
  char status[16];
  int ngo_id;
} Donation;

typedef struct {
  int id;
  int donation_id;
  int ngo_id;
  int quantity;
  char status[16];
  long created_at;
} Req;

static Donation donations[MAX_DONATIONS];
static int donation_count = 0;
static Req requests[MAX_REQUESTS];
static int request_count = 0;
static int next_id = 1001;

/* ---- the data structures that run this API ---- */
static BST donation_index;        /* BST: donation id -> exists            */
static PriorityQueue urgency;     /* PQ : id -> minutes until expiry       */
static Queue pending;             /* FIFO: request ids in arrival order    */
static Stack activity;            /* LIFO: recent actions                  */
static LinkedList route;          /* delivery route steps                  */
static Graph network;             /* donor / hub / NGO connections         */

/* ============================ helpers ============================= */

static void json_escape(const char *in, char *out, int cap) {
  int o = 0;
  for (; *in && o < cap - 2; in++) {
    if (*in == '"' || *in == '\\') {
      out[o++] = '\\';
      out[o++] = *in;
    } else if ((unsigned char)*in < 0x20) {
      out[o++] = ' ';
    } else {
      out[o++] = *in;
    }
  }
  out[o] = '\0';
}

static int json_int_field(const char *body, const char *key, int *out) {
  char pat[64];
  const char *p;
  snprintf(pat, sizeof(pat), "\"%s\"", key);
  p = strstr(body, pat);
  if (!p) return 0;
  p = strchr(p, ':');
  if (!p) return 0;
  p++;
  while (*p == ' ' || *p == '\t') p++;
  if (*p != '-' && (*p < '0' || *p > '9')) return 0;
  *out = atoi(p);
  return 1;
}

static int json_str_field(const char *body, const char *key, char *out, int cap) {
  char pat[64];
  const char *p, *q;
  int n = 0;
  snprintf(pat, sizeof(pat), "\"%s\"", key);
  p = strstr(body, pat);
  if (!p) return 0;
  p = strchr(p, ':');
  if (!p) return 0;
  p = strchr(p, '"');
  if (!p) return 0;
  p++;
  q = strchr(p, '"');
  if (!q) return 0;
  while (p < q && n < cap - 1) out[n++] = *p++;
  out[n] = '\0';
  return 1;
}

static const char *activity_text(int code) {
  switch (code) {
    case 1: return "Donation posted and indexed in the BST";
    case 2: return "Collection request enqueued (FIFO)";
    case 3: return "Request claimed by NGO";
    case 4: return "Food collected by volunteer";
    case 5: return "Food distributed to recipients";
    case 6: return "Urgency queue rebuilt from expiring donations";
    default: return "System event";
  }
}

/* ========================= response helpers ======================= */

static void send_json(int fd, int code, const char *status, const char *body) {
  char head[512];
  int n = snprintf(head, sizeof(head),
                   "HTTP/1.1 %d %s\r\n"
                   "Content-Type: application/json; charset=utf-8\r\n"
                   "Content-Length: %zu\r\n"
                   "Access-Control-Allow-Origin: *\r\n"
                   "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                   "Access-Control-Allow-Headers: Content-Type\r\n"
                   "Connection: close\r\n\r\n%s",
                   code, status, strlen(body), body);
  (void)!write(fd, head, (size_t)n);
}

static void sendf(int fd, int code, const char *status, const char *fmt, ...) {
  static char body[RESP_BUF];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(body, sizeof(body), fmt, ap);
  va_end(ap);
  send_json(fd, code, status, body);
}

/* ============================ endpoints =========================== */

static void ep_health(int fd) {
  sendf(fd, 200, "OK",
        "{\"engine\":\"c\",\"file\":\"ds.c\",\"donations\":%d,\"requests\":%d,"
        "\"structures\":{"
        "\"stack\":%d,\"queue\":%d,\"priorityQueue\":%d,\"linked_list\":%d,"
        "\"bst\":%d,\"graph_nodes\":%d}}",
        donation_count, request_count, stack_size(&activity), queue_size(&pending),
        pq_size(&urgency), ll_size(&route), bst_size(&donation_index),
        graph_node_count(&network));
}

/* GET /api/donations — ordered by the priority queue (soonest expiry first) */
static void ep_list_donations(int fd) {
  static char body[RESP_BUF];
  PriorityQueue copy = urgency;
  int pos = 0;
  int i;
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "[");
  while (pq_size(&copy) > 0 && pos < (int)sizeof(body) - 512) {
    PqItem it;
    pq_extract_min(&copy, &it);
    for (i = 0; i < donation_count; i++) {
      if (donations[i].id == it.id) {
        char title[128];
        json_escape(donations[i].title, title, sizeof(title));
        pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                        "%s{\"id\":%d,\"title\":\"%s\",\"quantity\":%d,"
                        "\"location\":\"%s\",\"expires_in_minutes\":%d,"
                        "\"status\":\"%s\",\"ngo_id\":%d}",
                        pos > 1 ? "," : "", donations[i].id, title,
                        donations[i].quantity, donations[i].location,
                        it.priority, donations[i].status, donations[i].ngo_id);
        break;
      }
    }
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]");
  send_json(fd, 200, "OK", body);
}

/* POST /api/donations — BST insert (index) + PQ insert (urgency) */
static void ep_create_donation(int fd, const char *body) {
  Donation *d;
  char title[64] = "Food donation";
  char location[48] = "Unspecified";
  int quantity = 0;
  int expires_in = 120;

  json_str_field(body, "title", title, sizeof(title));
  json_str_field(body, "location", location, sizeof(location));
  json_int_field(body, "quantity", &quantity);
  json_int_field(body, "expires_in", &expires_in);
  if (quantity <= 0) quantity = 1;
  if (expires_in <= 0) expires_in = 60;

  if (donation_count >= MAX_DONATIONS) {
    sendf(fd, 503, "Service Unavailable", "{\"error\":\"donation store full\"}");
    return;
  }
  d = &donations[donation_count++];
  d->id = next_id++;
  snprintf(d->title, sizeof(d->title), "%s", title);
  snprintf(d->location, sizeof(d->location), "%s", location);
  d->quantity = quantity;
  d->expires_at = (long)time(NULL) + expires_in * 60;
  snprintf(d->status, sizeof(d->status), "AVAILABLE");
  d->ngo_id = 0;

  bst_insert(&donation_index, d->id);
  pq_insert(&urgency, d->id, expires_in);
  stack_push(&activity, 1);

  sendf(fd, 201, "Created",
        "{\"id\":%d,\"status\":\"AVAILABLE\",\"bst_size\":%d,\"heap_size\":%d}",
        d->id, bst_size(&donation_index), pq_size(&urgency));
}

/* GET /api/requests — FIFO queue order (oldest first) */
static void ep_list_requests(int fd) {
  static char body[RESP_BUF];
  int pos = 0;
  int i, j;
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "[");
  for (i = 0; i < queue_size(&pending); i++) {
    int rid = queue_at(&pending, i);
    for (j = 0; j < request_count; j++) {
      if (requests[j].id == rid) {
        pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                        "%s{\"id\":%d,\"donation_id\":%d,\"ngo_id\":%d,"
                        "\"quantity\":%d,\"status\":\"%s\",\"queue_position\":%d}",
                        pos > 1 ? "," : "", requests[j].id, requests[j].donation_id,
                        requests[j].ngo_id, requests[j].quantity, requests[j].status, i);
        break;
      }
    }
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]");
  send_json(fd, 200, "OK", body);
}

/* POST /api/requests — enqueue + claim the donation (BST lookup by id) */
static void ep_create_request(int fd, const char *body) {
  Req *r;
  int donation_id = 0, ngo_id = 1, quantity = 1;
  int i, found = 0;

  json_int_field(body, "donation_id", &donation_id);
  json_int_field(body, "ngo_id", &ngo_id);
  json_int_field(body, "quantity", &quantity);

  if (!bst_contains(&donation_index, donation_id)) {
    sendf(fd, 404, "Not Found", "{\"error\":\"unknown donation id (BST miss)\"}");
    return;
  }
  for (i = 0; i < donation_count; i++) {
    if (donations[i].id == donation_id) {
      if (strcmp(donations[i].status, "AVAILABLE") != 0) {
        sendf(fd, 409, "Conflict", "{\"error\":\"donation already claimed\"}");
        return;
      }
      snprintf(donations[i].status, sizeof(donations[i].status), "CLAIMED");
      donations[i].ngo_id = ngo_id;
      found = 1;
      break;
    }
  }
  if (!found) {
    sendf(fd, 404, "Not Found", "{\"error\":\"donation missing from store\"}");
    return;
  }

  if (request_count >= MAX_REQUESTS) {
    sendf(fd, 503, "Service Unavailable", "{\"error\":\"request store full\"}");
    return;
  }
  r = &requests[request_count++];
  r->id = next_id++;
  r->donation_id = donation_id;
  r->ngo_id = ngo_id;
  r->quantity = quantity;
  snprintf(r->status, sizeof(r->status), "PENDING");
  r->created_at = (long)time(NULL);

  queue_enqueue(&pending, r->id);
  stack_push(&activity, 2);

  sendf(fd, 201, "Created",
        "{\"id\":%d,\"status\":\"PENDING\",\"queue_position\":%d,\"queue_size\":%d}",
        r->id, queue_size(&pending) - 1, queue_size(&pending));
}

/* POST /api/requests/claim — dequeue the oldest request (FIFO collection) */
static void ep_claim_request(int fd) {
  int rid = -1;
  int i;
  if (queue_dequeue(&pending, &rid) != 0) {
    sendf(fd, 409, "Conflict", "{\"error\":\"request queue is empty\"}");
    return;
  }
  for (i = 0; i < request_count; i++) {
    if (requests[i].id == rid) {
      snprintf(requests[i].status, sizeof(requests[i].status), "APPROVED");
      break;
    }
  }
  stack_push(&activity, 3);
  sendf(fd, 200, "OK", "{\"id\":%d,\"status\":\"APPROVED\",\"queue_size\":%d}",
        rid, queue_size(&pending));
}

/* GET /api/history — stack (newest action first) */
static void ep_history(int fd) {
  static char body[RESP_BUF];
  int pos = 0;
  int i;
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "[");
  for (i = stack_size(&activity) - 1; i >= 0 && pos < (int)sizeof(body) - 256; i--) {
    int code = stack_at(&activity, i);
    pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                    "%s{\"code\":%d,\"action\":\"%s\",\"stack_depth\":%d}",
                    pos > 1 ? "," : "", code, activity_text(code), i);
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]");
  send_json(fd, 200, "OK", body);
}

/* GET /api/bst — size, height and ascending traversal */
static void ep_bst(int fd) {
  static char body[RESP_BUF];
  int keys[BST_POOL_CAP];
  int n = bst_inorder(&donation_index, keys, BST_POOL_CAP);
  int pos = 0;
  int i;
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                  "{\"size\":%d,\"height\":%d,\"inorder\":[", bst_size(&donation_index),
                  bst_height(&donation_index));
  for (i = 0; i < n; i++) {
    pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "%s%d", i ? "," : "", keys[i]);
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]}");
  send_json(fd, 200, "OK", body);
}

/* GET /api/bst/search?id=N — BST lookup with search depth */
static void ep_bst_search(int fd, const char *query) {
  int id = 0, depth;
  const char *p = strstr(query, "id=");
  if (p) id = atoi(p + 3);
  depth = bst_search_depth(&donation_index, id);
  sendf(fd, 200, "OK", "{\"id\":%d,\"found\":%s,\"depth\":%d}", id,
        depth >= 0 ? "true" : "false", depth);
}

/* GET /api/route — delivery route as a linked list traversal */
static void ep_route(int fd) {
  static char body[RESP_BUF];
  static const char *steps[] = {"Depot", "Restaurant", "Hub", "Volunteer", "Recipient"};
  int pos = 0;
  int i;
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "[");
  for (i = 0; i < ll_size(&route); i++) {
    int v = ll_at(&route, i);
    const char *name = (v >= 0 && v < 5) ? steps[v] : "Waypoint";
    pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "%s{\"step\":%d,\"name\":\"%s\"}",
                    pos > 1 ? "," : "", i, name);
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]");
  send_json(fd, 200, "OK", body);
}

/* GET /api/graph/bfs?from=N  |  /api/graph/dfs?from=N */
static void ep_graph(int fd, const char *query, int use_bfs) {
  static const char *names[] = {"Sunshine Restaurant", "Green Bistro", "Central Hub",
                                "Hope Foundation", "Rise Together", "Community Fridge"};
  int order[GRAPH_MAX_NODES];
  int start = 0;
  int n;
  const char *p = strstr(query, "from=");
  if (p) start = atoi(p + 5);
  n = use_bfs ? graph_bfs(&network, start, order, GRAPH_MAX_NODES)
              : graph_dfs(&network, start, order, GRAPH_MAX_NODES);
  sendf(fd, 200, "OK",
        "{\"mode\":\"%s\",\"start\":%d,\"order\":[%d,%d,%d,%d,%d,%d],"
        "\"names\":[\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"]}",
        use_bfs ? "bfs" : "dfs", start,
        n > 0 ? order[0] : 0, n > 1 ? order[1] : 0, n > 2 ? order[2] : 0,
        n > 3 ? order[3] : 0, n > 4 ? order[4] : 0, n > 5 ? order[5] : 0,
        names[0], names[1], names[2], names[3], names[4], names[5]);
}

/* ============================ HTTP layer ========================== */

static int read_request(int fd, char *buf, int cap) {
  int total = 0;
  int want_body = 0;
  int header_end = -1;
  while (total < cap - 1) {
    ssize_t n = read(fd, buf + total, (size_t)(cap - 1 - total));
    if (n <= 0) break;
    total += (int)n;
    buf[total] = '\0';
    if (header_end < 0) {
      char *p = strstr(buf, "\r\n\r\n");
      if (p) {
        header_end = (int)(p - buf) + 4;
        if (strstr(buf, "Content-Length:")) {
          const char *cl = strstr(buf, "Content-Length:");
          want_body = atoi(cl + 15);
        }
      }
    }
    if (header_end >= 0 && total >= header_end + want_body) break;
    if (header_end >= 0 && want_body == 0) break;
  }
  return total;
}

static void handle_client(int fd) {
  static char buf[REQ_BUF];
  char method[8] = {0};
  char path[128] = {0};
  char *body;
  int n = read_request(fd, buf, sizeof(buf));
  if (n <= 0) return;

  sscanf(buf, "%7s %127s", method, path);
  body = strstr(buf, "\r\n\r\n");
  if (body) body += 4;

  if (strcmp(method, "OPTIONS") == 0) {
    sendf(fd, 204, "No Content", "");
    return;
  }

  if (strcmp(method, "GET") == 0) {
    if (strcmp(path, "/api/health") == 0) { ep_health(fd); return; }
    if (strcmp(path, "/api/donations") == 0) { ep_list_donations(fd); return; }
    if (strcmp(path, "/api/requests") == 0) { ep_list_requests(fd); return; }
    if (strcmp(path, "/api/history") == 0) { ep_history(fd); return; }
    if (strcmp(path, "/api/bst") == 0) { ep_bst(fd); return; }
    if (strncmp(path, "/api/bst/search", 15) == 0) {
      ep_bst_search(fd, strchr(path, '?') ? strchr(path, '?') : "");
      return;
    }
    if (strcmp(path, "/api/route") == 0) { ep_route(fd); return; }
    if (strncmp(path, "/api/graph/bfs", 14) == 0) {
      ep_graph(fd, strchr(path, '?') ? strchr(path, '?') : "", 1);
      return;
    }
    if (strncmp(path, "/api/graph/dfs", 14) == 0) {
      ep_graph(fd, strchr(path, '?') ? strchr(path, '?') : "", 0);
      return;
    }
  } else if (strcmp(method, "POST") == 0) {
    if (strcmp(path, "/api/donations") == 0) { ep_create_donation(fd, body ? body : ""); return; }
    if (strcmp(path, "/api/requests") == 0) { ep_create_request(fd, body ? body : ""); return; }
    if (strcmp(path, "/api/requests/claim") == 0) { ep_claim_request(fd); return; }
  }

  sendf(fd, 404, "Not Found", "{\"error\":\"unknown endpoint\"}");
}

/* ============================== main ============================== */

static void seed(void) {
  static const char *titles[] = {"Cooked Rice + Curry", "Vegetable Pack",
                                 "Bread & Snacks", "Fruit Boxes"};
  static const char *locs[] = {"Kozhikode", "Vadakara", "Calicut", "Feroke"};
  static const int qty[] = {20, 50, 30, 40};
  static const int mins[] = {45, 240, 600, 120};
  int i;

  stack_init(&activity);
  queue_init(&pending);
  pq_init(&urgency);
  bst_init(&donation_index);
  ll_init(&route);
  graph_init(&network, 6);

  for (i = 0; i < 4; i++) {
    Donation *d = &donations[donation_count++];
    d->id = next_id++;
    snprintf(d->title, sizeof(d->title), "%s", titles[i]);
    snprintf(d->location, sizeof(d->location), "%s", locs[i]);
    d->quantity = qty[i];
    d->expires_at = (long)time(NULL) + mins[i] * 60;
    snprintf(d->status, sizeof(d->status), "AVAILABLE");
    d->ngo_id = 0;
    bst_insert(&donation_index, d->id);
    pq_insert(&urgency, d->id, mins[i]);
  }
  stack_push(&activity, 6);
  stack_push(&activity, 1);

  /* delivery route: Restaurant -> Hub -> Volunteer -> Recipient */
  ll_push_back(&route, 1);
  ll_push_back(&route, 2);
  ll_push_back(&route, 3);
  ll_push_back(&route, 4);

  /* network: two donors, one hub, two NGOs, one community fridge */
  graph_add_edge(&network, 0, 2);
  graph_add_edge(&network, 1, 2);
  graph_add_edge(&network, 2, 3);
  graph_add_edge(&network, 2, 4);
  graph_add_edge(&network, 3, 5);
  graph_add_edge(&network, 4, 5);
}

int main(int argc, char **argv) {
  int port = (argc > 1) ? atoi(argv[1]) : 8080;
  int srv, client;
  struct sockaddr_in addr;
  int opt = 1;

  signal(SIGPIPE, SIG_IGN);
  seed();

  srv = socket(AF_INET, SOCK_STREAM, 0);
  if (srv < 0) { perror("socket"); return 1; }
  setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

  memset(&addr, 0, sizeof(addr));
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_ANY);
  addr.sin_port = htons((unsigned short)port);

  if (bind(srv, (struct sockaddr *)&addr, sizeof(addr)) < 0) { perror("bind"); return 1; }
  if (listen(srv, 16) < 0) { perror("listen"); return 1; }

  printf("FoodShare C backend listening on http://localhost:%d\n", port);
  printf("  GET  /api/donations            -> priority queue (urgency order)\n");
  printf("  POST /api/donations            -> BST insert + PQ insert\n");
  printf("  GET  /api/requests             -> FIFO queue\n");
  printf("  POST /api/requests/claim       -> dequeue oldest\n");
  printf("  GET  /api/history              -> stack (LIFO)\n");
  printf("  GET  /api/bst, /api/route      -> BST + linked list\n");
  printf("  GET  /api/graph/bfs, /api/graph/dfs -> graph traversal\n");
  fflush(stdout);

  for (;;) {
    client = accept(srv, NULL, NULL);
    if (client < 0) continue;
    handle_client(client);
    close(client);
  }
  return 0;
}
