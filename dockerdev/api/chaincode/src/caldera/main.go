package main

import (
	"encoding/json"
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

type SmartContract struct{}

type Message struct {
	Message string
}

var calderaFunctions = map[string]func(shim.ChaincodeStubInterface, []string) pb.Response{
	"test_invoke": testInvoke,
}

func (c *SmartContract) Init(stub shim.ChaincodeStubInterface) pb.Response {
	return shim.Success(nil)
}

func (c *SmartContract) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()

	calderaFunction := calderaFunctions[function]
	if calderaFunction == nil {
		return shim.Error("Invalid Function")
	}

	return calderaFunction(stub, args)
}

func testInvoke(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 1 {
		return shim.Error("Invalid arg count")
	}
	responseAsBytes, _ := json.Marshal(Message{"Cool Bananas"})

	return shim.Success(responseAsBytes)

}

func main() {
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error starting Chaincode: %s", err)
	}
}
