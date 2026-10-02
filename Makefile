# FoodShare — local development helpers
# Usage: make setup | make check | make convex | make web | make api | make test

.PHONY: setup check convex web api test clean

## Install JS dependencies
setup:
	bun install

## Push Convex functions + codegen, then typecheck everything
check:
	bunx convex dev --once
	bunx tsc -b --noEmit

## Terminal A: Convex in watch mode (leave running)
convex:
	bun convex dev

## Terminal B: the web app -> http://localhost:5173
web:
	bun run dev

## Terminal C: the C backend -> http://localhost:8080
api:
	$(MAKE) -C c-backend run

## C data-structure test suite (385 checks across 6 structures)
test:
	$(MAKE) -C c-backend test

clean:
	$(MAKE) -C c-backend clean
