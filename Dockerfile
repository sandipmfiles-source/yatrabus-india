FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build
RUN mkdir -p /data

ENV NODE_ENV=production
ENV TS_NODE_TRANSPILE_ONLY=true
ENV PORT=5000
ENV YATRIBUS_DATA_FILE=/data/yatribus-store.json

EXPOSE 5000
CMD ["npm", "run", "server"]
