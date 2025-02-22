FROM node:23-alpine

WORKDIR /root/app

COPY package*.json ./
RUN npm install

COPY . .

CMD [ "npm", "run", "prod" ]