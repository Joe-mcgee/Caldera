#!/bin/bash
source ./env.sh
kubectl delete -f ${TEMPLATEPATH}/ca-deploy.yaml
kubectl delete -f ${TEMPLATEPATH}/ca-services.yaml
kubectl delete -f ${TEMPLATEPATH}/copySetupScripts.yaml
kubectl delete -f ${TEMPLATEPATH}/createPV.yaml