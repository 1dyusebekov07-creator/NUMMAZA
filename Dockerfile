# Сервер NUMMAZA: API + веб-приложение. Сборка: docker build -t nummaza .
FROM node:22-alpine
WORKDIR /srv/nummaza
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev && npm cache clean --force
COPY server/ server/
COPY app/ app/
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server/index.js"]
