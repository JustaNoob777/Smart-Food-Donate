CC      = gcc
CFLAGS  = -Wall -Wextra -O2 -std=c11

.PHONY: all test run clean

all: foodshare-server

# HTTP API backend (stack / queue / PQ / linked list / BST / graph driven)
foodshare-server: server.c ds.c ds.h
	$(CC) $(CFLAGS) server.c ds.c -o foodshare-server

# Data-structures test suite
ds_tests: tests.c ds.c ds.h
	$(CC) $(CFLAGS) tests.c ds.c -o ds_tests

test: ds_tests
	./ds_tests

run: foodshare-server
	./foodshare-server 8080

clean:
	rm -f foodshare-server ds_tests
