FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY tsconfig.json ./
COPY lib ./lib
COPY scripts ./scripts

USER node
EXPOSE 8789

CMD ["npm", "run", "token:server"]
