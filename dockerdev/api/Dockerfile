FROM node:8

ENV PORT 3000
ENV DOCKER_SOCKET_PATH /host/var/run/docker.sock
ENV DOCKER_CCENV_IMAGE hyperledger/fabric-ccenv:x86_64-1.1.0

RUN mkdir /app
COPY . /app
WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "run", "serve"]
