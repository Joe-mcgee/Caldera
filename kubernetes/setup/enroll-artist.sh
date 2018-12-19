#!/bin/bash
echo $BOOTSTRAP_USER_PASS
fabric-ca-client enroll -d -u http://${BOOTSTRAP_USER_PASS}@0.0.0.0:7054
fabric-ca-client register -d --id.name artist-org --id.secret artist-orgpw --id.type peer
fabric-ca-client register -d --id.name admin-artist-org --id.secret admin-artist-orgpw --id.attrs "hf.Registrar.Roles=client,hf.Registrar.Attributes=*,hf.Revoker=true,hf.GenCRL=true,admin=true:ecert,abac.init=true:ecert"
fabric-ca-client register -d --id.name user-artist-org --id.secret user-artist-orgpw
fabric-ca-client getcacert -d -u http://0.0.0.0:7054 -M /shared/orgs/artist-org/msp