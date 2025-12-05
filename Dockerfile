# Use Node.js 20
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

# Default container command: start the web server (Express app)
# Render or other platforms can still override this to run the worker.
# Use `npm run worker` or `node src/worker-final.js` to run the background worker.
CMD ["npm","start"]
