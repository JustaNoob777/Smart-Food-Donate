# FoodShare — local development helpers
# Usage: make setup | make check | make web | make api | make test

.PHONY: setup check web api test clean

## Install JS dependencies
setup:
	npm ci

## Typecheck the browser app
check:
	npx tsc -b --noEmit

## Start the web screen -> http://localhost:5173
web:
	npm run dev

## Start the C backend -> http://localhost:8080
api:
	$(MAKE) -C c-backend run

## C data-structure test suite (385 checks across 6 structures)
test:
	$(MAKE) -C c-backend test

clean:
	$(MAKE) -C c-backend clean
