# FoodShare Project Report

**Project:** Smart Food Donation and Distribution System
**Student:** ____________________
**Class / Roll No.:** ____________________
**Submitted to:** ____________________
**Date:** ____________________

## Abstract

FoodShare is a web application concept for connecting people and businesses with
surplus food to NGOs that can distribute it. Donors can post available food,
NGOs can find and request it, and users can follow collection and delivery
progress. The project also demonstrates common data structures through a C
engine that is compiled to WebAssembly and used in the browser.

## Problem and Objective

Usable food may be discarded while nearby communities need meals. The project
demonstrates a simple way to publish surplus food and organize requests around
availability and expiry time. Its objectives are to provide a clear donation
workflow, validate basic donation rules, and show how data structures support
real application tasks.

## Main Features

- Browse manually added food donations.
- Post a donation with food type, quantity, location, and expiry time.
- Request available food and follow its delivery status.
- View dashboard activity and account information.
- Explore and operate data structures in the C Engine Lab at `/ds`.

## Data Structures Demonstrated

| Data structure | Use in the project |
| --- | --- |
| Stack | Keeps recent actions in last-in, first-out order. |
| Circular queue | Processes collection requests in first-in, first-out order. |
| Priority queue (min-heap) | Places food with the earliest expiry first. |
| Deque | Supports a dispatch lane that can add urgent work at the front. |
| Linked list | Represents ordered delivery and route steps. |
| Binary search tree | Inserts and searches integer donation IDs. |
| Graph with BFS and DFS | Demonstrates traversal through a donor, hub, and NGO network. |

## Technology and Design

The interface is built with React and TypeScript. A native C HTTP server stores
demo records in memory and performs donation and request operations with the C
data structures. The same C data-structure implementation is compiled to
WebAssembly for the browser C Engine Lab. Donor, NGO, and admin use separate
shared demo credentials; these are not secure production accounts.

## Validation

Donation forms check that the title and pickup location are present, the
quantity is positive, and the expiry time is in the future. The backend checks
that food is available before a request and restricts legal status changes.
The native C data-structure test suite covers normal, boundary, and error
cases. The C server starts with an empty dataset, so donations and requests can
be entered manually during the demonstration.

## Conclusion

FoodShare combines a practical food-sharing workflow with demonstrations of
data structures. The priority queue helps surface time-sensitive donations,
the queue models request order, and the remaining structures support lookup,
history, dispatch, route, and network demonstrations. The project can be
extended with real NGO onboarding, notifications, and deployment support.

## Short Demonstration Plan

1. Start the native C backend with `make api`.
2. In another terminal, run `npm run dev` and open
   `http://localhost:5173`.
3. Sign in with `donor` / `donor123`, `ngo` / `ngo123`, or `admin` / `admin123`.
4. Add a donation from **Donate**, then confirm it appears in **Browse** and the
   dashboard. Create an NGO request and follow its delivery in **Track**.
5. Open **C Engine Lab** (`/ds`) to see those live records loaded into the C
   structures and demonstrate queue, heap, BST, or graph operations.

The C backend keeps demo records in memory, so they reset when it stops. The
local demo identity is stored in browser storage and is for study only.
