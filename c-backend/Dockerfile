FROM debian:bookworm-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libc6-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY ds.h ds.c server.c ./
RUN gcc -Wall -Wextra -O2 -std=c11 server.c ds.c -o foodshare-server

FROM debian:bookworm-slim

WORKDIR /app
COPY --from=build /src/foodshare-server ./foodshare-server
EXPOSE 8080
CMD ["sh", "-c", "./foodshare-server \"${PORT:-8080}\""]
