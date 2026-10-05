BINARY := server

.PHONY: all vet test build clean run

all: build

vet:
	go vet ./...

test: vet
	go test -race ./...

build: test
	go build -o $(BINARY) ./cmd/server

run:
	go run ./cmd/server

clean:
	rm -f $(BINARY)
