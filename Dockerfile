FROM oven/bun:1 as builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Start a new stage for the runtime
FROM oven/bun:1-slim

WORKDIR /app

# Copy the built executable from builder stage
COPY --from=builder /app/dist/slack_search_function_mcp ./slack_search_function_mcp

# Make the executable runnable
RUN chmod +x ./slack_search_function_mcp

# Set environment variables
ENV NODE_ENV=production

# Run the MCP server
CMD ["./slack_search_function_mcp"]
