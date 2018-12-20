#!/bin/bash
docker rmi $(docker images | grep "^<none>" | awk "{print $3}")
rm -rf ./api/certs

mkdir ./api/certs

cp ./data/orgs/artist-org/admin/msp/keystore/* ./api/certs/Admin@artist-org-key.pem
cp ./data/orgs/artist-org/admin/msp/signcerts/* ./api/certs/Admin@artist-org-cert.pem
cp ./data/tls/peer1-artist-org-client.key ./api/certs/peer1-artist-org-client.key
cp ./data/tls/peer1-artist-org-client.crt ./api/certs/peer1-artist-org-client.crt

cp ./data/orgs/archive-org/admin/msp/keystore/* ./api/certs/Admin@archive-org-key.pem
cp ./data/orgs/archive-org/admin/msp/signcerts/* ./api/certs/Admin@archive-org-cert.pem
cp ./data/tls/peer1-archive-org-client.key ./api/certs/peer1-archive-org-client.key
cp ./data/tls/peer1-archive-org-client.crt ./api/certs/peer1-archive-org-client.crt




cp ./data/caldera.tx ./api

cp ./data/artist-org-ca-cert.pem ./api/certs/artist-org-ca-cert.pem
cp ./data/archive-org-ca-cert.pem ./api/certs/archive-org-ca-cert.pem
cp ./data/orderer-org-ca-cert.pem ./api/certs/orderer-org-ca-cert.pem

docker build -t caldera-api:latest ./api
docker-compose -f compose/docker-compose-api.yaml up