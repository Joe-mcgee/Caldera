#!/bin/bash
SDIR=$(dirname "$0")
source $SDIR/env.sh
eval $(minikube docker-env)
function runCreateVolume {
	local pvName="$1" pvcName="$2"
	echo -e "\nCreating Volume"

	if [ "$(kubectl get pvc) | grep $pvcName | awk '{print $2}'" != "Bound" ]; then
		echo "Peristent claim does not yet exist"
		echo "Running create on createPV.yaml"
		kubectl create -f ${TEMPLATEPATH}/createPV.yaml
		sleep 5
		if [ "kubectl get pvc | grep $pvcName | awk '{print $3}'" != "$pvName" ]; then
			echo "$pvName created"
		else
			echo "Failed to created $pvName"
		fi
	else
		echo "$pvName exists, not recreating"
	fi
}

function copySetupScripts {
	echo -e "/nCopying setup scripts to shared volume"
	kubectl create -f ${TEMPLATEPATH}/copySetupScripts.yaml

	pod=$(kubectl get pods --selector=job-name=copyscripts --output=jsonpath={.items..metadata.name})
	podStatus=$(kubectl get pods --selector=job-name=copyscripts --output=jsonpath={.items..phase})
	while [ "${podSTATUS}" != "Running" ]; do
	    echo "Waiting for container of copy script pod to run. Current status of ${pod} is ${podSTATUS}"
	    sleep 5;
	    if [ "${podSTATUS}" == "Error" ]; then
	        echo "There is an error in copyscripts job. Please check logs."
	        exit 1
	    fi
	    podSTATUS=$(kubectl get pods --selector=job-name=copyscripts --output=jsonpath={.items..phase})
	done

	echo -e "${pod} is now ${podSTATUS}"
	kubectl cp ./setup $pod:/shared/

	echo "Waiting for 10 more seconds for copying scripts to avoid any network delay"
	sleep 10
	JOBSTATUS=$(kubectl get jobs |grep "copyscripts" |awk '{print $3}')
	while [ "${JOBSTATUS}" != "1" ]; do
	    echo "Waiting for copyscripts job to complete"
	    sleep 1;
	    PODSTATUS=$(kubectl get pods | grep "copyscripts" | awk '{print $3}')
	        if [ "${PODSTATUS}" == "Error" ]; then
	            echo "There is an error in copyscripts job. Please check logs."
	            exit 1
	        fi
	    JOBSTATUS=$(kubectl get jobs |grep "copyscripts" |awk '{print $3}')
	done
	echo "Copy scripts job completed"
}

function createCaServices {
	echo -e "\nCreating Certificate Authority Services"
	kubectl create -f ${TEMPLATEPATH}/ca-services.yaml

	echo -e "\nCreating new Deployment for CA"
}

function deployCA {
	kubectl create -f ${TEMPLATEPATH}/ca-deploy.yaml
	NUMPENDING=$(kubectl get deployments | grep blockchain | awk '{print $5}' | grep 0 | wc -l | awk '{print $1}')
	while [ "${NUMPENDING}" != "0" ]; do
	    echo "Waiting on pending deployments. Deployments pending = ${NUMPENDING}"
	    NUMPENDING=$(kubectl get deployments | grep blockchain | awk '{print $5}' | grep 0 | wc -l | awk '{print $1}')
	    sleep 1
	done
}

function fabricCryptogen {
	ORDERERCA=$(kubectl get pods | grep ordererca | awk '{print $1}')
	kubectl exec -it $ORDERERCA -- bash -c "mkdir -p /shared/orgs"
	kubectl exec -it $ORDERERCA -- bash -c "/shared/setup/enroll-orderer.sh"
	kubectl exec -it $ORDERERCA -- bash -c "mkdir -p /shared/orgs/orderer-org/msp/admincerts"
	kubectl exec -it $ORDERERCA -- bash -c "cp /etc/hyperledger/fabric-ca/msp/signcerts/* /shared/orgs/orderer-org/msp/admincerts"
	ARTISTCA=$(kubectl get pods | grep artistca | awk '{print $1}')
	kubectl exec -it $ARTISTCA -- bash -c "/shared/setup/enroll-artist.sh"
	kubectl exec -it $ARTISTCA -- bash -c "mkdir -p /shared/orgs/artist-org/msp/admincerts"
	kubectl exec -it $ARTISTCA -- bash -c "cp /etc/hyperledger/fabric-ca/msp/signcerts/* /shared/orgs/artist-org/msp/admincerts"
	ARCHIVECA=$(kubectl get pods | grep archiveca | awk '{print $1}')
	kubectl exec -it $ARCHIVECA -- bash -c "/shared/setup/enroll-archive.sh"
	kubectl exec -it $ARCHIVECA -- bash -c "mkdir -p /shared/orgs/archive-org/msp/admincerts"
	kubectl exec -it $ARCHIVECA -- bash -c "cp /etc/hyperledger/fabric-ca/msp/signcerts/* /shared/orgs/archive-org/msp/admincerts"
}

function generateArtifacts {
	kubectl create -f ${TEMPLATEPATH}/configtxlator-job.yaml
	JOBSTATUS=$(kubectl get jobs | grep utils | awk '{print $3}')
	while [ "${JOBSTATUS}" != "1" ]; do
		sleep 1;
		UTILSSTATUS=$(kubectl get pods | grep "utils" | awk '{print $3}')
		if [ "${UTILSSTATUS}" == "Error" ]; then
			echo "There is an error"
			exit 1
		fi
	JOBSTATUS=$(kubectl get jobs | grep utils | awk '{print $3}')
	done
}

function createPeerServices {
	echo -e "\nCreating orderer and peer services"
	kubectl create -f ${TEMPLATEPATH}/peer-services.yaml
}

function deployPeers {
	docker build -t hyperledger/fabric-ca-orderer:1.3.0 - < ./dockerfiles/fabric-ca-orderer.dockerfile
	kubectl create -f ${TEMPLATEPATH}/peer-deploy.yaml
	NUMPENDING=$(kubectl get deployments | grep blockchain | awk '{print $5}' | grep 0 | wc -l | awk '{print $1}')
	while [ "${NUMPENDING}" != "0" ]; do
	    echo "Waiting on pending deployments. Deployments pending = ${NUMPENDING}"
	    NUMPENDING=$(kubectl get deployments | grep blockchain | awk '{print $5}' | grep 0 | wc -l | awk '{print $1}')
	    sleep 1
	done
}

function main {
	runCreateVolume $PVNAME $PVCNAME
	copySetupScripts
	createCaServices
	deployCA
	fabricCryptogen
	generateArtifacts
	deployPeers
}

main