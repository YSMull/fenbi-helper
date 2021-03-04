FROM hub.c.163.com/yddocker/youdata-runtime:node-12

ENV npm_config_disturl=https://npm.taobao.org/mirrors/node

WORKDIR /www

COPY package.json /www

RUN npm install --production --verbose

COPY . /www

CMD ["node", "src/app.js"]
