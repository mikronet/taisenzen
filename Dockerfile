FROM node:22-alpine

WORKDIR /app

# Instalar dependencias del servidor
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Instalar y compilar cliente
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Copiar servidor
COPY server/ ./server/
COPY .env* ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Volumen para persistir la base de datos
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
