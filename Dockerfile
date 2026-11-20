FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --ignore-scripts

COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build --prefix apps/web \
  && npm exec --prefix apps/api -- prisma generate --schema=apps/api/prisma/schema.prisma

ENV WEB_DIST=/app/apps/web/dist
ENV DATABASE_URL=file:/data/library.db
ENV PORT=4000
ENV JWT_SECRET=change-me-before-deploy
EXPOSE 4000
CMD ["npm", "start", "--prefix", "apps/api"]
