FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY deploy/token-board/package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY apps/site/tsconfig.json ./
COPY apps/site/lib ./lib
COPY apps/site/scripts/token-board-server.ts ./scripts/token-board-server.ts

USER node
EXPOSE 8789

CMD ["npm", "run", "docker:start"]
