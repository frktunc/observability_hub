# Stage 1: Build the Go binary
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum files
COPY go.mod go.sum ./
# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod download

# Copy the source code
COPY . .

# Build the Go app
# -ldflags="-w -s" reduces the size of the binary by removing debug information
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /collector ./cmd/collector


# Stage 2: Create the final, minimal image
FROM alpine:latest

# It's a good practice to run containers as a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /home/appuser

# Copy the pre-built binary from the builder stage
COPY --from=builder /collector .

# Expose ports for metrics/health
EXPOSE 8081
EXPOSE 9090

# Command to run the executable
CMD ["./collector"] 