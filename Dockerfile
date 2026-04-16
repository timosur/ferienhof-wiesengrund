FROM node:20-alpine AS build

RUN apk add --no-cache hugo

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN hugo --minify

FROM nginx:alpine
COPY --from=build /app/public /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
