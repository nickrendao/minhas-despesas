# Build multi-estágio. ATENÇÃO: não foi testado no ambiente em que foi escrito — rode `docker build` antes de publicar.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @fin/shared && npm run prisma:generate -w @fin/api && npm run build -w @fin/api

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/package.json /repo/package-lock.json ./
COPY --from=build /repo/packages/shared/package.json packages/shared/
COPY --from=build /repo/apps/api/package.json apps/api/
RUN npm ci --omit=dev
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
USER node
WORKDIR /repo/apps/api
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT:-3333}/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
