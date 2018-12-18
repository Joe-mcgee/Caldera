#!/bin/bash
SDIR=$(dirname "$0")
source $SDIR/env.sh

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

function main {
	runCreateVolume $PVNAME $PVCNAME
	copySetupScripts
	createCaServices
	deployCA
}

main