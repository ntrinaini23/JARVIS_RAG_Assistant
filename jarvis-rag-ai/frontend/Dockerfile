# Stage 1: Build React Application
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

# Install dependencies using legacy peer deps to bypass React 19 constraints
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Copy default nginx configuration if customized, otherwise default is fine
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
