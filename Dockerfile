FROM node:alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN apk add --no-cache git
RUN yarn install --frozen-lockfile


FROM node:alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package.json yarn.lock ./
COPY . .

COPY ./cronjob /etc/crontabs/root

CMD ["sh", "-c", "crond && tail -f /dev/null"]