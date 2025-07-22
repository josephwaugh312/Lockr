# Use Node.js 18 LTS
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and npmrc
COPY package*.json .npmrc ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy configuration files
COPY next.config.js tsconfig.json tailwind.config.js postcss.config.js jest.config.js next-env.d.ts ./

# Copy source code and public directory
COPY src ./src
COPY public ./public

# Build Next.js app
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

# Set working directory
WORKDIR /app

# Copy package files and npmrc
COPY package*.json .npmrc ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Change to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 