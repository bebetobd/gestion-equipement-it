FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY index.html ./
COPY src/ src/
COPY public/ public/
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server/ server/
COPY --from=build /app/dist dist/
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/server.js"]
