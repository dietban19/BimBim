# syntax=docker/dockerfile:1

# All dependencies are installed while the image is built, so containers
# created from any stage below run without network access.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Development server with hot reload. Mount ./src to edit from the host:
#   docker build --target dev -t bim-starter:dev .
#   docker run --rm -p 5173:5173 -v "$PWD/src:/app/src" bim-starter:dev
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Type-check, test and produce the production bundle.
FROM deps AS build
COPY . .
RUN npm test && npm run build

# Serves the built bundle (default target):
#   docker build -t bim-starter .
#   docker run --rm -p 4173:4173 bim-starter
FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json /app/vite.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
