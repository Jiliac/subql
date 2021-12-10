# Debug Instructions

## Create new project
packages/cli/bin/run init --blockChain algorand
packages/cli/bin/run codegen
packages/cli/bin/run build

## Comment out lines 13-47 in project docker-compose.yml file then start postgres
docker-compose up -d

## Set environment variables
export DB_USER=postgres
export DB_PASS=postgres
export DB_DATABASE=postgres
export DB_HOST=localhost
export DB_PORT=5432

## Run the node
../packages/node/bin/run -f .

## Notes:

### Methods invoked:
chain_getBlockHash

state_getRuntimeVersion

system_chain

system_properties

rpc_methods

state_getMetadata

### Event subscriptions:
connected

disconnected

error