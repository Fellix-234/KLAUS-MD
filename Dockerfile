FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ARG BOT_SOURCE_REPO=""
ARG BOT_SOURCE_BRANCH="main"
ARG BOT_SOURCE_TOKEN=""

RUN if [ -n "$BOT_SOURCE_REPO" ]; then \
			rm -rf /app/source && mkdir -p /app/source && \
			repo_url="$BOT_SOURCE_REPO"; \
			if [ -n "$BOT_SOURCE_TOKEN" ]; then \
				repo_url="$(printf '%s' "$BOT_SOURCE_REPO" | sed "s#https://#https://x-access-token:${BOT_SOURCE_TOKEN}@#")"; \
			fi; \
			git clone --depth 1 --branch "$BOT_SOURCE_BRANCH" "$repo_url" /app/source; \
		fi

RUN npm run build:obf

ENV NODE_ENV=production
ENV PORT=3000
ENV APP_MODE=bot
ENV BOT_SOURCE_DIR=/app/source

EXPOSE 3000

CMD ["node", "dist/start.js"]
