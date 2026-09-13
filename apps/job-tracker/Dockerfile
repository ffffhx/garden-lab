FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs github-auth.mjs ./
COPY --chown=node:node public ./public
RUN mkdir /data && chown node:node /data
USER node
ENV HOST=0.0.0.0 PORT=8796 DATA_DIR=/data NODE_ENV=production
EXPOSE 8796
CMD ["node","server.mjs"]
