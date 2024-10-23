FROM denoland/deno:alpine

WORKDIR /app

COPY . .

# Install any dependencies (if applicable)
RUN deno cache --unstable --lock=lock.json main.ts

# Copy the cron job definition
COPY ./cronjob /etc/crontabs/root


CMD ["sh", "-c", "crond && tail -f /dev/null"]