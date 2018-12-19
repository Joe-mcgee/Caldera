#!/bin/bash

set -e

fabric-ca-client enroll -d -u http://orderer-org-peer:orderer-orgpeerpw@orderer-ca-client:7054 -M /etc/hyperledger/orderer/msp
orderer