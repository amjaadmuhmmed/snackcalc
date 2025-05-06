# Use the official Node.js 18 image as the base image
# Using -alpine for a smaller image size
FROM node:18-alpine AS base

# Set the working directory in the container
WORKDIR /app

# Install dependencies based on the preferred package manager
# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# If you use yarn, uncomment the next line and comment out the npm line
# COPY yarn.lock ./

# Install dependencies
# Use --omit=dev to skip installing devDependencies in the final image
RUN npm install --omit=dev
# If you use yarn, uncomment the next line and comment out the npm line
# RUN yarn install --production --frozen-lockfile

# Copy the rest of the application code to the container
# Including .env file if needed for build time, but preferably use runtime env vars
COPY . .

# Build the Next.js application for production
RUN npm run build

# Expose the port the app runs on (default is 3000)
EXPOSE 3000

# Set the NODE_ENV to production
ENV NODE_ENV production

# Command to run the Next.js production server
# Use "node server.js" if you have a custom server file
# Use "next start" for the default Next.js server
CMD ["npm", "start"]
