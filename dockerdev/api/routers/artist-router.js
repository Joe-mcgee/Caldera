const express = require('express')
const router = express.Router()
const artistClient = require("../clients/initialize").artistClient
const config = require("../config")

async function test() {
	try {
		let response = await artistClient.invoke(
			config.chaincodeId,
			config.chaincodeVersion,
			"test_invoke",
			{})
		return response
	} catch (e) {
		throw e
	}
}
module.exports = () => {

	router.post('/test', async (req, res) => {
		let response = await test()
		res.json(response)
	})
	return router
}