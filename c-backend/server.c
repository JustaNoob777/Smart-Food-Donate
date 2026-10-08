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
 *   GET  /api/dispatch           urgent-first dispatch lane (DEQUE)
 *   POST /api/requests           new request -> enqueue + mark CLAIMED
 *   POST /api/requests/claim     collect the OLDEST request (dequeue)
 *   GET  /api/history            recent actions from the STACK (newest first)
 *   GET  /api/bst                BST size / height / inorder traversal / tree
 *   GET  /api/bst/search?id=N    BST search with reported depth
 *   GET  /api/route              delivery route via LINKED LIST traversal
 *   GET  /api/graph/bfs?from=0   distribution network BFS
 *   GET  /api/graph/dfs?from=0   distribution network DFS
 *
 * Build & run:  make && ./foodshare-server 8080
 */
#define _POSIX_C_SOURCE 200809L
#include <arpa/inet.h>
#include <errno.h>
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
#define DONATION_ID_BASE 1001
#define REQUEST_ID_BASE 5001
#define REQ_BUF 16384
#define RESP_BUF 131072

typedef struct {
  int id;
  char title[64];
  char food_type[24];
  int quantity; /* meals */
  char location[48];
  char donor_id[48];
  char donor_name[64];
  char notes[128];
  long expires_at;
  long created_at;
  long collected_at;
  char status[16];
  int ngo_id;
  char ngo_name[64];
} Donation;

typedef struct {
  int id;
  int donation_id;
  int ngo_id;
  char ngo_ref[48];
  char ngo_name[64];
  int quantity;
  char status[16];
  int step;
  /* -1 follows expiry, 0 routine/back, 1 urgent/front (admin override). */
  int dispatch_override;
  int dispatch_rank;
  long created_at;
} Req;

static Donation donations[MAX_DONATIONS];
static int donation_count = 0;
static Req requests[MAX_REQUESTS];
static int request_count = 0;
static int next_donation_id = DONATION_ID_BASE;
static int next_request_id = REQUEST_ID_BASE;
static int next_dispatch_rank = 1;

/* ---- the data structures that run this API ---- */
static BST donation_index;        /* BST: donation id -> exists            */
static PriorityQueue urgency;     /* PQ : id -> minutes until expiry       */
static Queue pending;             /* FIFO: request ids in arrival order    */
static Deque dispatch;            /* urgent requests front, routine back   */
static Stack activity;            /* LIFO: recent actions                  */
static LinkedList route;          /* delivery route steps                  */
static Graph network;             /* donor / hub / NGO connections         */
static char network_names[GRAPH_MAX_NODES][64];
static char network_keys[GRAPH_MAX_NODES][48];
static int donation_network_node[MAX_DONATIONS];

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
    case 7: return "Pending request approved in FIFO order";
    case 8: return "Delivery route advanced to the next step";
    default: return "System event";
  }
}

static Req *request_by_id(int id) {
  int i = id - REQUEST_ID_BASE;
  return i >= 0 && i < request_count && requests[i].id == id ? &requests[i] : NULL;
}

static Donation *donation_by_id(int id) {
  int i = id - DONATION_ID_BASE;
  return i >= 0 && i < donation_count && donations[i].id == id ? &donations[i] : NULL;
}

static int dispatch_position(int id) {
  int i;
  for (i = 0; i < deque_size(&dispatch); i++)
    if (deque_at(&dispatch, i) == id) return i;
  return -1;
}

static int pending_position(int id) {
  int i;
  for (i = 0; i < queue_size(&pending); i++)
    if (queue_at(&pending, i) == id) return i;
  return -1;
}

static int network_node(const char *key, const char *label) {
  int i;
  if (!key[0] || network.n >= GRAPH_MAX_NODES) return -1;
  for (i = 1; i < network.n; i++)
    if (strcmp(network_keys[i], key) == 0) return i;
  i = network.n++;
  snprintf(network_keys[i], sizeof(network_keys[i]), "%s", key);
  snprintf(network_names[i], sizeof(network_names[i]), "%s", label);
  return i;
}

/* Build a live donor -> hub -> NGO graph from actual donation records. */
static void rebuild_network(void) {
  int i;
  graph_init(&network, donation_count > 0 ? 1 : 0);
  memset(network_names, 0, sizeof(network_names));
  memset(network_keys, 0, sizeof(network_keys));
  for (i = 0; i < MAX_DONATIONS; i++) donation_network_node[i] = -1;
  if (network.n) {
    snprintf(network_names[0], sizeof(network_names[0]), "Food hub");
    snprintf(network_keys[0], sizeof(network_keys[0]), "hub");
  }
  for (i = 0; i < donation_count; i++) {
    const char *label = donations[i].donor_name[0] ? donations[i].donor_name : donations[i].location;
    char node_label[64];
    char key[48];
    snprintf(key, sizeof(key), "donor:%s", donations[i].donor_id);
    snprintf(node_label, sizeof(node_label), "Donor: %.55s", label);
    int node = network_node(key, node_label);
    donation_network_node[i] = node;
    if (node >= 0) (void)graph_add_edge(&network, 0, node);
  }
  for (i = 0; i < request_count; i++) {
    int di = requests[i].donation_id - DONATION_ID_BASE;
    char node_label[64];
    char key[48];
    snprintf(key, sizeof(key), "ngo:%s", requests[i].ngo_ref);
    snprintf(node_label, sizeof(node_label), "NGO: %.58s", requests[i].ngo_name);
    int node = network_node(key, node_label);
    if (node >= 0 && di >= 0 && di < donation_count && donation_network_node[di] >= 0)
      (void)graph_add_edge(&network, donation_network_node[di], node);
  }
}

/* Keep the dispatch deque as a view of the FIFO's pending work. Urgent
 * requests go to the front; routine requests stay at the back. */
static void rebuild_dispatch(void) {
  int i, j, pinned_count = 0, back_count = 0;
  int pinned[MAX_REQUESTS];
  int manual_back[MAX_REQUESTS];
  Deque automatic, routine;
  time_t now = time(NULL);
  deque_init(&dispatch);
  deque_init(&automatic);
  deque_init(&routine);
  for (i = 0; i < queue_size(&pending); i++) {
    Req *r = request_by_id(queue_at(&pending, i));
    Donation *d = r ? donation_by_id(r->donation_id) : NULL;
    if (!r || !d) continue;
    if (r->dispatch_override == 1) pinned[pinned_count++] = r->id;
    else if (r->dispatch_override == 0) manual_back[back_count++] = r->id;
    else if (r->dispatch_override == -1 && d->expires_at - (long)now <= 120 * 60)
      (void)deque_push_back(&automatic, r->id);
    else
      (void)deque_push_back(&routine, r->id);
  }
  /* The most recently pinned pickup sits at the front. */
  for (i = 1; i < pinned_count; i++) {
    int id = pinned[i];
    Req *item = request_by_id(id);
    j = i;
    while (j > 0) {
      Req *previous = request_by_id(pinned[j - 1]);
      if (!item || !previous || previous->dispatch_rank >= item->dispatch_rank) break;
      pinned[j] = pinned[j - 1];
      j--;
    }
    pinned[j] = id;
  }
  for (i = 0; i < pinned_count; i++) (void)deque_push_back(&dispatch, pinned[i]);
  for (i = 0; i < deque_size(&automatic); i++) (void)deque_push_back(&dispatch, deque_at(&automatic, i));
  for (i = 0; i < deque_size(&routine); i++) (void)deque_push_back(&dispatch, deque_at(&routine, i));
  /* Manually returned items are placed after routine work, in edit order. */
  for (i = 1; i < back_count; i++) {
    int id = manual_back[i];
    Req *item = request_by_id(id);
    j = i;
    while (j > 0) {
      Req *previous = request_by_id(manual_back[j - 1]);
      if (!item || !previous || previous->dispatch_rank <= item->dispatch_rank) break;
      manual_back[j] = manual_back[j - 1];
      j--;
    }
    manual_back[j] = id;
  }
  for (i = 0; i < back_count; i++) (void)deque_push_back(&dispatch, manual_back[i]);
}

/* ========================= response helpers ======================= */

static void write_all(int fd, const char *data, size_t length) {
  while (length > 0) {
    ssize_t written = write(fd, data, length);
    if (written < 0 && errno == EINTR) continue;
    if (written <= 0) return;
    data += written;
    length -= (size_t)written;
  }
}

static void send_json(int fd, int code, const char *status, const char *body) {
  char head[512];
  int n = snprintf(head, sizeof(head),
                   "HTTP/1.1 %d %s\r\n"
                   "Content-Type: application/json; charset=utf-8\r\n"
                   "Content-Length: %zu\r\n"
                   "Access-Control-Allow-Origin: *\r\n"
                   "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                   "Access-Control-Allow-Headers: Content-Type\r\n"
                   "Connection: close\r\n\r\n",
                   code, status, strlen(body));
  if (n > 0 && (size_t)n < sizeof(head)) {
    write_all(fd, head, (size_t)n);
    write_all(fd, body, strlen(body));
  }
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
        "\"stack\":%d,\"queue\":%d,\"deque\":%d,\"priorityQueue\":%d,\"linked_list\":%d,"
        "\"bst\":%d,\"graph_nodes\":%d}}",
        donation_count, request_count, stack_size(&activity), queue_size(&pending),
        deque_size(&dispatch), pq_size(&urgency), ll_size(&route), bst_size(&donation_index),
        graph_node_count(&network));
}

/* GET /api/donations — ordered by the priority queue (soonest expiry first) */
static void ep_list_donations(int fd) {
  static char body[RESP_BUF];
  PriorityQueue copy = urgency;
  int pos = 0;
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "[");
  while (pq_size(&copy) > 0 && pos < (int)sizeof(body) - 512) {
    PqItem it;
    int remaining_minutes;
    pq_extract_min(&copy, &it);
    {
      Donation *d = donation_by_id(it.id);
      if (d) {
        char title[128], food_type[64], location[96], donor_id[96];
        char donor_name[128], notes[256], ngo_name[128];
        json_escape(d->title, title, sizeof(title));
        json_escape(d->food_type, food_type, sizeof(food_type));
        json_escape(d->location, location, sizeof(location));
        json_escape(d->donor_id, donor_id, sizeof(donor_id));
        json_escape(d->donor_name, donor_name, sizeof(donor_name));
        json_escape(d->notes, notes, sizeof(notes));
        json_escape(d->ngo_name, ngo_name, sizeof(ngo_name));
        remaining_minutes = it.priority - (int)(time(NULL) / 60);
        if (remaining_minutes < 0) remaining_minutes = 0;
        pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                        "%s{\"id\":%d,\"ref\":%d,\"title\":\"%s\","
                        "\"foodType\":\"%s\",\"quantity\":%d,\"location\":\"%s\","
                        "\"donorId\":\"%s\",\"donorName\":\"%s\",\"notes\":\"%s\","
                        "\"expires_in_minutes\":%d,\"expiresAt\":%ld,\"createdAt\":%ld,"
                        "\"collectedAt\":%ld,\"status\":\"%s\",\"ngo_id\":%d,\"ngoName\":\"%s\"}",
                        pos > 1 ? "," : "", d->id, d->id, title, food_type,
                        d->quantity, location, donor_id, donor_name, notes,
                        remaining_minutes, d->expires_at * 1000L,
                        d->created_at * 1000L, d->collected_at * 1000L,
                        d->status, d->ngo_id, ngo_name);
      }
    }
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]");
  send_json(fd, 200, "OK", body);
}

/* POST /api/donations — BST insert (index) + PQ insert (urgency) */
static void ep_create_donation(int fd, const char *body) {
  Donation *d;
  char title[64] = "";
  char location[48] = "";
  char food_type[24] = "Other";
  char donor_id[48] = "local-demo-user";
  char donor_name[64] = "Community donor";
  char notes[128] = "";
  int quantity = 0;
  int expires_in = 0;

  if (!json_str_field(body, "title", title, sizeof(title)) ||
      !json_str_field(body, "location", location, sizeof(location)) ||
      !json_int_field(body, "quantity", &quantity) ||
      !json_int_field(body, "expires_in", &expires_in) ||
      title[0] == '\0' || location[0] == '\0' || quantity <= 0 || expires_in <= 0) {
    sendf(fd, 400, "Bad Request",
          "{\"error\":\"title, location, positive quantity, and positive expires_in are required\"}");
    return;
  }
  (void)json_str_field(body, "foodType", food_type, sizeof(food_type));
  (void)json_str_field(body, "donor_id", donor_id, sizeof(donor_id));
  (void)json_str_field(body, "donor_name", donor_name, sizeof(donor_name));
  (void)json_str_field(body, "notes", notes, sizeof(notes));
  if (quantity > 1000000 || expires_in > 10080) {
    sendf(fd, 400, "Bad Request", "{\"error\":\"quantity or expiry exceeds the demo limit\"}");
    return;
  }

  if (donation_count >= MAX_DONATIONS || donation_count >= PQ_CAP) {
    sendf(fd, 503, "Service Unavailable", "{\"error\":\"donation store full\"}");
    return;
  }
  d = &donations[donation_count];
  d->id = next_donation_id;
  snprintf(d->title, sizeof(d->title), "%s", title);
  snprintf(d->food_type, sizeof(d->food_type), "%s", food_type);
  snprintf(d->location, sizeof(d->location), "%s", location);
  snprintf(d->donor_id, sizeof(d->donor_id), "%s", donor_id);
  snprintf(d->donor_name, sizeof(d->donor_name), "%s", donor_name);
  snprintf(d->notes, sizeof(d->notes), "%s", notes);
  d->quantity = quantity;
  d->expires_at = (long)time(NULL) + expires_in * 60;
  d->created_at = (long)time(NULL);
  d->collected_at = 0;
  snprintf(d->status, sizeof(d->status), "AVAILABLE");
  d->ngo_id = 0;
  d->ngo_name[0] = '\0';

  if (bst_insert(&donation_index, d->id) != 0) {
    sendf(fd, 503, "Service Unavailable", "{\"error\":\"donation index capacity reached\"}");
    return;
  }
  if (pq_insert(&urgency, d->id, (int)(d->expires_at / 60)) != 0) {
    (void)bst_delete(&donation_index, d->id);
    sendf(fd, 503, "Service Unavailable", "{\"error\":\"data structure capacity reached\"}");
    return;
  }
  donation_count++;
  next_donation_id++;
  rebuild_network();
  stack_push(&activity, 1);

  sendf(fd, 201, "Created",
        "{\"id\":%d,\"ref\":%d,\"status\":\"AVAILABLE\",\"bst_size\":%d,\"heap_size\":%d}",
        d->id, d->id, bst_size(&donation_index), pq_size(&urgency));
}

/* GET /api/requests — FIFO queue order (oldest first) */
static void ep_list_requests(int fd) {
  static char body[RESP_BUF];
  int pos = 0;
  int i;
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "[");
  for (i = 0; i < request_count && pos < (int)sizeof(body) - 256; i++) {
    Req *r = &requests[i];
    if (r) {
      Donation *d = donation_by_id(r->donation_id);
      char title[128], ngo_name[128], ngo_ref[96];
      int queue_pos = pending_position(r->id);
      json_escape(d ? d->title : "Unknown donation", title, sizeof(title));
      json_escape(r->ngo_name, ngo_name, sizeof(ngo_name));
      json_escape(r->ngo_ref, ngo_ref, sizeof(ngo_ref));
      pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                      "%s{\"id\":%d,\"ref\":%d,\"donation_id\":%d,\"donationRef\":%d,"
                      "\"donationTitle\":\"%s\",\"ngo_id\":%d,\"ngoId\":\"%s\",\"ngoName\":\"%s\","
                      "\"quantity\":%d,\"status\":\"%s\",\"step\":%d,\"createdAt\":%ld,\"queue_position\":%d}",
                      pos > 1 ? "," : "", r->id, r->id, r->donation_id,
                      r->donation_id, title, r->ngo_id, ngo_ref, ngo_name,
                      r->quantity, r->status, r->step, r->created_at * 1000L, queue_pos);
    }
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]");
  send_json(fd, 200, "OK", body);
}

/* GET /api/dispatch — deque order prioritizes food expiring within 2 hours. */
static void ep_dispatch(int fd) {
  static char body[RESP_BUF];
  int pos = 0;
  int i;
  rebuild_dispatch();
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "[");
  for (i = 0; i < deque_size(&dispatch) && pos < (int)sizeof(body) - 256; i++) {
    Req *r = request_by_id(deque_at(&dispatch, i));
    if (!r) continue;
    pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                    "%s{\"id\":%d,\"donation_id\":%d,\"status\":\"%s\",\"dispatch_position\":%d,\"dispatch_override\":%d}",
                    pos > 1 ? "," : "", r->id, r->donation_id, r->status, i, r->dispatch_override);
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]");
  send_json(fd, 200, "OK", body);
}

/* POST /api/requests — enqueue + claim the donation (BST lookup by id) */
static void ep_create_request(int fd, const char *body) {
  Req *r;
  int donation_id = 0, ngo_id = 1, quantity = 1;
  char ngo_ref[48] = "local-demo-user";
  char ngo_name[64] = "Community NGO";
  char account_type[16] = "";
  Donation *donation;

  json_int_field(body, "donation_id", &donation_id);
  json_int_field(body, "ngo_id", &ngo_id);
  json_int_field(body, "quantity", &quantity);
  (void)json_str_field(body, "ngo_ref", ngo_ref, sizeof(ngo_ref));
  (void)json_str_field(body, "ngo_name", ngo_name, sizeof(ngo_name));
  (void)json_str_field(body, "account_type", account_type, sizeof(account_type));

  if (strcmp(account_type, "ngo") != 0 && strcmp(account_type, "admin") != 0) {
    sendf(fd, 403, "Forbidden", "{\"error\":\"choose the NGO demo role to request food\"}");
  return;
}

  if (quantity <= 0) {
    sendf(fd, 400, "Bad Request", "{\"error\":\"quantity must be positive\"}");
    return;
  }
  if (request_count >= MAX_REQUESTS || queue_size(&pending) >= QUEUE_CAP ||
      deque_size(&dispatch) >= DEQUE_CAP) {
    sendf(fd, 503, "Service Unavailable", "{\"error\":\"pending request capacity reached\"}");
    return;
  }
  if (!bst_contains(&donation_index, donation_id)) {
    sendf(fd, 404, "Not Found", "{\"error\":\"unknown donation id (BST miss)\"}");
    return;
  }
  donation = donation_by_id(donation_id);
  if (!donation) {
    sendf(fd, 404, "Not Found", "{\"error\":\"donation missing from store\"}");
    return;
  }
  if (strcmp(donation->status, "AVAILABLE") != 0) {
    sendf(fd, 409, "Conflict", "{\"error\":\"donation already claimed\"}");
    return;
  }
  if (quantity > donation->quantity) {
    sendf(fd, 400, "Bad Request", "{\"error\":\"quantity exceeds available food\"}");
    return;
  }
  snprintf(donation->status, sizeof(donation->status), "CLAIMED");
  donation->ngo_id = ngo_id;
  snprintf(donation->ngo_name, sizeof(donation->ngo_name), "%s", ngo_name);
  r = &requests[request_count++];
  r->id = next_request_id++;
  r->donation_id = donation_id;
  r->ngo_id = ngo_id;
  snprintf(r->ngo_ref, sizeof(r->ngo_ref), "%s", ngo_ref);
  snprintf(r->ngo_name, sizeof(r->ngo_name), "%s", ngo_name);
  r->quantity = quantity;
  snprintf(r->status, sizeof(r->status), "PENDING");
  r->step = 0;
  r->dispatch_override = -1;
  r->dispatch_rank = 0;
  r->created_at = (long)time(NULL);

  queue_enqueue(&pending, r->id);
  rebuild_dispatch();
  rebuild_network();
  stack_push(&activity, 2);

  sendf(fd, 201, "Created",
        "{\"id\":%d,\"ref\":%d,\"status\":\"PENDING\",\"queue_position\":%d,\"dispatch_position\":%d,\"queue_size\":%d}",
        r->id, r->id, queue_size(&pending) - 1,
        /* Urgent requests are moved ahead by the deque. */
        dispatch_position(r->id),
        queue_size(&pending));
}

/* Admin may put a pending pickup at either end of the dispatch deque. */
static void ep_dispatch_reorder(int fd, const char *body) {
  int id = 0;
  char position[16] = "", account_type[16] = "";
  Req *r;
  json_int_field(body, "request_id", &id);
  (void)json_str_field(body, "position", position, sizeof(position));
  (void)json_str_field(body, "account_type", account_type, sizeof(account_type));
  if (strcmp(account_type, "admin") != 0) {
    sendf(fd, 403, "Forbidden", "{\"error\":\"only an admin can change dispatch order\"}");
    return;
  }
  r = request_by_id(id);
  if (!r || strcmp(r->status, "PENDING") != 0 || pending_position(id) < 0) {
    sendf(fd, 409, "Conflict", "{\"error\":\"only pending requests can be reordered\"}");
    return;
  }
  if (strcmp(position, "front") == 0) r->dispatch_override = 1;
  else if (strcmp(position, "back") == 0) r->dispatch_override = 0;
  else {
    sendf(fd, 400, "Bad Request", "{\"error\":\"position must be front or back\"}");
    return;
  }
  r->dispatch_rank = next_dispatch_rank++;
  rebuild_dispatch();
  (void)stack_push(&activity, 2);
  sendf(fd, 200, "OK", "{\"request_id\":%d,\"dispatch_position\":%d}", id, dispatch_position(id));
}

/* POST /api/requests/claim — dequeue the oldest request (FIFO collection) */
static void ep_claim_request(int fd) {
  int rid = -1;
  if (queue_dequeue(&pending, &rid) != 0) {
    sendf(fd, 409, "Conflict", "{\"error\":\"request queue is empty\"}");
    return;
  }
  {
    Req *r = request_by_id(rid);
    if (r) snprintf(r->status, sizeof(r->status), "APPROVED");
  }
  rebuild_dispatch();
  stack_push(&activity, 3);
  sendf(fd, 200, "OK", "{\"id\":%d,\"status\":\"APPROVED\",\"queue_size\":%d}",
        rid, queue_size(&pending));
}

static void ep_approve_request(int fd, const char *body) {
  int ref = 0;
  char account_type[16] = "";
  Req *r;
  json_int_field(body, "ref", &ref);
  (void)json_str_field(body, "account_type", account_type, sizeof(account_type));
  if (strcmp(account_type, "admin") != 0) {
    sendf(fd, 403, "Forbidden", "{\"error\":\"choose the coordinator demo role to approve requests\"}");
    return;
  }
  r = request_by_id(ref);
  if (!r) {
    sendf(fd, 404, "Not Found", "{\"error\":\"request not found\"}");
    return;
  }
  if (strcmp(r->status, "PENDING") != 0) {
    sendf(fd, 409, "Conflict", "{\"error\":\"request is not pending\"}");
    return;
  }
  rebuild_dispatch();
  if (deque_size(&dispatch) == 0 || deque_at(&dispatch, 0) != r->id) {
    sendf(fd, 409, "Conflict", "{\"error\":\"approve the next request in dispatch order\"}");
    return;
  }
  /* Queue is the arrival-order record; rebuild it without the approved item. */
  {
    Queue remaining;
    int i;
    queue_init(&remaining);
    for (i = 0; i < queue_size(&pending); i++) {
      int queued_id = queue_at(&pending, i);
      if (queued_id != r->id) (void)queue_enqueue(&remaining, queued_id);
    }
    pending = remaining;
  }
  snprintf(r->status, sizeof(r->status), "APPROVED");
  rebuild_dispatch();
  (void)stack_push(&activity, 7);
  sendf(fd, 200, "OK", "{\"ref\":%d,\"status\":\"APPROVED\"}", ref);
}

static void ep_advance_request(int fd, const char *body) {
  static const char *labels[] = {
    "Request Received", "Assigned to Volunteer", "Picked Up",
    "Out for Delivery", "Delivered"
  };
  int ref = 0;
  int i;
  char account_type[16] = "";
  Req *r;
  Donation *d;
  int done;
  json_int_field(body, "ref", &ref);
  (void)json_str_field(body, "account_type", account_type, sizeof(account_type));
  if (strcmp(account_type, "ngo") != 0 && strcmp(account_type, "admin") != 0) {
    sendf(fd, 403, "Forbidden", "{\"error\":\"choose an NGO or coordinator demo role to update deliveries\"}");
    return;
  }
  r = request_by_id(ref);
  if (!r) {
    sendf(fd, 404, "Not Found", "{\"error\":\"request not found\"}");
    return;
  }
  if (r->step >= 4 || strcmp(r->status, "DELIVERED") == 0) {
    sendf(fd, 409, "Conflict", "{\"error\":\"delivery route is already complete\"}");
    return;
  }
  r->step++;
  done = r->step == 4;
  if (done) snprintf(r->status, sizeof(r->status), "DELIVERED");
  else if (strcmp(r->status, "PENDING") == 0)
    snprintf(r->status, sizeof(r->status), "APPROVED");
  d = donation_by_id(r->donation_id);
  if (d && r->step >= 2 && strcmp(d->status, "CLAIMED") == 0) {
    snprintf(d->status, sizeof(d->status), "COLLECTED");
    d->collected_at = (long)time(NULL);
  }
  if (d && done) snprintf(d->status, sizeof(d->status), "DISTRIBUTED");
  ll_init(&route);
  for (i = 0; i <= r->step; i++) (void)ll_push_back(&route, i);
  (void)stack_push(&activity, 8);
  sendf(fd, 200, "OK", "{\"ref\":%d,\"step\":%d,\"label\":\"%s\",\"done\":%s}",
        ref, r->step, labels[r->step], done ? "true" : "false");
}

static void ep_stats(int fd) {
  int i, j, donor_count = 0, ngo_count = 0, available = 0;
  int pending_count = 0, approved = 0, delivered = 0;
  long people_fed = 0, collected_meals = 0;
  char donor_ids[MAX_DONATIONS][48];
  char ngo_ids[MAX_REQUESTS][48];
  for (i = 0; i < donation_count; i++) {
    if (strcmp(donations[i].status, "AVAILABLE") == 0) available++;
    if (strcmp(donations[i].status, "DISTRIBUTED") == 0) people_fed += donations[i].quantity;
    if (strcmp(donations[i].status, "COLLECTED") == 0 ||
        strcmp(donations[i].status, "DISTRIBUTED") == 0)
      collected_meals += donations[i].quantity;
    for (j = 0; j < donor_count; j++)
      if (strcmp(donor_ids[j], donations[i].donor_id) == 0) break;
    if (j == donor_count) snprintf(donor_ids[donor_count++], 48, "%s", donations[i].donor_id);
  }
  for (i = 0; i < request_count; i++) {
    if (strcmp(requests[i].status, "PENDING") == 0) pending_count++;
    if (strcmp(requests[i].status, "APPROVED") == 0) approved++;
    if (strcmp(requests[i].status, "DELIVERED") == 0) delivered++;
    for (j = 0; j < ngo_count; j++)
      if (strcmp(ngo_ids[j], requests[i].ngo_ref) == 0) break;
    if (j == ngo_count) snprintf(ngo_ids[ngo_count++], 48, "%s", requests[i].ngo_ref);
  }
  sendf(fd, 200, "OK",
        "{\"totalDonations\":%d,\"totalRequests\":%d,\"peopleFed\":%ld,"
        "\"totalDonors\":%d,\"totalNgos\":%d,\"activeNgos\":%d,"
        "\"pendingRequests\":%d,\"approvedRequests\":%d,\"deliveredRequests\":%d,"
        "\"availableNow\":%d,\"collectedMeals\":%ld}",
        donation_count, request_count, people_fed, donor_count, ngo_count, ngo_count,
        pending_count, approved, delivered, available, collected_meals);
}

static void ep_weekly_stats(int fd) {
  static const char *days[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  long meals[7] = {0};
  time_t now = time(NULL);
  struct tm today;
  char body[512];
  int i, pos = 0;
  localtime_r(&now, &today);
  for (i = 0; i < donation_count; i++) {
    long age = ((long)now - donations[i].created_at) / 86400L;
    if (age >= 0 && age < 7) meals[6 - age] += donations[i].quantity;
  }
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "[");
  for (i = 0; i < 7; i++) {
    struct tm day = today;
    time_t stamp = now - (6 - i) * 86400L;
    localtime_r(&stamp, &day);
    pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                    "%s{\"day\":\"%s\",\"meals\":%ld}",
                    i ? "," : "", days[day.tm_wday], meals[i]);
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]");
  send_json(fd, 200, "OK", body);
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

static int append_bst_json(char *body, size_t capacity, int *position, int index) {
  int written;
  const BstNode *node;

  if (index < 0) {
    written = snprintf(body + *position, capacity - (size_t)*position, "null");
    if (written < 0 || (size_t)written >= capacity - (size_t)*position) return -1;
    *position += written;
    return 0;
  }
  if (index >= BST_POOL_CAP || !donation_index.used[index]) return -1;

  node = &donation_index.pool[index];
  written = snprintf(body + *position, capacity - (size_t)*position,
                     "{\"id\":%d,\"left\":", node->key);
  if (written < 0 || (size_t)written >= capacity - (size_t)*position) return -1;
  *position += written;
  if (append_bst_json(body, capacity, position, node->left) != 0) return -1;

  written = snprintf(body + *position, capacity - (size_t)*position, ",\"right\":");
  if (written < 0 || (size_t)written >= capacity - (size_t)*position) return -1;
  *position += written;
  if (append_bst_json(body, capacity, position, node->right) != 0) return -1;

  written = snprintf(body + *position, capacity - (size_t)*position, "}");
  if (written < 0 || (size_t)written >= capacity - (size_t)*position) return -1;
  *position += written;
  return 0;
}

/* GET /api/bst — size, height, ascending traversal, and actual tree links */
static void ep_bst(int fd) {
  static char body[RESP_BUF];
  int keys[BST_POOL_CAP];
  int n = bst_inorder(&donation_index, keys, BST_POOL_CAP);
  int pos = 0;
  int i;
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                  "{\"size\":%d,\"height\":%d,\"inorder\":[",
                  bst_size(&donation_index), bst_height(&donation_index));
  for (i = 0; i < n; i++) {
    pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "%s%d", i ? "," : "", keys[i]);
  }
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "],\"root\":");
  if (append_bst_json(body, sizeof(body), &pos, donation_index.root) != 0) {
    sendf(fd, 500, "Internal Server Error", "{\"error\":\"could not serialize donation BST\"}");
    return;
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "}");
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
    pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                    "%s{\"step\":%d,\"value\":%d,\"name\":\"%s\"}",
                    pos > 1 ? "," : "", i, v, name);
  }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]");
  send_json(fd, 200, "OK", body);
}

/* GET /api/graph/bfs?from=N  |  /api/graph/dfs?from=N */
static void ep_graph(int fd, const char *query, int use_bfs) {
  static char body[RESP_BUF];
  int order[GRAPH_MAX_NODES];
  int start = 0;
  int n, i, j, pos = 0;
  const char *p = strstr(query, "from=");
  if (p) start = atoi(p + 5);
  rebuild_network();
  n = use_bfs ? graph_bfs(&network, start, order, GRAPH_MAX_NODES)
              : graph_dfs(&network, start, order, GRAPH_MAX_NODES);
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                  "{\"mode\":\"%s\",\"start\":%d,\"order\":[",
                  use_bfs ? "bfs" : "dfs", start);
  for (i = 0; i < n; i++)
    pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                    "%s%d", i ? "," : "", order[i]);
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "],\"names\":[");
  for (i = 0; i < network.n; i++) {
    char escaped[128];
    json_escape(network_names[i], escaped, sizeof(escaped));
    pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                    "%s\"%s\"", i ? "," : "", escaped);
  }
  pos += snprintf(body + pos, sizeof(body) - (size_t)pos, "],\"edges\":[");
  for (i = 0, j = 0; i < network.n; i++)
    for (int k = i + 1; k < network.n; k++)
      if (graph_has_edge(&network, i, k)) {
        pos += snprintf(body + pos, sizeof(body) - (size_t)pos,
                        "%s[%d,%d]", j++ ? "," : "", i, k);
      }
  snprintf(body + pos, sizeof(body) - (size_t)pos, "]}");
  send_json(fd, 200, "OK", body);
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
    if (strcmp(path, "/api/stats") == 0) { ep_stats(fd); return; }
    if (strcmp(path, "/api/stats/weekly") == 0) { ep_weekly_stats(fd); return; }
    if (strcmp(path, "/api/donations") == 0) { ep_list_donations(fd); return; }
    if (strcmp(path, "/api/requests") == 0) { ep_list_requests(fd); return; }
    if (strcmp(path, "/api/dispatch") == 0) { ep_dispatch(fd); return; }
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
    if (strcmp(path, "/api/dispatch/reorder") == 0) { ep_dispatch_reorder(fd, body ? body : ""); return; }
    if (strcmp(path, "/api/requests/claim") == 0) { ep_claim_request(fd); return; }
    if (strcmp(path, "/api/requests/approve") == 0) { ep_approve_request(fd, body ? body : ""); return; }
    if (strcmp(path, "/api/requests/advance") == 0) { ep_advance_request(fd, body ? body : ""); return; }
  }

  sendf(fd, 404, "Not Found", "{\"error\":\"unknown endpoint\"}");
}

/* ============================== main ============================== */

static void initialize(void) {
  stack_init(&activity);
  queue_init(&pending);
  deque_init(&dispatch);
  pq_init(&urgency);
  bst_init(&donation_index);
  ll_init(&route);
  graph_init(&network, 0);
  memset(network_names, 0, sizeof(network_names));
  memset(network_keys, 0, sizeof(network_keys));
  memset(donation_network_node, 0xff, sizeof(donation_network_node));
}

int main(int argc, char **argv) {
  int port = (argc > 1) ? atoi(argv[1]) : 8080;
  int srv, client;
  struct sockaddr_in addr;
  int opt = 1;

  signal(SIGPIPE, SIG_IGN);
  initialize();

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
  printf("  GET  /api/dispatch             -> urgent-first deque\n");
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
