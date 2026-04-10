FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV APP_MODE=bot

EXPOSE 3000

CMD ["node", "start.js"]
