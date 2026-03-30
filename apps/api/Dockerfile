FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm install
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3002
CMD ["npm", "run", "start"]
