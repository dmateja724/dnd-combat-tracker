# syntax=docker/dockerfile:1.7

FROM node:20-bookworm AS base
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

FROM base AS frontend-build
RUN npm run build

FROM nginx:1.27-alpine AS frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM base AS api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "server"]
