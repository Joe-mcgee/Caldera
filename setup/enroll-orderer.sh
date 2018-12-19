#!/bin/bash
echo $BOOTSTRAP_USER_PASS
fabric-ca-client enroll -d -u http://${BOOTSTRAP_USER_PASS}@0.0.0.0:7054
fabric-ca-client register -d --id.name orderer-org --id.secret orderer-orgpw --id.type orderer
fabric-ca-client register -d --id.name admin-orderer-org --id.secret admin-orderer-orgpw --id.attrs "admin=true:ecert"
