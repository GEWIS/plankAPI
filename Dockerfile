FROM node:22-alpine AS base
ENV NODE_ENV=development
ENV YARN_VERSION=4.5.1
RUN corepack enable && corepack prepare yarn@${YARN_VERSION}
RUN apk add git

FROM base AS builder
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
# COPY .yarn ./.yarn
RUN yarn install --immutable

COPY ./src ./src
COPY ./tsconfig.json ./

RUN yarn build

FROM node:alpine AS runner

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY ./cronjob /etc/crontabs/root
RUN touch /var/log/cron.log

CMD ["sh", "-c", "crond && tail -f /var/log/cron.log"]