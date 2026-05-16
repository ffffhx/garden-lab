FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY tools/lark-codex-bot/package.json ./
COPY tools/lark-codex-bot/src ./src

USER node
EXPOSE 8790

CMD ["node", "src/server.mjs", "--mode", "hub"]
