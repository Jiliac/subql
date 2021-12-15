# Debug Instructions

## Create new project
```bash
packages/cli/bin/run init --blockChain algorand --starter algo-proj
cd algo-proj
../packages/cli/bin/run codegen
../packages/cli/bin/run build
```

## Docker up !
Comment out lines 13-47 in project docker-compose.yml file then start postgres
```bash
docker-compose up -d
```

## Set environment variables
```bash
export DB_USER=postgres
export DB_PASS=postgres
export DB_DATABASE=postgres
export DB_HOST=localhost
export DB_PORT=5432
```

## Run the node
```bash
../packages/node/bin/run -f . --local
```