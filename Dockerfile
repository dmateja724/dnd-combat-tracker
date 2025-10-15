# syntax=docker/dockerfile:1.7

ARG APP_VERSION=dev

FROM node:20-bookworm AS base
ARG APP_VERSION
WORKDIR /app
ENV APP_VERSION=${APP_VERSION}
ENV VITE_APP_VERSION=${APP_VERSION}

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

FROM base AS frontend-build
RUN npm run build

FROM nginx:1.27-alpine AS frontend
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.version=$APP_VERSION
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM base AS api
ARG APP_VERSION
ENV NODE_ENV=production
ENV APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.version=$APP_VERSION
EXPOSE 4000
CMD ["npm", "run", "server"]
