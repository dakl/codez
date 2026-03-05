.PHONY: dev build lint format test test-watch test-e2e build-release clean

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

format:
	npm run format

test:
	npm test

test-watch:
	npm run test:watch

test-e2e:
	npm run test:e2e

build-release: test build
	npx electron-builder --mac --arm64 --publish never

clean:
	rm -rf dist release
