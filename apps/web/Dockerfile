FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
RUN npm install
COPY apps/web ./apps/web
WORKDIR /app/apps/web
ARG NEXT_PUBLIC_API_URL=http://localhost:3002
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
